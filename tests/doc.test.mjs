// Module Trình bày sơ đồ: hàng kiểu kệ sách, box cao cố định, nhóm xếp dọc, ghi chú, zoom/pan, in/PDF + cấp ĐB, định biên, JSON v11
import { openApp, finish } from './_browser.mjs';
import fs from 'node:fs';
const { page, errors, close } = await openApp({ hash: '' });          // vào landing
const R = []; const check = (n, ok, x) => R.push((ok ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  → ' + x : ''));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const vis = (selr) => page.evaluate((s) => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display !== 'none'; }, selr);

// ---- landing ----
check('landing visible, modules hidden', await vis('#landing') && !(await vis('#tabDoc')) && !(await vis('#tabOrg')));
await page.waitForSelector('#overlay.open'); await page.click('#go'); await page.waitForSelector('#overlay:not(.open)');   // popup giới thiệu lần đầu
await page.click('#bModDoc'); await page.waitForSelector('#tabDoc', { state: 'visible' });                                  // nửa được chọn nở ra rồi mới chuyển module
check('doc module opens; hash #doc', await vis('#tabDoc') && !(await vis('#landing')) && (await ev(() => location.hash)) === '#doc' && (await ev(() => MOD)) === 'doc');
check('empty page shows hint text', (await ev(() => document.querySelector('#docPage svg').textContent)).includes(await ev(() => t('docNoTree'))));
check('classic scheme by default with the exact palette', (await ev(() => doc.scheme + '|' + TCOLOR_CLASSIC['ĐB'] + TCOLOR_CLASSIC.CC + TCOLOR_CLASSIC.T1 + TCOLOR_CLASSIC.T2 + TCOLOR_CLASSIC.T3 + TCOLOR_CLASSIC.T4 + TCOLOR_CLASSIC.T5 + TCOLOR_CLASSIC.T6)) === 'classic|#c8c82d#5e8cf9#ea9651#92d050#f6d5b9#77e3f2#cfc8dd#ffffff');
check('canvases never select text while panning (user-select:none)', await ev(() => ['docWrap', 'canvasWrap', 'vcanvasWrap'].every(id => getComputedStyle(document.getElementById(id)).userSelect === 'none')));

// ---- cây: T1 → con T3/T2 cùng hàng ngay dưới; chữ dài; nhiều người; box cao cố định ----
const built = await ev(() => {
  addRoot(); const a = rootIds[0]; Object.assign(nodes.get(a), { dept: 'THỊ TRƯỜNG INDONESIA', title: 'Tổng Giám đốc', person: 'Lê Viết Hải Sơn (CBN)\n(Q.TGĐ thị trường Việt Nam & Lào - kiêm nhiệm)' }); setT(a, 'T1');
  addChild(a); const c1 = nodes.get(a).children[0]; Object.assign(nodes.get(c1), { dept: 'PHÒNG TĂNG TRƯỞNG & KINH DOANH O2O', title: 'Giám đốc', person: 'Phạm Công Hoàng (kiêm nhiệm)', annot: 'E', hc: 4 }); setT(c1, 'T3');
  addChild(a); const c2 = nodes.get(a).children[1]; Object.assign(nodes.get(c2), { dept: 'VẬN HÀNH 4 BÁNH', title: 'Phó Tổng Giám đốc', person: 'Jabo1: Ade Panca Putra Siregar (Q.)\nJabo 2: Yudhistira A. Syahputra (Q.)\nNon-Jabo 1: Phạm Hoàng Giang\nNon-Jabo 2: Adriansyah (Q.)\nASK: Chưa có\nDòng 6\nDòng 7', hc: 6 }); setT(c2, 'T2');
  select(c1);
  const pa = docView.pos.get(a), p1 = docView.pos.get(c1), p2 = docView.pos.get(c2);
  const lines = (id, cls) => document.querySelectorAll('#docPage .dbox[data-id="' + id + '"] text.l-' + cls).length;
  const fs2 = +document.querySelector('#docPage .dbox[data-id="' + c2 + '"] text.l-person').getAttribute('font-size');
  return { a, c1, c2, boxes: document.querySelectorAll('#docPage .dbox').length, deptLines1: lines(c1, 'dept'), personLinesRoot: lines(a, 'person'), personLines2: lines(c2, 'person'),
           hA: pa.h, h1: p1.h, h2: p2.h, sameRow: p1.y === p2.y, directlyBelow: p1.y === pa.y + pa.h + DBOX.gy, rowPitch: rowPitch(), rows: [pa.row, p1.row, p2.row].join(','),
           ellipsis: document.querySelector('#docPage svg').textContent.includes('…'), shrunkFont: fs2, titleText: document.querySelector('#docPage .dbox[data-id="' + c1 + '"] text.l-title').textContent,
           hcA: hcOf(a), fillT1: document.querySelector('#docPage .dbox[data-id="' + a + '"] rect.bg').getAttribute('fill'), legendFs: document.querySelector('#docPage .dlegend text').getAttribute('font-size') };
});
check('3 boxes drawn', built.boxes === 3);
check('long dept wraps to 2 lines, nothing truncated', built.deptLines1 === 2 && !built.ellipsis);
check('multi-line person (root 3 lines incl. wrap; 7 entered lines kept)', built.personLinesRoot >= 3 && built.personLines2 >= 7, JSON.stringify([built.personLinesRoot, built.personLines2]));
check('box height is fixed (23) even with 7 person lines — font shrinks instead', built.hA === 23 && built.h1 === 23 && built.h2 === 23 && built.shrunkFont < 2.9, JSON.stringify([built.h2, built.shrunkFont]));
check('rows like shelves: children on the same row right under the parent (row 0 → 1)', built.sameRow && built.directlyBelow && built.rows === '0,1,1', built.rows);
check('title shows level; classic T1 colour; legend text 2.7', built.titleText === 'Giám đốc (T3)' && built.fillT1 === '#ea9651' && built.legendFs === '2.7', JSON.stringify([built.titleText, built.fillT1, built.legendFs]));
check('headcount roll-up 4 + 6 + 1 = 11', built.hcA === 11);

// ---- ẩn (Tx) riêng từng box ----
await ev(() => { document.getElementById('dfLv').click(); });
check('hide level per box', (await ev((id) => document.querySelector('#docPage .dbox[data-id="' + id + '"] text.l-title').textContent + '|' + nodes.get(id).hideLv, built.c1)) === 'Giám đốc|true');

// ---- nhóm xếp dọc: 3 con của gốc tick stack -> cột trái, các hàng liên tiếp, badge không đè box trên ----
const grp = await ev((a) => {
  const mk = (dept) => { addChild(a); const id = nodes.get(a).children.slice(-1)[0]; Object.assign(nodes.get(id), { dept, title: 'Giám đốc', person: '(Chưa có)', stack: true, annot: 'E' }); setT(id, 'T3'); return id; };
  const s1 = mk('PHÒNG PHÁP CHẾ'), s2 = mk('PHÒNG THANH TRA, KSCL & ANAT'), s3 = mk('PHÒNG QUAN HỆ ĐỐI NGOẠI');
  renderDoc();
  const P = docView.pos, q1 = P.get(s1), q2 = P.get(s2), q3 = P.get(s3), c1 = P.get(nodes.get(a).children[0]);
  const edges = docEdges(a, P);
  const badgeTop2 = q2.y - 5.2;
  return { s1, sameCol: q1.x === q2.x && q2.x === q3.x, rows: [q1.row, q2.row, q3.row].join(','), leftmost: q1.x < c1.x,
           stubsIn: edges.filter(e => e.arrow && e.pts[0][1] === e.pts[1][1]).length,
           spine: edges.some(e => !e.arrow && e.pts.length === 2 && e.pts[0][0] === e.pts[1][0] && e.pts[1][1] > e.pts[0][1] && e.pts[0][0] < q1.x),
           badgeClear: badgeTop2 - (q1.y + q1.h) };
}, built.a);
check('stacked siblings: one leftmost column, consecutive rows 1,2,3', grp.sameCol && grp.rows === '1,2,3' && grp.leftmost, JSON.stringify(grp));
check('spine + 3 arrowed stubs into the left edges', grp.spine && grp.stubsIn === 3);
check('annotation badge of the lower box does not overlap the box above (clearance > 0)', grp.badgeClear > 0, String(grp.badgeClear));

// ---- ý 8: box dàn ngang có nhóm riêng -> treo dưới, đường dọc từ cạnh trái ----
const sub = await ev((c1) => {
  const mk = (dept) => { addChild(c1); const id = nodes.get(c1).children.slice(-1)[0]; Object.assign(nodes.get(id), { dept, title: 'Trưởng phòng', stack: true }); setT(id, 'T4'); return id; };
  const k1 = mk('KINH DOANH NỀN TẢNG'), k2 = mk('KINH DOANH CORPORATE');
  renderDoc();
  const P = docView.pos, p = P.get(c1), q1 = P.get(k1), q2 = P.get(k2), edges = docEdges(c1, P), first = edges[0];
  return { underParent: q1.x === p.x && q1.row === p.row + 1 && q2.row === p.row + 2,
           fromLeftEdge: first.pts[0][0] === p.x && first.pts[1][0] === p.x - DBOX.sx, stubs: edges.filter(e => e.arrow).length };
}, built.c1);
check('stack-only children hang under the parent on the next rows, spine from its left edge', sub.underParent && sub.fromLeftEdge && sub.stubs === 2, JSON.stringify(sub));

// ---- đẩy hàng: nút ▼ đẩy box + con xuống; ▲ trả lại; kéo chuột dọc có đường kẻ hàng ----
const push = await ev((c1) => {
  select(c1); document.getElementById('dbDown').click();
  const P = docView.pos, p = P.get(c1), k = P.get(nodes.get(c1).children[0]), sib = P.get(nodes.get(nodes.get(c1).parent).children[1]);
  const out = { shift: nodes.get(c1).rowShift, row: p.row, childRow: k.row, sibRow: sib.row, upEnabled: !document.getElementById('dbUp').disabled };
  document.getElementById('dbUp').click();
  out.back = nodes.get(c1).rowShift === 0 && docView.pos.get(c1).row === 1 && document.getElementById('dbUp').disabled;
  return out;
}, built.c1);
check('▼ pushes the box one row down and its children along; siblings stay', push.shift === 1 && push.row === 2 && push.childRow === 3 && push.sibRow === 1 && push.upEnabled, JSON.stringify(push));
check('▲ brings it back (disabled at the natural row)', push.back);
await ev(() => dZoomTo(1));
// Kéo là một GESTURE: trong lúc kéo document KHÔNG đổi (chỉ view-state docRowDrag), thả chuột mới ghi đúng MỘT bước Undo + dirty;
// thả về chỗ cũ không ghi gì; pointercancel bỏ xem trước. Oracle so cả document (serializeAll) với snapshot trước khi kéo,
// không chỉ đọc lại rowShift của một box (review 4, R1/R2: no-op detection từng nuốt bước Undo của thao tác kéo).
const box = await page.locator('#docPage .dbox[data-id="' + built.c2 + '"] rect.bg').boundingBox();
const pitchPx = await ev(() => rowPitch() * docView.scale * PX_PER_MM * dzoom);
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const pre = await ev(() => { dirty = false; return { doc: JSON.stringify(serializeAll()), hist: undoStack.length }; });   // như vừa Save
await page.mouse.move(cx, cy); await page.mouse.down();
await page.mouse.move(cx, cy + pitchPx * 0.9, { steps: 4 });
const mid1 = await ev(({ id, d }) => ({ preview: docRowDrag && docRowDrag.shift, row: docView.pos.get(id).row, docShift: nodes.get(id).rowShift, same: JSON.stringify(serializeAll()) === d, dirty, hist: undoStack.length }), { id: built.c2, d: pre.doc });
await page.mouse.move(cx, cy + pitchPx * 1.9, { steps: 4 });
const mid = await ev(({ id, d }) => ({ guides: document.querySelectorAll('#docPage .drow').length, cur: document.querySelectorAll('#docPage .drow.cur').length, preview: docRowDrag && docRowDrag.shift, row: docView.pos.get(id).row, docShift: nodes.get(id).rowShift, same: JSON.stringify(serializeAll()) === d, dirty, hist: undoStack.length, sel: sel === id }), { id: built.c2, d: pre.doc });
await page.mouse.up();
const dropped = await ev((id) => ({ guides: document.querySelectorAll('#docPage .drow').length, shift: nodes.get(id).rowShift, row: docView.pos.get(id).row, y: docView.pos.get(id).y, dirty, hist: undoStack.length, drag: docRowDrag, upEnabled: !document.getElementById('dbUp').disabled }), built.c2);
check('while dragging (two moves, rows 1 → 2 → 3) only the PREVIEW moves: guides on, current row highlighted, document byte-identical, no undo entry, not dirty', mid1.preview === 1 && mid1.row === 2 && mid1.docShift === 0 && mid1.same && !mid1.dirty && mid1.hist === pre.hist && mid.guides > 4 && mid.cur === 2 && mid.preview === 2 && mid.row === 3 && mid.docShift === 0 && mid.same && !mid.dirty && mid.hist === pre.hist && mid.sel, JSON.stringify([mid1, mid]));
check('REGRESSION (review 4): drop commits ONCE — box on row 3 (rowShift 2), exactly one undo entry for the whole gesture, Save → drag → dirty, guides hidden, ▲ enabled', dropped.guides === 0 && dropped.shift === 2 && dropped.row === 3 && dropped.y === 3 * (await ev(() => rowPitch())) && dropped.dirty === true && dropped.hist === pre.hist + 1 && dropped.drag === null && dropped.upEnabled, JSON.stringify(dropped));
await ev(() => undo());
const undone = await ev((d) => ({ same: JSON.stringify(serializeAll()) === d, hist: undoStack.length, guides: document.querySelectorAll('#docPage .drow').length }), pre.doc);
check('one undo restores the WHOLE document to the pre-drag snapshot', undone.same && undone.hist === pre.hist && undone.guides === 0, JSON.stringify(undone));
// thả về chỗ cũ: xuống 2 hàng rồi kéo ngược lên hàng gốc -> không ghi gì (không dirty, không bước Undo)
await ev(() => { dirty = false; });
await page.mouse.move(cx, cy); await page.mouse.down();
await page.mouse.move(cx, cy + pitchPx * 1.9, { steps: 4 });
await page.mouse.move(cx, cy, { steps: 4 });
const backPreview = await ev((id) => ({ preview: docRowDrag && docRowDrag.shift, row: docView.pos.get(id).row }), built.c2);
await page.mouse.up();
const back = await ev(({ id, d }) => ({ same: JSON.stringify(serializeAll()) === d, dirty, hist: undoStack.length, guides: document.querySelectorAll('#docPage .drow').length, shift: nodes.get(id).rowShift, drag: docRowDrag }), { id: built.c2, d: pre.doc });
check('dragging down and back to the original row writes nothing: document identical, not dirty, no undo entry, guides gone', backPreview.preview === 0 && backPreview.row === 1 && back.same && !back.dirty && back.hist === pre.hist && back.guides === 0 && back.shift === 0 && back.drag === null, JSON.stringify([backPreview, back]));
// pointercancel giữa chừng: bỏ xem trước, document nguyên vẹn
await page.mouse.move(cx, cy); await page.mouse.down();
await page.mouse.move(cx, cy + pitchPx * 1.9, { steps: 4 });
const cancelled = await ev(({ id, d }) => {
  const before = { preview: docRowDrag && docRowDrag.shift, row: docView.pos.get(id).row };
  document.getElementById('docPage').dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
  return { before, same: JSON.stringify(serializeAll()) === d, dirty, hist: undoStack.length, guides: document.querySelectorAll('#docPage .drow').length, row: docView.pos.get(id).row, drag: docRowDrag };
}, { id: built.c2, d: pre.doc });
await page.mouse.up();
const afterCancelUp = await ev((d) => ({ same: JSON.stringify(serializeAll()) === d, hist: undoStack.length, dirty }), pre.doc);
check('pointercancel discards the preview: box back on its row, document identical, no undo entry; a later pointerup writes nothing either', cancelled.before.preview === 2 && cancelled.before.row === 3 && cancelled.same && !cancelled.dirty && cancelled.hist === pre.hist && cancelled.guides === 0 && cancelled.row === 1 && cancelled.drag === null && afterCancelUp.same && afterCancelUp.hist === pre.hist && !afterCancelUp.dirty, JSON.stringify([cancelled, afterCancelUp]));

// ---- trang: A2, chiều cao tự động, bề rộng box, font, tiêu đề/mã/ghi chú, dropdown badge ----
const DBOX_gy = await ev(() => DBOX.gy);
const pg = await ev((c1) => {
  const out = {};
  out.pageOpts = [...document.querySelectorAll('#dpPage option')].map(o => o.value).join(',');
  document.getElementById('dpPage').value = 'A3'; document.getElementById('dpPage').dispatchEvent(new Event('change'));
  document.getElementById('dpOrient').value = 'P'; document.getElementById('dpOrient').dispatchEvent(new Event('change'));
  out.viewBox = document.querySelector('#docPage svg').getAttribute('viewBox');
  const lg = document.getElementById('dpLogo');
  lg.value = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><defs><style>.a{fill:\n#ff0000}</style></defs><rect class="a" x="0" y="0" width="100" height="40" onclick="alert(1)"/><script>alert(1)</script></svg>';
  lg.dispatchEvent(new Event('input'));                       // dán vào (input) là render ngay, không cần blur
  const logoEl = document.querySelector('#docPage svg .dlogo');
  out.logo = logoEl ? { w: logoEl.getAttribute('width'), h: logoEl.getAttribute('height'), x: logoEl.getAttribute('x'), fill: logoEl.querySelector('rect').getAttribute('fill'), script: !!logoEl.querySelector('script'), onclick: logoEl.querySelector('rect').hasAttribute('onclick'), style: !!logoEl.querySelector('style') } : null;
  out.codeBelowLogo = +document.querySelector('#docPage svg text').getAttribute('y') > 0 && docView.ty >= 0;
  document.getElementById('dpFont').value = 'times'; document.getElementById('dpFont').dispatchEvent(new Event('change'));
  const h = document.getElementById('dpHeader'); h.value = 'SƠ ĐỒ TỔ CHỨC CÔNG TY'; h.dispatchEvent(new Event('input'));
  const c = document.getElementById('dpc_code'); c.value = 'QĐ-01/2026'; c.dispatchEvent(new Event('input'));
  select(c1);
  document.getElementById('dpAddNote').click(); document.getElementById('dpAddNote').click();
  const rows = document.querySelectorAll('#dpNotes .noteRow');
  const tx = rows[0].querySelector('input.txt'); tx.value = 'Báo cáo đồng thời cho Chủ Tịch Tập đoàn'; tx.dispatchEvent(new Event('input'));
  const k2 = rows[1].querySelector('input.k'); k2.value = 'E'; k2.dispatchEvent(new Event('input'));
  out.annotOpts = [...document.querySelectorAll('#dfA option')].map(o => o.value).join(',');
  document.getElementById('dfA').value = 'A'; document.getElementById('dfA').dispatchEvent(new Event('change'));
  out.annotAfter = nodes.get(c1).annot;
  const svgText = document.querySelector('#docPage svg').textContent;
  out.hasHeader = svgText.includes('SƠ ĐỒ TỔ CHỨC CÔNG TY'); out.hasCode = svgText.includes('QĐ-01/2026'); out.hasNote = svgText.includes('Báo cáo đồng thời');
  out.chartTop = docView.ty;                                   // sơ đồ phải bắt đầu cạnh khối ghi chú, không dưới hẳn
  out.notesBottom = 10 + 8 + 3 + 5 * 3.9 + 2.5 + 4.6 + 2 * 4.2 + 2.5;
  // đẩy các con của gốc xuống 2 hàng: thanh ngang phải nằm ngay trên hàng con (không sát đáy cha), badge hở với thanh ngang
  const rt0 = rootIds[0]; nodes.get(rt0).children.forEach(c => { nodes.get(c).rowShift = 2; }); renderDoc();
  const P = docView.pos, pr = P.get(rt0), edges = docEdges(rt0, P), bus = edges.find(e => !e.arrow && e.pts[0][1] === e.pts[1][1] && e.pts[0][0] !== e.pts[1][0]);
  const childTop = Math.min(...nodes.get(rt0).children.map(c => P.get(c).y));
  out.busY = bus.pts[0][1]; out.childTop = childTop; out.parentBottom = pr.y + pr.h; out.badgeGap = (childTop - BADGE.up) - out.busY;
  // không đoạn đường kẻ nào và không box nào được chạm khối ghi chú / bảng màu (toạ độ trang)
  const clash = (function(){
    const V = docView, out2 = [];
    const test = (x0, x1, y0, y1, what) => V.blocks.forEach(b => { if (y1 > b.y0 - 1 && y0 < b.y1 + 2 && x1 > b.x0 - 3 && x0 < b.x1 + 3) out2.push(what); });
    V.pos.forEach((q, id) => { test(V.tx + q.x * V.scale, V.tx + (q.x + q.w) * V.scale, V.ty + (q.y - (nodes.get(id).annot ? BADGE.up : 0)) * V.scale, V.ty + (q.y + q.h) * V.scale, 'box ' + id);
      docEdges(id, V.pos).forEach(e => { const xs = e.pts.map(q => q[0]), ys = e.pts.map(q => q[1]); test(V.tx + Math.min(...xs) * V.scale, V.tx + Math.max(...xs) * V.scale, V.ty + Math.min(...ys) * V.scale, V.ty + Math.max(...ys) * V.scale, 'edge of ' + id); }); });
    return out2;
  })();
  out.clashPushed = clash; out.chartTopPushed = docView.ty;
  nodes.get(rt0).children.forEach(c => { nodes.get(c).rowShift = 0; }); renderDoc();
  out.pageH0 = docView.pageH;
  document.getElementById('dpAutoH').click();
  const root = rootIds[0]; nodes.get(root).rowShift = 9; renderDoc();     // đẩy cả sơ đồ xuống 9 hàng -> dài quá A3
  out.autoPageH = docView.pageH; out.viewBoxAuto = document.querySelector('#docPage svg').getAttribute('viewBox');
  out.printPage = (docPrint.toString().length > 0, (window.print = function(){}), docPrint(), document.getElementById('printPage').textContent);
  nodes.get(root).rowShift = 0; document.getElementById('dpAutoH').click();
  return out;
}, built.c1);
check('paper options include A2', pg.pageOpts === 'A4,A3,A2', pg.pageOpts);
check('A3 portrait → viewBox 297×420', pg.viewBox === '0 0 297 420', pg.viewBox);
check('pasted SVG logo: fixed 8 mm high (width by aspect), class fill inlined, script/onclick/style stripped', pg.logo && pg.logo.h === '8' && pg.logo.w === '20' && pg.logo.x === '10' && pg.logo.fill === '#ff0000' && !pg.logo.script && !pg.logo.onclick && !pg.logo.style, JSON.stringify(pg.logo));
// SVG không tin cậy: allowlist — <a href="java<tab>script:"> (URL parser bỏ tab), xlink:href với xuống dòng, <image> tải ngoài, <animate>, <script>,
// onclick, fill url() ra ngoài đều bị gỡ; gradient nội bộ, <use href="#id">, rect/path giữ nguyên. Payload vô hại: chỉ đặt window.__pwned.
const hostile = await ev(() => {
  window.__prevLogo = doc.logo;
  doc.logo = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 40 20">'
    + '<defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient><rect id="sym" width="4" height="4"/></defs>'
    + '<a href="java&#9;script:window.__pwned=1"><rect x="0" y="0" width="20" height="20" fill="url(#g)" onclick="window.__pwned=2"/></a>'
    + '<a xlink:href="java&#10;script:window.__pwned=3"><circle cx="30" cy="10" r="5"/></a>'
    + '<image href="https://example.invalid/track.png" width="1" height="1"/><rect width="5" height="5" fill="url(http://evil/x)"><animate attributeName="href" to="javascript:window.__pwned=4"/></rect>'
    + '<use href="#sym" x="30"/><script>window.__pwned=5</script><foreignObject><div onload="1"></div></foreignObject></svg>';
  renderDocAll();
  const g = document.querySelector('#docPage .dlogo');
  const q = (s) => g.querySelectorAll(s).length;
  return { a: q('a'), image: q('image'), animate: q('animate'), script: q('script'), fo: q('foreignObject'), rect: q('rect'), circle: q('circle'), use: q('use'), grad: q('linearGradient'),
           onclick: !!g.querySelector('[onclick]'), fillGrad: g.querySelector('rect[fill="url(#g)"]') !== null, fillExt: !!g.querySelector('rect[fill^="url(http"]'), useHref: g.querySelector('use') && g.querySelector('use').getAttribute('href') };
});
await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
const pwned = await ev(() => window.__pwned);
check('REGRESSION F8: hostile SVG logo is reduced to static drawing (no a/image/animate/script/foreignObject/on*/external url()), internal refs kept, nothing executes', hostile.a === 0 && hostile.image === 0 && hostile.animate === 0 && hostile.script === 0 && hostile.fo === 0 && hostile.rect === 3 && hostile.circle === 1 && hostile.use === 1 && hostile.grad === 1 && !hostile.onclick && hostile.fillGrad && !hostile.fillExt && hostile.useHref === '#sym' && pwned === undefined, JSON.stringify(hostile) + ' pwned=' + pwned);
const reqs = []; page.on('request', r => { if (/example\.invalid/.test(r.url())) reqs.push(r.url()); });
const viaClass = await ev(() => {
  doc.logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#00f"/></linearGradient></defs>'
    + '<style>.x{fill:url(//example.invalid/paint.svg#p)} .y{fill:#0f0;stroke:url(http://example.invalid/s)} .z{fill:url(#g)}</style>'
    + '<rect class="x" width="10" height="10"/><rect class="y" x="10" width="10" height="10"/><rect class="z" x="20" width="10" height="10"/></svg>';
  renderDocAll();
  const r = [...document.querySelectorAll('#docPage .dlogo rect')].map(x => (x.getAttribute('fill') || '-') + '/' + (x.getAttribute('stroke') || '-'));
  return r;
});
await page.waitForTimeout(300);
check('REGRESSION (review 3): fills inlined from <style> classes pass the same attribute check — external url() dropped, colour and #gradient kept, no external request', JSON.stringify(viaClass) === '["-/-","#0f0/-","url(#g)/-"]' && reqs.length === 0, JSON.stringify(viaClass) + ' ' + reqs.join(','));
// review 4 (R4): escape CSS "u\72l(" = url( — qua class, qua style="" inline và qua thuộc tính fill đều bị bỏ; style="" hợp lệ thì giữ fill/stroke
const viaEscape = await ev(() => {
  doc.logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#00f"/></linearGradient></defs>'
    + '<style>.e{fill:u\\72l(//example.invalid/c.svg#p)} .f{fill:u\\00072l(//example.invalid/c2.svg#p)}</style>'
    + '<rect class="e" width="10" height="10"/><rect class="f" x="10" width="10" height="10"/>'
    + '<rect x="20" width="10" height="10" style="fill:u\\72l(//example.invalid/s.svg#p);stroke:#123456"/>'
    + '<rect x="30" width="10" height="10" fill="u\\72l(//example.invalid/a.svg#p)"/>'
    + '<rect x="40" width="10" height="10" style="fill:url(#g); stroke: rgb(1, 2, 3); stroke-width:2"/></svg>';
  renderDocAll();
  return [...document.querySelectorAll('#docPage .dlogo rect')].map(x => (x.getAttribute('fill') || '-') + '/' + (x.getAttribute('stroke') || '-') + '/' + (x.hasAttribute('style') ? 'style' : '-'));
});
await page.waitForTimeout(300);
check('REGRESSION (review 4): CSS-escaped url() (u\\72l, u\\00072l) via class, inline style or attribute is dropped; valid inline style becomes fill/stroke attributes; style="" never survives; no external request', JSON.stringify(viaEscape) === '["-/-/-","-/-/-","-/#123456/-","-/-/-","url(#g)/rgb(1, 2, 3)/-"]' && reqs.length === 0, JSON.stringify(viaEscape) + ' ' + reqs.join(','));
await ev(() => { doc.logo = window.__prevLogo; renderDocAll(); });   // trả lại logo hợp lệ cho các test sau
check('annotation dropdown lists defined keys; switch to A', pg.annotOpts === ',A,E' && pg.annotAfter === 'A', pg.annotOpts);
check('header, code block and note on page', pg.hasHeader && pg.hasCode && pg.hasNote);
check('chart starts beside the notes block, not below it', pg.chartTop < pg.notesBottom, JSON.stringify([pg.chartTop, pg.notesBottom]));
check('with pushed rows no connector or box touches the notes/legend (chart only moves when something would touch)', pg.clashPushed.length === 0, JSON.stringify([pg.clashPushed, pg.chartTopPushed]));
check('bus sits just above the (pushed) child row, not under the parent; badge clear of the bus', pg.busY === pg.childTop - DBOX_gy / 2 && pg.busY > pg.parentBottom + 20 && pg.badgeGap >= 1, JSON.stringify([pg.busY, pg.childTop, pg.parentBottom, pg.badgeGap]));
check('auto page height: page grows to fit 9 extra rows; print @page follows', pg.pageH0 === 420 && pg.autoPageH > 420 && pg.viewBoxAuto === '0 0 297 ' + pg.autoPageH && pg.printPage === '@page{size:297mm ' + pg.autoPageH + 'mm;margin:0}', JSON.stringify([pg.pageH0, pg.autoPageH, pg.printPage]));

// ---- zoom mượt quanh con trỏ + pan bằng chuột, không bôi đen chữ ----
await ev(() => dZoomTo(1));
const wrapBox = await page.locator('#docWrap').boundingBox();
await page.mouse.move(wrapBox.x + 300, wrapBox.y + 300);
await page.mouse.wheel(0, -300);
await page.waitForTimeout(500);
const z1 = await ev(() => ({ z: dzoom, anim: dzoomAnim }));
check('wheel zooms smoothly to the target', z1.z > 1.5 && z1.anim === null, JSON.stringify(z1));
const before = await ev(() => ({ sl: document.getElementById('docWrap').scrollLeft, st: document.getElementById('docWrap').scrollTop }));
await page.mouse.move(wrapBox.x + 200, wrapBox.y + 200); await page.mouse.down();
await page.mouse.move(wrapBox.x + 120, wrapBox.y + 140, { steps: 5 }); await page.mouse.up();
const after = await ev(() => ({ sl: document.getElementById('docWrap').scrollLeft, st: document.getElementById('docWrap').scrollTop, sel, selection: window.getSelection().toString() }));
check('dragging the background pans the page, keeps selection, selects no text', after.sl > before.sl && after.st > before.st && after.sel !== null && after.selection === '', JSON.stringify([before, after]));
await page.mouse.move(wrapBox.x + 8, wrapBox.y + 8); await page.mouse.down(); await page.mouse.up();   // vùng đệm quanh trang = nền
check('plain click on background deselects', (await ev(() => sel)) === null);
await ev(() => dZoomFit());

// ---- round-trip JSON (v11 + doc + trường trình bày) + file cũ ----
const rt = await ev(() => {
  nodes.get(rootIds[0]).children.forEach((c, i) => { if (i === 1) nodes.get(c).rowShift = 1; });
  const saved = JSON.parse(JSON.stringify(serializeAll()));
  applyState(saved); renderAll();
  const a = rootIds[0], c1 = nodes.get(nodes.get(a).children[0]), c2 = nodes.get(nodes.get(a).children[1]), s1 = nodes.get(nodes.get(a).children[2]);
  const out = { v: saved.v, page: doc.page, orient: doc.orient, logo: doc.logo.length > 0, autoH: doc.autoH, font: doc.font, notes: doc.notes.length,
                annot: c1.annot, hc: c1.hc, hideLv: c1.hideLv, rowShift: c2.rowShift, stack: s1.stack };
  const legacy = JSON.parse(JSON.stringify(saved)); delete legacy.doc;
  legacy.roots.forEach(function strip(r){ delete r.hc; delete r.annot; delete r.desc; delete r.rowShift; delete r.hideLv; delete r.stack; (r.children || []).forEach(strip); });
  applyState(legacy); renderAll();
  out.legacyDoc = doc.page + doc.orient + doc.logo.length + doc.autoH + doc.font + doc.scheme + '|' + doc.notes.length; out.legacyFlags = [...nodes.values()].some(n => n.stack || n.hideLv || n.rowShift);
  applyState(saved); renderAll();
  return out;
});
check('round-trip keeps doc layer (logo/autoH), annot/hc/hideLv/rowShift/stack', rt.v === 11 && rt.page === 'A3' && rt.orient === 'P' && rt.logo === true && rt.autoH === false && rt.font === 'times' && rt.notes === 2 && rt.annot === 'A' && rt.hc === 4 && rt.hideLv === true && rt.rowShift === 1 && rt.stack === true, JSON.stringify(rt));
check('file without presentation fields loads with defaults', rt.legacyDoc === 'A4L0falseappclassic|0' && rt.legacyFlags === false, rt.legacyDoc);

// ---- chuyển module: cùng cây ----
await page.click('#bHome'); check('home → landing', await vis('#landing'));
await page.click('#bModFlow'); await page.waitForSelector('#tabOrg', { state: 'visible' });
const flow = await ev(() => ({ mod: MOD, orgVisible: getComputedStyle(document.getElementById('tabOrg')).display !== 'none', nodesOnCanvas: document.querySelectorAll('#canvas .node').length }));
check('flow module shows the same 8 boxes', flow.mod === 'flow' && flow.orgVisible && flow.nodesOnCanvas === 8, JSON.stringify(flow));
await ev(() => { select(rootIds[0]); addChild(rootIds[0]); nodes.get(sel).dept = 'THÊM Ở LUỒNG'; select(rootIds[0]); });
check('org panel offers ĐB (root) and headcount field', (await ev(() => [...document.querySelectorAll('#fT option')].map(o => o.textContent).join(','))).startsWith('ĐB,CC') && (await ev(() => !!document.getElementById('fHc'))));
await ev(() => showModule('doc'));
check('box added in flow module appears in doc module with blank presentation fields', (await ev(() => document.querySelectorAll('#docPage .dbox').length)) === 9 && (await ev(() => { const n = nodes.get(nodes.get(rootIds[0]).children.slice(-1)[0]); return n.annot === '' && n.desc === '' && n.rowShift === 0 && !n.stack && !n.hideLv; })));

// ---- PDF ----
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#bPdf')]);
const pdfBuf = fs.readFileSync(await dl.path());
check('PDF download is a real PDF with embedded LiberationSerif', pdfBuf.subarray(0, 5).toString() === '%PDF-' && /LiberationSerif/.test(pdfBuf.toString('latin1')), pdfBuf.length + 'B');
// Font máy (Local Font Access): giả lập queryLocalFonts trả "Times New Roman" bằng bytes Liberation Sans -> PDF phải nhúng đúng bộ đó thay vì Liberation Serif
const b64 = (f) => fs.readFileSync(new URL('../public/fonts/' + f, import.meta.url)).toString('base64');
const fake = [['Regular', 'Regular'], ['Bold', 'Bold'], ['Italic', 'Italic'], ['Bold Italic', 'BoldItalic']].map(([style, file]) => ({ style, b64: b64('LiberationSans-' + file + '.ttf') }));
await ev((fonts) => { window.queryLocalFonts = async () => fonts.map(f => ({ family: 'Times New Roman', style: f.style, postscriptName: 'TNR-' + f.style.replace(' ', ''), blob: async () => new Blob([Uint8Array.from(atob(f.b64), c => c.charCodeAt(0))]) })); _localFonts = {}; }, fake);
const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#bPdf')]);
const pdf2 = fs.readFileSync(await dl2.path()).toString('latin1');
check('PDF embeds the font taken from the user\'s computer (all 4 styles), not the Liberation fallback', /LiberationSans/.test(pdf2) && !/LiberationSerif/.test(pdf2) && (await ev(() => document.getElementById('msg').textContent)) === (await ev(() => tf('msgPdfDoneLocal', { f: 'Times New Roman' }))));
await ev((fonts) => { window.queryLocalFonts = async () => [{ family: 'Times New Roman', style: 'Regular', postscriptName: 'x', blob: async () => new Blob([Uint8Array.from(atob(fonts[0].b64), c => c.charCodeAt(0))]) }]; _localFonts = {}; }, fake);
const [dl3] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#bPdf')]);
const pdf3 = fs.readFileSync(await dl3.path()).toString('latin1');
check('local family missing a style (or API denied) -> Liberation fallback with a substitution toast', /LiberationSerif/.test(pdf3) && !/LiberationSans/.test(pdf3) && (await ev(() => document.getElementById('msg').textContent)) === (await ev(() => tf('msgPdfDoneSubst', { f: 'Times New Roman' }))));
await ev((fonts) => { window.queryLocalFonts = async () => fonts.map(f => ({ family: 'Times New Roman', style: f.style, postscriptName: 'bad', blob: async () => new Blob([new Uint8Array(64)]) })); _localFonts = {}; }, fake);
const [dl4] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#bPdf')]);
check('local font that is not TrueType (OTF/TTC/garbage) -> Liberation fallback, no jsPDF errors', /LiberationSerif/.test(fs.readFileSync(await dl4.path()).toString('latin1')) && errors.length === 0);
check('no page/console errors', errors.length === 0, errors.join(' | '));
await close();
finish(R);
