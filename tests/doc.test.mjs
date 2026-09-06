// Module Trình bày sơ đồ + cấp ĐB + định biên + lớp doc trong JSON + landing/chuyển module
import { openApp, finish } from './_browser.mjs';
import fs from 'node:fs';
const { page, errors, close } = await openApp({ hash: '' });          // vào landing
const R = []; const check = (n, ok, x) => R.push((ok ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  → ' + x : ''));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const vis = (selr) => page.evaluate((s) => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display !== 'none'; }, selr);

// ---- landing ----
check('landing visible, modules hidden', await vis('#landing') && !(await vis('#tabDoc')) && !(await vis('#tabOrg')));
await page.click('#bModDoc');
check('doc module opens; hash #doc', await vis('#tabDoc') && !(await vis('#landing')) && (await ev(() => location.hash)) === '#doc' && (await ev(() => MOD)) === 'doc');
check('empty page shows hint text', (await ev(() => document.querySelector('#docPage svg').textContent)).includes(await ev(() => t('docNoTree'))));
check('doc module defaults to the classic scheme', (await ev(() => doc.scheme)) === 'classic');

// ---- cây 3 cấp: ĐB gốc, T1 → con T3 ngay dưới (không đùn hàng), chữ dài, nhiều người ----
const built = await ev(() => {
  addRoot(); const a = rootIds[0]; Object.assign(nodes.get(a), { dept: 'THỊ TRƯỜNG INDONESIA', title: 'Tổng Giám đốc', person: 'Lê Viết Hải Sơn (CBN)\n(Q.TGĐ thị trường Việt Nam & Lào - kiêm nhiệm)' }); setT(a, 'T1');
  addChild(a); const c1 = nodes.get(a).children[0]; Object.assign(nodes.get(c1), { dept: 'PHÒNG TĂNG TRƯỞNG & KINH DOANH O2O', title: 'Giám đốc', person: 'Phạm Công Hoàng (kiêm nhiệm)', annot: 'E', hc: 4 }); setT(c1, 'T3');
  addChild(a); const c2 = nodes.get(a).children[1]; Object.assign(nodes.get(c2), { dept: 'VẬN HÀNH 4 BÁNH', title: 'Phó Tổng Giám đốc', person: 'Lê Viết Hải Sơn', hc: 6 }); setT(c2, 'T2');
  select(c1);
  const pa = docView.pos.get(a), p1 = docView.pos.get(c1), p2 = docView.pos.get(c2);
  const lines = (id, cls) => document.querySelectorAll('#docPage .dbox[data-id="' + id + '"] text.l-' + cls).length;
  return { a, c1, c2, levels: LEVELS.join(','), boxes: document.querySelectorAll('#docPage .dbox').length,
           deptLinesRoot: lines(a, 'dept'), deptLines1: lines(c1, 'dept'), personLinesRoot: lines(a, 'person'), personLines1: lines(c1, 'person'),
           rootH: pa.h, h1: p1.h, h2: p2.h, sameRow: Math.abs(p1.y - p2.y) < 0.01, directlyBelow: Math.abs(p1.y - (pa.y + pa.h + DBOX.gy)) < 0.01,
           deptText: [...document.querySelectorAll('#docPage .dbox[data-id="' + c1 + '"] text.l-dept')].map(e => e.textContent).join('|'),
           ellipsis: document.querySelector('#docPage svg').textContent.includes('…'),
           titleText: document.querySelector('#docPage .dbox[data-id="' + c1 + '"] text.l-title').textContent,
           hcA: hcOf(a), panelDept: document.getElementById('dfD').value, fillT1: document.querySelector('#docPage .dbox[data-id="' + a + '"] rect.bg').getAttribute('fill') };
});
check('LEVELS has ĐB before CC', built.levels.startsWith('ĐB,CC,T1'), built.levels);
check('3 boxes; panel shows selected', built.boxes === 3 && built.panelDept === 'PHÒNG TĂNG TRƯỞNG & KINH DOANH O2O');
check('long dept wraps to 2 lines, nothing truncated with "…"', built.deptLines1 === 2 && !built.ellipsis, built.deptText);
check('multi-line person: root has 3 person lines (1 + wrapped 2nd line)', built.personLinesRoot >= 3, String(built.personLinesRoot));
check('box height grows with content (root taller than min 19)', built.rootH > 19 && built.h2 === 19, JSON.stringify([built.rootH, built.h1, built.h2]));
check('T3 and T2 children share the row directly under the T1 parent (no level rows)', built.sameRow && built.directlyBelow);
check('title shows level by default', built.titleText === 'Giám đốc (T3)', built.titleText);
check('classic T1 colour', built.fillT1 === '#E89347', built.fillT1);
check('headcount roll-up 4 + 6 + 1 = 11', built.hcA === 11, String(built.hcA));

// ---- ẩn (Tx) riêng từng box ----
await ev(() => { document.getElementById('dfLv').click(); });
check('hide level per box', (await ev((id) => document.querySelector('#docPage .dbox[data-id="' + id + '"] text.l-title').textContent + '|' + nodes.get(id).hideLv, built.c1)) === 'Giám đốc|true');
check('other box still shows level', (await ev((id) => document.querySelector('#docPage .dbox[data-id="' + id + '"] text.l-title').textContent, built.c2)) === 'Phó Tổng Giám đốc (T2)');

// ---- nhóm xếp dọc: 3 con của gốc tick stack -> cột trái, đường dọc + nhánh vào cạnh trái ----
const grp = await ev((a) => {
  const mk = (dept) => { addChild(a); const id = nodes.get(a).children.slice(-1)[0]; Object.assign(nodes.get(id), { dept, title: 'Giám đốc', person: '(Chưa có)', stack: true }); setT(id, 'T3'); return id; };
  const s1 = mk('PHÒNG PHÁP CHẾ'), s2 = mk('PHÒNG THANH TRA, KSCL & ANAT'), s3 = mk('PHÒNG QUAN HỆ ĐỐI NGOẠI');
  renderDoc();
  const P = docView.pos, q1 = P.get(s1), q2 = P.get(s2), q3 = P.get(s3), c1 = P.get(nodes.get(a).children[0]);
  const edges = docEdges(a, P);
  const stubsIn = edges.filter(e => e.arrow && Math.abs(e.pts[0][1] - e.pts[1][1]) < 0.01).length;   // nhánh ngang có mũi tên vào cạnh trái
  return { s1, sameCol: q1.x === q2.x && q2.x === q3.x, stackedDown: q1.y < q2.y && q2.y < q3.y, leftmost: q1.x < c1.x,
           stubsIn, spine: edges.some(e => !e.arrow && e.pts.length === 2 && e.pts[0][0] === e.pts[1][0] && e.pts[1][1] > e.pts[0][1] && e.pts[0][0] < q1.x),
           gap: q2.y - (q1.y + q1.h) };
}, built.a);
check('stacked siblings form one column at the far left, top to bottom', grp.sameCol && grp.stackedDown && grp.leftmost, JSON.stringify(grp));
check('one vertical spine left of the column + an arrowed stub into each of the 3 boxes', grp.spine && grp.stubsIn === 3, JSON.stringify([grp.spine, grp.stubsIn]));
check('stack gap uses gyS', Math.abs(grp.gap - 4.5) < 0.01, String(grp.gap));

// ---- ý 8: box con dàn ngang (nối thẳng) có nhóm xếp dọc riêng -> treo ngay dưới, đường dọc từ cạnh trái ----
const sub = await ev((c1) => {
  const mk = (dept) => { addChild(c1); const id = nodes.get(c1).children.slice(-1)[0]; Object.assign(nodes.get(id), { dept, title: 'Trưởng phòng', stack: true }); setT(id, 'T4'); return id; };
  const k1 = mk('KINH DOANH NỀN TẢNG'), k2 = mk('KINH DOANH CORPORATE');
  renderDoc();
  const P = docView.pos, p = P.get(c1), q1 = P.get(k1), q2 = P.get(k2), edges = docEdges(c1, P);
  const first = edges[0];
  return { underParent: q1.x === p.x && q1.y === p.y + p.h + DBOX.gy1 && q2.y > q1.y,
           fromLeftEdge: first.pts[0][0] === p.x && first.pts[1][0] === p.x - DBOX.sx && first.pts[0][1] > p.y && first.pts[0][1] < p.y + p.h,
           stubs: edges.filter(e => e.arrow).length };
}, built.c1);
check('stack-only children hang under the parent, aligned to its left edge', sub.underParent, JSON.stringify(sub));
check('spine leaves from the parent\'s left edge; 2 arrowed stubs', sub.fromLeftEdge && sub.stubs === 2);

// ---- trang: khổ giấy / font / bảng màu / tiêu đề / mã văn bản / ghi chú -> dropdown badge ----
const pg = await ev((c1) => {
  const out = {};
  document.getElementById('dpPage').value = 'A3'; document.getElementById('dpPage').dispatchEvent(new Event('change'));
  document.getElementById('dpOrient').value = 'P'; document.getElementById('dpOrient').dispatchEvent(new Event('change'));
  out.viewBox = document.querySelector('#docPage svg').getAttribute('viewBox');
  document.getElementById('dpScheme').value = 'pastel'; document.getElementById('dpScheme').dispatchEvent(new Event('change'));
  out.fillPastel = document.querySelector('#docPage .dbox rect.bg').getAttribute('fill');
  document.getElementById('dpScheme').value = 'classic'; document.getElementById('dpScheme').dispatchEvent(new Event('change'));
  document.getElementById('dpFont').value = 'times'; document.getElementById('dpFont').dispatchEvent(new Event('change'));
  out.fam = document.querySelector('#docPage svg').getAttribute('font-family');
  const h = document.getElementById('dpHeader'); h.value = 'SƠ ĐỒ TỔ CHỨC CÔNG TY'; h.dispatchEvent(new Event('input'));
  const c = document.getElementById('dpc_code'); c.value = 'QĐ-01/2026'; c.dispatchEvent(new Event('input'));
  select(c1);
  out.annotOptsBefore = [...document.querySelectorAll('#dfA option')].map(o => o.value).join(',');
  document.getElementById('dpAddNote').click(); document.getElementById('dpAddNote').click();
  const rows = document.querySelectorAll('#dpNotes .noteRow');
  const tx = rows[0].querySelector('input.txt'); tx.value = 'Báo cáo đồng thời cho Chủ Tịch Tập đoàn'; tx.dispatchEvent(new Event('input'));
  const k2 = rows[1].querySelector('input.k'); k2.value = 'E'; k2.dispatchEvent(new Event('input'));
  out.annotOpts = [...document.querySelectorAll('#dfA option')].map(o => o.value).join(',');
  out.annotSel = document.getElementById('dfA').value;
  document.getElementById('dfA').value = 'A'; document.getElementById('dfA').dispatchEvent(new Event('change'));
  out.annotAfter = nodes.get(c1).annot;
  const svgText = document.querySelector('#docPage svg').textContent;
  out.hasHeader = svgText.includes('SƠ ĐỒ TỔ CHỨC CÔNG TY'); out.hasCode = svgText.includes('QĐ-01/2026'); out.hasNote = svgText.includes('Báo cáo đồng thời');
  out.legendRects = document.querySelectorAll('#docPage .dlegend rect').length;
  return out;
}, built.c1);
check('A3 portrait → viewBox 297×420', pg.viewBox === '0 0 297 420', pg.viewBox);
check('pastel scheme selectable; Times font applied', pg.fillPastel === '#FFB98A' && /Times New Roman/.test(pg.fam), JSON.stringify([pg.fillPastel, pg.fam]));
check('annotation is a dropdown: undefined key flagged before notes exist', pg.annotOptsBefore === ',E', pg.annotOptsBefore);
check('dropdown lists defined note keys; box keeps E; can switch to A', pg.annotOpts === ',A,E' && pg.annotSel === 'E' && pg.annotAfter === 'A', JSON.stringify([pg.annotOpts, pg.annotSel, pg.annotAfter]));
check('header, code block, note and 8-row legend on page', pg.hasHeader && pg.hasCode && pg.hasNote && pg.legendRects === 8);

// ---- kéo box sang ngang (giữ hàng) ----
const box = await page.locator('#docPage .dbox[data-id="' + built.c2 + '"] rect.bg').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 6 }); await page.mouse.up();
const afterDrag = await ev((id) => ({ dx: nodes.get(id).dx, sel: sel === id, y: docView.pos.get(id).y }), built.c2);
const rowY = await ev((id) => docView.pos.get(nodes.get(id).children[0]).y, built.a);
check('box drag shifts dx only (row unchanged), selects box', afterDrag.dx > 5 && afterDrag.sel && Math.abs(afterDrag.y - rowY) < 0.01, JSON.stringify(afterDrag));
await ev(() => document.getElementById('dbPos').click());
check('reset position clears dx', (await ev((id) => nodes.get(id).dx, built.c2)) === 0);

// ---- zoom mượt quanh con trỏ + pan bằng chuột ----
await ev(() => dZoomTo(1));
const wrapBox = await page.locator('#docWrap').boundingBox();
await page.mouse.move(wrapBox.x + 300, wrapBox.y + 300);
await page.mouse.wheel(0, -300);
await page.waitForTimeout(500);
const z1 = await ev(() => ({ z: dzoom, w: parseFloat(document.querySelector('#docPage svg').style.width), anim: dzoomAnim }));
check('wheel zooms smoothly to the target (animation finished)', z1.z > 1.5 && z1.anim === null && z1.w > 0, JSON.stringify(z1));
const before = await ev(() => ({ sl: document.getElementById('docWrap').scrollLeft, st: document.getElementById('docWrap').scrollTop }));
await page.mouse.move(wrapBox.x + 200, wrapBox.y + 200); await page.mouse.down();
await page.mouse.move(wrapBox.x + 120, wrapBox.y + 140, { steps: 5 }); await page.mouse.up();
const after = await ev(() => ({ sl: document.getElementById('docWrap').scrollLeft, st: document.getElementById('docWrap').scrollTop, sel }));
check('dragging the background pans the page and keeps selection', after.sl > before.sl && after.st > before.st && after.sel !== null, JSON.stringify([before, after]));
await page.mouse.move(wrapBox.x + 300, wrapBox.y + 400); await page.mouse.down(); await page.mouse.up();
check('plain click on background deselects', (await ev(() => sel)) === null);
await ev(() => dZoomFit());

// ---- round-trip JSON (v11 + doc + trường trình bày) + file cũ ----
const rt = await ev(() => {
  const saved = JSON.parse(JSON.stringify(serializeAll()));
  applyState(saved); renderAll();
  const a = rootIds[0], c1 = nodes.get(nodes.get(a).children[0]), s1 = nodes.get(nodes.get(a).children[2]);
  const out = { v: saved.v, page: doc.page, orient: doc.orient, font: doc.font, scheme: doc.scheme, header: doc.header, notes: doc.notes.length,
                annot: c1.annot, hc: c1.hc, hideLv: c1.hideLv, stack: s1.stack, rootStack: nodes.get(a).stack };
  const legacy = JSON.parse(JSON.stringify(saved)); delete legacy.doc;
  legacy.roots.forEach(function strip(r){ delete r.hc; delete r.annot; delete r.desc; delete r.dx; delete r.hideLv; delete r.stack; (r.children || []).forEach(strip); });
  applyState(legacy); renderAll();
  out.legacyDoc = doc.page + doc.orient + doc.font + doc.scheme + '|' + doc.notes.length; out.legacyStack = [...nodes.values()].some(n => n.stack || n.hideLv);
  applyState(saved); renderAll();
  return out;
});
check('round-trip keeps doc layer, annot/hc/hideLv/stack', rt.v === 11 && rt.page === 'A3' && rt.orient === 'P' && rt.font === 'times' && rt.scheme === 'classic' && rt.notes === 2 && rt.annot === 'A' && rt.hc === 4 && rt.hideLv === true && rt.stack === true && rt.rootStack === false, JSON.stringify(rt));
check('file without presentation fields loads with defaults', rt.legacyDoc === 'A4Lappclassic|0' && rt.legacyStack === false, rt.legacyDoc);

// ---- chuyển module: cùng cây ----
await page.click('#bHome'); check('home → landing', await vis('#landing'));
await page.click('#bModFlow');
const flow = await ev(() => ({ mod: MOD, orgVisible: getComputedStyle(document.getElementById('tabOrg')).display !== 'none', nodesOnCanvas: document.querySelectorAll('#canvas .node').length }));
check('flow module shows the same 8 boxes', flow.mod === 'flow' && flow.orgVisible && flow.nodesOnCanvas === 8, JSON.stringify(flow));
await ev(() => { select(rootIds[0]); addChild(rootIds[0]); nodes.get(sel).dept = 'THÊM Ở LUỒNG'; });
await ev(() => select(rootIds[0]));
check('org panel offers ĐB (root) and headcount field', (await ev(() => [...document.querySelectorAll('#fT option')].map(o => o.textContent).join(','))).startsWith('ĐB,CC') && (await ev(() => !!document.getElementById('fHc'))));
await ev(() => showModule('doc'));
check('box added in flow module appears in doc module with blank presentation fields', (await ev(() => document.querySelectorAll('#docPage .dbox').length)) === 9 && (await ev(() => { const n = nodes.get(sel); return n.annot === '' && n.desc === '' && n.dx === 0 && !n.stack && !n.hideLv; })));

// ---- in + PDF ----
await ev(() => { window.print = function(){ window.__printed = true; }; docPrint(); });
check('print sets @page size from current paper', (await ev(() => document.getElementById('printPage').textContent)) === '@page{size:297mm 420mm;margin:0}' && (await ev(() => window.__printed === true)));
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#bPdf')]);
const pdfBuf = fs.readFileSync(await dl.path());
check('PDF download is a real PDF with embedded LiberationSerif', pdfBuf.subarray(0, 5).toString() === '%PDF-' && /LiberationSerif/.test(pdfBuf.toString('latin1')), pdfBuf.length + 'B');
check('no page/console errors', errors.length === 0, errors.join(' | '));
await close();
finish(R);
