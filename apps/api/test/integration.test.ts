import { config } from 'dotenv';
import { unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { Client } from 'pg';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { root, settings } from '../src/core/config';
import { createApp } from '../src/app';
import { Database, Row } from '../src/core/db';
import { hashPassword } from '../src/auth/auth.service';
import { StockService } from '../src/inventory/stock.service';
import { Contract } from '../src/core/contract';

config({path:resolve(root,'.env.test.local'),quiet:true});
const configured=process.env.TEST_DATABASE_URL;
const suite=configured?describe:describe.skip;
suite('Real PostgreSQL API integration (isolated disposable database)',()=>{
  let app:INestApplication,db:Database,maintenance:Client;
  const name=`halora_test_${randomUUID().replaceAll('-','')}`;
  const password=randomUUID()+'Aa1!',username='integration_admin';
  let adminToken='',staffCookie='',customerToken='',secondToken='',customerId='',secondId='';
  let category:Row,brand:Row,product:Row,variant:Row,secondVariant:Row,address:Row,secondAddress:Row,supplier:Row;
  let order:Row,invoice:Row;
  const uploadedFiles:string[]=[];
  const categoryInput={name:`Loại ${name}`,description:null,status:'ACTIVE'};
  const brandInput={name:`Thương hiệu ${name}`,description:null,status:'ACTIVE'};
  const variantInput={sku:`SKU-${name}`,name:'Biến thể kiểm chứng',color:null,volumeMl:50,weightGrams:null,salePrice:'200000',referenceCostPrice:'100000',lowStockThreshold:2,status:'ACTIVE'};
  const endpoint=(method:string,path:string,body?:unknown,token=adminToken,key?:string)=>{
    const agent=request(app.getHttpServer());
    const req=method==='GET'?agent.get(`/api/v1${path}`):method==='POST'?agent.post(`/api/v1${path}`):method==='PATCH'?agent.patch(`/api/v1${path}`):method==='PUT'?agent.put(`/api/v1${path}`):agent.delete(`/api/v1${path}`);
    if(token)req.set('Authorization',`Bearer ${token}`);
    if(key)req.set('Idempotency-Key',key);
    return body===undefined?req:req.send(body as object);
  };
  const data=async(method:string,path:string,body?:unknown,token=adminToken,key?:string):Promise<Row>=>{
    const res=await endpoint(method,path,body,token,key);
    if(res.status>=400)throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.data as Row;
  };
  beforeAll(async()=>{
    const url=new URL(configured!);url.pathname='/postgres';
    maintenance=new Client({connectionString:url.toString()});await maintenance.connect();
    expect(/^halora_test_[a-f0-9]{32}$/.test(name)).toBe(true);
    await maintenance.query(`CREATE DATABASE "${name}"`);
    url.pathname=`/${name}`;process.env.DATABASE_URL=url.toString();process.env.VALIDATE_RESPONSES='true';
    execFileSync(process.execPath,[require.resolve('tsx/cli'),resolve(root,'apps/api/scripts/migrate.ts')],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});
    execFileSync(process.execPath,[require.resolve('tsx/cli'),resolve(root,'apps/api/scripts/bootstrap.ts')],{env:{...process.env,BOOTSTRAP_ADMIN_USERNAME:username,BOOTSTRAP_ADMIN_EMAIL:`admin-${name}@example.test`,BOOTSTRAP_ADMIN_PASSWORD:password,BOOTSTRAP_ADMIN_FULL_NAME:'Nhân sự kiểm chứng',BOOTSTRAP_ADMIN_PHONE:'0900000000'},stdio:'pipe'});
    app=await createApp();await app.listen(0,'127.0.0.1');db=app.get(Database);
    const login=await endpoint('POST','/auth/staff/login',{identifier:username,password},'');
    expect(login.status).toBe(200);adminToken=login.body.data.accessToken;staffCookie=String(login.headers['set-cookie'][0]).split(';')[0];
    for(const second of [false,true]){
      const loginName=second?'integration_customer2':'integration_customer1';
      const registration=await data('POST','/auth/customer/register',{fullName:loginName,username:loginName,email:`${loginName}-${name}@example.test`,phone:'0900000001',password},'');
      const loginCustomer=await data('POST','/auth/customer/login',{identifier:loginName,password},'');
      const token=String(loginCustomer.accessToken);
      const saved=await data('POST','/me/addresses',{recipientName:loginName,recipientPhone:'0900000001',addressLine:'Địa chỉ kiểm chứng',provinceName:'Tỉnh kiểm chứng',wardName:'Phường kiểm chứng',isDefault:true},token);
      if(second){secondToken=token;secondId=String(registration.customerId);secondAddress=saved;}else{customerToken=token;customerId=String(registration.customerId);address=saved;}
    }
    category=await data('POST','/admin/categories',categoryInput);brand=await data('POST','/admin/brands',brandInput);
    product=await data('POST','/admin/products',{name:'Sản phẩm kiểm chứng',slug:`integration-${name}`,categoryId:category.id,brandId:brand.id,description:null,ingredients:null,benefits:null,isFeatured:true,status:'ACTIVE'});
    variant=await data('POST',`/admin/products/${product.id}/variants`,variantInput);
    secondVariant=await data('POST',`/admin/products/${product.id}/variants`,{...variantInput,sku:`SECOND-${name}`,name:'Biến thể thứ hai'});
    const adjustment=await data('POST','/admin/inventory-adjustments',{reason:'Thiết lập số dư cho kiểm chứng tích hợp',items:[{variantId:variant.id,quantityDelta:1},{variantId:secondVariant.id,quantityDelta:10}]});
    await data('POST',`/admin/inventory-adjustments/${adjustment.id}/post`,{version:adjustment.version},adminToken,randomUUID());
  },120000);
  afterAll(async()=>{
    if(app)await app.close();
    if(maintenance){
      await maintenance.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[name]);
      await maintenance.query(`DROP DATABASE IF EXISTS "${name}"`);await maintenance.end();
    }
    delete process.env.DATABASE_URL;
    for(const file of uploadedFiles)if(/^[a-f0-9-]+\.png$/.test(file))await unlink(resolve(settings.uploadDir,file));
  });

  it('recovers after PostgreSQL closes an idle pooled connection without losing login',async()=>{
    const client=await db.pool.connect();
    const result=await client.query<{pid:number}>('SELECT pg_backend_pid() AS pid');
    client.release();
    const disconnected=once(db.pool,'error',{signal:AbortSignal.timeout(5000)});
    const terminated=await maintenance.query('SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity WHERE pid=$1 AND datname=$2',[result.rows[0].pid,name]);
    expect(terminated.rows[0]?.terminated).toBe(true);
    await disconnected;
    expect((await endpoint('GET','/ready',undefined,'')).status).toBe(200);
    const login=await endpoint('POST','/auth/staff/login',{identifier:username,password},'');
    expect(login.status).toBe(200);expect(login.body.data.accessToken).toBeTruthy();
  });
  it('covers every documented operation and validates basic request safety',async()=>{
    expect(new Contract().routes.length).toBeGreaterThan(120);
    const bad=await endpoint('POST','/admin/categories',{...categoryInput,unexpected:true});expect(bad.status).toBe(400);
    expect((await endpoint('GET','/admin/products','',customerToken)).status).toBe(403);
    expect((await endpoint('GET','/admin/products?sortBy=pg_sleep(10)')).status).toBe(400);
    expect((await endpoint('GET','/products/not-a-uuid',undefined,'')).status).toBe(400);
    const publicProduct=await data('GET',`/products/${product.id}`,undefined,'');
    expect(JSON.stringify(publicProduct)).not.toContain('referenceCostPrice');
    expect((publicProduct.variants as Row[])[0].salePrice).toBe('200000');
  });
  it('lets administrators edit their own profile without changing roles or losing the session',async()=>{
    const profile=await data('GET','/auth/profile');
    const input={fullName:'Quản trị đã cập nhật',phone:'0900000088',email:`updated-admin-${name}@example.test`,version:profile.version};
    const updated=await data('PATCH','/auth/profile',input);
    expect(updated.accountId).toBe(profile.accountId);expect(updated.fullName).toBe(input.fullName);expect(updated.version).toBe(Number(profile.version)+1);
    const principal=await data('GET','/auth/me');expect(principal.displayName).toBe(input.fullName);expect(principal.email).toBe(input.email);expect(principal.roles).toEqual(['ADMIN']);
    const employee=await db.one('SELECT full_name,email,phone FROM employees WHERE account_id=$1',[profile.accountId]);expect(employee.email).toBe(input.email);expect(employee.phone).toBe(input.phone);
    expect((await endpoint('PATCH','/auth/profile',input)).status).toBe(409);
    for(const extra of [{accountId:randomUUID()},{status:'LOCKED'},{roleIds:[]},{position:'Quản lý'}])expect((await endpoint('PATCH','/auth/profile',{...input,version:updated.version,...extra})).status).toBe(400);
    expect((await endpoint('PATCH','/auth/profile',{...input,fullName:'   ',version:updated.version})).status).toBe(400);
    expect((await endpoint('PATCH','/auth/profile',{...input,email:'invalid',version:updated.version})).status).toBe(400);
    expect((await endpoint('GET','/auth/profile',undefined,'')).status).toBe(401);
  });
  it('supports personal edits for unprivileged staff and customers, with ownership and atomic email uniqueness',async()=>{
    const employee=await data('POST','/admin/employees',{fullName:'Nhân sự tự quản hồ sơ',phone:'0900000003',email:`self-staff-${name}@example.test`,position:'Nhân viên',status:'ACTIVE'});
    await data('POST',`/admin/employees/${employee.id}/account`,{username:'integration_self_staff',email:`self-staff-${name}@example.test`,password});
    const login=await data('POST','/auth/staff/login',{identifier:'integration_self_staff',password},'');
    const token=String(login.accessToken),profile=await data('GET','/auth/profile',undefined,token);
    expect((login.principal as Row).permissions).toEqual([]);
    const saved=await data('PATCH','/auth/profile',{fullName:'Tên nhân viên đã sửa',email:`self-edited-${name}@example.test`,phone:'0900000018',version:profile.version},token);
    expect(saved.fullName).toBe('Tên nhân viên đã sửa');
    expect((await endpoint('GET','/admin/employees',undefined,token)).status).toBe(403);
    expect((await endpoint('PATCH',`/admin/employees/${employee.id}`,{fullName:'Vượt quyền',phone:'0900000018',email:saved.email,position:'Quản lý',status:'ACTIVE',version:saved.version},token)).status).toBe(403);
    const before=await data('GET','/auth/profile',undefined,customerToken);
    const second=await data('GET','/auth/profile',undefined,secondToken);
    const edited=await data('PATCH','/auth/profile',{fullName:'Khách hàng đã sửa',email:`edited-customer-${name}@example.test`,phone:'0900000028',version:second.version},secondToken);
    expect(edited.realm).toBe('CUSTOMER');expect(edited.accountId).toBe(second.accountId);
    const customer=await data('GET','/me/profile',undefined,secondToken);expect(customer.fullName).toBe(edited.fullName);expect(customer.email).toBe(edited.email);
    expect((await endpoint('PATCH','/auth/profile',{fullName:'Trùng email',email:before.email,phone:'0900000029',version:edited.version},secondToken)).status).toBe(409);
    expect(await data('GET','/auth/profile',undefined,secondToken)).toEqual(edited);
    expect((await endpoint('PATCH','/auth/profile',{fullName:'Sửa người khác',email:edited.email,phone:edited.phone,version:edited.version,accountId:before.accountId},secondToken)).status).toBe(400);
    expect(await data('GET','/auth/profile',undefined,customerToken)).toEqual(before);
  });
  it('preserves ownership and one default address under concurrent updates',async()=>{
    expect((await endpoint('PATCH',`/me/addresses/${address.id}`,{recipientName:'Người khác',recipientPhone:'0900000001',addressLine:'Địa chỉ',provinceName:'Tỉnh',wardName:'Phường',isDefault:false,version:address.version},secondToken)).status).toBe(404);
    const input={recipientName:'Người nhận',recipientPhone:'0900000001',addressLine:'Địa chỉ kiểm chứng',provinceName:'Tỉnh',wardName:'Phường',isDefault:true};
    await Promise.all([data('POST','/me/addresses',input,secondToken),data('POST','/me/addresses',input,secondToken)]);
    const list=await data('GET','/me/addresses',undefined,secondToken);
    // The array response is unwrapped by the helper.
    expect((list as unknown as Row[]).filter(a=>a.isDefault)).toHaveLength(1);
    const own=await data('GET','/me/profile',undefined,customerToken);expect(own.id).toBe(customerId);
  });
  it('posts receipts once, preserves historical supplier links and rejects a version conflict',async()=>{
    supplier=await data('POST','/admin/suppliers',{name:'Nhà cung cấp kiểm chứng',contactName:'Người liên hệ',phone:'0900000002',email:`supplier-${name}@example.test`,address:'Địa chỉ cung ứng',status:'ACTIVE'});
    const supply=await data('POST',`/admin/suppliers/${supplier.id}/variants`,{variantId:secondVariant.id,quotedCostPrice:'100000',status:'ACTIVE'});
    const receipt=await data('POST','/admin/goods-receipts',{supplierId:supplier.id,receivedAt:new Date().toISOString(),items:[{variantId:secondVariant.id,quantity:2,unitCost:'100000'}]});
    const key=randomUUID();const posted=await data('POST',`/admin/goods-receipts/${receipt.id}/post`,{version:receipt.version},adminToken,key);
    const repeated=await data('POST',`/admin/goods-receipts/${receipt.id}/post`,{version:receipt.version},adminToken,key);expect(repeated.id).toBe(posted.id);
    expect((await endpoint('POST',`/admin/goods-receipts/${receipt.id}/post`,{version:receipt.version},adminToken,randomUUID())).status).toBe(409);
    expect((await endpoint('DELETE',`/admin/suppliers/${supplier.id}/variants/${supply.id}`)).status).toBe(409);
    expect((await endpoint('DELETE',`/admin/goods-receipts/${receipt.id}`)).status).toBe(409);
    const balances=await endpoint('GET','/admin/inventory/balances');expect(balances.body.data.find((b:Row)=>b.variantId===secondVariant.id).stockQuantity).toBe(12);
    expect((await endpoint('PATCH',`/admin/categories/${category.id}`,{...categoryInput,version:0})).status).toBe(400);
  });
  it('reserves the last voucher once, prices exactly and removes only purchased cart lines',async()=>{
    const promotion=await data('POST','/admin/promotions',{name:'Ưu đãi kiểm chứng',description:null,startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString(),status:'ACTIVE'});
    await data('POST',`/admin/promotions/${promotion.id}/product-rules`,{productId:product.id,variantId:variant.id,discountPercent:'10.00',minQuantity:1,maxDiscountAmount:null});
    await data('POST',`/admin/promotions/${promotion.id}/order-rules`,{minOrderAmount:'0',discountPercent:'5.00',maxDiscountAmount:null});
    await data('POST',`/admin/promotions/${promotion.id}/vouchers`,{code:`V-${name}`,discountPercent:'10.00',minOrderAmount:'0',maxDiscountAmount:null,maxUses:1,perCustomerLimit:1,status:'ACTIVE'});
    await data('POST','/me/cart/items',{variantId:variant.id,quantity:1},customerToken);
    await data('POST','/me/cart/items',{variantId:secondVariant.id,quantity:2},customerToken);
    const input={items:[{variantId:variant.id,quantity:1}],addressId:address.id,paymentMethod:'COD',voucherCode:`V-${name}`};
    const other={...input,addressId:secondAddress.id};
    const quote=await data('POST','/me/checkout/quote',input,customerToken),otherQuote=await data('POST','/me/checkout/quote',other,secondToken);
    expect((quote.amounts as Row).totalAmount).toBe('183900');
    const key=randomUUID(),body={...input,quoteToken:quote.quoteToken};
    order=await data('POST','/me/orders',body,customerToken,key);
    expect((await data('POST','/me/orders',body,customerToken,key)).id).toBe(order.id);
    expect((await endpoint('POST','/me/orders',{...body,note:'Khác nội dung'},customerToken,key)).status).toBe(409);
    const rejected=await endpoint('POST','/me/orders',{...other,quoteToken:otherQuote.quoteToken},secondToken,randomUUID());
    expect(rejected.status).toBe(409);expect(rejected.body.error.code).toBe('VOUCHER_LIMIT_REACHED');
    const cart=await data('GET','/me/cart',undefined,customerToken);expect((cart.items as Row[])).toHaveLength(1);expect((cart.items as Row[])[0].variantId).toBe(secondVariant.id);
    expect((await endpoint('GET',`/me/orders/${order.id}`,undefined,secondToken)).status).toBe(404);
    expect((await endpoint('PATCH',`/admin/promotions/${promotion.id}`,{name:'Đổi thời gian',description:null,status:'ACTIVE',startsAt:new Date(Date.now()-120000).toISOString(),endsAt:promotion.endsAt,version:promotion.version})).status).toBe(409);
  });
  it('uses one stock issue, records payments once, completes and posts a gross-value invoice',async()=>{
    order=await data('POST',`/admin/orders/${order.id}/confirm`,{version:order.version},adminToken,randomUUID());
    const failed=await data('POST',`/admin/orders/${order.id}/payments`,{method:'COD',amount:'1000'});
    await data('POST',`/admin/payments/${failed.id}/fail`,{note:'Kiểm chứng thanh toán thất bại'});
    order=await data('GET',`/admin/orders/${order.id}`);expect(order.paidAmount).toBe('0');
    expect((await endpoint('POST',`/admin/orders/${order.id}/invoice`,{})).status).toBe(409);
    order=await data('POST',`/admin/orders/${order.id}/dispatch`,{version:order.version});
    expect((await endpoint('POST',`/admin/orders/${order.id}/complete`,{version:order.version})).status).toBe(409);
    const payment=await data('POST',`/admin/orders/${order.id}/payments`,{method:'COD',amount:order.totalAmount});
    const key=randomUUID();await data('POST',`/admin/payments/${payment.id}/confirm`,{},adminToken,key);await data('POST',`/admin/payments/${payment.id}/confirm`,{},adminToken,key);
    order=await data('GET',`/admin/orders/${order.id}`);expect(order.paidAmount).toBe('183900');
    order=await data('POST',`/admin/orders/${order.id}/complete`,{version:order.version});
    invoice=await data('POST',`/admin/orders/${order.id}/invoice`,{});expect(invoice.totalAmount).toBe('200000');
    invoice=await data('POST',`/admin/invoices/${invoice.id}/post`,{version:invoice.version},adminToken,randomUUID());
    expect((await endpoint('DELETE',`/admin/invoices/${invoice.id}`)).status).toBe(409);
    const balance=await db.one('SELECT stock_quantity FROM inventory_balances WHERE variant_id=$1',[variant.id]);expect(balance.stockQuantity).toBe(0);
  });
  it('keeps transaction snapshots when product prices and customer addresses change',async()=>{
    variant=await data('PATCH',`/admin/products/${product.id}/variants/${variant.id}`,{...variantInput,salePrice:'210000',version:variant.version});
    address=await data('PATCH',`/me/addresses/${address.id}`,{recipientName:'Người nhận mới',recipientPhone:'0900000001',addressLine:'Địa chỉ mới',provinceName:'Tỉnh mới',wardName:'Phường mới',isDefault:true,version:address.version},customerToken);
    const saved=await data('GET',`/admin/orders/${order.id}`);expect(saved.addressLine).toBe('Địa chỉ kiểm chứng');expect((saved.items as Row[])[0].unitPrice).toBe('200000');
    const oldInvoice=await data('GET',`/admin/invoices/${invoice.id}`);expect(oldInvoice.totalAmount).toBe('200000');
  });
  it('serializes competing orders for the last unit and restores stock once on cancellation',async()=>{
    const adjustment=await data('POST','/admin/inventory-adjustments',{reason:'Kiểm chứng cạnh tranh tồn kho',items:[{variantId:variant.id,quantityDelta:1}]});
    await data('POST',`/admin/inventory-adjustments/${adjustment.id}/post`,{version:adjustment.version},adminToken,randomUUID());
    const create=async(token:string,addressId:unknown)=>{const input={items:[{variantId:variant.id,quantity:1}],addressId,paymentMethod:'BANK_TRANSFER'};const quote=await data('POST','/me/checkout/quote',input,token);return data('POST','/me/orders',{...input,quoteToken:quote.quoteToken},token,randomUUID());};
    const a=await create(customerToken,address.id),b=await create(secondToken,secondAddress.id);
    const result=await Promise.all([endpoint('POST',`/admin/orders/${a.id}/confirm`,{version:a.version},adminToken,randomUUID()),endpoint('POST',`/admin/orders/${b.id}/confirm`,{version:b.version},adminToken,randomUUID())]);
    expect(result.map(r=>r.status).sort()).toEqual([200,409]);
    const winner=result.find(r=>r.status===200)!.body.data;
    const payment=await data('POST',`/admin/orders/${winner.id}/payments`,{method:'BANK_TRANSFER',amount:winner.totalAmount,reference:`TRANSFER-${name}`});
    await data('POST',`/admin/payments/${payment.id}/confirm`,{},adminToken,randomUUID());
    const updated=await data('GET',`/admin/orders/${winner.id}`);
    const cancelled=await data('POST',`/admin/orders/${winner.id}/cancel`,{version:updated.version,reason:'Kiểm chứng hoàn kho và hoàn tiền'});
    expect((await endpoint('POST',`/admin/orders/${winner.id}/cancel`,{version:cancelled.version,reason:'Lặp'})).status).toBe(409);
    const refund=(cancelled.refunds as Row[])[0],key=randomUUID();await data('POST',`/admin/refunds/${refund.id}/confirm`,{},adminToken,key);await data('POST',`/admin/refunds/${refund.id}/confirm`,{},adminToken,key);
    const final=await data('GET',`/admin/orders/${winner.id}`);expect(final.refundedAmount).toBe(final.paidAmount);
    expect((await db.one('SELECT stock_quantity FROM inventory_balances WHERE variant_id=$1',[variant.id])).stockQuantity).toBe(1);
    expect(await app.get(StockService).assertLedger()).toEqual([]);
  });
  it('exports actual reports, PDF and XLSX and reconciles separate invoice/order amounts',async()=>{
    const sales=await data('GET','/admin/reports/sales');
    expect((sales.metrics as Row[]).find(m=>m.key==='invoiceAmount')?.value).toBe('200000');
    expect((sales.metrics as Row[]).find(m=>m.key==='completedOrderAmount')?.value).toBe('183900');
    for(const kind of ['payments','inventory','purchases','promotions','activity'])expect((await endpoint('GET',`/admin/reports/${kind}`)).status).toBe(200);
    const pdf=await endpoint('GET',`/admin/invoices/${invoice.id}/export?format=pdf`);expect(pdf.status).toBe(200);expect(pdf.headers['content-type']).toContain('application/pdf');expect(pdf.body.subarray(0,4).toString()).toBe('%PDF');
    const excel=await endpoint('GET','/admin/reports/sales/export?format=xlsx');expect(excel.status).toBe(200);expect(excel.headers['content-type']).toContain('spreadsheetml');
    expect((await endpoint('GET','/admin/reports/sales?from=2026-10-15T00:00:00Z&to=2026-10-01T00:00:00Z')).status).toBe(400);
  });
  it('enforces permissions, revokes locked staff sessions and protects the last administrator',async()=>{
    const employee=await data('POST','/admin/employees',{fullName:'Nhân sự kho kiểm chứng',phone:'0900000003',email:`warehouse-${name}@example.test`,position:'Kho',status:'ACTIVE'});
    const account=await data('POST',`/admin/employees/${employee.id}/account`,{username:'integration_warehouse',email:`warehouse-${name}@example.test`,password});
    const roles=await data('GET','/admin/roles') as unknown as Row[];
    const fresh=await data('GET',`/admin/employees/${employee.id}`);
    await data('PUT',`/admin/employees/${employee.id}/roles`,{version:fresh.version,roleIds:[roles.find(r=>r.code==='WAREHOUSE')!.id]});
    const login=await data('POST','/auth/staff/login',{identifier:'integration_warehouse',password},'');
    expect((await endpoint('GET','/admin/reports/payments',undefined,String(login.accessToken))).status).toBe(403);
    const current=await data('GET',`/admin/accounts/${account.id}`);
    await data('PATCH',`/admin/accounts/${account.id}`,{status:'LOCKED',version:current.version});
    expect((await endpoint('GET','/auth/me',undefined,String(login.accessToken))).status).toBe(401);
    const principal=await data('GET','/auth/me'),admin=await data('GET',`/admin/accounts/${principal.accountId}`);
    expect((await endpoint('PATCH',`/admin/accounts/${admin.id}`,{status:'LOCKED',version:admin.version})).status).toBe(409);
    expect((await endpoint('GET','/auth/me')).status).toBe(200);
  });
  it('serializes the final voucher redemption and releases it when a pending order is cancelled',async()=>{
    const p=await data('POST','/admin/promotions',{name:'Voucher cạnh tranh',description:null,startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString(),status:'ACTIVE'});
    const voucher=await data('POST',`/admin/promotions/${p.id}/vouchers`,{code:`LAST-${name}`,discountPercent:'1.00',minOrderAmount:'0',maxDiscountAmount:null,maxUses:1,perCustomerLimit:1,status:'ACTIVE'});
    const a={items:[{variantId:secondVariant.id,quantity:1}],addressId:address.id,paymentMethod:'COD',voucherCode:voucher.code};
    const b={...a,addressId:secondAddress.id};
    const qa=await data('POST','/me/checkout/quote',a,customerToken),qb=await data('POST','/me/checkout/quote',b,secondToken);
    const results=await Promise.all([endpoint('POST','/me/orders',{...a,quoteToken:qa.quoteToken},customerToken,randomUUID()),endpoint('POST','/me/orders',{...b,quoteToken:qb.quoteToken},secondToken,randomUUID())]);
    expect(results.map(r=>r.status).sort()).toEqual([201,409]);
    const winner=results.find(r=>r.status===201)!.body.data,winnerToken=winner.customerId===customerId?customerToken:secondToken;
    await data('POST',`/me/orders/${winner.id}/cancel`,{version:winner.version,reason:'Giải phóng lượt voucher'},winnerToken);
    const index=results[0].status===409?0:1,body=index===0?a:b,quote=index===0?qa:qb,token=index===0?customerToken:secondToken;
    const retried=await data('POST','/me/orders',{...body,quoteToken:quote.quoteToken},token,randomUUID());expect(retried.status).toBe('PENDING_CONFIRMATION');
    await data('POST',`/me/orders/${retried.id}/cancel`,{version:retried.version,reason:'Kết thúc kiểm chứng'},token);
  });
  it('requires a fresh quote after the delivery address changes',async()=>{
    const input={items:[{variantId:secondVariant.id,quantity:1}],addressId:address.id,paymentMethod:'COD'};
    const quote=await data('POST','/me/checkout/quote',input,customerToken);
    address=await data('PATCH',`/me/addresses/${address.id}`,{recipientName:'Người nhận mới',recipientPhone:'0900000001',addressLine:'Địa chỉ sau báo giá',provinceName:'Tỉnh mới',wardName:'Phường mới',isDefault:true,version:address.version},customerToken);
    const rejected=await endpoint('POST','/me/orders',{...input,quoteToken:quote.quoteToken},customerToken,randomUUID());
    expect(rejected.status).toBe(409);expect(rejected.body.error.code).toBe('QUOTE_CHANGED');
    const refreshed=await data('POST','/me/checkout/quote',input,customerToken);
    const created=await data('POST','/me/orders',{...input,quoteToken:refreshed.quoteToken},customerToken,randomUUID());
    expect(created.addressLine).toBe('Địa chỉ sau báo giá');
    await data('POST',`/me/orders/${created.id}/cancel`,{version:created.version,reason:'Kết thúc kiểm chứng báo giá'},customerToken);
  });
  it('validates image contents and stores an actual upload',async()=>{
    const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=','base64');
    const result=await request(app.getHttpServer()).post('/api/v1/admin/media').set('Authorization',`Bearer ${adminToken}`).attach('file',image,{filename:'upload-check.png',contentType:'image/png'});
    expect(result.status).toBe(201);expect(result.body.data.mimeType).toBe('image/png');expect(result.body.data.url).toMatch(/\/media\/[a-f0-9-]+\.png$/);
    uploadedFiles.push(new URL(result.body.data.url).pathname.split('/').pop()!);
    const invalid=await request(app.getHttpServer()).post('/api/v1/admin/media').set('Authorization',`Bearer ${adminToken}`).attach('file',Buffer.from('<svg></svg>'),{filename:'not-an-image.png',contentType:'image/png'});
    expect(invalid.status).toBe(400);
  });
  it('rotates refresh tokens, revokes replays and rejects staff cookie requests from other origins',async()=>{
    const refreshed=await endpoint('POST','/auth/staff/refresh',undefined,'').set('Cookie',staffCookie).set('Origin','http://localhost:5173');expect(refreshed.status).toBe(200);
    expect((await endpoint('POST','/auth/staff/refresh',undefined,'').set('Cookie',staffCookie).set('Origin','https://untrusted.example')).status).toBe(403);
    const login=await data('POST','/auth/customer/login',{identifier:'integration_customer2',password},'');
    const next=await data('POST','/auth/customer/refresh',{refreshToken:login.refreshToken},'');
    expect(next.refreshToken).not.toBe(login.refreshToken);
    expect((await endpoint('POST','/auth/customer/refresh',{refreshToken:login.refreshToken},'')).status).toBe(401);
    expect((await endpoint('GET','/auth/me',undefined,String(next.accessToken))).status).toBe(401);
  });
  (process.env.MAILPIT_TEST_URL?it:it.skip)('sends and consumes a one-time reset link through real Mailpit SMTP',async()=>{
    const email=`integration_customer1-${name}@example.test`;
    expect((await endpoint('POST','/auth/customer/forgot-password',{email},'')).status).toBe(200);
    const messages=await (await fetch(`${process.env.MAILPIT_TEST_URL}/api/v1/messages`)).json() as {messages:{ID:string;To:{Address:string}[]}[]};
    const entry=messages.messages.find(m=>m.To.some(to=>to.Address===email));expect(entry).toBeDefined();
    const message=await (await fetch(`${process.env.MAILPIT_TEST_URL}/api/v1/message/${entry!.ID}`)).json() as {Text:string};
    const match=message.Text.match(/halora:\/\/reset-password\?token=([^\s]+)/);expect(match).not.toBeNull();
    const token=decodeURIComponent(match![1]),nextPassword=randomUUID()+'X1!';
    expect((await endpoint('POST','/auth/customer/reset-password',{token,newPassword:nextPassword},'')).status).toBe(200);
    expect((await endpoint('POST','/auth/customer/reset-password',{token,newPassword:nextPassword},'')).status).toBe(400);
    expect((await endpoint('GET','/auth/me',undefined,customerToken)).status).toBe(401);
    expect((await endpoint('POST','/auth/customer/login',{identifier:'integration_customer1',password:nextPassword},'')).status).toBe(200);
  });
  (process.env.HALORA_BROWSER_TEST==='true'?it:it.skip)('logs into the actual admin UI, reads API data and restores the cookie session',async()=>{
    const address=app.getHttpServer().address() as {port:number};
    const origin='http://127.0.0.1:5175';settings.origins.push(origin);
    const vite=resolve(dirname(require.resolve('vite/package.json',{paths:[resolve(root,'apps/admin')]})),'bin/vite.js');
    const server=spawn(process.execPath,[vite,'--host','127.0.0.1','--port','5175','--strictPort'],{cwd:resolve(root,'apps/admin'),env:{...process.env,VITE_API_BASE_URL:'/api/v1',API_PROXY_TARGET:`http://127.0.0.1:${address.port}`},stdio:'ignore',windowsHide:true});
    const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:process.platform==='win32'?{channel:'chrome'}:{})});
    try{
      for(let i=0;i<100;i++){try{const res=await fetch(`${origin}/login`);if(res.ok)break;}catch{}await new Promise(ok=>setTimeout(ok,100));}
      const page=await browser.newPage();
      await page.goto(`${origin}/login`);
      await page.getByLabel('Tên đăng nhập hoặc Email').fill(username);
      await page.getByLabel('Mật khẩu',{exact:true}).fill(password);
      const loaded=page.waitForResponse(r=>r.url().includes('/admin/dashboard')&&r.status()===200);
      await page.getByRole('button',{name:'Đăng nhập hệ thống'}).click();await loaded;
      await page.getByRole('heading',{name:'Tổng quan hệ thống'}).waitFor();
      await page.goto(`${origin}/categories`);
      await page.getByRole('cell',{name:categoryInput.name,exact:true}).waitFor();
      await page.reload();
      await page.getByRole('cell',{name:categoryInput.name,exact:true}).waitFor();
      expect(page.url()).toContain('/categories');
      await page.screenshot({path:resolve(root,'.local/admin-integration.png'),fullPage:true});
      await page.goto(`${origin}/profile`);
      await page.getByLabel('Họ và tên',{exact:true}).fill('Quản trị sửa hồ sơ qua web');
      await page.getByLabel('Email',{exact:true}).fill(`browser-admin-${name}@example.test`);
      await page.getByLabel('Số điện thoại',{exact:true}).fill('0900000099');
      const saved=page.waitForResponse(r=>r.url().endsWith('/auth/profile')&&r.request().method()==='PATCH'&&r.status()===200);
      await page.getByRole('button',{name:'Lưu thông tin cá nhân'}).click();await saved;
      await page.locator('header').getByText('Quản trị sửa hồ sơ qua web',{exact:true}).waitFor();
      expect(await page.getByText('Quyền hạn được cấp',{exact:false}).count()).toBe(0);
      await page.reload();
      await page.waitForFunction(()=>document.querySelector<HTMLInputElement>('#fullName')?.value==='Quản trị sửa hồ sơ qua web');
      await page.screenshot({path:resolve(root,'.local/profile-integration.png'),fullPage:true});
    }finally{await browser.close();server.kill();}
  },60000);
});
