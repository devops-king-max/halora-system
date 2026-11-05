import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { load } from 'js-yaml';
import { root } from '../src/core/config';

config({ path: resolve(root, '.env.test.local'), quiet: true });
const configured = process.env.TEST_DATABASE_URL;

const matrixCounts = [
  { role: 'ACCOUNTANT', permissions: 21 },
  { role: 'ADMIN', permissions: 64 },
  { role: 'CUSTOMER', permissions: 0 },
  { role: 'SALES', permissions: 18 },
  { role: 'WAREHOUSE', permissions: 32 },
];

const parseSchema = () => {
  const schema = readFileSync(resolve(root, 'database/schema.sql'), 'utf8');
  const roles = new Map(
    [...schema.matchAll(/INSERT INTO public\.roles VALUES \('([^']+)', '([^']+)'/g)].map((match) => [match[1], match[2]])
  );
  const counts = new Map<string, number>();
  for (const match of schema.matchAll(/INSERT INTO public\.role_permissions VALUES \('([^']+)', '[^']+'\)/g)) {
    const code = roles.get(match[1]);
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return {
    permissions: [...schema.matchAll(/INSERT INTO public\.permissions VALUES \('[^']+', '([^']+)'/g)].map((match) => match[1]),
    counts: [...roles.values()].sort().map((role) => ({ role, permissions: counts.get(role) ?? 0 })),
  };
};

describe('Fixed role permission matrix (exported schema)', () => {
  it('exports exactly the migration-defined permission sets for every role', () => {
    const { permissions, counts } = parseSchema();
    expect(counts).toEqual(matrixCounts);
    expect(permissions).toHaveLength(64);
    expect(permissions).not.toContain('roles.update');
  });

  it('documents at most one role per staff assignment in OpenAPI', () => {
    const spec = load(readFileSync(resolve(root, 'docs/api/openapi.yaml'), 'utf8')) as {
      components: { schemas: Record<string, { properties?: { roleIds?: { maxItems?: number } } }> };
    };
    expect(spec.components.schemas.EmployeeRoleAssignInput.properties?.roleIds?.maxItems).toBe(1);
    expect(spec.components.schemas.AccountRoleAssignInput.properties?.roleIds?.maxItems).toBe(1);
  });
});

(configured ? describe : describe.skip)('Fixed role permission matrix (migrated database)', () => {
  it('keeps the migration-defined permission counts and exposes no per-account overrides', async () => {
    const name = `halora_test_${randomUUID().replaceAll('-', '')}`;
    const url = new URL(configured!);
    url.pathname = '/postgres';
    const admin = new Client({ connectionString: url.toString() });
    await admin.connect();
    let client: Client | undefined;
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
      url.pathname = `/${name}`;
      execFileSync(process.execPath, [require.resolve('tsx/cli'), resolve(root, 'apps/api/scripts/migrate.ts')], {
        env: { ...process.env, DATABASE_URL: url.toString() },
        stdio: 'pipe',
      });
      client = new Client({ connectionString: url.toString() });
      await client.connect();
      const counts = (await client.query(
        "SELECT r.code AS role,count(rp.permission_id)::integer AS permissions FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id GROUP BY r.code ORDER BY r.code"
      )).rows;
      expect(counts).toEqual(matrixCounts);
      const codes = (await client.query('SELECT code FROM permissions ORDER BY code')).rows.map((row) => row.code);
      expect(codes).toHaveLength(64);
      expect(codes).not.toContain('roles.update');
      expect((await client.query(
        "SELECT count(*)::integer AS count FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('account_permissions','permission_overrides')"
      )).rows[0].count).toBe(0);
      expect((await client.query(
        'SELECT count(*)::integer AS count FROM permissions p WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.permission_id=p.id)'
      )).rows[0].count).toBe(0);
    } finally {
      if (client) await client.end();
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [name]);
      await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
      await admin.end();
    }
  }, 120000);
});
