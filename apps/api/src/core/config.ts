import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const root = (() => {
  let dir = process.cwd();
  while (!existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
    const parent = resolve(dir, '..');
    if (parent === dir) throw new Error('Cannot locate Halora workspace');
    dir = parent;
  }
  return dir;
})();
config({ path: resolve(root, '.env'), quiet: true });
export function secret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 32 || value.startsWith('replace_')) throw new Error(`${name} must be a generated secret containing at least 32 characters`);
  return value;
}
export function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = process.env.POSTGRES_PASSWORD;
  if (!password) throw new Error('POSTGRES_PASSWORD is required');
  return `postgresql://${encodeURIComponent(process.env.POSTGRES_USER || 'halora_app')}:${encodeURIComponent(password)}@${process.env.DB_HOST || '127.0.0.1'}:${process.env.POSTGRES_PORT || '5433'}/${encodeURIComponent(process.env.POSTGRES_DB || 'halora')}`;
}
export const settings = {
  port: Number(process.env.PORT || 3000),
  origins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080').split(',').map(s => s.trim()),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
  uploadDir: resolve(process.env.UPLOAD_DIR || resolve(root, '.local/uploads')),
  production: process.env.NODE_ENV === 'production',
  cookieSecure: process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false'),
  shippingFee: process.env.SHIPPING_FEE || '30000',
};
if(!/^\d{1,18}$/.test(settings.shippingFee))throw new Error('SHIPPING_FEE must be a nonnegative integer VND string, at most 18 digits');
if(!Number.isInteger(settings.port)||settings.port<1||settings.port>65535)throw new Error('PORT must be between 1 and 65535');
