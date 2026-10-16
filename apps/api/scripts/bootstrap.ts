import { Database } from '../src/core/db';
import { hashPassword } from '../src/auth/auth.service';
import { assert } from '../src/core/errors';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { root } from '../src/core/config';
config({path:process.env.BOOTSTRAP_ENV_FILE||resolve(root,'.local/bootstrap-admin.env'),quiet:true});
async function main(){
  const keys=['BOOTSTRAP_ADMIN_USERNAME','BOOTSTRAP_ADMIN_EMAIL','BOOTSTRAP_ADMIN_PASSWORD','BOOTSTRAP_ADMIN_FULL_NAME','BOOTSTRAP_ADMIN_PHONE'];
  for(const key of keys)assert(process.env[key],'VALIDATION_ERROR',`Set ${key} in your local environment.`,400);
  const username=process.env.BOOTSTRAP_ADMIN_USERNAME!,email=process.env.BOOTSTRAP_ADMIN_EMAIL!;
  assert(/^[a-zA-Z0-9_.-]{3,64}$/.test(username)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'VALIDATION_ERROR','Invalid bootstrap username/email.',400);
  const passwordHash=await hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD);
  const db=new Database();
  try{
    await db.transaction(async()=>{
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended('halora-administrators',0))");
      const existing=await db.query("SELECT id FROM accounts WHERE realm='STAFF' AND (lower(username)=lower($1) OR lower(email)=lower($2))",[username,email]);
      assert(!existing.length,'INVALID_STATE','Bootstrap account already exists; credentials were not changed.');
      const account=await db.insert('accounts',{realm:'STAFF',username,email:email.toLowerCase(),passwordHash});
      const employee=await db.insert('employees',{accountId:account.id,fullName:process.env.BOOTSTRAP_ADMIN_FULL_NAME,phone:process.env.BOOTSTRAP_ADMIN_PHONE,email:email.toLowerCase(),position:'Quản trị hệ thống'});
      await db.query("INSERT INTO employee_roles(employee_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",[employee.id]);
    });
    console.log('Administrator created. No credentials were printed. Remove BOOTSTRAP_ADMIN_PASSWORD from the environment after use.');
  }finally{await db.onModuleDestroy();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Bootstrap failed');process.exitCode=1;});
