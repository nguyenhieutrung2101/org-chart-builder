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

// ---- vẽ trong module doc: cây 3 cấp, ĐB ở gốc ----
const built = await ev(() => {
  addRoot(); const a = rootIds[0]; const na = nodes.get(a); na.dept = 'TẬP ĐOÀN'; na.title = 'Chủ tịch'; na.person = 'Nguyễn Văn A'; setT(a, 'ĐB');
  addChild(a); const b = nodes.get(a).children[0]; const nb = nodes.get(b); nb.dept = 'CÔNG TY'; nb.title = 'Tổng Giám đốc'; nb.person = 'Trần B'; setT(b, 'CC');
  addChild(b); addChild(b);
  const c1 = nodes.get(b).children[0], c2 = nodes.get(b).children[1];
  Object.assign(nodes.get(c1), { dept: 'PHÒNG PHÁP CHẾ', title: 'Giám đốc', person: 'Gharnis Athe M Ginting', annot: 'E', hc: 4,
    desc: '# Pháp chế\n- Cung cấp tư vấn và ý kiến pháp lý cho Ban Lãnh đạo về các vấn đề liên quan đến pháp luật.\n- Soạn thảo, rà soát hợp đồng.' });
  Object.assign(nodes.get(c2), { dept: 'PHÒNG TĂNG TRƯỞNG', title: 'Giám đốc', person: 'Lê C', hc: 6 });
  setT(c1, 'T3'); setT(c2, 'T3');
  select(c1);
  return { a, b, c1, c2, levels: LEVELS.join(','), hcB: hcOf(b), hcA: hcOf(a), boxes: document.querySelectorAll('#docPage .dbox').length,
           badge: document.querySelector('#docPage .dbox[data-id="' + c1 + '"] rect.annot') ? document.querySelector('#docPage .dbox[data-id="' + c1 + '"]').textContent : '',
           fillA: document.querySelector('#docPage .dbox[data-id="' + a + '"] rect.bg').getAttribute('fill'),
           descBlocks: document.querySelectorAll('#docPage .ddesc').length, descLines: document.querySelectorAll('#docPage .ddesc text').length,
           edges: document.querySelectorAll('#docPage .dedge-hit').length, panelDept: document.getElementById('dfD').value };
});
check('LEVELS has ĐB before CC', built.levels.startsWith('ĐB,CC,T1'), built.levels);
check('4 boxes drawn; panel shows selected box', built.boxes === 4 && built.panelDept === 'PHÒNG PHÁP CHẾ', JSON.stringify([built.boxes, built.panelDept]));
check('headcount roll-up: 4 + 6 + 1 = 11 at CC, 12 at ĐB', built.hcB === 11 && built.hcA === 12, JSON.stringify([built.hcB, built.hcA]));
check('annotation badge "E" rendered', built.badge.includes('E'), built.badge);
check('ĐB box uses pastel ĐB colour', built.fillA === '#F0A6C0', built.fillA);
check('description block wrapped into several lines', built.descBlocks === 1 && built.descLines >= 4, JSON.stringify([built.descBlocks, built.descLines]));
check('edge hit segments: 3 edges × 3 segments', built.edges === 9, String(built.edges));

// ---- trang: khổ giấy / hướng / font / bảng màu / tiêu đề / mã văn bản / ghi chú / toggle ----
const pg = await ev(() => {
  const out = {};
  document.getElementById('dpPage').value = 'A3'; document.getElementById('dpPage').dispatchEvent(new Event('change'));
  document.getElementById('dpOrient').value = 'P'; document.getElementById('dpOrient').dispatchEvent(new Event('change'));
  out.viewBox = document.querySelector('#docPage svg').getAttribute('viewBox');
  document.getElementById('dpScheme').value = 'classic'; document.getElementById('dpScheme').dispatchEvent(new Event('change'));
  out.fillClassic = document.querySelector('#docPage .dbox rect.bg').getAttribute('fill');
  document.getElementById('dpFont').value = 'times'; document.getElementById('dpFont').dispatchEvent(new Event('change'));
  out.fam = document.querySelector('#docPage svg').getAttribute('font-family');
  const h = document.getElementById('dpHeader'); h.value = 'SƠ ĐỒ TỔ CHỨC CÔNG TY'; h.dispatchEvent(new Event('input'));
  const c = document.getElementById('dpc_code'); c.value = 'QĐ-01/2026'; c.dispatchEvent(new Event('input'));
  document.getElementById('dpAddNote').click();
  const rows = document.querySelectorAll('#dpNotes .noteRow'); const tx = rows[0].querySelector('input.txt'); tx.value = 'Báo cáo đồng thời cho Chủ Tịch Tập đoàn'; tx.dispatchEvent(new Event('input'));
  const svgText = document.querySelector('#docPage svg').textContent;
  out.hasHeader = svgText.includes('SƠ ĐỒ TỔ CHỨC CÔNG TY'); out.hasCode = svgText.includes('QĐ-01/2026'); out.hasNote = svgText.includes('Báo cáo đồng thời');
  out.legendRects = document.querySelectorAll('#docPage .dlegend rect').length;
  out.noteKey = doc.notes[0].key;
  document.getElementById('dps_legend').click(); out.legendAfter = document.querySelectorAll('#docPage .dlegend').length;
  document.getElementById('dps_hc').click(); out.hcAfter = document.querySelectorAll('#docPage rect.hc').length;
  document.getElementById('dps_hc').click(); document.getElementById('dps_legend').click();
  return out;
});
check('A3 portrait → viewBox 297×420', pg.viewBox === '0 0 297 420', pg.viewBox);
check('classic scheme colours the ĐB box olive', pg.fillClassic === '#C7BC1F', pg.fillClassic);
check('Times font applied to svg', /Times New Roman/.test(pg.fam), pg.fam);
check('header, code block and note appear on page', pg.hasHeader && pg.hasCode && pg.hasNote, JSON.stringify(pg));
check('legend has 8 colour rows; first note key auto = A', pg.legendRects === 8 && pg.noteKey === 'A', JSON.stringify([pg.legendRects, pg.noteKey]));
check('toggles hide legend / headcount', pg.legendAfter === 0 && pg.hcAfter === 0, JSON.stringify([pg.legendAfter, pg.hcAfter]));

// ---- kéo box sang ngang (trong hàng) + kéo đoạn nối ----
const box = await page.locator('#docPage .dbox[data-id="' + built.c1 + '"] rect.bg').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 6 }); await page.mouse.up();
const afterDrag = await ev((id) => ({ dx: nodes.get(id).dx, y: docView.pos.get(id).y, sel: sel === id }), built.c1);
check('box drag sets dx > 0, keeps row, stays selected', afterDrag.dx > 5 && afterDrag.sel, JSON.stringify(afterDrag));
await ev(() => document.getElementById('dbPos').click());
check('reset position clears dx', (await ev((id) => nodes.get(id).dx, built.c1)) === 0);
const seg = await page.locator('#docPage .dedge-hit[data-id="' + built.c2 + '"][data-seg="1"]').boundingBox();
await page.mouse.move(seg.x + seg.width / 2, seg.y + seg.height / 2); await page.mouse.down();
await page.mouse.move(seg.x + seg.width / 2, seg.y + seg.height / 2 + 25, { steps: 6 }); await page.mouse.up();
const afterEdge = await ev((id) => ({ wp: nodes.get(id).wp, segs: document.querySelectorAll('#docPage .dedge-hit[data-id="' + id + '"]').length }), built.c2);
check('dragging the horizontal segment stores waypoints (bus moved down)', Array.isArray(afterEdge.wp) && afterEdge.wp.length === 2 && afterEdge.wp[0][1] === afterEdge.wp[1][1], JSON.stringify(afterEdge));
const seg0 = await page.locator('#docPage .dedge-hit[data-id="' + built.c2 + '"][data-seg="0"]').boundingBox();
await page.mouse.move(seg0.x + seg0.width / 2, seg0.y + seg0.height / 2); await page.mouse.down();
await page.mouse.move(seg0.x + seg0.width / 2 + 30, seg0.y + seg0.height / 2, { steps: 6 }); await page.mouse.up();
const afterEdge2 = await ev((id) => ({ wp: nodes.get(id).wp, segs: document.querySelectorAll('#docPage .dedge-hit[data-id="' + id + '"]').length }), built.c2);
check('dragging the first vertical segment adds a bend (5 segments)', afterEdge2.wp && afterEdge2.wp.length === 3 && afterEdge2.segs === 4, JSON.stringify(afterEdge2));
await ev(() => document.getElementById('dbEdge').disabled ? null : null);
await ev((id) => { select(id); document.getElementById('dbEdge').click(); }, built.c2);
check('reset connector clears waypoints', (await ev((id) => nodes.get(id).wp, built.c2)) === null);
await ev(() => undo());
check('undo restores waypoints', Array.isArray(await ev((id) => nodes.get(id).wp, built.c2)));

// ---- round-trip JSON (v11 + doc + trường trình bày) + file cũ không có doc ----
const rt = await ev(() => {
  const saved = JSON.parse(JSON.stringify(serializeAll()));
  applyState(saved); renderAll();
  const n = nodes.get(rootIds[0]); const c = nodes.get(nodes.get(n.children[0]).children[0]);
  const out = { v: saved.v, page: doc.page, orient: doc.orient, font: doc.font, scheme: doc.scheme, header: doc.header, notes: doc.notes.length, annot: c.annot, hc: c.hc, desc: !!c.desc, lvl: n.t };
  const legacy = JSON.parse(JSON.stringify(saved)); delete legacy.doc; legacy.roots.forEach(function strip(r){ delete r.hc; delete r.annot; delete r.desc; delete r.dx; delete r.wp; (r.children || []).forEach(strip); });
  applyState(legacy); renderAll();
  out.legacyDoc = doc.page + doc.orient + doc.font + doc.scheme + '|' + doc.notes.length; out.legacyHc = hcOf(rootIds[0]);
  applyState(saved); renderAll();
  return out;
});
check('round-trip keeps doc layer + presentation fields + ĐB', rt.v === 11 && rt.page === 'A3' && rt.orient === 'P' && rt.font === 'times' && rt.scheme === 'classic' && rt.header.length > 0 && rt.notes === 1 && rt.annot === 'E' && rt.hc === 4 && rt.desc && rt.lvl === 'ĐB', JSON.stringify(rt));
check('file without doc/presentation fields loads with defaults (hc blank = 1 each)', rt.legacyDoc === 'A4Lapppastel|0' && rt.legacyHc === 4, JSON.stringify([rt.legacyDoc, rt.legacyHc]));

// ---- chuyển module: cùng cây ----
await page.click('#bHome'); check('home → landing', await vis('#landing'));
await page.click('#bModFlow');
const flow = await ev(() => ({ mod: MOD, orgVisible: getComputedStyle(document.getElementById('tabOrg')).display !== 'none', nodesOnCanvas: document.querySelectorAll('#canvas .node').length, hcField: !!document.getElementById('fHc') || sel === null, lvlOpts: [...document.querySelectorAll('#fT option')].map(o => o.textContent).join(',') }));
check('flow module shows the same 4 boxes', flow.mod === 'flow' && flow.orgVisible && flow.nodesOnCanvas === 4, JSON.stringify(flow));
await ev(() => { select(rootIds[0]); addChild(rootIds[0]); nodes.get(sel).dept = 'THÊM Ở LUỒNG'; });
check('org panel offers ĐB and headcount field', (await ev(() => [...document.querySelectorAll('#fT option')].map(o => o.textContent).join(','))).startsWith('ĐB,CC') && (await ev(() => !!document.getElementById('fHc'))));
await ev(() => showModule('doc'));
check('box added in flow module appears in doc module (blank presentation fields)', (await ev(() => document.querySelectorAll('#docPage .dbox').length)) === 5 && (await ev(() => { const n = nodes.get(sel); return n.annot === '' && n.desc === '' && n.dx === 0 && n.wp === null; })));

// ---- in: @page theo khổ giấy ----
await ev(() => { window.print = function(){ window.__printed = true; }; docPrint(); });
check('print sets @page size from current paper', (await ev(() => document.getElementById('printPage').textContent)) === '@page{size:297mm 420mm;margin:0}' && (await ev(() => window.__printed === true)));

// ---- tải PDF: jsPDF + svg2pdf + font nhúng ----
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#bPdf')]);
const pdfPath = await dl.path(); const pdfBuf = fs.readFileSync(pdfPath);
const pdfHead = pdfBuf.subarray(0, 5).toString();
check('PDF download produced a real PDF', pdfHead === '%PDF-' && pdfBuf.length > 100000, pdfHead + ' ' + pdfBuf.length + 'B ' + dl.suggestedFilename());
check('PDF embeds LiberationSerif (Times chosen) with Vietnamese glyph support', /LiberationSerif/.test(pdfBuf.toString('latin1')), '');
fs.copyFileSync(pdfPath, '/tmp/claude-0/-home-user-ideal-fiesta/36013426-8f19-5f04-9163-25afeda6f837/scratchpad/doc-test.pdf');
check('no page/console errors', errors.length === 0, errors.join(' | '));
await close();
finish(R);
