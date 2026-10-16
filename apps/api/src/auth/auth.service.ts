import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import jwt, { JwtPayload } from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { Actor, Database, Row, ident } from '../core/db';
import { assert, fail, version } from '../core/errors';
import { secret, settings } from '../core/config';
import { Context, Routes } from '../core/registry';

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
export async function hashPassword(value: unknown): Promise<string> {
  assert(typeof value === 'string' && value.length >= 10 && value.length <= 128, 'VALIDATION_ERROR', 'Mật khẩu phải có từ 10 đến 128 ký tự.', 400);
  return argon2.hash(value, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
@Injectable()
export class AuthService {
  private readonly jwtSecret = secret('JWT_SECRET');
  private readonly dummy = hashPassword(randomBytes(24).toString('hex'));
  constructor(@Inject(Database) private readonly db: Database) {}

  async principal(accountId: unknown): Promise<Actor> {
    const a = await this.db.one(`SELECT a.*,c.id AS customer_id,c.full_name AS customer_name,c.status AS customer_status,e.id AS employee_id,e.full_name AS employee_name,e.status AS employee_status FROM accounts a LEFT JOIN customers c ON c.account_id=a.id LEFT JOIN employees e ON e.account_id=a.id WHERE a.id=$1`, [accountId]);
    assert(a.status === 'ACTIVE' && (a.realm === 'CUSTOMER' ? a.customerStatus === 'ACTIVE' : a.employeeStatus === 'ACTIVE'), 'UNAUTHENTICATED', 'Tài khoản không hoạt động.', 401);
    const roles = a.realm === 'STAFF' ? await this.db.query('SELECT r.code FROM roles r JOIN employee_roles er ON er.role_id=r.id WHERE er.employee_id=$1 ORDER BY r.code',[a.employeeId]) : [{code:'CUSTOMER'}];
    const permissions = a.realm === 'STAFF' ? await this.db.query('SELECT DISTINCT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id JOIN employee_roles er ON er.role_id=rp.role_id WHERE er.employee_id=$1 ORDER BY p.code',[a.employeeId]) : [];
    return { accountId:String(a.id),realm:a.realm as Actor['realm'],username:String(a.username),email:String(a.email),displayName:String(a.customerName || a.employeeName),customerId:a.customerId ? String(a.customerId):null,employeeId:a.employeeId ? String(a.employeeId):null,roles:roles.map(r=>String(r.code)),permissions:permissions.map(p=>String(p.code)),authVersion:Number(a.authVersion),sessionId:'' };
  }
  publicPrincipal(actor: Actor): Row {
    const {sessionId: _s,authVersion: _v,...publicFields} = actor;
    return publicFields;
  }
  async authenticate(authorization?: string): Promise<Actor> {
    try {
      assert(authorization && authorization.startsWith('Bearer '),'UNAUTHENTICATED','Vui lòng đăng nhập.',401);
      const token = jwt.verify(authorization.slice(7),this.jwtSecret,{algorithms:['HS256'],issuer:'halora',audience:'halora-api'}) as JwtPayload;
      const actor = await this.principal(token.sub);
      const sessions = await this.db.query('SELECT id FROM auth_sessions WHERE id=$1 AND account_id=$2 AND revoked_at IS NULL AND expires_at>now()',[token.sid,actor.accountId]);
      assert(sessions.length && token.av === actor.authVersion,'UNAUTHENTICATED','Phiên đăng nhập đã hết hiệu lực.',401);
      return {...actor,sessionId:String(token.sid)};
    } catch { fail('UNAUTHENTICATED','Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',401); }
  }
  private access(actor: Actor, sessionId: unknown): string {
    return jwt.sign({sid:sessionId,av:actor.authVersion},this.jwtSecret,{subject:actor.accountId,issuer:'halora',audience:'halora-api',expiresIn:900,algorithm:'HS256'});
  }
  private cookie(c: Context, value: string, clear=false): void {
    const options = { httpOnly:true,secure:settings.cookieSecure,sameSite:'lax' as const,path:'/api/v1/auth/staff' };
    if (clear) c.res.clearCookie('refreshToken',options);
    else c.res.cookie('refreshToken',value,{...options,maxAge:30*24*3600*1000});
  }
  private result(c: Context, actor: Actor, sessionId: unknown, refreshToken: string): Row {
    const data: Row = {accessToken:this.access(actor,sessionId),expiresIn:900,principal:this.publicPrincipal(actor)};
    if (actor.realm==='STAFF') this.cookie(c,refreshToken); else data.refreshToken=refreshToken;
    return data;
  }
  private checkOrigin(c: Context): void {
    const origin = c.req.headers.origin;
    assert(!origin || settings.origins.includes(origin),'FORBIDDEN','Nguồn yêu cầu không được phép.',403);
    assert(c.req.headers['sec-fetch-site'] !== 'cross-site','FORBIDDEN','Yêu cầu cookie khác site không được phép.',403);
  }
  async login(c: Context, realm: string): Promise<Row> {
    const identifier = String(c.body.identifier).trim().toLowerCase();
    const a = (await this.db.query('SELECT id,password_hash FROM accounts WHERE realm=$1 AND (lower(username)=$2 OR lower(email)=$2)',[realm,identifier]))[0];
    const valid = await argon2.verify(a ? String(a.passwordHash):await this.dummy,String(c.body.password));
    assert(a && valid,'UNAUTHENTICATED','Thông tin đăng nhập không đúng.',401);
    return this.db.transaction(async()=>{
      await this.db.one('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[a.id]);
      const actor = await this.principal(a.id), token = randomBytes(48).toString('base64url');
      const session = await this.db.insert('auth_sessions',{accountId:a.id,refreshTokenHash:hashToken(token),expiresAt:new Date(Date.now()+30*86400000)});
      await this.db.audit(actor,'LOGIN','account',a.id,c.req.get('x-request-id'));
      return this.result(c,actor,session.id,token);
    });
  }
  async refresh(c: Context, realm: string): Promise<Row> {
    if (realm==='STAFF') this.checkOrigin(c);
    const token = realm==='STAFF' ? c.req.cookies?.refreshToken : c.body.refreshToken;
    assert(typeof token==='string' && token.length<=256,'UNAUTHENTICATED','Thiếu phiên đăng nhập.',401);
    // A replay revocation must commit even when the HTTP result is 401.
    const result = await this.db.transaction(async()=>{
      const hash = hashToken(token);
      const s = (await this.db.query('SELECT s.*,a.realm FROM auth_sessions s JOIN accounts a ON a.id=s.account_id WHERE (s.refresh_token_hash=$1 OR s.previous_token_hash=$1) FOR UPDATE OF s',[hash]))[0];
      if (!s || s.realm!==realm || s.revokedAt || new Date(String(s.expiresAt)).getTime()<=Date.now()) return null;
      if (s.refreshTokenHash!==hash) { await this.db.query('UPDATE auth_sessions SET revoked_at=now() WHERE id=$1',[s.id]); return null; }
      const actor = await this.principal(s.accountId), next = randomBytes(48).toString('base64url');
      await this.db.query('UPDATE auth_sessions SET previous_token_hash=refresh_token_hash,refresh_token_hash=$2 WHERE id=$1',[s.id,hashToken(next)]);
      return this.result(c,actor,s.id,next);
    });
    assert(result,'UNAUTHENTICATED','Phiên đăng nhập không hợp lệ.',401);
    return result;
  }
  async register(c: Context): Promise<Row> {
    const passwordHash = await hashPassword(c.body.password);
    return this.db.transaction(async()=>{
      const a = await this.db.insert('accounts',{realm:'CUSTOMER',username:String(c.body.username).trim(),email:String(c.body.email).trim().toLowerCase(),passwordHash});
      const customer = await this.db.insert('customers',{accountId:a.id,fullName:c.body.fullName,phone:c.body.phone});
      await this.db.insert('carts',{customerId:customer.id});
      return {customerId:customer.id,accountId:a.id};
    });
  }
  async forgot(c: Context, realm: string): Promise<Row> {
    const generic = {message:'Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi.'};
    const a = (await this.db.query('SELECT id,email FROM accounts WHERE realm=$1 AND lower(email)=lower($2) AND status=\'ACTIVE\'',[realm,c.body.email]))[0];
    if (!a) return generic;
    const token = randomBytes(40).toString('base64url');
    const entry = await this.db.insert('password_reset_tokens',{accountId:a.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+30*60000)});
    const url = new URL(realm==='STAFF' ? (process.env.STAFF_RESET_URL || 'http://localhost:5173/reset-password') : (process.env.CUSTOMER_RESET_URL || 'halora://reset-password'));
    url.searchParams.set('token',token);
    try {
      const transport = nodemailer.createTransport({host:process.env.SMTP_HOST || '127.0.0.1',port:Number(process.env.SMTP_PORT || 1025),secure:false,connectionTimeout:5000});
      await transport.sendMail({from:process.env.MAIL_FROM || 'Halora <no-reply@halora.local>',to:String(a.email),subject:'Đặt lại mật khẩu Halora',text:`Liên kết có hiệu lực 30 phút: ${url.toString()}`});
      transport.close();
    } catch {
      await this.db.query('DELETE FROM password_reset_tokens WHERE id=$1',[entry.id]);
      // No recipient, token or reset URL is logged.
      console.error(JSON.stringify({event:'password_reset_mail_failed',requestId:c.req.get('x-request-id')}));
    }
    return generic;
  }
  async revoke(accountId: unknown): Promise<void> {
    await this.db.query('UPDATE accounts SET auth_version=auth_version+1 WHERE id=$1',[accountId]);
    await this.db.query('UPDATE auth_sessions SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL',[accountId]);
  }
  async reset(c: Context, realm: string): Promise<Row> {
    const passwordHash = await hashPassword(c.body.newPassword);
    return this.db.transaction(async()=>{
      const t = (await this.db.query('SELECT t.* FROM password_reset_tokens t JOIN accounts a ON a.id=t.account_id WHERE t.token_hash=$1 AND a.realm=$2 AND t.used_at IS NULL AND t.expires_at>now() FOR UPDATE OF t',[hashToken(String(c.body.token)),realm]))[0];
      assert(t,'VALIDATION_ERROR','Liên kết không hợp lệ hoặc đã hết hạn.',400);
      await this.db.query('UPDATE accounts SET password_hash=$2 WHERE id=$1',[t.accountId,passwordHash]);
      await this.db.query('UPDATE password_reset_tokens SET used_at=now() WHERE account_id=$1 AND used_at IS NULL',[t.accountId]);
      await this.revoke(t.accountId);
      return {message:'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.'};
    });
  }
  async guardAdministrator(actor: Actor): Promise<void> { assert(actor.roles.includes('ADMIN'),'FORBIDDEN','Chỉ quản trị viên được thay đổi tài khoản hoặc quyền.',403); }
  async ensureActiveAdministrator(): Promise<void> {
    const count = await this.db.one("SELECT count(*)::integer AS count FROM employees e JOIN accounts a ON a.id=e.account_id WHERE e.status='ACTIVE' AND a.status='ACTIVE' AND EXISTS(SELECT 1 FROM employee_roles er JOIN roles r ON r.id=er.role_id WHERE er.employee_id=e.id AND r.code='ADMIN')");
    assert(Number(count.count)>0,'INVALID_STATE','Phải giữ ít nhất một quản trị viên đang hoạt động.');
  }
  private async profile(c:Context):Promise<Row>{
    const table=c.actor.realm==='STAFF'?'employees':'customers';
    return this.db.one(`SELECT a.id AS account_id,a.realm,a.username,a.email,p.full_name,p.phone,p.version FROM accounts a JOIN ${table} p ON p.account_id=a.id WHERE a.id=$1`,[c.actor.accountId]);
  }
  private async updateProfile(c:Context):Promise<Row>{
    return this.db.transaction(async()=>{
      const account=await this.db.one('SELECT id,email,status FROM accounts WHERE id=$1 FOR UPDATE',[c.actor.accountId]);
      assert(account.status==='ACTIVE','UNAUTHENTICATED','Tài khoản không hoạt động.',401);
      const table=c.actor.realm==='STAFF'?'employees':'customers';
      const current=await this.db.one(`SELECT * FROM ${table} WHERE account_id=$1 FOR UPDATE`,[c.actor.accountId]);
      version(current,c.body.version);
      assert(current.status==='ACTIVE','UNAUTHENTICATED','Hồ sơ không hoạt động.',401);
      const email=String(c.body.email).trim().toLowerCase();
      if(email!==account.email){
        await this.db.update('accounts',account.id,{email});
        await this.db.query('DELETE FROM password_reset_tokens WHERE account_id=$1 AND used_at IS NULL',[account.id]);
      }
      await this.db.update(table,current.id,{fullName:String(c.body.fullName).trim(),phone:String(c.body.phone).trim(),...(c.actor.realm==='STAFF'?{email}:{})});
      await this.db.audit(c.actor,'UPDATE_PROFILE',table,current.id,c.req.get('x-request-id'));
      return this.profile(c);
    });
  }
  registerRoutes(routes: Routes): void {
    for (const realm of ['STAFF','CUSTOMER']) {
      const prefix=`/auth/${realm.toLowerCase()}`;
      routes.add('POST',`${prefix}/login`,{public:true},c=>this.login(c,realm));
      routes.add('POST',`${prefix}/refresh`,{public:true},c=>this.refresh(c,realm));
      routes.add('POST',`${prefix}/forgot-password`,{public:true},c=>this.forgot(c,realm));
      routes.add('POST',`${prefix}/reset-password`,{public:true},c=>this.reset(c,realm));
      routes.add('POST',`${prefix}/logout`,{public:true},async c=>{
        if(realm==='STAFF') this.checkOrigin(c);
        const token=realm==='STAFF'?c.req.cookies?.refreshToken:c.body.refreshToken;
        if(typeof token==='string') await this.db.query('UPDATE auth_sessions SET revoked_at=now() WHERE refresh_token_hash=$1 AND account_id IN (SELECT id FROM accounts WHERE realm=$2)',[hashToken(token),realm]);
        if(realm==='STAFF') this.cookie(c,'',true);
        return {message:'Đã đăng xuất.'};
      });
    }
    routes.add('POST','/auth/customer/register',{public:true},c=>this.register(c));
    routes.add('GET','/auth/me',{},async c=>this.publicPrincipal(c.actor));
    routes.add('GET','/auth/profile',{},c=>this.profile(c));
    routes.add('PATCH','/auth/profile',{},c=>this.updateProfile(c));
    routes.add('POST','/auth/change-password',{},async c=>this.db.transaction(async()=>{
      const a=await this.db.one('SELECT password_hash FROM accounts WHERE id=$1 FOR UPDATE',[c.actor.accountId]);
      assert(await argon2.verify(String(a.passwordHash),String(c.body.currentPassword)),'VALIDATION_ERROR','Mật khẩu hiện tại không đúng.',400);
      await this.db.query('UPDATE accounts SET password_hash=$2 WHERE id=$1',[c.actor.accountId,await hashPassword(c.body.newPassword)]);
      await this.revoke(c.actor.accountId);
      return {message:'Đã đổi mật khẩu. Vui lòng đăng nhập lại.'};
    }));
  }
}
