// Harness Node cho phần LOGIC (không cần trình duyệt): nạp public/js/01…11 vào một vm context với DOM giả tối thiểu,
// rồi thay toàn bộ lớp vẽ bằng hàm rỗng. Kết quả: model + undo/dirty, applyState/serializeAll, layout, engine luồng,
// dán Excel, checkInvariants chạy thẳng trong Node — test nhanh gấp nhiều lần Playwright và fuzz được.
// 12-wiring.js không nạp (toàn bộ là DOM); hai biến view-state nó khai báo (MOD, curTab) được đặt sẵn.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'js');
const FILES = ['01-consts', '02-i18n', '03-state', '04-model', '05-org-render', '06-export', '07-vline', '08-flow', '09-rules', '10-zoom', '11-doc'];

export function loadApp(){
  const el = () => ({ style: {}, dataset: {}, value: '', textContent: '', innerHTML: '', options: [], children: [],
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(){}, removeChild(){}, remove(){}, focus(){}, click(){}, setAttribute(){}, getAttribute(){ return null; },
    querySelector(){ return null; }, querySelectorAll(){ return []; }, addEventListener(){}, closest(){ return null; } });
  const document = { getElementById: el, querySelector: () => null, querySelectorAll: () => [], createElement: el, createElementNS: el,
                     createTextNode: () => ({}), body: el(), head: el(), documentElement: { lang: '' }, title: '', activeElement: el(), addEventListener(){} };
  const ctx = { console, setTimeout, clearTimeout, document, confirm: () => true, alert(){},
                requestAnimationFrame: (f) => setTimeout(f, 0), navigator: {}, history: {}, location: { hash: '' },
                matchMedia: () => ({ matches: false }), URL: { createObjectURL(){ return ''; }, revokeObjectURL(){} }, Blob: class {}, performance };
  ctx.window = ctx;
  vm.createContext(ctx);
  FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), ctx, { filename: f + '.js' }));
  vm.runInContext("var MOD = 'flow', curTab = 'org';", ctx);
  // Lớp vẽ -> rỗng (mọi tên bắt đầu bằng render/patch/fill/update/scroll/sync + vài hàm lọc/áp view); toast + tải file -> ghi lại
  const noop = () => {};
  Object.keys(ctx).forEach(k => { if (typeof ctx[k] === 'function' && /^(render|patch|fill|update|scroll|sync|applySelDom|applyFcFilter|applyGrpFilter|applyResFilter|applyZoomView|applyDZoom|refreshView|refreshFlowResultSoon)/.test(k)) ctx[k] = noop; });
  ctx.toasts = []; ctx.msg = (s) => ctx.toasts.push(String(s));
  ctx.downloads = []; ctx.dl = (blob, name) => ctx.downloads.push(name);
  ctx.stubEl = el;                                   // test tự dựng $ giả khi cần đọc dropdown (vImportPick, rolePick)
  ctx.seedRules();                                   // như init của 12-wiring
  return ctx;
}

// PRNG có seed (mulberry32) để fuzz lặp lại được
export function rng(seed){
  let a = seed >>> 0;
  return function(){ a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
