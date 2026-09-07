// Chất lượng ở tầng trình duyệt: mốc Save qua UI thật, vẽ theo tab đang mở với 2.000 FC (đếm lần vẽ + thời gian),
// dán Excel mơ hồ qua UI, mở file JSON trùng ID / tham chiếu hỏng qua ô chọn file.
import { openApp, finish } from './_browser.mjs';
import fsMod from 'node:fs';
const { page, errors, close } = await openApp();                  // #flow, tab Sơ đồ
const R = []; const check = (n, ok, x) => R.push((ok ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  → ' + x : ''));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const toast = () => ev(() => document.getElementById('msg').textContent);

// ---- mốc Save qua UI: gõ vào ô chức danh, Save, gõ tiếp cùng ô -> phải dirty + cảnh báo đóng tab ----
await page.click('#bRoot');
await page.type('#fC', 'Giám đốc');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bSave')]);
const saved = JSON.parse(require_fs().readFileSync(await dl.path(), 'utf8'));
check('Save writes the current title and clears dirty', saved.roots[0].title === 'Giám đốc' && (await ev(() => dirty)) === false);
await page.focus('#fC'); await page.keyboard.press('End'); await page.type('#fC', ' Vùng');   // panel vừa vẽ lại: con trỏ ở đầu ô
const sb = await ev(() => ({ dirty, warn: window.onbeforeunload(), lastSnap: JSON.parse(undoStack[undoStack.length - 1]).roots[0].title, title: nodes.get(rootIds[0]).title }));
check('REGRESSION (review #1): typing the same field after Save is dirty again, unload warns, undo boundary = saved state', sb.dirty === true && sb.warn === true && sb.lastSnap === 'Giám đốc' && sb.title === 'Giám đốc Vùng', JSON.stringify(sb));

// ---- vẽ theo tab đang mở: 2.000 FC × 50 nhóm, thao tác ở tab Sơ đồ không dựng lại bảng FC / luồng duyệt đang ẩn ----
const perf = await ev(() => {
  for (let i = 0; i < 50; i++) fcGroups.push({ id: 'g' + (gseq++), code: 'FCG' + i, name: 'Nhóm ' + i, cbqlns: null, byCig: false });
  for (let i = 0; i < 2000; i++) fcs.push({ id: 'f' + (fseq++), code: 'FC' + i, name: 'Fund ' + i, groupId: fcGroups[i % 50].id });
  window.__cnt = { fcs: 0, res: 0, canvas: 0 };
  const oFcs = renderFcs, oRes = renderFlowResult, oCv = renderCanvas;
  renderFcs = function(){ __cnt.fcs++; return oFcs.apply(null, arguments); };
  renderFlowResult = function(){ __cnt.res++; return oRes.apply(null, arguments); };
  renderCanvas = function(){ __cnt.canvas++; return oCv.apply(null, arguments); };
  renderAll();                                                   // đang ở tab Sơ đồ -> chỉ sơ đồ được vẽ
  const afterRenderAll = { ...__cnt };
  const t0 = performance.now();
  addChild(rootIds[0]); toggleStar(rootIds[0]); setT(rootIds[0], 'T1');
  const ms = performance.now() - t0;
  const afterOrgOps = { ...__cnt };
  showTab('flow');
  const afterShow = { ...__cnt };
  showTab('org'); showTab('flow');                               // không đổi dữ liệu -> mở lại không vẽ lại
  const afterReshow = { ...__cnt };
  return { afterRenderAll, afterOrgOps, ms: Math.round(ms), afterShow, afterReshow, rows: document.querySelectorAll('#fcTbody tr').length, stale: { ...staleTabs } };
});
check('renderAll on the org tab renders the chart only (FC table / result untouched)', perf.afterRenderAll.fcs === 0 && perf.afterRenderAll.res === 0 && perf.afterRenderAll.canvas === 1, JSON.stringify(perf.afterRenderAll));
check('three org mutations with 2,000 FCs never rebuild the hidden FC table or result', perf.afterOrgOps.fcs === 0 && perf.afterOrgOps.res === 0, JSON.stringify(perf.afterOrgOps));
check('three org mutations with 2,000 FCs take under 150 ms in total (chart re-render only)', perf.ms < 150, perf.ms + ' ms');
check('opening the stale flow tab renders it exactly once; reopening without changes does not re-render', perf.afterShow.fcs === 1 && perf.afterShow.res === 1 && perf.afterReshow.fcs === 1 && perf.afterReshow.res === 1 && perf.rows === 2000 && !perf.stale.flow, JSON.stringify([perf.afterShow, perf.afterReshow]));
await page.fill('#fcFilter', 'FC1999');
await page.evaluate(() => { const inp = [...document.querySelectorAll('#fcTbody tr')].find(tr => tr.style.display !== 'none').querySelector('input'); inp.focus(); inp.value += 'X'; inp.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(300);
const typed = await ev(() => ({ ...__cnt, code: fcs[1999].code, dirty }));
check('typing in an FC row patches in place: result recomputed once after the debounce, FC table not rebuilt', typed.fcs === 1 && typed.res === 2 && typed.code === 'FC1999X' && typed.dirty, JSON.stringify(typed));

// ---- dán Excel mơ hồ qua UI: hai box ★ cùng tên -> không gán, toast liệt kê dòng ----
await ev(() => { fcs = []; fcGroups = []; const r = rootIds[0]; addChild(r); addChild(r); const [a, b] = nodes.get(r).children.slice(-2);
  Object.assign(nodes.get(a), { title: 'GĐ 1', person: 'Nguyễn Văn A', star: true }); Object.assign(nodes.get(b), { title: 'GĐ 2', person: 'Nguyễn Văn A', star: true }); renderAll(); showTab('flow'); });
await page.click('#bPasteGrp');
await page.fill('#pasteTaGrp', 'FCG01\tMarketing\tNguyễn Văn A\nFCG02\tSales\tKhông Ai');
await page.click('#bPasteGrpGo');
const amb = await ev(() => ({ toast: document.getElementById('msg').textContent, cb: fcGroups.map(g => g.cbqlns), rows: document.querySelectorAll('#grpTbody tr[data-gid]').length, exp1: tf('impAmbCb', { name: 'Nguyễn Văn A', n: 2 }), exp2: tf('impNoCb', { name: 'Không Ai' }) }));
check('UI paste: ambiguous / unknown BMO names are left blank and the toast lists both rows', amb.cb.join(',') === ',' && amb.rows === 2 && amb.toast.includes(amb.exp1) && amb.toast.includes(amb.exp2), amb.toast);
await page.click('#bPaste');
await page.fill('#pasteTa', 'F1\tFund 1\tMarketing\nF2\tFund 2\tSales\tFCG02\nF3\tFund 3\tNope');
await page.click('#bPasteGo');
const fcp = await ev(() => ({ toast: document.getElementById('msg').textContent, groups: fcs.map(f => { const g = fcGroups.find(x => x.id === f.groupId); return g ? (g.code || g.name) : '-'; }), n: fcGroups.length }));
check('UI paste FC: group by unique name, by FCG code column, unknown group created', fcp.groups.join(',') === 'FCG01,FCG02,Nope' && fcp.n === 3 && fcp.toast.includes('3'), JSON.stringify(fcp));

// ---- mở file JSON qua ô chọn file: trùng ID -> từ chối, dữ liệu giữ nguyên; tham chiếu hỏng -> mở nhưng báo số lượng ----
const before = await ev(() => JSON.stringify(serializeAll()));
await page.setInputFiles('#fileIn', { name: 'dup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ v: 11, roots: [{ id: 'n1', t: 'CC', children: [] }, { id: 'n1', t: 'CC', children: [] }] })) });
await page.waitForFunction(() => document.getElementById('msg').textContent.includes('n1'));
const dup = await ev(() => ({ toast: document.getElementById('msg').textContent, same: JSON.stringify(serializeAll()), exp: tf('msgBadStructWhy', { why: tf('errDupId', { id: 'n1' }) }) }));
check('duplicate node id in a file: rejected with the id named, current data untouched', dup.toast === dup.exp && dup.same === before, dup.toast);
await page.setInputFiles('#fileIn', { name: 'dangling.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ v: 11, roots: [{ id: 'n1', t: 'CC', children: [] }], fcGroups: [{ id: 'g1', code: 'A', name: 'x', cbqlns: 'n99' }], fcs: [{ id: 'f1', code: 'F', name: '', groupId: 'g77' }], roleBoxes: [{ id: 'r1', kind: 'node', nodeId: 'n42' }], cigs: [] })) });
await page.waitForFunction(() => document.getElementById('msg').textContent.includes(t('msgOpened')));
const dang = await ev(() => ({ toast: document.getElementById('msg').textContent, exp: t('msgOpened') + ' · ' + tf('msgDroppedRefs', { n: 3 }), inv: checkInvariants(), nodes: nodes.size, dirty }));
check('file with 3 broken references: opened, references dropped, count shown, invariants hold, not dirty', dang.toast === dang.exp && dang.inv.length === 0 && dang.nodes === 1 && dang.dirty === false, JSON.stringify(dang));

check('no page/console errors', errors.length === 0, errors.join(' | '));
await close();
finish(R);

function require_fs(){ return fsMod; }
