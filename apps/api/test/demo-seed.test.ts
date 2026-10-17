import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import * as argon2 from 'argon2';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { root } from '../src/core/config';
import { createApp } from '../src/app';

config({path:resolve(root,'.env.test.local'),quiet:true});
const configured=process.env.TEST_DATABASE_URL;
const suite=configured?describe:describe.skip;
suite('Explicit SQL demo import (isolated disposable database)',()=>{
  const name=`halora_test_${randomUUID().replaceAll('-','')}`;
  const adminId=randomUUID(),employeeId=randomUUID();
  let maintenance:Client,client:Client,app:INestApplication;
  const seed=readFileSync(resolve(root,'database/seed-demo.sql'),'utf8').replace(/^\\set .*$/gm,'');
  const login=(realm:string,username:string)=>request(app.getHttpServer()).post(`/api/v1/auth/${realm}/login`).send({identifier:username,password:'123456'});
  beforeAll(async()=>{
    const url=new URL(configured!);url.pathname='/postgres';
    maintenance=new Client({connectionString:url.toString()});await maintenance.connect();
    if(!/^halora_test_[a-f0-9]{32}$/.test(name))throw new Error('Unsafe test database name');
    await maintenance.query(`CREATE DATABASE "${name}"`);
    url.pathname=`/${name}`;process.env.DATABASE_URL=url.toString();process.env.VALIDATE_RESPONSES='true';
    execFileSync(process.execPath,[require.resolve('tsx/cli'),resolve(root,'apps/api/scripts/migrate.ts')],{env:process.env,stdio:'pipe'});
    client=new Client({connectionString:url.toString()});await client.connect();
    await client.query("INSERT INTO accounts(id,realm,username,email,password_hash) VALUES($1,'STAFF','existing_admin','admin@seed.example.test',$2)",[adminId,await argon2.hash(randomUUID())]);
    await client.query("INSERT INTO employees(id,account_id,full_name,phone,email,position) VALUES($1,$2,'Quản trị có sẵn','0900000000','admin@seed.example.test','Quản trị')",[employeeId,adminId]);
    await client.query("INSERT INTO employee_roles(employee_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",[employeeId]);
    await client.query("INSERT INTO auth_sessions(account_id,refresh_token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')",[adminId,randomUUID()]);
    await client.query(seed);
    app=await createApp();await app.listen(0,'127.0.0.1');
  },120000);
  afterAll(async()=>{
    if(app)await app.close();if(client)await client.end();
    if(maintenance){await maintenance.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[name]);await maintenance.query(`DROP DATABASE IF EXISTS "${name}"`);await maintenance.end();}
    delete process.env.DATABASE_URL;
  });
  it('keeps the existing admin, creates 3 accounts per other role and authenticates all 13 accounts',async()=>{
    expect(Number((await client.query('SELECT count(*) FROM accounts')).rows[0].count)).toBe(13);
    const counts=(await client.query('SELECT r.code,count(*)::integer AS count FROM employee_roles er JOIN roles r ON r.id=er.role_id GROUP BY r.code ORDER BY r.code')).rows;
    expect(counts).toEqual([{code:'ACCOUNTANT',count:3},{code:'ADMIN',count:1},{code:'SALES',count:3},{code:'WAREHOUSE',count:3}]);
    const admin=await login('staff','existing_admin');expect(admin.status).toBe(200);expect(admin.body.data.principal.accountId).toBe(adminId);
    expect((await client.query('SELECT auth_version FROM accounts WHERE id=$1',[adminId])).rows[0].auth_version).toBe(2);
    expect(Number((await client.query('SELECT count(*) FROM auth_sessions WHERE account_id=$1 AND revoked_at IS NOT NULL',[adminId])).rows[0].count)).toBe(1);
    for(const [prefix,role] of [['banhang','SALES'],['kho','WAREHOUSE'],['ketoan','ACCOUNTANT'],['khachhang','CUSTOMER']]){
      for(let i=1;i<=3;i++){
        const res=await login(role==='CUSTOMER'?'customer':'staff',prefix+String(i).padStart(2,'0'));
        expect(res.status).toBe(200);expect(res.body.data.principal.roles).toEqual([role]);
      }
    }
    const sales=await login('staff','banhang01');
    expect((await request(app.getHttpServer()).get('/api/v1/admin/employees').auth(sales.body.data.accessToken,{type:'bearer'})).status).toBe(403);
    const customer=await login('customer','khachhang01');
    expect((await request(app.getHttpServer()).get('/api/v1/me/orders').auth(customer.body.data.accessToken,{type:'bearer'})).body.data).toHaveLength(2);
    expect((await request(app.getHttpServer()).post('/api/v1/auth/customer/register').send({fullName:'Mật khẩu mới ngắn',username:'new_customer',email:'new@seed.example.test',phone:'0900000020',password:'123456'})).status).toBe(400);
  });
  it('has consistent inventory, payment/refund, invoice and order totals',async()=>{
    expect((await client.query("SELECT status,count(*)::integer AS n FROM voucher_redemptions GROUP BY status ORDER BY status")).rows).toEqual([{status:'HELD',n:1},{status:'RELEASED',n:2},{status:'USED',n:3}]);
    for(const [table,column,prefix] of [['accounts','code','TK'],['employees','code','NV'],['products','code','SP'],['product_variants','sku','SKU'],['promotions','code','KM'],['orders','order_code','DH'],['goods_receipts','receipt_code','PN'],['vouchers','code','VC']]){
      const rows=(await client.query(`SELECT ${column} AS code FROM ${table}`)).rows;
      expect(rows.every(row=>new RegExp(`^${prefix}[0-9]{2,}$`).test(row.code))).toBe(true);
    }
    expect(Number((await client.query('SELECT count(*) FROM products')).rows[0].count)).toBe(12);
    expect(Number((await client.query('SELECT count(*) FROM product_variants')).rows[0].count)).toBe(24);
    expect((await client.query('SELECT b.variant_id FROM inventory_balances b LEFT JOIN stock_movements m ON m.variant_id=b.variant_id GROUP BY b.variant_id,b.stock_quantity HAVING b.stock_quantity<>COALESCE(sum(m.quantity_delta),0)')).rows).toEqual([]);
    expect((await client.query('SELECT o.id FROM orders o JOIN (SELECT order_id,sum(line_subtotal) AS subtotal,sum(product_discount_amount) AS discount FROM order_items GROUP BY order_id) i ON i.order_id=o.id WHERE o.subtotal_amount<>i.subtotal OR o.product_discount_amount<>i.discount')).rows).toEqual([]);
    expect((await client.query("SELECT id FROM api_orders WHERE (status='COMPLETED' AND paid_amount<>total_amount) OR (status='CANCELLED' AND paid_amount<>refunded_amount)")).rows).toEqual([]);
    expect((await client.query("SELECT i.id FROM invoices i JOIN orders o ON o.id=i.order_id WHERE o.status<>'COMPLETED' OR i.total_amount<>(SELECT sum(line_total) FROM invoice_items WHERE invoice_id=i.id)")).rows).toEqual([]);
    expect((await client.query("SELECT count(*)::integer AS n FROM stock_movements WHERE type='CANCELLATION'")).rows[0].n).toBe(2);
    const admin=await login('staff','existing_admin');
    for(const path of ['/admin/orders','/admin/invoices','/admin/goods-receipts','/admin/inventory/balances','/admin/promotions'])expect((await request(app.getHttpServer()).get('/api/v1'+path).auth(admin.body.data.accessToken,{type:'bearer'})).status).toBe(200);
  });
  it('cleans labels in master data, transaction snapshots and cached responses without changing credentials or amounts',async()=>{
    const credentialSnapshot=(await client.query('SELECT id,username,email,password_hash FROM accounts ORDER BY id')).rows;
    const stockSnapshot=(await client.query('SELECT variant_id,stock_quantity FROM inventory_balances ORDER BY variant_id')).rows;
    const totals=(await client.query('SELECT id,total_amount FROM orders ORDER BY id')).rows;
    await client.query("UPDATE categories SET name=name||' (mẫu)'; UPDATE products SET name=name||' (mẫu)'; UPDATE customers SET full_name=full_name||' (MẪU)'; UPDATE employees SET full_name=full_name||' mẫu'; UPDATE suppliers SET name=name||' (mẫu)'; UPDATE goods_receipts SET supplier_name=supplier_name||' (mẫu)',note='[Mẫu] Nhập hàng'; UPDATE order_items SET product_name=product_name||' (mẫu)'; UPDATE orders SET customer_name=customer_name||' (mẫu)'; UPDATE invoices SET employee_name=employee_name||' (mẫu)'; UPDATE audit_logs SET performed_by_name=performed_by_name||' mẫu'");
    const cacheKey=randomUUID();
    await client.query('INSERT INTO idempotency_keys(account_id,key,fingerprint,response_body,status_code) VALUES($1,$2,$3,$4,200)',[adminId,cacheKey,'label-cleanup-test',JSON.stringify({data:{name:'Serum (mẫu)',note:'[Mẫu] Đã ghi nhận',email:'admin@demo.halora.test',totalAmount:'123000',items:[{productName:'Kem dưỡng (mẫu)'}]}})]);
    const migration=readFileSync(resolve(root,'database/migrations/005_clean_display_labels.sql'),'utf8').split('-- Down Migration')[0];
    await client.query('BEGIN');
    try{await client.query(migration);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}
    for(const [table,field] of [['categories','name'],['products','name'],['customers','full_name'],['employees','full_name'],['suppliers','name'],['goods_receipts','supplier_name'],['order_items','product_name'],['orders','customer_name'],['invoices','employee_name'],['audit_logs','performed_by_name']]){
      expect((await client.query(`SELECT ${field} AS label FROM ${table}`)).rows.every(row=>!String(row.label).toLowerCase().includes('mẫu'))).toBe(true);
    }
    expect((await client.query('SELECT response_body FROM idempotency_keys WHERE key=$1',[cacheKey])).rows[0].response_body).toEqual({data:{name:'Serum',note:'Đã ghi nhận',email:'admin@demo.halora.test',totalAmount:'123000',items:[{productName:'Kem dưỡng'}]}});
    expect((await client.query('SELECT id,username,email,password_hash FROM accounts ORDER BY id')).rows).toEqual(credentialSnapshot);
    expect((await client.query('SELECT variant_id,stock_quantity FROM inventory_balances ORDER BY variant_id')).rows).toEqual(stockSnapshot);
    expect((await client.query('SELECT id,total_amount FROM orders ORDER BY id')).rows).toEqual(totals);
  });
  it('is repeatable without changing data, user edits, passwords or existing sessions',async()=>{
    await client.query("UPDATE products SET description='Nội dung đã chỉnh sau import' WHERE code='SP01'");
    const hash=await argon2.hash(randomUUID());await client.query('UPDATE accounts SET password_hash=$2 WHERE id=$1',[adminId,hash]);
    const versions=(await client.query('SELECT id,version,auth_version FROM accounts ORDER BY id')).rows;
    const sessionCount=(await client.query('SELECT count(*) FROM auth_sessions WHERE revoked_at IS NULL')).rows;
    await client.query(seed);
    expect((await client.query('SELECT id,version,auth_version FROM accounts ORDER BY id')).rows).toEqual(versions);
    expect((await client.query('SELECT count(*) FROM auth_sessions WHERE revoked_at IS NULL')).rows).toEqual(sessionCount);
    expect((await client.query('SELECT password_hash FROM accounts WHERE id=$1',[adminId])).rows[0].password_hash).toBe(hash);
    expect((await client.query("SELECT description FROM products WHERE code='SP01'")).rows[0].description).toBe('Nội dung đã chỉnh sau import');
    expect(Number((await client.query('SELECT count(*) FROM orders')).rows[0].count)).toBe(6);
  });
});
