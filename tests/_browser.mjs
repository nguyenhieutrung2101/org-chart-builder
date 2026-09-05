// Hạ tầng test dùng chung: server tĩnh phục vụ public/ + mở Chromium qua Playwright.
// Chạy: npm test (cần `npm i` để có playwright). Có thể trỏ tới bản cài sẵn bằng
//   PW_MODULE=<đường dẫn playwright-core/index.mjs> PW_CHROMIUM=<đường dẫn chromium>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.png': 'image/png' };

export function startServer(){
  return new Promise(function(resolve){
    const srv = http.createServer(function(req, res){
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      if (p === '/favicon.ico'){ res.writeHead(204); res.end(); return; }
      const f = path.join(root, p);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', function(){ resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/' }); });
  });
}

export async function openApp(opts){
  opts = opts || {};
  const pw = await import(process.env.PW_MODULE || 'playwright');
  const { srv, url } = await startServer();
  const browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: opts.width || 1400, height: opts.height || 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url + 'index.html' + (opts.hash || ''));
  return { page, errors, browser, url, close: async function(){ await browser.close(); srv.close(); } };
}

// In kết quả PASS/FAIL và thoát với mã lỗi nếu có FAIL
export function finish(R){
  console.log(R.join('\n'));
  const bad = R.filter(r => r.startsWith('FAIL')).length;
  console.log((R.length - bad) + '/' + R.length + ' passed');
  process.exit(bad ? 1 : 0);
}
