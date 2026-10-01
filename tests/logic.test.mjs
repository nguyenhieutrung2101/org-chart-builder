// Logic thuần trong Node (không trình duyệt): mốc Save/dirty, mutate(), applyState nghiêm ngặt, dán Excel chỉ gán khi duy nhất,
// copy -> dán lại bằng chính app, layout, engine luồng, checkInvariants + FUZZ 400 thao tác ngẫu nhiên (có seed).
import { loadApp, rng } from './_node.mjs';
import { finish } from './_browser.mjs';
const R = []; const check = (n, ok, x) => R.push((ok ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  → ' + x : ''));
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x);
const clone = (v) => JSON.parse(JSON.stringify(v));

// ---------- mốc Save / dirty / undo ----------
{
  const A = loadApp();
  A.addRoot(); const id = A.rootIds[0];
  A.mutate('e:' + id + ':c', () => { A.nodes.get(id).title = 'Before save'; });
  A.mutate('e:' + id + ':c', () => { A.nodes.get(id).title = 'Before save 2'; });
  const snapsBefore = A.undoStack.length;
  check('typing the same field twice coalesces into one undo snapshot', snapsBefore === 2, String(snapsBefore));
  A.saveJSON();
  check('saveJSON clears dirty and resets the coalescing key', A.dirty === false && A.lastSnapKey === null && A.downloads.length === 1);
  A.mutate('e:' + id + ':c', () => { A.nodes.get(id).title = 'After save'; });
  check('REGRESSION: editing the same field right after Save makes the document dirty again', A.dirty === true);
  check('and the first edit after Save snapshots the saved state (undo boundary)', A.undoStack.length === snapsBefore + 1 && JSON.parse(A.undoStack[A.undoStack.length - 1]).roots[0].title === 'Before save 2');
  A.undo();
  check('undo returns to the saved state and leaves the document dirty', A.nodes.get(id).title === 'Before save 2' && A.dirty === true);
  Object.keys(A.staleTabs).forEach(k => { A.staleTabs[k] = false; }); A.mutate(null, () => { A.nodes.get(id).person = 'p'; });
  check('every committed change marks all flow tabs stale (hidden tabs re-render on entry)', Object.values(A.staleTabs).every(Boolean), JSON.stringify(A.staleTabs));
  check('mutate returns the callback result', A.mutate(null, () => 42) === 42);
}

// ---------- applyState: ID trùng bị từ chối, ID thiếu được cấp, tham chiếu hỏng bị bỏ và báo, file cũ vẫn mở ----------
{
  const A = loadApp();
  const base = { v: 11, roots: [{ id: 'n1', t: 'CC', dept: 'A', children: [{ id: 'n2', t: 'T1', star: true, children: [] }] }],
                 fcGroups: [{ id: 'g1', code: 'G1', name: 'One', cbqlns: 'n2' }], fcs: [{ id: 'f1', code: 'F1', name: '', groupId: 'g1' }],
                 roleBoxes: [{ id: 'r1', kind: 'node', nodeId: 'n2' }, { id: 'r2', kind: 'free', title: 'CFO', person: '' }],
                 ruleGrids: { '': { 'Xanh': { 'TĐ2': { ALL: 'r2' } } } }, vlineGrids: { '': {} }, cigs: [{ id: 'c1', code: 'CI-SM', name: '' }],
                 vroots: [{ id: 'v1', dept: 'HQ', children: [{ id: 'v2', orgId: 'n2', children: [] }] }] };
  const st = A.applyState(clone(base));
  check('a clean file loads with nothing dropped and passes the invariants', st.dropped.length === 0 && A.checkInvariants().length === 0, JSON.stringify(A.checkInvariants()));
  const rt = stable(A.serializeAll()); A.applyState(clone(A.serializeAll()));
  check('serialize -> applyState -> serialize is idempotent', stable(A.serializeAll()) === rt);
  const dupCases = {
    node: (d) => { d.roots.push({ id: 'n2', t: 'CC', children: [] }); },
    group: (d) => { d.fcGroups.push({ id: 'g1', code: 'X', name: 'X' }); },
    fc: (d) => { d.fcs.push({ id: 'f1', code: 'X', name: '' }); },
    role: (d) => { d.roleBoxes.push({ id: 'r2', kind: 'free', title: 'X' }); },
    cig: (d) => { d.cigs.push({ id: 'c1', code: 'X', name: '' }); },
    vnode: (d) => { d.vroots.push({ id: 'v1', dept: 'X', children: [] }); }
  };
  const before = stable(A.serializeAll());
  const rejected = Object.entries(dupCases).map(([k, f]) => { const d = clone(base); f(d); try { A.applyState(d); return k + ':loaded'; } catch (e) { return /n2|g1|f1|r2|c1|v1/.test(e.message) ? '' : k + ':' + e.message; } }).filter(Boolean);
  check('duplicate ids of every entity type are rejected with the offending id in the message', rejected.length === 0, rejected.join(' | '));
  check('a rejected file leaves the current state untouched', stable(A.serializeAll()) === before);
  const miss = clone(base); delete miss.roots[0].children[0].id; miss.fcGroups.push({ code: 'G2', name: 'Two' }); miss.roleBoxes.push({ kind: 'free', title: 'X' }); miss.vroots[0].children.push({ dept: 'X', children: [] });
  A.applyState(miss);
  check('missing ids are regenerated without colliding with existing ones', A.checkInvariants().length === 0 && A.nodes.size === 2 && A.fcGroups.length === 2 && new Set(A.fcGroups.map(g => g.id)).size === 2 && A.roleBoxes.length === 3 && A.vnodes.size === 3, JSON.stringify([...A.fcGroups.map(g => g.id), ...A.roleBoxes.map(r => r.id), ...A.vnodes.keys()]));
  const dang = clone(base); dang.fcGroups[0].cbqlns = 'n99'; dang.fcs[0].groupId = 'g77'; dang.roleBoxes[0].nodeId = 'n42'; dang.ruleGrids[''].Xanh['TĐ2'].ALL = 'r9'; dang.ruleGrids.c9 = {}; dang.vroots[0].children[0].orgId = 'n41';
  const st2 = A.applyState(dang);
  check('dangling references are dropped, counted (6) and the state stays consistent', st2.dropped.length === 6 && A.checkInvariants().length === 0 && A.fcGroups[0].cbqlns === null && A.fcs[0].groupId === null && A.roleBoxes.length === 1 && A.vnodes.size === 1, JSON.stringify(st2.dropped));
  const legacy = { roots: [{ id: 'n1', t: 'CC', vh: true, children: [] }], ruleGrid: { 'Xanh': { 'TĐ2': { ALL: 'r1' } } }, roleBoxes: [{ id: 'r1', kind: 'free', title: 'X' }] };
  A.applyState(legacy);
  check('legacy shapes still load: vh -> br VH, ruleGrid -> ruleGrids[\'\'], no cigs -> defaults', A.nodes.get('n1').br === 'VH' && A.ruleGrids[''].Xanh['TĐ2'].ALL === 'r1' && A.cigs.length === 3 && A.checkInvariants().length === 0);
  const bad = [null, {}, { roots: 'x' }, { roots: [5] }].map(d => { try { A.applyState(d); return 'loaded'; } catch (e) { return ''; } }).filter(Boolean);
  check('structurally broken files throw instead of loading', bad.length === 0);
}

// ---------- checkInvariants thật sự bắt được hỏng ----------
{
  const A = loadApp();
  A.addRoot(); A.addChild(A.rootIds[0]); A.addGroup(); A.addFreeRole(); A.dropRole('Xanh', 'TĐ2', A.roleBoxes[0].id);
  check('invariants hold after normal operations', A.checkInvariants().length === 0, JSON.stringify(A.checkInvariants()));
  const c = A.nodes.get(A.rootIds[0]).children[0];
  A.nodes.get(c).parent = 'nope'; A.fcGroups[0].cbqlns = 'n77'; A.ruleGrids[''].Xanh['TĐ2'].ALL = 'r77';
  const v = A.checkInvariants();
  check('corrupted parent link, BMO reference and rule reference are all reported', v.some(x => /parent mismatch/.test(x)) && v.some(x => /cbqlns dangling/.test(x)) && v.some(x => /rule role dangling/.test(x)), v.join(' | '));
}

// ---------- dán Excel: chỉ gán khi duy nhất; copy -> dán lại bằng chính app ----------
{
  const A = loadApp();
  A.addRoot(); const r = A.rootIds[0];
  A.addChild(r); A.addChild(r); A.addChild(r);
  const [a, b, c] = A.nodes.get(r).children;
  Object.assign(A.nodes.get(a), { title: 'GĐ Vùng 1', person: 'Nguyễn Văn A', star: true });
  Object.assign(A.nodes.get(b), { title: 'GĐ Vùng 2', person: 'Nguyễn Văn A', star: true });   // kiêm nhiệm: cùng tên, hai box ★
  Object.assign(A.nodes.get(c), { title: 'GĐ Vùng 3', person: 'Trần B', star: true });
  check('parsePaste drops the header row and trims cells', JSON.stringify(A.parsePaste('Mã FCG\tTên\tCBQLNS\n G1 \tOne\t Trần B \n\n')) === '[["G1","One","Trần B"]]');
  const st = A.mergeGroupRows(A.parsePaste('G1\tOne\tNguyễn Văn A\nG2\tTwo\tTrần B\nG3\tThree\tKhông Có Ai\nG1\tOne renamed\ttrần b'));
  const g = (code) => A.fcGroups.find(x => x.code === code);
  check('ambiguous BMO name is NOT auto-mapped (no silent wrong approver), unique name is; unknown name reported', g('G1').cbqlns === c && g('G2').cbqlns === c && g('G3').cbqlns === null && st.added === 3 && st.updated === 1 && st.notes.length === 2 && /Nguyễn Văn A.*2/.test(st.notes[0]) && /Không Có Ai/.test(st.notes[1]), JSON.stringify(st) + ' | ' + JSON.stringify(A.fcGroups));
  check('same FCG code updates the existing row in place (case-insensitive BMO match)', g('G1').name === 'One renamed' && A.fcGroups.length === 3);
  A.fcGroups.push({ id: 'g9', code: '', name: 'Two', cbqlns: null, byCig: false });   // nhóm thứ hai cùng tên "Two", không mã
  const st2 = A.mergeFcRows(A.parsePaste('F1\tFund 1\tOne renamed\nF2\tFund 2\tTwo\nF3\tFund 3\tTwo\tG2\nF4\tFund 4\tNew group\nF5\tFund 5\tWhatever\tG9\nF6\tFund 6'));
  const fc = (code) => A.fcs.find(x => x.code === code);
  check('FC group: unique name -> assigned; duplicate name -> left blank + reported; group code column wins; unknown -> created; blank -> none',
    fc('F1').groupId === g('G1').id && fc('F2').groupId === null && fc('F3').groupId === g('G2').id && fc('F4').groupId && A.fcGroups.find(x => x.id === fc('F4').groupId).name === 'New group' && fc('F5').groupId && g('G9').name === 'Whatever' && fc('F6').groupId === null && st2.added === 6 && st2.groups === 2 && st2.notes.length === 1 && /Two.*2/.test(st2.notes[0]),
    JSON.stringify(st2) + ' | ' + JSON.stringify(A.fcs));
  // copy -> dán lại vào một app trống với cùng sơ đồ: nhóm khớp theo MÃ, CBQLNS theo tên duy nhất
  const B = loadApp(); B.applyState(clone(A.serializeAll())); B.fcGroups = []; B.fcs = [];
  const sg = B.mergeGroupRows(B.parsePaste(A.groupsTsv())), sf = B.mergeFcRows(B.parsePaste(A.fcsTsv()));
  const same = A.fcs.every(f => { const gA = A.fcGroups.find(x => x.id === f.groupId), fB = B.fcs.find(x => x.code === f.code), gB = fB && B.fcGroups.find(x => x.id === fB.groupId); return (gA ? gA.code + '|' + gA.name : '') === (gB ? gB.code + '|' + gB.name : ''); });
  check('copy -> paste round trip through the app keeps every FC in the same group (matched by FCG code) and BMOs where unique', same && sg.added === A.fcGroups.length && sf.added === A.fcs.length && B.checkInvariants().length === 0 && B.fcGroups.find(x => x.code === 'G2').cbqlns === c, JSON.stringify({ sg, sf }));
  check('TSV export quotes formula-looking cells (Excel injection guard) and tabs', A.q('=SUM(1)') === "'=SUM(1)" && A.q('a\tb') === '"a\tb"');
}

// ---------- layout + engine luồng ----------
{
  const A = loadApp(); const rnd = rng(7);
  A.addRoot();
  for (let i = 0; i < 40; i++){ const ids = [...A.nodes.keys()]; A.addChild(ids[Math.floor(rnd() * ids.length)]); }
  const L = A.layout(); let overlap = 0, rowBad = 0;
  const rects = [...L.pos.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y }));
  rects.forEach((a, i) => rects.forEach((b, j) => { if (i < j && Math.abs(a.x - b.x) < A.BW && Math.abs(a.y - b.y) < A.BH) overlap++; }));
  A.nodes.forEach(n => n.children.forEach(c => { if (L.pos.get(c).y <= L.pos.get(n.id).y) rowBad++; }));
  check('layout of a random 41-node tree: no overlapping boxes, every child below its parent', overlap === 0 && rowBad === 0 && L.vis.size === 41, overlap + '/' + rowBad);
  A.nodes.get(A.rootIds[0]).collapsed = true;
  check('collapsed root hides the whole subtree from the layout', A.layout().vis.size === 1);
  A.nodes.get(A.rootIds[0]).collapsed = false;
  // engine: CBQLNS cố định, phạm vi theo nhánh, REST, uỷ quyền pdBelow, ngành dọc
  const root = A.rootIds[0], kids = A.nodes.get(root).children;
  A.setBranch(kids[0], 'SM'); const cbSM = kids[0]; A.toggleStar(cbSM);
  const cbRest = kids[1]; A.toggleStar(cbRest);
  A.addFreeRole(); const rAll = A.roleBoxes[0].id; A.roleBoxes[0].title = 'CFO';
  A.addFreeRole(); const rSM = A.roleBoxes[1].id; A.roleBoxes[1].title = 'Sales head';
  A.dropRole('Xanh', 'TĐ2', rAll); A.cycleScope('Xanh', 'TĐ2', 'ALL'); A.dropRole('Xanh', 'TĐ2', rSM);   // ALL -> VH, box thứ hai vào phạm vi trống kế tiếp (SM)
  A.cycleScope('Xanh', 'TĐ2', 'IT');                                                                  // chip không tồn tại -> bỏ qua, không hỏng ô
  const cell = A.ruleGrids[''].Xanh['TĐ2'];
  const seg = (id) => A.segmentOf(A.nodes.get(id));
  check('cycling ALL -> VH then dropping a second box fills the next free scope; cycling a missing chip is ignored', !cell.ALL && cell.VH === rAll && cell.SM === rSM && Object.keys(cell).length === 2, JSON.stringify(cell));
  check('resolveCell: SM branch picks the SM box, REST branch falls back to "—" when only branch scopes exist; fixed BMO cell shows the BMO',
    A.resolveCell('Xanh', 'TĐ2', seg(cbSM), A.nodes.get(cbSM)) === 'Sales head' && A.resolveCell('Xanh', 'TĐ2', seg(cbRest), A.nodes.get(cbRest)) === '—' && A.resolveCell('Xanh', 'PD', 'REST', A.nodes.get(cbRest)) === A.roleText(A.nodes.get(cbRest)),
    [A.resolveCell('Xanh', 'TĐ2', seg(cbSM), A.nodes.get(cbSM)), A.resolveCell('Xanh', 'TĐ2', seg(cbRest), A.nodes.get(cbRest))].join(' | '));
  A.$ = (id) => id === 'rolePick' ? { value: root } : A.stubEl(); A.addNodeRole(); A.$ = A.stubEl;
  const rNode = A.roleBoxes[2]; rNode.pdBelow = true; A.dropRole('Vàng', 'PD', rNode.id);
  check('pdBelow: BMO under the chart box signs instead of the box', A.resolveCell('Vàng', 'PD', 'REST', A.nodes.get(cbRest)).startsWith(A.roleText(A.nodes.get(cbRest))));
  A.vAddRoot(); const vr = A.vroots[0]; A.vnodes.get(vr).title = 'Global head';
  A.$ = (id) => id === 'vImportPick' ? { value: cbRest } : A.stubEl(); A.vsel = vr; A.vImport(); A.$ = A.stubEl;
  A.setRuleMode('vline'); A.dropRole('Đỏ', 'TĐ2', A.VLINE);
  check('vertical-line mode: the VLINE box resolves to the BMO\'s superior on the vertical tree', A.resolveCell('Đỏ', 'TĐ2', 'REST', A.nodes.get(cbRest), A.vlineGrids['']) === 'Global head' && A.checkInvariants().length === 0);
}

// ---------- F1: getter chỉ đọc; đổi mode giữ fallback về Chung; RENDER KHÔNG ĐƯỢC ĐỔI DOCUMENT (renderer thật, DOM giả) ----------
{
  const A = loadApp({ realRender: true }); A.curTab = 'rules';
  A.addFreeRole(); A.roleBoxes[0].title = 'Common approver'; const rid = A.roleBoxes[0].id;
  A.dropRole('Xanh', 'TĐ2', rid);                                            // luật Chung, mode Luồng
  A.setRuleMode('vline'); A.dropRole('Xanh', 'TĐ2', rid); A.setRuleMode('flow');   // luật Chung, mode Ngành dọc
  A.setCurCig('c1');                                                         // mở CIG c1 ở mode Luồng -> clone Chung (chủ ý)
  const own = { flow: !!A.ruleGrids.c1, vline: !!A.vlineGrids.c1 };
  A.setRuleMode('vline');                                                    // đổi mode khi c1 chưa có luật riêng ở family này
  const after = A.resolveCell('Xanh', 'TĐ2', 'REST', null, A.gridFor('c1'));
  check('REGRESSION F1: switching mode with a CIG selected keeps the Common fallback (renderer creates no empty override)', after === 'Common approver' && A.vlineGrids.c1 === undefined && own.flow && !own.vline, JSON.stringify({ after, own, vlineC1: A.vlineGrids.c1 }));
  A.dropRole('Đỏ', 'TĐ3', rid);                                              // sửa luật của c1 ở mode Ngành dọc -> lúc này mới clone Chung rồi áp thay đổi
  check('first edit of an inherited CIG clones Common then applies the change (Common untouched)', !!A.vlineGrids.c1 && A.vlineGrids.c1.Xanh['TĐ2'].ALL === rid && A.vlineGrids.c1['Đỏ']['TĐ3'].ALL === rid && !A.vlineGrids['']['Đỏ']);
  A.addRoot(); A.addGroup(); A.addFc(); A.vAddRoot(); A.curCig = 'c2';       // c2 tồn tại nhưng chưa có luật riêng ở cả 2 mode (đúng tình huống F1)
  const snapshot = () => stable(A.serializeAll()) + '|' + A.undoStack.length + '|' + A.dirty + '|' + A.lastSnapKey;
  const impure = ['org', 'vline', 'rules', 'flow'].map(tab => { A.curTab = tab; const b = snapshot(); A.renderAll(); A.renderTab(tab); A.refreshView(); return b === snapshot() ? '' : tab; }).filter(Boolean);
  A.MOD = 'doc'; const b2 = snapshot(); A.renderDocAll(); A.refreshView(); const docPure = b2 === snapshot(); A.MOD = 'flow';
  check('PROPERTY: rendering any tab or the print page (real renderers) never changes document, history or dirty', impure.length === 0 && docPure, impure.join(',') + (docPure ? '' : ' doc'));
}

// ---------- F2: dòng cập nhật với CBQLNS không khớp giữ người cũ và NÓI RÕ; dòng mới để trống và nói rõ ----------
{
  const A = loadApp(); A.addRoot(); Object.assign(A.nodes.get(A.rootIds[0]), { person: 'Existing BMO', star: true });
  A.mergeGroupRows([['G01', 'Group', 'Existing BMO']]);
  const st = A.mergeGroupRows([['G01', 'Group', 'Unknown BMO'], ['G02', 'New', 'Unknown BMO'], ['G01', 'Group', '']]);
  check('REGRESSION F2: unresolved BMO on an update keeps the existing BMO and the note says so; on a new row it is blank and says so; blank column = no change',
    A.nodes.get(A.fcGroups[0].cbqlns).person === 'Existing BMO' && A.fcGroups[1].cbqlns === null && st.notes.length === 2 && st.notes[0].endsWith(A.tf('impKept', { cur: 'Existing BMO' })) && st.notes[1].endsWith(A.t('impBlank')) && st.updated === 2, JSON.stringify(st));
}

// ---------- F3: TSV round-trip với ký tự đặc biệt; header chỉ khi khớp trọn nhãn ----------
{
  const A = loadApp();
  const cases = ['Finance "HQ"', 'Finance\nHQ', 'Finance\tHQ', '=HQ', '+1', '-abc', '@x', "'quoted'", ' spaced ', 'a""b', ' =HQ', '\t=x'];
  const bad = cases.filter(v => { const rows = A.parsePaste(['G01', v, 'x'].map(A.q).join('\t') + '\r\n'); return !(rows.length === 1 && rows[0][1] === v.trim() && rows[0][2] === 'x'); });
  check('REGRESSION F3: copy -> paste round-trips quotes, newlines, tabs and the formula guard', bad.length === 0, JSON.stringify(bad));
  check('a first row whose code contains a space ("FC 001") is data, not a header', JSON.stringify(A.parsePaste('FC 001\tFund 1\tGroup 1\nFC002\tFund 2\tGroup 2').map(r => r[0])) === '["FC 001","FC002"]');
  check('exact header labels (both languages, generic words) are still dropped', A.parsePaste('Mã FCG\tTên\tCBQLNS\nG1\tOne\t').length === 1 && A.parsePaste('FCG code\tGroup name\tBMO (★)\nG1\tOne\t').length === 1 && A.parsePaste('Code\tName\nG1\tOne').length === 1);
  check('trailing empty cells and CRLF are preserved as columns', JSON.stringify(A.parsePaste('F1\tFund\t\t\r\nF2\tFund 2\tG\tCODE')) === '[["F1","Fund","",""],["F2","Fund 2","G","CODE"]]');
  check('codes that happen to be words ("ID", "FC", "FCG") on the first row are data, not a header', JSON.stringify(A.parsePaste('ID\tIndonesia Fund\tSEA\nVN\tVietnam Fund\tSEA').map(r => r[0])) === '["ID","VN"]' && A.parsePaste('FC\tx').length === 1 && A.parsePaste('FCG\tx').length === 1);
  let quoteErr = ''; try { A.parsePaste('F1\tok\nF2\t"Missing quote\nF3\tFund 3\tGroup 3'); } catch (e) { quoteErr = e.message; }
  check('an unclosed quote is reported with its line instead of silently merging rows', quoteErr === A.tf('errTsvQuote', { line: 2 }), quoteErr);
  const B = loadApp(); B.importGrpPaste('G1\t"open\nG2\tx');
  check('importing such a paste changes nothing and shows the error', B.fcGroups.length === 0 && B.dirty === false && B.toasts.includes(B.tf('errTsvQuote', { line: 1 })), JSON.stringify(B.toasts));
}

// ---------- F4: tên trùng thuộc tính kế thừa; mutate là transaction (rollback khi lỗi / vi phạm bất biến) ----------
{
  const A = loadApp();
  const st = A.mergeGroupRows(A.parsePaste('G01\tFirst\t\nconstructor\tSecond\t\n__proto__\tThird\t\nG03\tFourth\t'));
  check('REGRESSION F4: names colliding with inherited object keys import completely', st.added === 4 && A.fcGroups.map(g => g.code).join(',') === 'G01,constructor,__proto__,G03' && A.checkInvariants().length === 0, JSON.stringify(st));
  A.saveJSON(); const before = stable(A.serializeAll()), hist = A.undoStack.length;
  let threw = false; try { A.mutate(null, () => { A.fcGroups.push({ id: 'g99', code: 'X', name: 'X', cbqlns: null, byCig: false }); throw new Error('boom'); }); } catch (e) { threw = /boom/.test(e.message); }
  check('TRANSACTION: a callback that throws is rolled back completely (document, undo stack, dirty) and reported', threw && stable(A.serializeAll()) === before && A.undoStack.length === hist && A.dirty === false && A.toasts.includes(A.t('msgMutateFail')), JSON.stringify({ threw, hist, len: A.undoStack.length, dirty: A.dirty }));
  let threw2 = false; try { A.mutate(null, () => { A.fcs.push({ id: 'f1', code: 'F', name: '', groupId: 'g-missing' }); }); } catch (e) { threw2 = /invariants/.test(e.message); }
  check('TRANSACTION: a callback that leaves the document inconsistent is rolled back before commit', threw2 && stable(A.serializeAll()) === before && A.dirty === false && A.fcs.length === 0);
  A.mutate('e:x', () => { A.fcGroups[0].name = 'renamed'; });
  check('after a rollback, normal mutations work again', A.dirty === true && A.undoStack.length === hist + 1);
}

// ---------- F5: một box ★ chỉ đứng một chỗ trên cây Ngành dọc — file xung đột bị TỪ CHỐI (không chọn thay người dùng), nêu cả hai tuyến ----------
{
  const A = loadApp();
  const file = (order) => ({ roots: [{ id: 'n1', t: 'CC', star: true, person: 'BMO' }], roleBoxes: [], cigs: [],
    vroots: order === 'AB'
      ? [{ id: 'v1', title: 'Superior A', children: [{ id: 'v2', orgId: 'n1' }] }, { id: 'v3', title: 'Superior B', children: [{ id: 'v4', orgId: 'n1' }] }]
      : [{ id: 'v3', title: 'Superior B', children: [{ id: 'v4', orgId: 'n1' }] }, { id: 'v1', title: 'Superior A', children: [{ id: 'v2', orgId: 'n1' }] }] });
  A.addRoot(); const before = stable(A.serializeAll());
  const errs = ['AB', 'BA'].map(o => { try { A.applyState(file(o)); return 'loaded'; } catch (e) { return e.message; } });
  check('REGRESSION F5: a file with the same box on two vertical lines is rejected in BOTH raw orders, naming the box and both superiors; state untouched',
    errs[0] === A.tf('errOrgTwice', { id: 'n1', a: 'Superior A', b: 'Superior B' }) && errs[1] === A.tf('errOrgTwice', { id: 'n1', a: 'Superior B', b: 'Superior A' }) && stable(A.serializeAll()) === before, errs.join(' | '));
  A.applyState({ roots: [{ id: 'n1', t: 'CC', star: true }], roleBoxes: [], cigs: [], vroots: [{ id: 'v1', title: 'Superior A', children: [{ id: 'v2', orgId: 'n1' }] }, { id: 'v3', title: 'B' }] });
  A.vnodes.get('v3').orgId = 'n1';
  check('checkInvariants reports a box imported twice', A.checkInvariants().some(x => /imported twice/.test(x)));
}

// ---------- Transaction + history: lỗi ở mức history 0 / 59 / 60, gộp phím, no-op — so NỘI DUNG stack, không chỉ độ dài ----------
{
  const A = loadApp(); A.addRoot(); const id = A.rootIds[0];
  const hist = () => A.undoStack.join('\u0001') + '|' + A.undoStack.length;
  const failing = (key) => { try { A.mutate(key, () => { A.nodes.get(id).title = 'broken'; throw new Error('boom'); }); } catch (e) {} };
  const badInv = () => { try { A.mutate(null, () => { A.fcs.push({ id: 'fX', code: 'X', name: '', groupId: 'nope' }); }); } catch (e) {} };
  const results = [];
  [0, 59, 60].forEach(level => {
    A.undoStack.length = 0; A.lastSnapKey = null;
    for (let i = 0; i < level; i++) A.mutate(null, () => { A.nodes.get(id).person = 'p' + i; });
    const docBefore = stable(A.serializeAll()), h = hist(), d = A.dirty;
    failing(null); const afterThrow = hist() === h && stable(A.serializeAll()) === docBefore && A.dirty === d;
    badInv();      const afterInv = hist() === h && stable(A.serializeAll()) === docBefore && A.dirty === d;
    A.mutate('e:t', () => { A.nodes.get(id).title = 'a'; }); const h2 = hist();
    failing('e:t'); const coalescedFail = hist() === h2 && A.nodes.get(id).title === 'a';
    A.mutate('e:t', () => { A.nodes.get(id).title = 'ab'; }); const coalesced = hist() === h2;
    results.push({ level, len: A.undoStack.length, afterThrow, afterInv, coalescedFail, coalesced });
  });
  check('TRANSACTION: at history 0 / 59 / 60 a throw or an invariant failure leaves the undo stack byte-identical (no lost oldest entry), document and dirty unchanged; coalesced keys still coalesce',
    results.every(r => r.afterThrow && r.afterInv && r.coalescedFail && r.coalesced) && results[2].len === 60 && results[1].len === 60, JSON.stringify(results));
  A.saveJSON(); const h3 = hist(), k3 = A.lastSnapKey;
  A.mutate(null, () => {});                                               // không đổi gì
  A.mutate('e:t', () => { A.nodes.get(id).title = 'ab'; });               // gán lại đúng giá trị cũ = cũng không đổi gì
  check('a no-op mutation leaves history, dirty and the coalescing key untouched', hist() === h3 && A.dirty === false && A.lastSnapKey === k3);
}

// ---------- Review 4 / R1: kéo box đổi hàng là GESTURE — xem trước trong view-state, thả mới ghi đúng một transaction ----------
// Chạy renderer thật (renderDoc dựng SVG lên DOM giả) như trong trình duyệt; #docPage có firstChild để startRowDrag đọc được.
{
  const A = loadApp({ realRender: true });
  const page = A.stubEl(); page.firstChild = A.stubEl();
  A.$ = (id) => id === 'docPage' ? page : A.stubEl();
  A.MOD = 'doc';
  A.addRoot(); const r = A.rootIds[0]; A.addChild(r); A.addChild(r); const c = A.nodes.get(r).children[0]; A.addChild(c);
  A.renderDocAll();
  A.saveJSON(); const doc0 = stable(A.serializeAll()), h0 = A.undoStack.length;
  const px = A.rowPitch() * A.docView.scale * A.PX_PER_MM * A.dzoom;
  // DOM giả: svg.getBoundingClientRect().top = 0 nên clientY = toạ độ trang. yOf(row) = tâm box ở hàng row (px màn hình)
  const yOf = (row) => (A.docView.ty + A.docView.scale * (row * A.rowPitch() + A.DBOX.h / 2)) * A.PX_PER_MM * A.dzoom;
  const rowC = A.docView.pos.get(c).row, y0 = yOf(rowC), ev = (dy) => ({ clientY: y0 + dy });
  const d = A.startRowDrag(c, ev(0));
  A.moveRowDrag(d, ev(2));                                                 // dưới ngưỡng 6px: chưa bắt đầu
  const notYet = d.moved === false && A.docRowDrag === null;
  A.moveRowDrag(d, { clientY: yOf(rowC + 1) + 1 });                       // kéo xuống một hàng
  const s1 = { preview: A.docRowDrag && A.docRowDrag.shift, row: A.docView.pos.get(c).row, childRow: A.docView.pos.get(A.nodes.get(c).children[0]).row, docSame: stable(A.serializeAll()) === doc0, dirty: A.dirty, h: A.undoStack.length };
  A.moveRowDrag(d, { clientY: yOf(rowC + 2) + 1 });                       // hai hàng
  const s2 = { preview: A.docRowDrag.shift, row: A.docView.pos.get(c).row, docSame: stable(A.serializeAll()) === doc0, dirty: A.dirty, h: A.undoStack.length };
  A.endRowDrag(d);
  const done = { shift: A.nodes.get(c).rowShift, row: A.docView.pos.get(c).row, dirty: A.dirty, h: A.undoStack.length, drag: A.docRowDrag, inv: A.checkInvariants().length };
  A.undo();
  const undone = { same: stable(A.serializeAll()) === doc0, h: A.undoStack.length, row: A.docView.pos.get(c).row };
  check('REGRESSION (review 4): during a drag only the preview moves (document byte-identical, not dirty, no undo entry); release commits ONE undo step, dirty after Save; undo restores the whole document',
    notYet && s1.preview === 1 && s1.row === rowC + 1 && s1.childRow === rowC + 2 && s1.docSame && !s1.dirty && s1.h === h0 && s2.preview === 2 && s2.row === rowC + 2 && s2.docSame && !s2.dirty && s2.h === h0
    && done.shift === 2 && done.row === rowC + 2 && done.dirty === true && done.h === h0 + 1 && done.drag === null && done.inv === 0 && undone.same && undone.h === h0 && undone.row === rowC, JSON.stringify({ notYet, s1, s2, done, undone, px }));
  A.dirty = false;
  const d2 = A.startRowDrag(c, ev(0)); A.moveRowDrag(d2, { clientY: yOf(rowC + 2) + 1 }); A.moveRowDrag(d2, ev(7)); A.endRowDrag(d2);
  const back = { same: stable(A.serializeAll()) === doc0, dirty: A.dirty, h: A.undoStack.length, drag: A.docRowDrag };
  const d3 = A.startRowDrag(c, ev(0)); A.moveRowDrag(d3, { clientY: yOf(rowC + 2) + 1 }); const mid3 = A.docView.pos.get(c).row; A.cancelRowDrag(d3);
  const cancelled = { mid3, same: stable(A.serializeAll()) === doc0, dirty: A.dirty, h: A.undoStack.length, drag: A.docRowDrag, row: A.docView.pos.get(c).row };
  const d4 = A.startRowDrag(c, ev(0)); A.endRowDrag(d4); A.cancelRowDrag(d4);
  const untouched = { same: stable(A.serializeAll()) === doc0, dirty: A.dirty, h: A.undoStack.length };
  check('drag back to the original row, pointercancel mid-drag, or a click without movement write nothing (document, dirty and history untouched)',
    back.same && !back.dirty && back.h === h0 && back.drag === null && cancelled.mid3 === rowC + 2 && cancelled.same && !cancelled.dirty && cancelled.h === h0 && cancelled.drag === null && cancelled.row === rowC && untouched.same && !untouched.dirty && untouched.h === h0, JSON.stringify({ back, cancelled, untouched }));
}

// ---------- Review 4 / R4: svgAttrOk giải mã escape CSS; fill/stroke chỉ nhận danh sách giá trị cho phép ----------
{
  const A = loadApp();
  const ok = (n, v) => A.svgAttrOk(n, v);
  const rejected = ['u\\72l(//x)', 'u\\00072l(//x)', 'u\\72 l(//x)', 'url(//x)', 'url(http://x)', 'url("//x")', '\\75rl(#g) url(//x)', 'url(#g)url(//x)', 'expression(1)', 'javascript:1', 'u\\72l(#g)x;'];
  const accepted = ['#fff', '#0F0F0F', '#00ff0080', 'red', 'none', 'currentColor', 'transparent', 'inherit', 'rgb(1, 2, 3)', 'rgba(1,2,3,.5)', 'hsl(10, 50%, 50%)', 'url(#g)', 'url(#g) none', 'url(#g) #f00', 'u\\72l(#g)'];
  const badR = rejected.filter(v => ok('fill', v) || ok('stroke', v) || ok('stop-color', v));
  const badA = accepted.filter(v => !ok('fill', v) || !ok('stroke', v));
  check('svgAttrOk on paint attributes: CSS escapes are decoded before matching (u\\72l( is url(); only colours / none / currentColor / url(#id) pass; every external or escaped url() form is rejected', badR.length === 0 && badA.length === 0, 'rejected-but-passed=' + JSON.stringify(badR) + ' accepted-but-failed=' + JSON.stringify(badA));
  check('svgAttrOk generic attributes: escaped javascript: / url( still rejected; on* never; href only #id', !ok('x', 'java\\73 cript:1') && !ok('filter', 'u\\72l(//x)') && !ok('onload', '1') && !ok('href', 'https://x') && ok('href', '#g') && ok('xlink:href', '#g') && ok('x', '10') && ok('transform', 'rotate(10)'));
  check('cssUnescape: hex escapes with optional trailing space and backslash-char escapes', A.cssUnescape('u\\72l(') === 'url(' && A.cssUnescape('u\\00072 l(') === 'url(' && A.cssUnescape('a\\:b') === 'a:b');
}

// ---------- Review 4 / R3: parsePaste(txt, header) — lựa chọn của người dùng thắng phép đoán ----------
{
  const A = loadApp();
  const txt = 'Code\tFirst fund\tSEA\nVN\tVietnam Fund\tSEA';
  check('header: undefined guesses (Code → dropped), false keeps the row as data, true drops even a non-label first row',
    A.parsePaste(txt).length === 1 && A.parsePaste(txt, false).length === 2 && A.parsePaste(txt, false)[0][0] === 'Code' && A.parsePaste('ID\tx\nVN\ty', true).length === 1 && A.parsePaste('ID\tx\nVN\ty', true)[0][0] === 'VN' && A.parsePaste('', true).length === 0);
  const ck = A.stubEl(), ta = A.stubEl(); ta.value = '\n  \nMã FC\tTên\nF1\tx'; A.$ = (id) => id === 'ck' ? ck : id === 'ta' ? ta : A.stubEl();
  A.guessHeaderBox('ta', 'ck'); const g1 = ck.checked === true && ck.dataset.touched === '' && A.headerChoice('ck') === undefined;
  ck.checked = false; ck.dataset.touched = '1'; const g2 = A.headerChoice('ck') === false;
  ta.value = 'FC001\tx'; A.guessHeaderBox('ta', 'ck'); const g3 = ck.checked === false && A.headerChoice('ck') === undefined;
  check('guessHeaderBox ticks the checkbox from the first non-empty line and resets "touched"; headerChoice returns the user choice only after they clicked', g1 && g2 && g3);
}

// ---------- F6: ID quá 15 chữ số bị coi là không hợp lệ -> cấp mới, không ghi đè ----------
{
  const A = loadApp();
  A.applyState({ roots: [{ id: 'n9007199254740992', t: 'CC', title: 'Original' }, { id: 'n12', t: 'CC' }], roleBoxes: [], cigs: [] });
  A.addRoot();
  check('REGRESSION F6: an unsafe-integer id is regenerated; adding a node never overwrites an existing one', A.nodes.size === 3 && new Set(A.rootIds).size === 3 && A.checkInvariants().length === 0 && [...A.nodes.values()].some(n => n.title === 'Original'), JSON.stringify(A.rootIds));
}

// ---------- FUZZ: 5 seed × 2.000 thao tác ngẫu nhiên qua API công khai. Sau mỗi bước: bất biến rỗng; thao tác có snapshot thì undo
// phải về đúng trạng thái trước (kể cả khi stack đã đầy 60: nhận ra snapshot mới qua việc đỉnh stack đổi); rồi khôi phục đúng history;
// mỗi 25 bước: serialize -> applyState -> serialize idempotent ----------
function fuzz(seed, steps){
  const A = loadApp(); const rnd = rng(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const word = () => pick(['ALPHA', 'BETA', 'GAMMA', 'ĐỘI 1', 'PHÒNG KẾ TOÁN', 'X Y Z', '=cmd', 'constructor', 'Tên "kép"', '']);
  const ops = [
    () => A.addRoot(),
    () => { const ids = [...A.nodes.keys()]; if (ids.length) A.addChild(pick(ids)); },
    () => { const ids = [...A.nodes.keys()]; if (ids.length) A.addSib(pick(ids)); },
    () => { const ids = [...A.nodes.keys()]; if (ids.length) A.delNode(pick(ids)); },
    () => { const ids = [...A.nodes.keys()]; if (!ids.length) return; const id = pick(ids), n = A.nodes.get(id), min = n.parent ? A.rnum(A.nodes.get(n.parent).t) : 0; A.setT(id, pick(A.LEVELS.slice(min))); },
    () => { const ids = [...A.nodes.keys()]; if (ids.length) A.toggleStar(pick(ids)); },
    () => { const ids = [...A.nodes.keys()]; if (ids.length) A.setBranch(pick(ids), pick(['', 'VH', 'SM', 'BO', 'IT', 'AC'])); },
    () => { const ids = [...A.nodes.keys()]; if (ids.length) A.moveSib(pick(ids), pick([-1, 1])); },
    () => { const ids = [...A.nodes.keys()]; if (ids.length) A.toggleCollapse(pick(ids)); },
    () => { const ids = [...A.nodes.keys()]; if (ids.length) (rnd() < 0.7 ? A.setFocus(pick(ids)) : A.clearFocus()); },
    () => { const ids = [...A.nodes.keys()]; if (ids.length) A.setHc(pick(ids), pick(['', '3', '12', 'x'])); },
    () => { const ids = [...A.nodes.keys()]; if (!ids.length) return; const id = pick(ids); A.mutate('e:' + id + ':d', () => { A.nodes.get(id).dept = word().toUpperCase(); }); },
    () => { const ids = [...A.nodes.keys()]; if (!ids.length) return; const id = pick(ids); A.mutate(null, () => { const n = A.nodes.get(id); n.stack = !!n.parent && rnd() < 0.5; n.annot = pick(['', 'A', 'B']); n.rowShift = pick([0, 1, 2]); n.person = word(); }); },
    () => A.addGroup(),
    () => { if (A.fcGroups.length) A.delGroup(pick(A.fcGroups), null); },
    () => { const stars = A.starredNodes(); if (A.fcGroups.length) A.mutate(null, () => { pick(A.fcGroups).cbqlns = stars.length && rnd() < 0.8 ? pick(stars).id : null; }); },
    () => { if (A.fcGroups.length) A.mutate(null, () => { const g = pick(A.fcGroups); g.byCig = !g.byCig; g.code = word(); }); },
    () => A.addFc(),
    () => { if (A.fcs.length) A.delFc(pick(A.fcs), null); },
    () => { if (A.fcs.length) A.mutate(null, () => { pick(A.fcs).groupId = A.fcGroups.length && rnd() < 0.8 ? pick(A.fcGroups).id : null; }); },
    () => A.addFreeRole(),
    () => { const ids = [...A.nodes.keys()]; if (!ids.length) return; A.$ = (id) => id === 'rolePick' ? { value: pick(ids) } : A.stubEl(); A.addNodeRole(); A.$ = A.stubEl; },
    () => { if (A.roleBoxes.length) A.deleteRole(pick(A.roleBoxes)); },
    () => { if (A.roleBoxes.length) A.dropRole(pick(A.FLOWS), pick(A.COLS), pick(A.roleBoxes.concat([{ id: A.VLINE }])).id); },
    () => { const cells = []; A.FLOWS.forEach(f => A.COLS.forEach(c => { const a = (A.curGrid()[f] || {})[c]; if (a) A.SCOPES.forEach(s => { if (a[s]) cells.push([f, c, s]); }); })); if (cells.length){ const x = pick(cells); (rnd() < 0.6 && A.ruleMode === 'flow') ? A.cycleScope(...x) : A.removeAssign(...x); } },
    () => A.setRuleMode(pick(['flow', 'vline'])),
    () => A.setCurCig(A.cigs.length && rnd() < 0.7 ? pick(A.cigs).id : ''),
    () => A.addCig(),
    () => { if (A.cigs.length) A.delCig(pick(A.cigs)); },
    () => A.vAddRoot(),
    () => { const ids = [...A.vnodes.keys()]; if (ids.length) A.vAdd(pick(ids)); },
    () => { const ids = [...A.vnodes.keys()]; if (ids.length) A.vAddSib(pick(ids)); },
    () => { const ids = [...A.vnodes.keys()]; if (ids.length) A.vMove(pick(ids), pick([-1, 1])); },
    () => { const ids = [...A.vnodes.keys()]; if (ids.length) A.vDel(pick(ids)); },
    () => { const ids = [...A.vnodes.keys()], stars = A.starredNodes().filter(n => ![...A.vnodes.values()].some(v => v.orgId === n.id)); if (!ids.length || !stars.length) return; A.vsel = pick(ids); A.$ = (id) => id === 'vImportPick' ? { value: pick(stars).id } : A.stubEl(); A.vImport(); A.$ = A.stubEl; },
    () => A.importGrpPaste(A.q('FCG' + Math.floor(rnd() * 5)) + '\t' + A.q(word()) + '\t' + A.q(A.starredNodes().length ? pick(A.starredNodes()).person : 'Nobody')),
    () => A.importPaste(A.q('F' + Math.floor(rnd() * 50)) + '\t' + A.q(word()) + '\t' + A.q(A.fcGroups.length ? pick(A.fcGroups).name : 'Fresh')),
    () => A.docSet('header', () => { A.doc.header = word(); }),
    () => A.mutate(null, () => { A.doc.notes.push({ key: pick(['A', 'B']), text: word() }); }),
    () => A.undo()
  ];
  const undoIdx = ops.length - 1;
  let bad = '', i = 0;
  for (; i < steps && !bad; i++){
    const opIdx = Math.floor(rnd() * ops.length), before = stable(A.serializeAll()), topBefore = A.undoStack[A.undoStack.length - 1];
    try { ops[opIdx](); } catch (e) { bad = 'step ' + i + ' op ' + opIdx + ' threw: ' + e.message; break; }
    const inv = A.checkInvariants();
    if (inv.length){ bad = 'step ' + i + ' op ' + opIdx + ' broke invariants: ' + inv.join(', '); break; }
    const pushed = A.undoStack[A.undoStack.length - 1] !== topBefore;
    if (opIdx !== undoIdx && pushed){
      const afterRaw = JSON.stringify(A.serializeAll()), afterStable = stable(A.serializeAll()), keyAfter = A.lastSnapKey, view = { curCig: A.curCig, vsel: A.vsel, sel: A.sel };
      const popped = A.undoStack[A.undoStack.length - 1];
      A.undo();
      if (stable(A.serializeAll()) !== before){ bad = 'step ' + i + ' op ' + opIdx + ' undo did not restore the previous state'; break; }
      A.applyState(JSON.parse(afterRaw)); A.undoStack.push(popped); A.lastSnapKey = keyAfter; A.dirty = true;
      A.curCig = view.curCig; A.vsel = view.vsel; A.sel = view.sel;
      if (stable(A.serializeAll()) !== afterStable){ bad = 'step ' + i + ' could not restore the post-op state'; break; }
    }
    if (i % 25 === 0){
      const s1 = stable(A.serializeAll()), view = { curCig: A.curCig, vsel: A.vsel, sel: A.sel };
      A.applyState(clone(A.serializeAll())); A.curCig = view.curCig; A.vsel = view.vsel; A.sel = view.sel;
      if (stable(A.serializeAll()) !== s1){ bad = 'step ' + i + ' serialize/apply not idempotent'; break; }
    }
  }
  const noisy = A.toasts.filter(s => /undefined|NaN|\[object/.test(s));
  return { seed, bad, steps: i, noisy, size: A.nodes.size + 'n/' + A.fcs.length + 'fc/' + A.roleBoxes.length + 'r/' + A.vnodes.size + 'v/' + A.undoStack.length + 'undo' };
}
const t0 = Date.now();
const runs = [2026, 7, 42, 99, 123].map(seed => fuzz(seed, 2000));
const failed = runs.filter(r => r.bad || r.noisy.length);
check('FUZZ 5 seeds × 2,000 random operations: invariants hold, undo restores exactly (also with a full undo stack), serialize/apply idempotent, no malformed toast',
  failed.length === 0, failed.map(r => r.seed + ': ' + (r.bad || r.noisy.slice(0, 2).join(' | '))).join(' || ') || (runs.map(r => r.seed + ' ' + r.size).join('; ') + ' in ' + (Date.now() - t0) + ' ms'));
finish(R);
