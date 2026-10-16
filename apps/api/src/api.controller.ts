import { All, Controller, Get, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { Database, Row, Actor } from './core/db';
import { Contract } from './core/contract';
import { Routes, Context } from './core/registry';
import { assert } from './core/errors';
import { AuthService } from './auth/auth.service';
import { CatalogService } from './catalog/catalog.service';
import { CustomerService } from './commerce/customer.service';
import { OrdersService } from './commerce/orders.service';
import { DocumentsService } from './inventory/documents.service';
import { ReportsService } from './reports/reports.service';
import { FilesService, Download } from './files/files.service';

@Controller()
export class ApiController {
  readonly contract=new Contract();
  private readonly routes=new Routes();
  constructor(@Inject(Database)private readonly db:Database,@Inject(AuthService)private readonly auth:AuthService,@Inject(CatalogService)catalog:CatalogService,@Inject(CustomerService)customers:CustomerService,@Inject(OrdersService)orders:OrdersService,@Inject(DocumentsService)documents:DocumentsService,@Inject(ReportsService)reports:ReportsService,@Inject(FilesService)files:FilesService){
    for(const service of [auth,catalog,customers,orders,documents,reports,files])service.registerRoutes(this.routes);
    const implemented=new Set(this.routes.entries.keys());
    for(const route of this.contract.routes){const key=`${route.method} ${route.path}`;assert(implemented.delete(key),'INTERNAL_ERROR',`Missing handler: ${key}`,500);}
    assert(!implemented.size,'INTERNAL_ERROR',`Undocumented endpoints: ${[...implemented].join(', ')}`,500);
  }
  @Get('health') health(){return {data:{status:'ok'}};}
  @Get('ready') async ready(){await this.db.one('SELECT 1 AS ready');await this.db.one('SELECT id FROM pgmigrations ORDER BY id DESC LIMIT 1');return {data:{status:'ready'}};}
  @All('{*path}') async handle(@Req()req:Request,@Res()res:Response):Promise<void>{
    const path=req.path.replace(/^\/api\/v1/,'')||'/';
    const route=this.contract.routes.find(r=>r.method===req.method&&r.regex.test(path));
    assert(route,'NOT_FOUND','Không tìm thấy API.',404);
    res.locals.routeTemplate=route.path;
    const endpoint=this.routes.entries.get(`${route.method} ${route.path}`)!;
    const match=route.regex.exec(path)!;
    const params=Object.fromEntries(route.keys.map((key,i)=>[key,decodeURIComponent(match[i+1])]));
    const query:Row={...req.query};
    this.contract.validate(route.params,params);this.contract.validate(route.query,query);this.contract.validate(route.headers,{...req.headers});
    const body:Row=req.body||{};
    if(route.body)this.contract.validate(route.body,body);
    let actor:Actor|undefined;
    if(!endpoint.public){
      actor=await this.auth.authenticate(req.headers.authorization);
      if(endpoint.customer)assert(actor.realm==='CUSTOMER'&&actor.customerId,'FORBIDDEN','Chỉ dành cho tài khoản khách hàng.',403);
      if(route.path.startsWith('/admin'))assert(actor.realm==='STAFF'&&actor.employeeId,'FORBIDDEN','Chỉ dành cho nhân viên.',403);
      if(endpoint.permission)assert(actor.permissions.includes(endpoint.permission),'FORBIDDEN','Bạn không có quyền thực hiện thao tác này.',403);
    }
    const context:Context={params,query,body,actor:actor as Actor,req,res};
    const mutating=req.method!=='GET'&&req.method!=='HEAD';
    const execute=async():Promise<unknown>=>{
      const key=req.get('Idempotency-Key');
      if(key&&actor&&mutating&&!route.path.startsWith('/auth/')){
        assert(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key),'VALIDATION_ERROR','Idempotency-Key phải là UUID hợp lệ.',400);
        const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
        const fingerprint=createHash('sha256').update(JSON.stringify(canonical({method:req.method,path,body}))).digest('hex');
        await this.db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${actor.accountId}:${key}`]);
        const existing=(await this.db.query('SELECT * FROM idempotency_keys WHERE account_id=$1 AND key=$2',[actor.accountId,key]))[0];
        if(existing){assert(existing.fingerprint===fingerprint,'IDEMPOTENCY_CONFLICT','Khóa thao tác đã dùng cho nội dung khác.');res.setHeader('Idempotency-Replayed','true');return existing.responseBody;}
        const result=await endpoint.handler(context);
        const payload=this.envelope(result,route.status);
        if(process.env.VALIDATE_RESPONSES==='true'&&route.status!==204)this.contract.validateResponse(route,payload);
        await this.db.insert('idempotency_keys',{accountId:actor.accountId,key,fingerprint,responseBody:JSON.stringify(payload),statusCode:route.status});
        return payload;
      }
      const payload=this.envelope(await endpoint.handler(context),route.status);
      if(process.env.VALIDATE_RESPONSES==='true'&&route.status!==204&&!(payload instanceof Download))this.contract.validateResponse(route,payload);
      return payload;
    };
    // Authentication manages its own transaction boundaries (refresh replay revocation must commit).
    const payload=mutating&&!route.path.startsWith('/auth/')?await this.db.transaction(execute):await execute();
    if(payload instanceof Download){res.type(payload.contentType);res.attachment(payload.filename);res.status(route.status).send(payload.buffer);return;}
    if(route.status===204){res.status(204).end();return;}
    res.status(route.status).json(payload);
  }
  private envelope(value:unknown,status:number):unknown{
    if(status===204||value instanceof Download)return value;
    if(value&&typeof value==='object'&&'data' in value)return value;
    return {data:value};
  }
}
