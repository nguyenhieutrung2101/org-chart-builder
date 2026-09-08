// Harness Node cho phần LOGIC (không cần trình duyệt): nạp public/js/01…11 vào một vm context với DOM giả tối thiểu,
// rồi thay LỚP VẼ bằng hàm rỗng theo DANH SÁCH TƯỜNG MINH (không theo tiền tố tên, để không vô tình tắt hàm nghiệp vụ).
// Kết quả: model + undo/dirty, applyState/serializeAll, layout, engine luồng, dán Excel, checkInvariants chạy thẳng trong Node.
// loadApp({ realRender:true }) giữ nguyên renderer thật (chạy trên DOM giả) — dùng cho test "render không được đổi document".
// 12-wiring.js không nạp (toàn bộ là DOM); hai biến view-state nó khai báo (MOD, curTab) được đặt sẵn.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'js');
const FILES = ['01-consts', '02-i18n', '03-state', '04-model', '05-org-render', '06-export', '07-vline', '08-flow', '09-rules', '10-zoom', '11-doc'];
// Lớp vẽ / vá DOM. Thêm hàm mới vào đây khi tạo; tên không tồn tại trong app sẽ làm harness ném lỗi (danh sách luôn khớp code).
const RENDER_LAYER = ['renderAll', 'renderTab', 'refreshView', 'renderCanvas', 'renderPanel', 'renderTable', 'renderMinimap', 'syncMiniView',
  'applySelDom', 'scrollNodeIntoView', 'applyZoomView', 'fitZoom', 'renderVline', 'renderVPanel', 'patchVNodeText', 'fillVImportPick',
  'renderFlow', 'renderGroups', 'renderFcs', 'updateGroupCounts', 'applyGrpFilter', 'applyFcFilter', 'renderFlowResult',
  'patchGroupOptionLabels', 'fillGroupSelect', 'refreshFlowResultSoon', 'renderRules', 'renderRolePalette', 'renderModeToggle',
  'renderCigToggle', 'renderCigs', 'patchRoleChips', 'fillRolePick', 'renderDoc', 'renderDocAll', 'renderDPanel', 'renderDPage',
  'renderDNotes', 'applyDZoom'];

export function loadApp(opts){
  opts = opts || {};
  const el = () => ({ style: {}, dataset: {}, value: '', textContent: '', innerHTML: '', options: [], children: [], childNodes: [], attributes: [],
    firstChild: null, hidden: false, disabled: false, scrollLeft: 0, scrollTop: 0, clientWidth: 800, clientHeight: 600,
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(c){ return c; }, removeChild(){}, insertBefore(c){ return c; }, remove(){}, focus(){}, click(){}, cloneNode(){ return el(); },
    setAttribute(){}, getAttribute(){ return null; }, hasAttribute(){ return false; }, removeAttribute(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; }, addEventListener(){}, closest(){ return null; }, contains(){ return false; },
    getBoundingClientRect(){ return { left: 0, top: 0, width: 0, height: 0 }; }, setPointerCapture(){}, releasePointerCapture(){},
    getContext(){ return { font: '', measureText: (s) => ({ width: String(s).length * 5 }) }; } });
  const document = { getElementById: el, querySelector: () => null, querySelectorAll: () => [], createElement: el, createElementNS: el,
                     createTextNode: () => ({}), body: el(), head: el(), documentElement: { lang: '' }, title: '', activeElement: el(), addEventListener(){} };
  const ctx = { console, setTimeout, clearTimeout, document, confirm: () => true, alert(){},
                requestAnimationFrame: (f) => setTimeout(f, 0), navigator: {}, history: {}, location: { hash: '' },
                matchMedia: () => ({ matches: false }), URL: { createObjectURL(){ return ''; }, revokeObjectURL(){} }, Blob: class {}, performance };
  ctx.window = ctx;
  vm.createContext(ctx);
  FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), ctx, { filename: f + '.js' }));
  vm.runInContext("var MOD = 'flow', curTab = 'org';", ctx);
  const missing = RENDER_LAYER.filter(k => typeof ctx[k] !== 'function');
  if (missing.length) throw new Error('RENDER_LAYER names not found in app: ' + missing.join(', '));
  if (!opts.realRender) RENDER_LAYER.forEach(k => { ctx[k] = () => {}; });
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
