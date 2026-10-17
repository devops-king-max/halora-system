import { config } from 'dotenv';
import { readFileSync,readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { root } from '../src/core/config';

config({path:resolve(root,'.env.test.local'),quiet:true});
const configured=process.env.TEST_DATABASE_URL;
(configured?describe:describe.skip)('Single promotion type migration on existing transactions',()=>{
  it('splits mixed configurations without rewriting financial snapshots, voucher holds or first-use history',async()=>{
    const name=`halora_test_${randomUUID().replaceAll('-','')}`;
    const url=new URL(configured!);url.pathname='/postgres';
    const admin=new Client({connectionString:url.toString()});await admin.connect();
    let client:Client|undefined;
    try{
      await admin.query(`CREATE DATABASE "${name}"`);url.pathname='/'+name;
      client=new Client({connectionString:url.toString()});await client.connect();
      for(const file of readdirSync(resolve(root,'database/migrations')).filter(f=>/^00[1-7]_.*\.sql$/.test(f)).sort())
        await client.query(readFileSync(resolve(root,'database/migrations',file),'utf8').split('-- Down Migration')[0]);
      const account=(await client.query("INSERT INTO accounts(realm,username,email,password_hash) VALUES('STAFF','migration_admin','migration@example.test','initial-test-hash') RETURNING id")).rows[0];
      const employee=(await client.query("INSERT INTO employees(account_id,full_name,phone,email,position) VALUES($1,'Quản trị kiểm thử','0900000000','migration@example.test','Quản trị') RETURNING id",[account.id])).rows[0];
      await client.query("INSERT INTO employee_roles(employee_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",[employee.id]);
      let seed=readFileSync(resolve(root,'database/seed-demo.sql'),'utf8').replace(/^\\set .*$/gm,'');
      const begin=seed.indexOf('    INSERT INTO promotions('),end=seed.indexOf('    INSERT INTO product_promotion_rules(',begin);
      const legacy=seed.slice(begin,end).replace(',status,type)',',status)').replace(/,'(?:PRODUCT|ORDER|VOUCHER)'(?=\))/g,'');
      seed=seed.slice(0,begin)+legacy+seed.slice(end);await client.query(seed);
      const original=(await client.query("SELECT id FROM promotions WHERE code='KM01'")).rows[0].id;
      await client.query('UPDATE order_promotion_rules SET promotion_id=$1',[original]);
      await client.query('UPDATE vouchers SET promotion_id=$1',[original]);
      await client.query('UPDATE order_discounts SET promotion_id=$1',[original]);await client.query('UPDATE promotion_usage SET promotion_id=$1',[original]);
      await client.query("DELETE FROM promotions WHERE code IN ('KM03','KM04')");
      const tables=['orders','order_items','order_discounts','voucher_redemptions','promotion_usage','stock_movements','inventory_balances','invoices','invoice_items'];
      const snapshot=async()=>{const result:Record<string,string>={};for(const table of tables)result[table]=(await client!.query(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]')) AS hash FROM ${table} t`)).rows[0].hash;return result;};
      const before=await snapshot();
      await client.query('BEGIN');
      await client.query(readFileSync(resolve(root,'database/migrations/008_single_promotion_type.sql'),'utf8').split('-- Down Migration')[0]);
      await client.query('COMMIT');
      expect(await snapshot()).toEqual(before);
      const programs=(await client.query("SELECT p.type,p.has_usage FROM api_promotions p WHERE p.status='ACTIVE' ORDER BY p.type")).rows;
      expect(programs).toEqual([{type:'ORDER',has_usage:true},{type:'PRODUCT',has_usage:true},{type:'VOUCHER',has_usage:true}]);
      expect((await client.query("SELECT p.type FROM vouchers v JOIN promotions p ON p.id=v.promotion_id WHERE v.code='VC01'")).rows[0].type).toBe('VOUCHER');
      await expect(client.query("UPDATE promotions SET type='ORDER' WHERE id=$1",[original])).rejects.toMatchObject({code:'23001'});
    }finally{
      if(client)await client.end();
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1',[name]);await admin.query(`DROP DATABASE IF EXISTS "${name}"`);await admin.end();
    }
  },120000);
});
