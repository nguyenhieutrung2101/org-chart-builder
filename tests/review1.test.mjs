import { openApp, finish } from './_browser.mjs';
const { page, errors, close } = await openApp();
const R = [];
const check = (name, ok, extra) => R.push((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  → ' + extra : ''));
const ev = (fn, ...a) => page.evaluate(fn, ...a);

// ---------- seed: 2 starred boxes + 1 group ----------
await ev(() => {
  addRoot(); const a = rootIds[0]; nodes.get(a).dept = 'HQ'; nodes.get(a).person = 'Anna Lee'; nodes.get(a).star = true;
  addChild(a); const b = nodes.get(a).children[0]; nodes.get(b).dept = 'OPS'; nodes.get(b).person = 'John Smith'; nodes.get(b).star = true;
  fcGroups.push({ id: 'g' + (gseq++), code: 'FCG01', name: 'Nhóm 1', cbqlns: a, byCig: false });
  renderAll();
});

// ---------- #1 header row round-trip (vi + en + real FCG03 code) ----------
const h1 = await ev(() => {
  const before = fcGroups.length;
  const tsvVi = [t('thFcgCode'), t('thGrpName'), t('thCbqlns')].join('\t') + '\nFCG01\tNhóm một\tJohn Smith\nFCG03\tNhóm ba\tAnna Lee';
  importGrpPaste(tsvVi);
  const afterVi = fcGroups.map(g => g.code);
  setLang('en');
  const tsvEn = [t('thFcgCode'), t('thGrpName'), t('thCbqlns')].join('\t') + '\nFCG04\tGroup four\t';
  importGrpPaste(tsvEn);
  const afterEn = fcGroups.map(g => g.code);
  const fcBefore = fcs.length;
  importPaste([t('thFcCode'), t('thFcName'), t('thFcGroup')].join('\t') + '\nFC001\tFund one\tNhóm 1');
  setLang('vi');
  importPaste([t('thFcCode'), t('thFcName'), t('thFcGroup')].join('\t') + '\nFC002\tFund two\tNhóm 1');
  return { before, afterVi, afterEn, fcCodes: fcs.map(f => f.code), fcBefore,
           g1: fcGroups.find(g => g.code === 'FCG01'), john: rootIds.length && nodes.get(nodes.get(rootIds[0]).children[0]).id,
           probes: ['Mã FCG', 'FCG code', 'Mã', 'Code', 'FCG', 'FC', 'ma', 'FCG03', 'FC001', 'MAX01', 'code01'].map(p => p + '=' + isHeaderRow(p + '\tx')) };
});
check('#1 vi header "Mã FCG" skipped, FCG01 updated, FCG03 kept', JSON.stringify(h1.afterVi) === JSON.stringify(['FCG01', 'FCG03']), JSON.stringify(h1.afterVi));
check('#1 FCG01 BMO updated to John via paste', h1.g1 && h1.g1.cbqlns === h1.john && h1.g1.name === 'Nhóm một', JSON.stringify(h1.g1));
check('#1 en header "FCG code" skipped', JSON.stringify(h1.afterEn) === JSON.stringify(['FCG01', 'FCG03', 'FCG04']), JSON.stringify(h1.afterEn));
check('#1 FC headers vi+en skipped', JSON.stringify(h1.fcCodes) === JSON.stringify(['FC001', 'FC002']), JSON.stringify(h1.fcCodes));
check('#1 isHeaderRow probes', h1.probes.join(' ') === 'Mã FCG=true FCG code=true Mã=true Code=true FCG=true FC=true ma=true FCG03=false FC001=false MAX01=false code01=false', h1.probes.join(' '));

// ---------- #2 empty cigs survives save/reload; legacy file w/o cigs gets defaults ----------
const c2 = await ev(() => {
  cigs = []; renderRules();
  const saved = JSON.parse(JSON.stringify(serializeAll()));
  applyState(saved); renderAll();
  const afterEmpty = cigs.length;
  const legacy = JSON.parse(JSON.stringify(serializeAll())); delete legacy.cigs;
  applyState(legacy); renderAll();
  const afterLegacy = cigs.map(c => c.code);
  return { v: saved.v, afterEmpty, afterLegacy, toggleBtns: document.querySelectorAll('#cigToggle button, .scenBtn').length };
});
check('#2 cigs:[] stays empty after reload', c2.afterEmpty === 0, String(c2.afterEmpty));
check('#2 legacy file without cigs gets 3 defaults', JSON.stringify(c2.afterLegacy) === JSON.stringify(['CI-SM', 'CI-TE', 'CI-OP']), JSON.stringify(c2.afterLegacy));
check('#8 serializeAll writes v:SCHEMA_V (11)', c2.v === 11, String(c2.v));

// ---------- #3 CIG delete clears both families; scenOwn note reads current family ----------
const c3 = await ev(() => {
  setRuleMode('vline'); setCurCig('c1');          // clones Common into vlineGrids.c1
  const cloned = !!vlineGrids.c1 && !ruleGrids.c1;
  const note = (document.querySelector('#scenNote') || document.querySelector('.scenNote') || { textContent: '' }).textContent;
  const noteAll = document.body.innerText;
  const noteOk = note === tf('scenOwn', { code: 'CI-SM' });
  setRuleMode('flow'); setCurCig('c1');           // clone into ruleGrids.c1 too
  const both = !!vlineGrids.c1 && !!ruleGrids.c1;
  const row = [...document.querySelectorAll('input')].find(i => i.value === 'CI-SM').closest('tr');
  row.querySelector('button.danger').click();
  return { cloned, noteOk, both, r: 'c1' in ruleGrids, v: 'c1' in vlineGrids, left: cigs.map(c => c.code) };
});
check('#3 vline-mode clone lands only in vlineGrids', c3.cloned);
check('#3 scenOwn note shown in vline mode (reads gridFamily())', c3.noteOk);
check('#3 delete CIG removes ruleGrids AND vlineGrids entries', c3.both && !c3.r && !c3.v && c3.left.length === 2, JSON.stringify(c3));

// ---------- #4 deleting a chart node prunes its role boxes + cells, with toast; undo restores ----------
const c4 = await ev(() => {
  setRuleMode('flow'); setCurCig('');
  const a = rootIds[0]; const b = nodes.get(a).children[0];
  const rid = 'r' + (rseq++); roleBoxes.push({ id: rid, kind: 'node', nodeId: b, pdBelow: false });
  dropRole('Vàng', 'TĐ2', rid); dropRole('Đỏ', 'TĐ3', rid);
  const usedBefore = usageCount(rid);
  delNode(b);
  const toast = document.getElementById('msg').textContent;
  const gone = !roleBoxes.some(r => r.id === rid) && usageCount(rid) === 0;
  undo();
  const back = roleBoxes.some(r => r.id === rid) && usageCount(rid) === 2 && nodes.has(b);
  return { usedBefore, toast, gone, back, expected: tf('msgRolesPruned', { n: 1, c: 2 }) };
});
check('#4 role box + 2 cells pruned on node delete', c4.usedBefore === 2 && c4.gone, JSON.stringify(c4));
check('#4 toast reports 1 box / 2 cells', c4.toast === c4.expected, c4.toast);
check('#4 undo restores box, cells and node', c4.back);

// ---------- #5 execCommand returning false → blocked toast, not "copied" ----------
const c5 = await ev(() => {
  const oc = navigator.clipboard; Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  const oe = document.execCommand; document.execCommand = () => false;
  copyText('x', 'COPIED-OK');
  const toast = document.getElementById('msg').textContent;
  document.execCommand = oe; Object.defineProperty(navigator, 'clipboard', { value: oc, configurable: true });
  return { toast, expected: t('msgCopyBlocked') };
});
check('#5 execCommand=false shows blocked toast', c5.toast === c5.expected, c5.toast);

// ---------- #6 Ctrl+Z inside paste textarea does not trigger app undo ----------
await ev(() => showTab('flow'));
await page.click('#bPasteGrp');
await page.focus('#pasteTaGrp');
await page.keyboard.type('abc');
const before6 = await ev(() => ({ n: nodes.size, u: undoStack.length }));
await page.keyboard.press('Control+z');
const after6 = await ev(() => ({ n: nodes.size, u: undoStack.length, ta: document.getElementById('pasteTaGrp').value }));
check('#6 Ctrl+Z in textarea leaves app state alone', before6.n === after6.n && before6.u === after6.u, JSON.stringify({ before6, after6 }));
await ev(() => document.activeElement.blur());
await page.click('body');
await ev(() => { addRoot(); });
const before6b = await ev(() => nodes.size);
await page.keyboard.press('Control+z');
const after6b = await ev(() => nodes.size);
check('#6 Ctrl+Z outside textarea still undoes', after6b === before6b - 1, before6b + '→' + after6b);

// ---------- #7 drag flicker guard ----------
const c7 = await ev(() => {
  setRuleMode('flow'); renderRules();
  const chip = document.querySelector('#ruleTbl td.slot .chip') || document.querySelector('#ruleTbl td.slot > *');
  const card = document.querySelector('.roleCard [draggable="true"], .roleCard');
  const pe0 = getComputedStyle(chip).pointerEvents;
  document.body.classList.add('rdrag'); const pe1 = getComputedStyle(chip).pointerEvents; document.body.classList.remove('rdrag');
  let viaEvents = null;
  const drag = document.querySelector('.roleCard [draggable="true"]');
  if (drag && drag.ondragstart){ drag.ondragstart({ dataTransfer: { setData(){ } } }); const on = document.body.classList.contains('rdrag'); drag.ondragend(); viaEvents = on && !document.body.classList.contains('rdrag'); }
  return { pe0, pe1, viaEvents };
});
check('#7 slot children ignore pointer only while dragging', c7.pe0 === 'auto' && c7.pe1 === 'none', JSON.stringify(c7));
check('#7 palette dragstart/dragend toggle body.rdrag', c7.viaEvents === true, String(c7.viaEvents));

// ---------- #8 newer-file warning via loadJSON ----------
const c8 = await page.evaluate(async () => {
  const mk = (o) => new File([JSON.stringify(o)], 'x.json', { type: 'application/json' });
  loadJSON(mk({ v: 12, roots: [] })); await new Promise(r => setTimeout(r, 100));
  const t11 = document.getElementById('msg').textContent;
  loadJSON(mk({ v: 11, roots: [] })); await new Promise(r => setTimeout(r, 100));
  const t10 = document.getElementById('msg').textContent;
  return { t11, t10, exp11: tf('msgNewerFile', { v: 12, s: 11 }), exp10: t('msgOpened') };
});
check('#8 v:12 file warns', c8.t11 === c8.exp11, c8.t11);
check('#8 v:11 file opens normally', c8.t10 === c8.exp10, c8.t10);

// ---------- misc ----------
const misc = await ev(() => ({
  keys: Object.keys(STR.vi).filter(k => !(k in STR.en)).concat(Object.keys(STR.en).filter(k => !(k in STR.vi))),
  rnum: rnum('T2'), lvl: (addRoot(), nodes.get(rootIds[rootIds.length - 1]).t),
}));
check('vi/en key sets identical', misc.keys.length === 0, misc.keys.join(','));
check('rnum/nn still work after param rename', misc.rnum === 3 && misc.lvl === 'CC', JSON.stringify(misc));
check('no page/console errors', errors.length === 0, errors.join(' | '));

await close();
finish(R);
