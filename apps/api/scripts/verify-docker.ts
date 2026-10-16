import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { root } from '../src/core/config';

config({path:resolve(root,'.local/bootstrap-admin.env'),quiet:true});
const origin=process.env.DEMO_PUBLIC_BASE_URL||`http://localhost:${process.env.WEB_PORT||8080}`;
const docker=(...args:string[])=>execFileSync('docker',['compose',...args],{cwd:root,stdio:'pipe'}).toString().trim();
const apiStartedAt=()=>execFileSync('docker',['inspect','--format','{{.State.StartedAt}}',docker('ps','-q','api')],{cwd:root,stdio:'pipe'}).toString().trim();
const marker=`halora-volume-check-${randomUUID()}`;
const accountCount=()=>docker('exec','-T','db','sh','-c','psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM accounts"');
async function ready(){
  for(let i=0;i<120;i++){
    try{if((await fetch(`${origin}/api/v1/ready`)).ok)return;}catch{/* Wait for startup. */}
    await new Promise(ok=>setTimeout(ok,1000));
  }
  throw new Error('Compose API did not become ready.');
}
async function main(){
  await ready();
  const html=await fetch(origin);if(!html.ok||!(await html.text()).includes('id="root"'))throw new Error('Admin HTML unavailable.');
  if(!(await fetch(`${origin}/api/docs`)).ok)throw new Error('Swagger unavailable.');
  if(!(await fetch(`http://127.0.0.1:${process.env.MAILPIT_UI_PORT||8025}/api/v1/info`)).ok)throw new Error('Mailpit unavailable.');
  const before=accountCount();
  if(Number(before)<1)throw new Error('Run db:bootstrap:docker first.');
  docker('exec','-T','api','sh','-c',`printf '%s' '${marker}' > /app/.local/uploads/${marker}`);
  try{
    // Keep the API and web running to exercise pool recovery after DB restart.
    const startedAt=apiStartedAt();
    docker('restart','db');await ready();
    if(apiStartedAt()!==startedAt)throw new Error('API process restarted after an idle database connection was closed.');
    // Recreate only the API: Nginx must discover its current address by DNS.
    docker('up','-d','--no-deps','--force-recreate','api');await ready();
    if(accountCount()!==before)throw new Error('Account count changed after restart.');
    if(docker('exec','-T','api','cat',`/app/.local/uploads/${marker}`)!==marker)throw new Error('Upload volume did not persist.');
    const login=await fetch(`${origin}/api/v1/auth/staff/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:process.env.BOOTSTRAP_ADMIN_USERNAME,password:process.env.BOOTSTRAP_ADMIN_PASSWORD})});
    const body=await login.json() as {data?:{accessToken?:string}};
    if(!login.ok||!body.data?.accessToken)throw new Error('Administrator login failed.');
    const me=await fetch(`${origin}/api/v1/auth/me`,{headers:{Authorization:`Bearer ${body.data.accessToken}`}});
    if(!me.ok)throw new Error('Authenticated API unavailable.');
    await fetch(`${origin}/api/v1/auth/staff/logout`,{method:'POST',headers:{Cookie:login.headers.get('set-cookie')?.split(';')[0]||'',Origin:origin}});
    console.log('Compose verified: admin, Swagger, Mailpit, authenticated API; recovery after database restart and API recreation without restarting web; database and upload volume persisted.');
  }finally{docker('exec','-T','api','rm','-f',`/app/.local/uploads/${marker}`);}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Docker verification failed');process.exitCode=1;});
