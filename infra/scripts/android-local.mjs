import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') throw new Error('These local Android scripts require Windows PowerShell.');
const mode = process.argv[2];
if (!['build', 'run', 'install'].includes(mode)) throw new Error('Expected build, run or install.');
const script = fileURLToPath(new URL(mode === 'build' ? './build-android.ps1' : './run-android.ps1', import.meta.url));
const powershell = resolve(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const result = spawnSync(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...(mode === 'install' ? ['-Install'] : []), ...process.argv.slice(3)], { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
