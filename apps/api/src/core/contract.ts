import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import Ajv, { AnySchemaObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { root } from './config';
import { AppError, assert } from './errors';
import { Row } from './db';

type Schema = Record<string,unknown> & { type?:string|string[]; $ref?:string; properties?:Record<string,Schema>; allOf?:Schema[]; items?:Schema; required?:string[]; enum?:unknown[]; nullable?:boolean; additionalProperties?:boolean|Schema; };
interface Parameter { $ref?:string;name:string;in:string;required?:boolean;schema?:Schema; }
interface Operation { parameters?:Parameter[];requestBody?:{required?:boolean;content:Record<string,{schema?:Schema}>};responses:Record<string,{$ref?:string;content?:Record<string,{schema?:Schema}>}>; }
interface Document { paths:Record<string,Record<string,Operation>>;components:{schemas:Record<string,Schema>;parameters:Record<string,Parameter>;responses:Record<string,Operation['responses'][string]>}; }
export interface ContractRoute { method:string;path:string;regex:RegExp;keys:string[];operation:Operation;status:number;body?:ValidateFunction;query:ValidateFunction;params:ValidateFunction;headers:ValidateFunction; }
export class Contract {
  readonly document=load(readFileSync(resolve(root,'docs/api/openapi.yaml'),'utf8')) as Document;
  readonly routes:ContractRoute[]=[];
  private readonly ajv=new Ajv({allErrors:true,strict:false,coerceTypes:false});
  private readonly queryAjv=new Ajv({allErrors:true,strict:false,coerceTypes:true,useDefaults:true});
  private readonly responseValidators=new Map<string,ValidateFunction>();
  constructor(){
    addFormats(this.ajv);addFormats(this.queryAjv);
    for(const [path,methods] of Object.entries(this.document.paths))for(const [method,operation]of Object.entries(methods)){
      if(!['get','post','put','patch','delete'].includes(method))continue;
      const keys:string[]=[];
      const regex=new RegExp('^'+path.split('/').map(segment=>segment.startsWith('{')?(keys.push(segment.slice(1,-1)),'([^/]+)'):segment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/')+'/?$');
      const inputs:Record<string,Schema>={query:{type:'object',properties:{},required:[],additionalProperties:false},path:{type:'object',properties:{},required:[],additionalProperties:false},header:{type:'object',properties:{},required:[],additionalProperties:true}};
      for(const original of operation.parameters||[]){
        const p=original.$ref?this.document.components.parameters[original.$ref.split('/').pop()!]:original;
        const schema=this.flatten(p.schema||{},true);
        if(p.in==='query'&&schema.type==='object'){Object.assign(inputs.query.properties!,schema.properties);continue;}
        const target=inputs[p.in];if(!target)continue;
        const name=p.in==='header'?p.name.toLowerCase():p.name;
        target.properties![name]=schema;if(p.required)target.required!.push(name);
      }
      const media=operation.requestBody?.content['application/json'];
      const bodySchema=media?.schema?this.flatten(media.schema,true):undefined;
      if(path.endsWith('/login')&&bodySchema?.properties?.password)bodySchema.properties.password.minLength=1;
      const body=bodySchema?this.ajv.compile(bodySchema):undefined;
      const success=Object.keys(operation.responses).find(code=>/^2\d\d$/.test(code));
      this.routes.push({method:method.toUpperCase(),path,regex,keys,operation,status:Number(success||200),body,query:this.queryAjv.compile(inputs.query),params:this.ajv.compile(inputs.path),headers:this.ajv.compile(inputs.header)});
    }
    this.routes.sort((a,b)=>a.keys.length-b.keys.length||b.path.length-a.path.length);
  }
  flatten(input:Schema,request=false):Schema{
    let base:Schema={};
    if(input.$ref){const name=input.$ref.split('/').pop()!;const ref=this.document.components.schemas[name];assert(ref,'INTERNAL_ERROR',`Unknown schema ${name}`,500);base=this.flatten(ref,request);}
    const merged:Schema={...base,...input};delete merged.$ref;
    if(input.allOf){
      delete merged.allOf;
      for(const part of input.allOf){const flat=this.flatten(part,request);merged.type=flat.type||merged.type;merged.properties={...merged.properties,...flat.properties};merged.required=[...new Set([...(merged.required||[]),...(flat.required||[])])];}
    }
    if(merged.properties){
      merged.properties=Object.fromEntries(Object.entries(merged.properties).map(([key,s])=>{
        const property=this.flatten(s,request);
        if(request){
          if(['name','fullName','recipientName','recipientPhone','phone','addressLine','provinceName','wardName','sku','slug','code','reason','position','contactName'].includes(key)&&property.type==='string'){property.minLength=1;property.maxLength=key==='addressLine'||key==='reason'?2000:255;property.pattern=property.pattern||'.*\\S.*';}
          if(['description','ingredients','benefits','note'].includes(key)&&property.type==='string')property.maxLength=20000;
          if(['password','newPassword'].includes(key)){property.minLength=10;property.maxLength=128;}
          if(key==='username'){property.minLength=3;property.maxLength=64;property.pattern='^[a-zA-Z0-9_.-]+$';}
          if(key==='quantity'){property.minimum=1;property.maximum=1000000;}
          if(key==='version')property.minimum=1;
          if(['minQuantity','perCustomerLimit'].includes(key)&&property.minimum===undefined)property.minimum=0;
          if(key==='items'&&property.type==='array'){property.minItems=1;property.maxItems=100;}
          if(key.endsWith('Ids')&&property.type==='array'){const limit=typeof property.maxItems==='number'?property.maxItems:200;property.maxItems=Math.min(limit,200);property.uniqueItems=true;}
        }
        return [key,property];
      }));
      if(request&&merged.additionalProperties===undefined)merged.additionalProperties=false;
    }
    if(merged.items)merged.items=this.flatten(merged.items,request);
    if(merged.nullable&&merged.enum&&!merged.enum.includes(null))merged.enum=[...merged.enum,null];
    if(request&&input.$ref?.endsWith('/Money'))merged.maxLength=18;
    return merged;
  }
  validate(validator:ValidateFunction,data:unknown):void{
    if(validator(data))return;
    const fields:Record<string,string[]>={};
    for(const e of validator.errors||[]){const key=(e.instancePath.replace(/^\//,'').replaceAll('/','.')||String(e.params.missingProperty||e.params.additionalProperty||'request'));(fields[key]||=[]).push(e.keyword==='required'?'Trường này là bắt buộc.':'Giá trị không hợp lệ.');}
    throw new AppError(400,'VALIDATION_ERROR','Vui lòng kiểm tra dữ liệu nhập.',fields);
  }
  validateResponse(route:ContractRoute,payload:unknown):void{
    let response=route.operation.responses[String(route.status)];
    if(response.$ref)response=this.document.components.responses[response.$ref.split('/').pop()!];
    const schema=response.content?.['application/json']?.schema;
    if(schema){const key=`${route.method} ${route.path}`;let validate=this.responseValidators.get(key);if(!validate){validate=this.ajv.compile(this.flatten(schema));this.responseValidators.set(key,validate);}if(!validate(payload))throw new Error(`Response contract mismatch ${route.method} ${route.path}: ${this.ajv.errorsText(validate.errors)}`);}
  }
}
