import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { root } from '../src/core/config';

const target = resolve(root, '.local/backups');
mkdirSync(target, { recursive: true });
const filename = `halora-${new Date().toISOString().replaceAll(':','-')}-${randomUUID().slice(0,8)}.dump`;
const docker = (...args:string[]) => execFileSync('docker', ['compose', ...args], { cwd:root, stdio:'pipe' });
try {
  docker('exec','-T','db','sh','-c',`pg_dump --format=custom --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --file=/tmp/${filename}`);
  docker('cp',`db:/tmp/${filename}`,resolve(target,filename));
  console.log(`Backup saved: .local/backups/${filename}`);
} catch { console.error('Backup failed. Check that the Compose db service is running.'); process.exitCode=1; }
finally { try { docker('exec','-T','db','rm','-f',`/tmp/${filename}`); } catch { /* Container may be unavailable. */ } }
