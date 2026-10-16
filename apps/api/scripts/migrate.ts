import { resolve } from 'node:path';
import { databaseUrl, root } from '../src/core/config';
async function main(){
  const { runner } = await import('node-pg-migrate');
  const migrations=await runner({databaseUrl:databaseUrl(),dir:resolve(root,'database/migrations'),migrationsTable:'pgmigrations',direction:'up',singleTransaction:true,checkOrder:true,verbose:false,log:()=>undefined});
  console.log(`Database migration complete: ${migrations.length} applied.`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Migration failed');process.exitCode=1;});
