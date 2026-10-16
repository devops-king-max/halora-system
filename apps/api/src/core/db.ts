import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { databaseUrl } from './config';
import { fail } from './errors';

export type Row = Record<string, unknown>;
export const snake = (key: string): string => key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
export const ident = (value: string): string => {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('Invalid SQL identifier');
  return `"${value}"`;
};
export function dto(row: Row): Row {
  return Object.fromEntries(Object.entries(row).map(([k,v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v instanceof Date ? v.toISOString() : v]));
}
@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool = new Pool({ connectionString: databaseUrl(), max: 15, connectionTimeoutMillis: 5000, statement_timeout: 20000, options:'-c timezone=UTC' });
  private readonly storage = new AsyncLocalStorage<PoolClient>();
  constructor() {
    // pg removes the failed idle client itself. Without a listener, a database
    // restart emits an unhandled error and terminates the whole API process.
    this.pool.on('error', () => {
      Logger.warn('Kết nối PostgreSQL đang chờ đã đóng; pool sẽ tạo kết nối mới khi cần.', 'Database');
    });
  }
  async query<T extends object = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await (this.storage.getStore() || this.pool).query(sql, params);
    return result.rows.map(r => dto(r)) as T[];
  }
  async one<T extends object = Row>(sql: string, params: unknown[] = []): Promise<T> {
    const rows = await this.query<T>(sql, params);
    if (!rows[0]) fail('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
    return rows[0];
  }
  async insert(table: string, data: Row): Promise<Row> {
    const entries = Object.entries(data).filter(([,v]) => v !== undefined);
    return this.one(`INSERT INTO ${ident(table)} (${entries.map(([k]) => ident(snake(k))).join(',')}) VALUES (${entries.map((_,i) => `$${i+1}`).join(',')}) RETURNING *`, entries.map(([,v]) => v));
  }
  async update(table: string, id: unknown, data: Row): Promise<Row> {
    const entries = Object.entries(data).filter(([k,v]) => k !== 'version' && v !== undefined);
    if (!entries.length) return this.one(`SELECT * FROM ${ident(table)} WHERE id=$1`, [id]);
    return this.one(`UPDATE ${ident(table)} SET ${entries.map(([k],i) => `${ident(snake(k))}=$${i+2}`).join(',')} WHERE id=$1 RETURNING *`, [id,...entries.map(([,v]) => v)]);
  }
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.storage.getStore()) return work();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '10s'");
      const result = await this.storage.run(client, work);
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async snapshot<T>(work: () => Promise<T>): Promise<T> {
    if (this.storage.getStore()) return work();
    return this.transaction(async () => {
      await this.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      return work();
    });
  }
  async audit(actor: Actor, action: string, entityType: string, entityId?: unknown, requestId?: string): Promise<void> {
    await this.insert('audit_logs', { accountId: actor.accountId, employeeId: actor.employeeId, performedByName: actor.displayName, action, entityType, entityId: entityId || null, requestId: requestId || null });
  }
  async onModuleDestroy(): Promise<void> { await this.pool.end(); }
}
export interface Actor {
  accountId: string; realm: 'STAFF'|'CUSTOMER'; username: string; email: string; displayName: string;
  customerId: string|null; employeeId: string|null; roles: string[]; permissions: string[];
  sessionId: string; authVersion: number;
}
export interface PageQuery extends Row { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: string; }
export function pagination(query: PageQuery): { page: number; limit: number; offset: number } {
  const page = Number(query.page || 1), limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || page > 1000000 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail('VALIDATION_ERROR','Phân trang không hợp lệ.',400);
  return { page, limit, offset: (page-1)*limit };
}
export function pageResult<T>(data: T[], total: number, page: number, limit: number) { return { data, meta: { page, limit, total, totalPages: Math.ceil(total/limit) } }; }
