import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const envPath = resolve(root, '.env');
if (!existsSync(envPath)) {
  const contents = readFileSync(resolve(root, '.env.example'), 'utf8')
    .replace('replace_with_a_local_password', randomBytes(32).toString('hex'))
    .replace('replace_with_a_random_secret_of_at_least_32_characters', randomBytes(48).toString('hex'))
    .replace('replace_with_another_random_secret_of_at_least_32_characters', randomBytes(48).toString('hex'));
  writeFileSync(envPath, contents, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with generated secrets.');
} else console.log('Kept existing .env.');

mkdirSync(resolve(root, '.local'), { recursive: true });
const credentials = resolve(root, '.local/bootstrap-admin.env');
if (!existsSync(credentials)) {
  const suffix = randomBytes(4).toString('hex');
  writeFileSync(credentials, [
    `BOOTSTRAP_ADMIN_USERNAME=admin_${suffix}`,
    `BOOTSTRAP_ADMIN_EMAIL=admin-${suffix}@halora.test`,
    `BOOTSTRAP_ADMIN_PASSWORD=${randomBytes(32).toString('base64url')}`,
    `BOOTSTRAP_ADMIN_FULL_NAME=Quản trị Halora ${suffix}`,
    `BOOTSTRAP_ADMIN_PHONE=09${randomInt(0, 100000000).toString().padStart(8, '0')}`,
    '',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Created .local/bootstrap-admin.env. No account has been inserted yet.');
} else console.log('Kept existing administrator credentials.');
console.log('Credentials remain local. Run db:bootstrap:docker after migration to create the account.');
