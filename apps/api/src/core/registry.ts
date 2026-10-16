import type { Request, Response } from 'express';
import type { Actor, Row } from './db';
import { assert } from './errors';

export interface Context { params: Record<string,string>; query: Row; body: Row; actor: Actor; req: Request; res: Response; }
export type Handler = (context: Context) => Promise<unknown>;
export interface Endpoint { method: string; path: string; permission?: string; public?: boolean; customer?: boolean; handler: Handler; }
export class Routes {
  readonly entries = new Map<string,Endpoint>();
  add(method: string, path: string, options: Omit<Endpoint,'method'|'path'|'handler'>, handler: Handler): void {
    const key = `${method.toUpperCase()} ${path}`;
    assert(!this.entries.has(key), 'INTERNAL_ERROR', `Duplicate endpoint ${key}`,500);
    this.entries.set(key,{method:method.toUpperCase(),path,...options,handler});
  }
}
