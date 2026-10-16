import { config } from 'dotenv';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { root } from '../src/core/config';
config({path:resolve(root,'.local/bootstrap-admin.env'),quiet:true});
const keys=['BOOTSTRAP_ADMIN_USERNAME','BOOTSTRAP_ADMIN_EMAIL','BOOTSTRAP_ADMIN_PASSWORD','BOOTSTRAP_ADMIN_FULL_NAME','BOOTSTRAP_ADMIN_PHONE'];
for(const key of keys)if(!process.env[key])throw new Error(`Set ${key} in .local/bootstrap-admin.env or environment`);
// Pass names only on argv: Docker reads the values from its process environment.
execFileSync('docker',['compose','exec','-T',...keys.flatMap(key=>['-e',key]),'api','node','apps/api/dist/scripts/bootstrap.js'],{cwd:root,env:process.env,stdio:'inherit'});
