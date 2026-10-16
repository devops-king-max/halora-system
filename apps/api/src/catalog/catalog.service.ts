import { Inject, Injectable } from '@nestjs/common';
import { Database, Row, ident, snake, pagination, pageResult } from '../core/db';
import { Context, Routes } from '../core/registry';
import { assert, fail, version } from '../core/errors';
import { AuthService, hashPassword } from '../auth/auth.service';

interface Resource {
  path: string; table: string; view?: string; fields: string[]; search: string[]; permission: string;
  parent?: { param: string; column: string; table: string }; readOnly?: boolean; array?: boolean; filters?: string[];
}
const definitions: Resource[] = [
  {path:'categories',table:'categories',fields:['name','description','status'],search:['code','name'],permission:'categories'},
  {path:'brands',table:'brands',fields:['name','description','status'],search:['code','name'],permission:'brands'},
  {path:'products',table:'products',fields:['name','slug','categoryId','brandId','description','ingredients','benefits','isFeatured','status'],search:['code','name'],permission:'products',filters:['categoryId','brandId','isFeatured']},
  {path:'products/{productId}/variants',table:'product_variants',view:'api_variants',fields:['sku','name','color','volumeMl','weightGrams','salePrice','referenceCostPrice','lowStockThreshold','status'],search:['sku','name'],permission:'products',parent:{param:'productId',column:'productId',table:'products'}},
  {path:'products/{productId}/images',table:'product_images',view:'api_images',fields:['mediaId','variantId','altText','sortOrder'],search:[],permission:'products',array:true,parent:{param:'productId',column:'productId',table:'products'}},
  {path:'employees',table:'employees',view:'api_employees',fields:['fullName','phone','email','position','status'],search:['code','fullName','phone','email'],permission:'employees'},
  {path:'customers',table:'customers',view:'api_customers',fields:['fullName','phone','status'],search:['code','fullName','phone','email'],permission:'customers',filters:['accountStatus']},
  {path:'accounts',table:'accounts',view:'api_accounts',fields:['status'],search:['username','email'],permission:'accounts',filters:['realm']},
  {path:'suppliers',table:'suppliers',fields:['name','contactName','phone','email','address','status'],search:['code','name','phone','email'],permission:'suppliers'},
  {path:'suppliers/{supplierId}/variants',table:'supplier_variants',view:'api_supplier_variants',fields:['variantId','quotedCostPrice','status'],search:['sku','productName','variantName'],permission:'suppliers',parent:{param:'supplierId',column:'supplierId',table:'suppliers'}},
  {path:'promotions',table:'promotions',view:'api_promotions',fields:['name','description','startsAt','endsAt','status'],search:['code','name'],permission:'promotions'},
  {path:'promotions/{promotionId}/product-rules',table:'product_promotion_rules',fields:['productId','variantId','discountPercent','minQuantity','maxDiscountAmount'],search:[],permission:'promotions',parent:{param:'promotionId',column:'promotionId',table:'promotions'}},
  {path:'promotions/{promotionId}/order-rules',table:'order_promotion_rules',fields:['minOrderAmount','discountPercent','maxDiscountAmount'],search:[],permission:'promotions',parent:{param:'promotionId',column:'promotionId',table:'promotions'}},
  {path:'promotions/{promotionId}/vouchers',table:'vouchers',view:'api_vouchers',fields:['code','discountPercent','minOrderAmount','maxDiscountAmount','maxUses','perCustomerLimit','status'],search:['code'],permission:'promotions',parent:{param:'promotionId',column:'promotionId',table:'promotions'}},
];
@Injectable()
export class CatalogService {
  constructor(@Inject(Database) private readonly db: Database,@Inject(AuthService) private readonly auth: AuthService) {}
  async list(view: string,c: Context,search: string[],filters: string[]=[],conditions: string[]=[],initial: unknown[]=[]): Promise<unknown> {
    const args=[...initial],where=[...conditions];
    const param=(v:unknown)=>{args.push(v);return `$${args.length}`;};
    if(c.query.search && search.length){const p=param(`%${String(c.query.search).replace(/[\\%_]/g,'\\$&')}%`);where.push(`(${search.map(s=>`${ident(snake(s))}::text ILIKE ${p}`).join(' OR ')})`);}
    for(const f of filters) if(c.query[f]!==undefined) where.push(`${ident(snake(f))}=${param(c.query[f])}`);
    const timeColumn=view==='api_balances'?'updated_at':'created_at';
    if(c.query.from) where.push(`${timeColumn}>=${param(c.query.from)}::timestamptz`);
    if(c.query.to) where.push(`${timeColumn}<${param(c.query.to)}::timestamptz`);
    if(c.query.lowStockOnly===true) where.push('stock_quantity<=low_stock_threshold');
    if(view==='products'||view==='api_public_products') {
      if(c.query.minPrice!==undefined) where.push(`${view==='products'?'EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=products.id AND v.sale_price>=':'price_from>='}${param(c.query.minPrice)}${view==='products'?')':''}`);
      if(c.query.maxPrice!==undefined) where.push(`${view==='products'?'EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=products.id AND v.sale_price<=':'price_from<='}${param(c.query.maxPrice)}${view==='products'?')':''}`);
      if(c.query.inStock===true) where.push(`EXISTS(SELECT 1 FROM product_variants v JOIN inventory_balances b ON b.variant_id=v.id WHERE v.product_id=${ident(view)}.id AND v.status='ACTIVE' AND b.stock_quantity>0)`);
      if(c.query.search) { /* Product SKU search is included alongside product name. */
        const old=where.findIndex(w=>w.includes('ILIKE'));
        if(old>=0) where[old]=`(${where[old]} OR EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=${ident(view)}.id AND v.sku ILIKE $${initial.length+1}))`;
      }
    }
    const clause=where.length?` WHERE ${where.join(' AND ')}`:'';
    const {page,limit,offset}=pagination(c.query);
    const count=await this.db.one(`SELECT count(*)::integer AS total FROM ${ident(view)}${clause}`,args);
    const sort=snake(String(c.query.sortBy || (view==='api_balances'?'sku':'createdAt')));
    const allowed=new Set(['id','created_at','updated_at','code','name','full_name','sku','sort_order','sale_price','price_from','stock_quantity','product_name','total_amount','order_code','receipt_code','invoice_code','received_at','issued_at','starts_at','ends_at','username','email']);
    assert(allowed.has(sort),'VALIDATION_ERROR','Trường sắp xếp không hợp lệ.',400);
    const direction=c.query.sortOrder==='asc'?'ASC':'DESC';
    const rows=await this.db.query(`SELECT * FROM ${ident(view)}${clause} ORDER BY ${ident(sort)} ${direction}${sort==='id'?'':view==='api_balances'?',variant_id ASC':',id ASC'} LIMIT $${args.length+1} OFFSET $${args.length+2}`,[...args,limit,offset]);
    return pageResult(rows,Number(count.total),page,limit);
  }
  private async parent(resource:Resource,c:Context):Promise<void>{
    if(resource.parent) await this.db.one(`SELECT id FROM ${ident(resource.parent.table)} WHERE id=$1`,[c.params[resource.parent.param]]);
  }
  private async read(resource:Resource,c:Context):Promise<Row>{
    const args:unknown[]=[c.params.id];
    let where='id=$1';
    if(resource.parent){args.push(c.params[resource.parent.param]);where+=` AND ${ident(snake(resource.parent.column))}=$2`;}
    return this.db.one(`SELECT * FROM ${ident(resource.view||resource.table)} WHERE ${where}`,args);
  }
  private async promotionGuard(id:unknown,allowMetadata=false,body:Row={}):Promise<void>{
    const p=await this.db.one('SELECT * FROM promotions WHERE id=$1 FOR UPDATE',[id]);
    const usage=await this.db.query('SELECT id FROM order_discounts WHERE promotion_id=$1 LIMIT 1',[id]);
    if(usage.length) {
      if(allowMetadata) assert((body.startsAt===undefined||new Date(String(body.startsAt)).toISOString()===p.startsAt)&&(body.endsAt===undefined||new Date(String(body.endsAt)).toISOString()===p.endsAt),'INVALID_STATE','Không sửa thời gian chương trình đã được sử dụng.');
      else fail('INVALID_STATE','Chương trình đã sử dụng; hãy ngừng hoặc tạo chương trình mới.');
    }
  }
  private payload(r:Resource,c:Context):Row{return Object.fromEntries(r.fields.filter(f=>c.body[f]!==undefined).map(f=>[f,c.body[f]]));}
  private async save(r:Resource,c:Context,create:boolean):Promise<Row>{
    await this.parent(r,c);
    if(['employees','accounts'].includes(r.table)) await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended('halora-administrators',0))");
    if(r.table==='accounts') await this.auth.guardAdministrator(c.actor);
    if(r.parent?.table==='promotions') await this.promotionGuard(c.params.promotionId);
    if(r.table==='promotions'&&!create) await this.promotionGuard(c.params.id,true,c.body);
    let old:Row|undefined;
    if(!create){old=await this.db.one<Row>(`SELECT * FROM ${ident(r.table)} WHERE id=$1 FOR UPDATE`,[c.params.id]);await this.read(r,c);version(old,c.body.version);}
    const data=this.payload(r,c);
    if(r.parent) data[r.parent.column]=c.params[r.parent.param];
    if(r.table==='supplier_variants'&&!create&&old) assert(data.variantId===undefined||data.variantId===old.variantId,'INVALID_STATE','Không thay biến thể của liên kết cung ứng.');
    const saved=create?await this.db.insert(r.table,data):await this.db.update(r.table,c.params.id,data);
    if(r.table==='product_variants'&&create) await this.db.query('INSERT INTO inventory_balances(variant_id) VALUES($1)',[saved.id]);
    if(['employees','accounts','customers'].includes(r.table)&&!create&&old&&data.status!==undefined&&old.status!==data.status){
      const accountId=r.table==='accounts'?old.id:old.accountId;
      if(accountId) await this.auth.revoke(accountId);
      if(r.table!=='customers') await this.auth.ensureActiveAdministrator();
    }
    await this.db.audit(c.actor,create?'CREATE':'UPDATE',r.table,saved.id,c.req.get('x-request-id'));
    return this.read(r,{...c,params:{...c.params,id:String(saved.id)}});
  }
  registerRoutes(routes:Routes):void{
    for(const r of definitions){
      const path=`/admin/${r.path}`;
      routes.add('GET',path,{permission:`${r.permission}.read`},async c=>{
        await this.parent(r,c);
        const conditions:string[]=[],args:unknown[]=[];
        if(r.parent){args.push(c.params[r.parent.param]);conditions.push(`${ident(snake(r.parent.column))}=$1`);}
        if(r.array) return {data:await this.db.query(`SELECT * FROM ${ident(r.view||r.table)}${conditions.length?` WHERE ${conditions.join(' AND ')}`:''} ORDER BY sort_order,id`,args)};
        const status=['product_promotion_rules','order_promotion_rules'].includes(r.table)?[]:['status'];
        return this.list(r.view||r.table,c,r.search,[...status,...(r.filters||[])],conditions,args);
      });
      if(!r.parent) routes.add('GET',`${path}/{id}`,{permission:`${r.permission}.read`},c=>this.read(r,c));
      if(!['customers','accounts'].includes(r.table)) routes.add('POST',path,{permission:`${r.permission}.create`},c=>this.save(r,c,true));
      routes.add('PATCH',`${path}/{id}`,{permission:`${r.permission}.update`},c=>this.save(r,c,false));
      if(r.table!=='accounts') routes.add('DELETE',`${path}/{id}`,{permission:`${r.permission}.delete`},async c=>{
        if(r.parent?.table==='promotions') await this.promotionGuard(c.params.promotionId);
        if(r.table==='promotions') await this.promotionGuard(c.params.id);
        const found=await this.read(r,c);
        if(r.table==='employees') await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended('halora-administrators',0))");
        if(r.table==='product_variants') await this.db.query('DELETE FROM inventory_balances WHERE variant_id=$1 AND stock_quantity=0 AND NOT EXISTS(SELECT 1 FROM stock_movements WHERE variant_id=$1)',[found.id]);
        await this.db.query(`DELETE FROM ${ident(r.table)} WHERE id=$1`,[found.id]);
        if(r.table==='employees') {
          if(found.accountId){await this.db.update('accounts',found.accountId,{status:'INACTIVE'});await this.auth.revoke(found.accountId);}
          await this.auth.ensureActiveAdministrator();
        }
        if(r.table==='customers') await this.db.query('DELETE FROM accounts WHERE id=$1',[found.accountId]);
        await this.db.audit(c.actor,'DELETE',r.table,found.id,c.req.get('x-request-id'));
        return undefined;
      });
    }
    for(const table of ['categories','brands']) routes.add('GET',`/${table}`,{public:true},c=>this.list(table,c,['code','name'],[],["status='ACTIVE'"]));
    routes.add('GET','/products',{public:true},c=>this.list('api_public_products',c,['code','name'],['categoryId','brandId','isFeatured']));
    routes.add('GET','/products/{id}',{public:true},async c=>{
      const p=await this.db.one('SELECT * FROM api_public_products WHERE id=$1',[c.params.id]);
      const info=await this.db.one('SELECT description,ingredients,benefits FROM products WHERE id=$1',[c.params.id]);
      const variants=await this.db.query("SELECT id,product_id,sku,name,color,volume_ml,weight_grams,sale_price,stock_quantity,status FROM api_variants WHERE product_id=$1 AND status='ACTIVE' ORDER BY created_at,id",[c.params.id]);
      const images=await this.db.query('SELECT * FROM api_images WHERE product_id=$1 ORDER BY sort_order,id',[c.params.id]);
      return {...p,...info,variants,images};
    });
    routes.add('GET','/admin/roles',{permission:'roles.read'},async()=>({data:await this.db.query('SELECT * FROM api_roles ORDER BY code')}));
    routes.add('GET','/admin/permissions',{permission:'permissions.read'},async()=>({data:await this.db.query('SELECT * FROM permissions ORDER BY code')}));
    routes.add('PATCH','/admin/roles/{id}/permissions',{permission:'roles.update'},async c=>{
      await this.auth.guardAdministrator(c.actor);
      await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended('halora-administrators',0))");
      const role=await this.db.one('SELECT * FROM roles WHERE id=$1 FOR UPDATE',[c.params.id]);version(role,c.body.version);
      assert(!['ADMIN','CUSTOMER'].includes(String(role.code)),'FORBIDDEN','Không sửa quyền của vai trò hệ thống này.',403);
      await this.db.query('DELETE FROM role_permissions WHERE role_id=$1',[role.id]);
      for(const id of [...new Set(c.body.permissionIds as string[])].sort()) await this.db.query('INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2)',[role.id,id]);
      await this.db.query('UPDATE roles SET name=name WHERE id=$1',[role.id]);
      const accounts=await this.db.query('SELECT account_id FROM employees e JOIN employee_roles er ON er.employee_id=e.id WHERE er.role_id=$1 AND e.account_id IS NOT NULL',[role.id]);
      for(const a of accounts) await this.auth.revoke(a.accountId);
      await this.db.audit(c.actor,'ASSIGN_PERMISSIONS','role',role.id);
      return this.db.one('SELECT * FROM api_roles WHERE id=$1',[role.id]);
    });
    routes.add('PUT','/admin/employees/{id}/roles',{permission:'employees.assignRoles'},async c=>{
      await this.auth.guardAdministrator(c.actor);
      await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended('halora-administrators',0))");
      const employee=await this.db.one('SELECT * FROM employees WHERE id=$1 FOR UPDATE',[c.params.id]);version(employee,c.body.version);
      await this.db.query('DELETE FROM employee_roles WHERE employee_id=$1',[employee.id]);
      for(const id of [...new Set(c.body.roleIds as string[])].sort()){
        const role=await this.db.one('SELECT code FROM roles WHERE id=$1',[id]);assert(role.code!=='CUSTOMER','VALIDATION_ERROR','Vai trò khách hàng không được gán cho nhân viên.',400);
        await this.db.query('INSERT INTO employee_roles(employee_id,role_id) VALUES($1,$2)',[employee.id,id]);
      }
      await this.db.query('UPDATE employees SET full_name=full_name WHERE id=$1',[employee.id]);
      if(employee.accountId) await this.auth.revoke(employee.accountId);
      await this.auth.ensureActiveAdministrator();
      await this.db.audit(c.actor,'ASSIGN_ROLES','employee',employee.id);
      return this.db.one('SELECT * FROM api_employees WHERE id=$1',[employee.id]);
    });
    routes.add('POST','/admin/employees/{id}/account',{permission:'employees.createAccount'},async c=>{
      await this.auth.guardAdministrator(c.actor);
      const e=await this.db.one('SELECT * FROM employees WHERE id=$1 FOR UPDATE',[c.params.id]);
      assert(!e.accountId&&e.status==='ACTIVE','INVALID_STATE','Nhân viên đã có tài khoản hoặc không hoạt động.');
      const account=await this.db.insert('accounts',{realm:'STAFF',username:String(c.body.username).trim(),email:String(c.body.email).trim().toLowerCase(),passwordHash:await hashPassword(c.body.password)});
      await this.db.update('employees',e.id,{accountId:account.id});
      await this.db.audit(c.actor,'CREATE_ACCOUNT','employee',e.id);
      return this.db.one('SELECT * FROM api_accounts WHERE id=$1',[account.id]);
    });
  }
}
