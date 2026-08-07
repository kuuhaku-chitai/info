/**
 * music Mode 検証スイートの一括実行。
 * 使い方: pnpm run test:music
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).sort();
const pure = files.filter((f) => f.endsWith('.test.ts'));
const db = files.filter((f) => f.endsWith('.dbtest.mjs'));

let failed = 0;
function run(file, extraArgs) {
  const args = ['--experimental-strip-types', '--no-warnings', ...extraArgs, join(here, file)];
  const result = spawnSync(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const out = (result.stdout?.toString() ?? '') + (result.stderr?.toString() ?? '');
  const ok = result.status === 0;
  if (!ok) failed++;
  const tail = out.trim().split('\n').slice(ok ? -1 : -12).join('\n  ');
  console.log(`${ok ? '✓' : '✗'} ${file}: ${tail}`);
}

for (const file of pure) run(file, []);
for (const file of db) run(file, [`--experimental-loader=${join(here, 'alias-loader.mjs')}`]);

console.log(failed === 0 ? '\n全スイート成功' : `\n${failed}スイート失敗`);
process.exit(failed === 0 ? 0 : 1);
