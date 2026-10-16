import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { root } from '../src/core/config';

const input = process.argv[2];
if (!input || !existsSync(resolve(input))) throw new Error('Pass the path to an existing PostgreSQL custom-format backup.');
const name=`halora_restore_${randomUUID().replaceAll('-','')}`;
const temp=`/tmp/${name}.dump`;
const docker=(...args:string[])=>execFileSync('docker',['compose',...args],{cwd:root,stdio:'pipe'});
let created=false;
try {
  docker('cp',resolve(input),`db:${temp}`);
  docker('exec','-T','db','sh','-c',`createdb --username="$POSTGRES_USER" ${name}`);created=true;
  docker('exec','-T','db','sh','-c',`pg_restore --exit-on-error --no-owner --username="$POSTGRES_USER" --dbname=${name} ${temp}`);
  const output=docker('exec','-T','db','sh','-c',`psql --username="$POSTGRES_USER" --dbname=${name} --tuples-only --no-align --command='SELECT count(*) FROM pgmigrations'`).toString().trim();
  if(!/^\d+$/.test(output)||Number(output)<2)throw new Error('Missing migration baseline.');
  console.log('Backup restored successfully into a separate scratch database; migration baseline is present.');
} catch { console.error('Restore verification failed. The application database was not replaced.');process.exitCode=1; }
finally {
  if(created)docker('exec','-T','db','sh','-c',`dropdb --username="$POSTGRES_USER" ${name}`);
  try{docker('exec','-T','db','rm','-f',temp);}catch{/* Container may be unavailable. */}
}
