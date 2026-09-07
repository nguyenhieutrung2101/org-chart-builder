// Chạy tuần tự mọi tests/*.test.mjs, gom kết quả. `node tests/run.mjs [tên-lọc]`
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] || '';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs') && f.includes(filter)).sort();
let failed = 0;
for (const f of files){
  console.log('\n=== ' + f);
  const r = spawnSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log('\n' + (files.length - failed) + '/' + files.length + ' suites passed');
process.exit(failed ? 1 : 0);
