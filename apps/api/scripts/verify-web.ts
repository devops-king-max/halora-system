import { config } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { root } from '../src/core/config';

config({path:resolve(root,'.local/bootstrap-admin.env'),quiet:true});
async function main(){
  const origin=process.env.DEMO_PUBLIC_BASE_URL||`http://localhost:${process.env.WEB_PORT||8080}`;
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:process.platform==='win32'?{channel:'chrome'}:{})});
  try{
    const page=await browser.newPage();
    const errors:string[]=[],failures:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${origin}/login`);
    await page.getByLabel('Tên đăng nhập hoặc Email').fill(process.env.BOOTSTRAP_ADMIN_USERNAME!);
    await page.getByLabel('Mật khẩu',{exact:true}).fill(process.env.BOOTSTRAP_ADMIN_PASSWORD!);
    await page.getByRole('button',{name:'Đăng nhập hệ thống'}).click();
    await page.getByRole('heading',{name:'Tổng quan hệ thống'}).waitFor();
    page.on('response',r=>{if(r.url().includes('/api/v1/')&&r.status()>=400&&!(r.status()===401&&new URL(r.url()).pathname==='/api/v1/auth/me'))failures.push(`${r.status()} ${new URL(r.url()).pathname}`);});
    const paths=['dashboard','categories','brands','products','customers','employees','accounts','roles','suppliers','goods-receipts','inventory','inventory-adjustments','promotions','orders','invoices','reports'];
    for(const path of paths){
      await page.locator(`a[href="${path==='dashboard'?'/':'/'+path}"]`).click();
      await page.waitForLoadState('networkidle');
      if(path==='categories'){await page.reload();await page.waitForLoadState('networkidle');}
      if(page.url().includes('/login'))throw new Error(`Session was lost on ${path}.`);
      if(path==='categories'){
        if(/danh mục/i.test(await page.locator('body').innerText()))throw new Error('Terminology mismatch in the admin UI.');
        mkdirSync(resolve(root,'.local'),{recursive:true});
        await page.screenshot({path:resolve(root,'.local/admin-docker.png'),fullPage:true});
      }
    }
    await page.goto(`${origin}/api/docs`);await page.waitForLoadState('networkidle');
    await page.locator('.swagger-ui').first().waitFor();
    if(errors.length||failures.length)throw new Error([...errors,...failures].join('\n'));
    console.log(`Production web verified through Nginx: ${paths.length} admin routes and Swagger; no browser exceptions or failed API responses after login.`);
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Web verification failed');process.exitCode=1;});
