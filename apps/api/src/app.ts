import 'reflect-metadata';
import { Module, Catch, ExceptionFilter, ArgumentsHost, HttpException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { Database } from './core/db';
import { AppError, normalizeError } from './core/errors';
import { settings } from './core/config';
import { ApiController } from './api.controller';
import { AuthService } from './auth/auth.service';
import { CatalogService } from './catalog/catalog.service';
import { CustomerService } from './commerce/customer.service';
import { PricingService } from './commerce/pricing.service';
import { OrdersService } from './commerce/orders.service';
import { StockService } from './inventory/stock.service';
import { DocumentsService } from './inventory/documents.service';
import { ReportsService } from './reports/reports.service';
import { FilesService } from './files/files.service';

@Catch()
class Errors implements ExceptionFilter {
  catch(error:unknown,host:ArgumentsHost):void{
    const response=host.switchToHttp().getResponse<Response>();
    const request=host.switchToHttp().getRequest<Request>();
    const normalized=error instanceof HttpException?new AppError(error.getStatus(),'VALIDATION_ERROR','Yêu cầu không hợp lệ.'):normalizeError(error);
    if(normalized.status===500)console.error(JSON.stringify({event:'request_failed',requestId:request.get('x-request-id'),code:(error as {code?:string}).code||'INTERNAL_ERROR',stack:error instanceof Error?error.stack?.split('\n').slice(1,5).join('\n'):undefined}));
    response.status(normalized.status).json({error:{code:normalized.code,message:normalized.message,fieldErrors:normalized.fieldErrors,requestId:request.get('x-request-id')||randomUUID()}});
  }
}
@Module({controllers:[ApiController],providers:[Database,AuthService,CatalogService,CustomerService,PricingService,OrdersService,StockService,DocumentsService,ReportsService,FilesService]})
export class AppModule{}
export async function createApp(){
  const app=await NestFactory.create(AppModule,{abortOnError:false,logger:process.env.NODE_ENV==='test'?false:['error','warn','log']});
  app.setGlobalPrefix('api/v1');
  app.use((req:Request,res:Response,next:()=>void)=>{
    const id=randomUUID(),start=Date.now();req.headers['x-request-id']=id;res.setHeader('X-Request-Id',id);
    if(process.env.NODE_ENV!=='test')res.on('finish',()=>console.log(JSON.stringify({requestId:id,method:req.method,route:res.locals.routeTemplate||req.path,status:res.statusCode,durationMs:Date.now()-start})));
    next();
  });
  app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
  app.use(cookieParser());
  app.enableCors({origin:settings.origins,credentials:true,exposedHeaders:['X-Request-Id','Idempotency-Replayed','Content-Disposition']});
  const expressApp=app.getHttpAdapter().getInstance();expressApp.set('trust proxy',process.env.TRUST_PROXY==='true'?1:false);
  const limited={windowMs:15*60*1000,standardHeaders:'draft-7' as const,legacyHeaders:false,handler:(req:Request,res:Response)=>res.status(429).json({error:{code:'RATE_LIMITED',message:'Quá nhiều yêu cầu. Vui lòng thử lại sau.',requestId:req.get('x-request-id')}})};
  app.use('/api/v1/auth',rateLimit({...limited,limit:process.env.NODE_ENV==='test'?1000:50,skip:(req:Request)=>req.method==='GET'||req.method==='HEAD'}));
  app.use('/api/v1/admin/media',rateLimit({...limited,limit:process.env.NODE_ENV==='test'?1000:100}));
  await mkdir(settings.uploadDir,{recursive:true});
  app.use('/media',express.static(settings.uploadDir,{index:false,dotfiles:'deny',maxAge:'1h'}));
  app.useGlobalFilters(new Errors());
  const spec=app.get(ApiController).contract.document;
  SwaggerModule.setup('api/docs',app,{...spec,servers:[{url:'/api/v1'}]} as unknown as OpenAPIObject);
  app.enableShutdownHooks();
  await app.init();return app;
}
