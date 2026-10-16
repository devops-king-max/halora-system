import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { Client } from 'pg';
import { root } from '../src/core/config';
config({path:resolve(root,'.env.test.local'),quiet:true});
async function main(){
  if(!process.env.TEST_DATABASE_URL)throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL server with CREATEDB permission.');
  const base=new URL(process.env.TEST_DATABASE_URL);base.pathname='/postgres';
  const admin=new Client({connectionString:base.toString()});await admin.connect();
  const first=`halora_schema_${randomUUID().replaceAll('-','')}`,second=`halora_schema_${randomUUID().replaceAll('-','')}`;
  const run=(script:string,url:string)=>execFileSync(process.execPath,[require.resolve('tsx/cli'),resolve(root,`apps/api/scripts/${script}.ts`)],{env:{...process.env,DATABASE_URL:url},encoding:'utf8'});
  try{
    await admin.query(`CREATE DATABASE "${first}"`);await admin.query(`CREATE DATABASE "${second}"`);
    base.pathname=`/${first}`;run('migrate',base.toString());
    if(process.env.UPDATE_SCHEMA==='true')run('export-schema',base.toString());
    base.pathname=`/${second}`;
    const imported=new Client({connectionString:base.toString()});await imported.connect();
    try{
      await imported.query(readFileSync(resolve(root,'database/schema.sql'),'utf8'));
      const before=await imported.query('SELECT count(*)::integer AS count FROM pgmigrations');
      const expected=readdirSync(resolve(root,'database/migrations')).filter(f=>f.endsWith('.sql')).length;
      if(before.rows[0].count!==expected)throw new Error('Schema baseline is missing migration history.');
      run('migrate',base.toString());
      const duplicate=await imported.query('SELECT count(*)::integer AS count FROM pgmigrations');
      if(duplicate.rows[0].count!==expected)throw new Error('Schema installation reapplied migrations.');
      const inspectSql="SELECT c.relname AS name,c.relkind AS kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v','S') ORDER BY c.relname";
      const left=new Client({connectionString:new URL(`/${first}`,base).toString()});await left.connect();
      try{
        const migrated=await left.query(inspectSql),restored=await imported.query(inspectSql);
        if(JSON.stringify(migrated.rows)!==JSON.stringify(restored.rows))throw new Error('Schema objects differ.');
        const constraints="SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2";
        if(JSON.stringify((await left.query(constraints)).rows)!==JSON.stringify((await imported.query(constraints)).rows))throw new Error('Schema constraints differ.');
        const structures=[
          ['indexes',"SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2"],
          ['columns',"SELECT table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_name,domain_name,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position"],
          ['views',"SELECT table_name,view_definition FROM information_schema.views WHERE table_schema='public' ORDER BY table_name"],
          ['triggers',"SELECT tgrelid::regclass::text AS table_name,tgname,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) ORDER BY 1,2"],
          ['functions',"SELECT proname,pg_get_functiondef(oid) AS definition FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY proname"],
          ['system roles',"SELECT code,name,description FROM roles ORDER BY code"],
          ['system permissions',"SELECT code,name,description FROM permissions ORDER BY code"],
          ['system grants',"SELECT r.code AS role,p.code AS permission FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id ORDER BY 1,2"],
          ['migration names',"SELECT name FROM pgmigrations ORDER BY id"],
        ];
        // pg_dump on Windows uses CRLF inside function bodies; line endings do not alter SQL semantics.
        const canonical=(rows:unknown)=>JSON.stringify(rows,(_key,value)=>typeof value==='string'?value.replaceAll('\r\n','\n'):value);
        for(const [kind,query] of structures)if(canonical((await left.query(query)).rows)!==canonical((await imported.query(query)).rows))throw new Error(`Schema ${kind} differ.`);
      }finally{await left.end();}
      console.log('schema.sql verified: objects, columns, indexes, constraints, views, triggers, functions and migration replay are consistent.');
    }finally{await imported.end();}
  }finally{
    for(const name of [first,second]){await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1',[name]);await admin.query(`DROP DATABASE IF EXISTS "${name}"`);}
    await admin.end();
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Schema verification failed');process.exitCode=1;});
