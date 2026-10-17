import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from '../src/core/config';

// Explicit operator command only. Ordinary Compose startup never imports demo data.
try {
  execFileSync(process.execPath,[require.resolve('tsx/cli'),resolve(root,'apps/api/scripts/backup-docker.ts')],{cwd:root,stdio:'inherit'});
  const result=spawnSync('docker',['compose','run','--rm','--no-deps','-T','seed-demo'],{cwd:root,encoding:'utf8'});
  if(result.error || result.status!==0){
    if(result.stderr)process.stderr.write(result.stderr);
    throw new Error('Nạp bộ mẫu thất bại; transaction SQL đã rollback. Kiểm tra Docker, migration và admin đã bootstrap.');
  }
  if((result.stderr+result.stdout).includes('HALORA_DEMO_APPLIED')){
    const credentials=resolve(root,'.local/bootstrap-admin.env');
    if(existsSync(credentials)){
      const original=readFileSync(credentials,'utf8');
      const updated=/^BOOTSTRAP_ADMIN_PASSWORD=.*$/m.test(original)
        ? original.replace(/^BOOTSTRAP_ADMIN_PASSWORD=.*$/m,'BOOTSTRAP_ADMIN_PASSWORD=123456')
        : original+'\nBOOTSTRAP_ADMIN_PASSWORD=123456\n';
      writeFileSync(credentials,updated);
    }
    console.log('Đã nạp bộ mẫu vào PostgreSQL Docker. Admin hiện có và các tài khoản mẫu dùng mật khẩu 123456.');
    console.log('Đã đồng bộ file thông tin quản trị cục bộ nếu file tồn tại. Đăng nhập lại để dùng phiên mới.');
  }else{
    console.log('Bộ mẫu v1 đã tồn tại; giữ nguyên dữ liệu và mật khẩu hiện tại.');
  }
}catch(error){
  console.error(error instanceof Error?error.message:'Nạp bộ mẫu thất bại.');process.exitCode=1;
}
