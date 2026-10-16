import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Client } from 'pg';
import { root } from '../src/core/config';

config({path:resolve(root,'.env.test.local'),quiet:true});
async function main(){
  if(!process.env.TEST_DATABASE_URL)throw new Error('Set TEST_DATABASE_URL on an isolated PostgreSQL 18 server with CREATEDB permission.');
  const url=new URL(process.env.TEST_DATABASE_URL);url.pathname='/postgres';
  const admin=new Client({connectionString:url.toString()});await admin.connect();
  const name=`halora_docs_${randomUUID().replaceAll('-','')}`;
  let db:Client|undefined,created=false;
  const cell=(value:unknown)=>String(value??'—').replaceAll('|','\\|').replaceAll('\n',' ');
  const lines=['# Từ điển dữ liệu Halora','','Xuất từ `database/schema.sql` trên PostgreSQL 18. Cột tiền dùng domain `money_vnd = numeric(18,0) >= 0`; tỷ lệ dùng `discount_percent = numeric(5,2)` trong 0–100. Các tên dưới đây là tên SQL; API dùng camelCase. Không có dữ liệu kinh doanh trong bản xuất.','','Tái tạo tài liệu: `pnpm --filter @halora/api exec tsx scripts/document-schema.ts` với `TEST_DATABASE_URL` cho phép tạo database thử riêng.','','## Bảng nghiệp vụ và hỗ trợ',''];
  try{
    await admin.query(`CREATE DATABASE "${name}"`);created=true;url.pathname=`/${name}`;
    db=new Client({connectionString:url.toString()});await db.connect();
    await db.query(readFileSync(resolve(root,'database/schema.sql'),'utf8'));
    const tables=await db.query("SELECT c.relname AS name,obj_description(c.oid) AS description FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname<>'pgmigrations' ORDER BY c.relname");
    for(const table of tables.rows){
      lines.push(`### ${table.name}`,'');if(table.description)lines.push(table.description,'');
      lines.push('| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |','|---|---|---|---|');
      const columns=await db.query("SELECT a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS required,pg_get_expr(d.adbin,d.adrelid) AS default_value FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relname=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum",[table.name]);
      for(const col of columns.rows)lines.push(`| \`${col.name}\` | \`${col.type}\` | ${col.required?'Có':'Không'} | ${cell(col.default_value)} |`);
      lines.push('','Ràng buộc:','');
      const constraints=await db.query("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid=$1::regclass ORDER BY contype,conname",[table.name]);
      for(const c of constraints.rows)lines.push(`- \`${c.conname}\`: \`${cell(c.definition)}\``);
      lines.push('');
      const indexes=await db.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1 ORDER BY indexname",[table.name]);
      lines.push('Chỉ mục:','');for(const i of indexes.rows)lines.push(`- \`${cell(i.indexdef)}\``);lines.push('');
    }
    const views=await db.query("SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name");
    lines.push('## View API','','Các view ánh xạ dữ liệu sang DTO; SQL đầy đủ có trong schema.','');
    for(const v of views.rows)lines.push(`- \`${v.table_name}\``);
    lines.push('','`pgmigrations` lưu baseline migration; không phải dữ liệu kinh doanh. `business_code_sequence` cấp mã chứng từ và hồ sơ. Trigger version tăng trên những bảng chỉnh sửa có cột version.','');
    writeFileSync(resolve(root,'docs/architecture/data-dictionary.md'),lines.join('\n'),'utf8');
    console.log(`Documented ${tables.rows.length} tables and ${views.rows.length} views from the actual schema.`);
  }finally{
    if(db)await db.end();
    if(created)await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Schema documentation failed');process.exitCode=1;});
