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
  {path:'brands',table:'brands',view:'api_brands',fields:['name','description','status','thumbnailMediaId'],search:['code','name'],permission:'brands'},
  {path:'products',table:'products',view:'api_products',fields:['name','slug','categoryId','brandId','description','ingredients','benefits','isFeatured','status','thumbnailMediaId'],search:['code','name'],permission:'products',filters:['categoryId','brandId','isFeatured']},
  {path:'products/{productId}/variants',table:'product_variants',view:'api_variants',fields:['sku','name','color','volumeMl','weightGrams','salePrice','referenceCostPrice','lowStockThreshold','status'],search:['sku','name'],permission:'products',parent:{param:'productId',column:'productId',table:'products'}},
  {path:'products/{productId}/images',table:'product_images',view:'api_images',fields:['mediaId','variantId','altText','sortOrder'],search:[],permission:'products',array:true,parent:{param:'productId',column:'productId',table:'products'}},
  {path:'employees',table:'employees',view:'api_employees',fields:['fullName','phone','email','position','status'],search:['code','fullName','phone','email'],permission:'employees'},
  {path:'customers',table:'customers',view:'api_customers',fields:['fullName','phone','status'],search:['code','fullName','phone','email'],permission:'customers',filters:['accountStatus']},
  {path:'accounts',table:'accounts',view:'api_accounts',fields:['status'],search:['username','email'],permission:'accounts',filters:['realm']},
  {path:'suppliers',table:'suppliers',fields:['name','contactName','phone','email','address','status'],search:['code','name','phone','email'],permission:'suppliers'},
  {path:'suppliers/{supplierId}/variants',table:'supplier_variants',view:'api_supplier_variants',fields:['variantId','quotedCostPrice','status'],search:['sku','productName','variantName'],permission:'suppliers',parent:{param:'supplierId',column:'supplierId',table:'suppliers'}},
  {path:'promotions',table:'promotions',view:'api_promotions',fields:['name','description','startsAt','endsAt','status','type'],search:['code','name'],permission:'promotions',filters:['type']},
  {path:'promotions/{promotionId}/product-rules',table:'product_promotion_rules',view:'api_product_promotion_rules',fields:['productId','variantId','discountPercent','minQuantity','maxDiscountAmount'],search:['code'],permission:'promotions',parent:{param:'promotionId',column:'promotionId',table:'promotions'}},
  {path:'promotions/{promotionId}/order-rules',table:'order_promotion_rules',view:'api_order_promotion_rules',fields:['minOrderAmount','discountPercent','maxDiscountAmount'],search:['code'],permission:'promotions',parent:{param:'promotionId',column:'promotionId',table:'promotions'}},
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
    if(view==='api_promotions') {
      if(c.query.from&&c.query.to)assert(new Date(String(c.query.from))<=new Date(String(c.query.to)),'VALIDATION_ERROR','Thời gian bắt đầu không sau thời gian kết thúc.',400);
      if(c.query.from)where.push(`ends_at>=${param(c.query.from)}::timestamptz`);
      if(c.query.to)where.push(`starts_at<=${param(c.query.to)}::timestamptz`);
      if(c.query.productId)where.push(`EXISTS(SELECT 1 FROM product_promotion_rules r WHERE r.promotion_id=api_promotions.id AND r.product_id=${param(c.query.productId)})`);
    }else{
      if(c.query.from) where.push(`${timeColumn}>=${param(c.query.from)}::timestamptz`);
      if(c.query.to) where.push(`${timeColumn}<${param(c.query.to)}::timestamptz`);
    }
    if(c.query.lowStockOnly===true) where.push('stock_quantity<=low_stock_threshold');
    if(view==='api_products'||view==='api_public_products') {
      if(c.query.minPrice!==undefined) where.push(`${view==='api_products'?'EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=api_products.id AND v.sale_price>=':'price_from>='}${param(c.query.minPrice)}${view==='api_products'?')':''}`);
      if(c.query.maxPrice!==undefined) where.push(`${view==='api_products'?'EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=api_products.id AND v.sale_price<=':'price_from<='}${param(c.query.maxPrice)}${view==='api_products'?')':''}`);
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
  private async promotionGuard(id:unknown,options:{metadata?:boolean;table?:string;rowId?:string;body?:Row;deleting?:boolean}={}):Promise<void>{
    const p=await this.db.one('SELECT * FROM promotions WHERE id=$1 FOR UPDATE',[id]);
    const body=options.body||{};
    const hasUsage=(await this.db.one('SELECT has_usage FROM api_promotions WHERE id=$1',[id])).hasUsage===true;
    if(!options.table){
      if(options.deleting)assert(!hasUsage,'INVALID_STATE','Chương trình đã được sử dụng; hãy tạm dừng hoặc kết thúc.');
      if(options.metadata){
        if(body.type!==undefined&&body.type!==p.type){
          const conditions=await this.db.one('SELECT EXISTS(SELECT 1 FROM product_promotion_rules WHERE promotion_id=$1 UNION ALL SELECT 1 FROM order_promotion_rules WHERE promotion_id=$1 UNION ALL SELECT 1 FROM vouchers WHERE promotion_id=$1) AS present',[id]);
          assert(!hasUsage&&!conditions.present&&p.status!=='ENDED','INVALID_STATE','Chỉ đổi loại khi chương trình chưa có điều kiện, chưa từng áp dụng và chưa kết thúc.');
        }
        assert(p.status!=='ENDED'||body.status===undefined||body.status==='ENDED','INVALID_STATE','Không kích hoạt lại chương trình đã kết thúc.');
        if(hasUsage||p.status==='ENDED'){
          assert((body.startsAt===undefined||new Date(String(body.startsAt)).toISOString()===p.startsAt)&&(body.endsAt===undefined||new Date(String(body.endsAt)).toISOString()===p.endsAt),'INVALID_STATE','Không sửa thời gian chương trình đã được sử dụng hoặc kết thúc.');
          assert(!hasUsage||body.status!=='DRAFT','INVALID_STATE','Không chuyển chương trình đã sử dụng về bản nháp.');
        }
      }
      return;
    }
    const typeByTable:Record<string,string>={product_promotion_rules:'PRODUCT',order_promotion_rules:'ORDER',vouchers:'VOUCHER'};
    assert(p.type===typeByTable[options.table],'INVALID_STATE','Mỗi chương trình chỉ được cấu hình đúng một loại khuyến mãi đã chọn.');
    const old=options.rowId?await this.db.one(`SELECT * FROM ${ident(options.table)} WHERE id=$1 AND promotion_id=$2 FOR UPDATE`,[options.rowId,id]):null;
    const keys:{[table:string]:string}={product_promotion_rules:'product_rule_id',order_promotion_rules:'order_rule_id',vouchers:'voucher_id'};
    const used=old?(await this.db.query(`SELECT id FROM promotion_usage WHERE ${ident(keys[options.table])}=$1 LIMIT 1`,[old.id])).length>0:false;
    if(options.deleting){assert(!used,'INVALID_STATE','Ưu đãi đã được sử dụng; không thể xóa.');return;}
    assert(p.status!=='ENDED','INVALID_STATE','Chương trình đã kết thúc; hãy tạo chương trình mới.');
    if(used&&old){
      if(options.table==='product_promotion_rules')for(const key of ['productId','variantId'])if(body[key]!==undefined)assert(body[key]===old[key],'INVALID_STATE','Không đổi sản phẩm hoặc biến thể của ưu đãi đã sử dụng; hãy tạo điều kiện mới.');
    }
    if(old&&options.table==='vouchers'){
      const usage=await this.db.one("SELECT count(*)::integer AS total FROM voucher_redemptions WHERE voucher_id=$1 AND status IN ('HELD','USED')",[old.id]);
      const perCustomer=await this.db.one("SELECT COALESCE(max(n),0)::integer AS maximum FROM (SELECT count(*) AS n FROM voucher_redemptions WHERE voucher_id=$1 AND status IN ('HELD','USED') GROUP BY customer_id) x",[old.id]);
      assert(body.maxUses===undefined||body.maxUses===null||Number(body.maxUses)>=Number(usage.total),'INVALID_STATE','Giới hạn tổng lượt không được thấp hơn lượt đã dùng và đang giữ.');
      assert(body.perCustomerLimit===undefined||Number(body.perCustomerLimit)>=Number(perCustomer.maximum),'INVALID_STATE','Giới hạn mỗi khách không được thấp hơn lượt đã dùng và đang giữ của khách.');
    }
  }
  private payload(r:Resource,c:Context):Row{return Object.fromEntries(r.fields.filter(f=>c.body[f]!==undefined).map(f=>[f,c.body[f]]));}
  private async save(r:Resource,c:Context,create:boolean):Promise<Row>{
    await this.parent(r,c);
    if(['employees','accounts'].includes(r.table)) await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended('halora-administrators',0))");
    if(r.table==='accounts') await this.auth.guardAdministrator(c.actor);
    if(r.parent?.table==='promotions') await this.promotionGuard(c.params.promotionId,{table:r.table,rowId:create?undefined:c.params.id,body:c.body});
    if(r.table==='promotions'&&!create) await this.promotionGuard(c.params.id,{metadata:true,body:c.body});
    let old:Row|undefined;
    if(!create){old=await this.db.one<Row>(`SELECT * FROM ${ident(r.table)} WHERE id=$1 FOR UPDATE`,[c.params.id]);await this.read(r,c);version(old,c.body.version);}
    const data=this.payload(r,c);
    if(r.table==='promotions'&&data.name!==undefined){data.name=String(data.name).trim();assert(String(data.name).length>0,'VALIDATION_ERROR','Nhập tên chương trình khuyến mãi.',400);}
    if(['brands','products'].includes(r.table)&&data.thumbnailMediaId)await this.db.one('SELECT id FROM media_assets WHERE id=$1',[data.thumbnailMediaId]);
    if(old&&r.table==='product_variants'&&data.sku!==undefined) assert(data.sku===old.sku,'INVALID_STATE','Không đổi mã SKU đã cấp.');
    if(old&&r.table==='vouchers'&&data.code!==undefined) assert(data.code===old.code,'INVALID_STATE','Không đổi mã voucher đã cấp.');
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
  private async assignRoles(c:Context,byAccount:boolean):Promise<Row>{
    await this.auth.guardAdministrator(c.actor);
    await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended('halora-administrators',0))");
    const account=byAccount?await this.db.one('SELECT * FROM accounts WHERE id=$1 FOR UPDATE',[c.params.id]):null;
    if(account){version(account,c.body.version);assert(account.realm==='STAFF','FORBIDDEN','Khách hàng có vai trò cố định; không gán vai trò nhân viên cho khách hàng.',403);}
    const initial=await this.db.one(`SELECT id,account_id FROM employees WHERE ${byAccount?'account_id':'id'}=$1`,[c.params.id]);
    if(!byAccount&&initial.accountId)await this.db.one('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[initial.accountId]);
    const employee=await this.db.one('SELECT * FROM employees WHERE id=$1 FOR UPDATE',[initial.id]);
    if(!byAccount)version(employee,c.body.version);
    await this.db.query('DELETE FROM employee_roles WHERE employee_id=$1',[employee.id]);
    for(const id of [...new Set(c.body.roleIds as string[])].sort()){
      const role=await this.db.one('SELECT code FROM roles WHERE id=$1',[id]);
      assert(role.code!=='CUSTOMER','VALIDATION_ERROR','Vai trò khách hàng không được gán cho nhân viên.',400);
      await this.db.query('INSERT INTO employee_roles(employee_id,role_id) VALUES($1,$2)',[employee.id,id]);
    }
    await this.db.query('UPDATE employees SET full_name=full_name WHERE id=$1',[employee.id]);
    if(employee.accountId)await this.auth.revoke(employee.accountId);
    await this.auth.ensureActiveAdministrator();
    await this.db.audit(c.actor,'ASSIGN_ROLES',byAccount?'account':'employee',byAccount?account!.id:employee.id);
    return this.db.one(`SELECT * FROM ${byAccount?'api_accounts':'api_employees'} WHERE id=$1`,[byAccount?account!.id:employee.id]);
  }
  registerRoutes(routes:Routes):void{
    for(const resource of ['products','brands'])routes.add('PUT',`/admin/${resource}/{id}/thumbnail`,{permission:`${resource}.update`},async c=>{
      const row=await this.db.one(`SELECT * FROM ${ident(resource)} WHERE id=$1 FOR UPDATE`,[c.params.id]);version(row,c.body.version);
      if(c.body.mediaId)await this.db.one('SELECT id FROM media_assets WHERE id=$1',[c.body.mediaId]);
      await this.db.update(resource,row.id,{thumbnailMediaId:c.body.mediaId});
      await this.db.audit(c.actor,'SET_THUMBNAIL',resource,row.id);
      return this.db.one(`SELECT * FROM ${resource==='products'?'api_products':'api_brands'} WHERE id=$1`,[row.id]);
    });
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
        if(r.parent?.table==='promotions') await this.promotionGuard(c.params.promotionId,{table:r.table,rowId:c.params.id,deleting:true});
        if(r.table==='promotions') await this.promotionGuard(c.params.id,{deleting:true});
        const found=await this.read(r,c);
        if(r.table==='employees') await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended('halora-administrators',0))");
        if(r.table==='product_variants') await this.db.query('DELETE FROM inventory_balances WHERE variant_id=$1 AND stock_quantity=0 AND NOT EXISTS(SELECT 1 FROM stock_movements WHERE variant_id=$1)',[found.id]);
        if(r.table==='promotions')for(const child of ['product_promotion_rules','order_promotion_rules','vouchers'])await this.db.query(`DELETE FROM ${ident(child)} WHERE promotion_id=$1`,[found.id]);
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
    for(const table of ['categories','brands']) routes.add('GET',`/${table}`,{public:true},c=>this.list(table==='brands'?'api_brands':table,c,['code','name'],[],["status='ACTIVE'"]));
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
    routes.add('PUT','/admin/accounts/{id}/roles',{permission:'employees.assignRoles'},c=>this.assignRoles(c,true));
    routes.add('PUT','/admin/employees/{id}/roles',{permission:'employees.assignRoles'},c=>this.assignRoles(c,false));
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
