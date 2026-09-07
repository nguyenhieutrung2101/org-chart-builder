import { openApp, finish } from './_browser.mjs';
const { page, errors, close } = await openApp();
const R = []; const check = (n, ok, x) => R.push((ok ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  → ' + x : ''));
const ev = (fn, ...a) => page.evaluate(fn, ...a);

// ---- #2 unload guard ----
const u = await ev(() => {
  const fresh = window.onbeforeunload();
  showTab('flow'); addFc();                       // dirty=true, nodes.size=0
  const fcOnly = window.onbeforeunload();
  dirty = false; const clean = window.onbeforeunload();
  return { fresh, fcOnly, clean, nodes: nodes.size };
});
check('#2 fresh page: no warning', u.fresh === null, String(u.fresh));
check('#2 dirty with FCs but zero org nodes: warns', u.fcOnly === true && u.nodes === 0, JSON.stringify(u));
check('#2 after save (dirty=false): no warning', u.clean === null);

// ---- #4 q() ----
const qq = await ev(() => ['=HYPERLINK("x")', '+84 912', '-abc', '@x', ' =1', 'abc', 'a\tb', 'x"y', '—', 'Tên (2)', 12, null].map(v => q(v)));
check('#4 q() prefixes = + - @ (also after spaces), leaves others', JSON.stringify(qq) === JSON.stringify(["\"'=HYPERLINK(\"\"x\"\")\"", "'+84 912", "'-abc", "'@x", "' =1", "abc", "\"a\tb\"", "\"x\"\"y\"", "—", "Tên (2)", "12", ""]), JSON.stringify(qq));
const tsvOut = await ev(() => {
  addRoot(); const a = rootIds[0]; nodes.get(a).dept = '=CMD()'; nodes.get(a).person = 'Anna'; nodes.get(a).star = true;
  fcGroups.length = 0; fcs.length = 0;
  fcGroups.push({ id: 'g' + (gseq++), code: '=1+1', name: 'G', cbqlns: a, byCig: false });
  fcs.push({ id: 'f' + (fseq++), code: '-FC', name: 'N', groupId: fcGroups[0].id });
  renderAll(); showTab('flow');
  const flow = flowTsv(); flowViewByFc = true; const flowFc = flowTsv(); flowViewByFc = false; return { hier: tsv(), flow, flowFc };
});
check('#4 hierarchy TSV neutralised', tsvOut.hier.indexOf("'=CMD()") >= 0 && tsvOut.hier.indexOf("\t=CMD") < 0, tsvOut.hier.split('\n')[1]);
check('#4 flow TSV neutralised', tsvOut.flow.indexOf("\"'=1+1") >= 0 && tsvOut.flowFc.indexOf("\"'-FC") >= 0, tsvOut.flow.split('\n')[1].slice(0, 60));

// ---- #3 compact dropdown behaviour ----
const d = await ev(() => {
  const a = rootIds[0];
  fcGroups.length = 0; fcs.length = 0; gseq = 1; fseq = 1;
  for (let i = 0; i < 30; i++) fcGroups.push({ id: 'g' + (gseq++), code: 'FCG' + i, name: 'Nhóm ' + i, cbqlns: a, byCig: false });
  for (let i = 0; i < 200; i++) fcs.push({ id: 'f' + (fseq++), code: 'FC' + i, name: 'Fund ' + i, groupId: i % 7 === 0 ? null : fcGroups[i % 30].id });
  renderFlow();
  const out = {};
  out.optionsCompact = document.querySelectorAll('#fcTbody option').length;   // 200 rows: 171 with group (2 options) + 29 without (1)
  const sel = document.querySelector('#fcTbody tr[data-fcid="f2"] select');
  sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));           // mouse path
  out.afterMousedown = sel.options.length; out.valueKept = sel.value;
  sel.focus();                                                                  // keyboard path (idempotent)
  out.afterFocus = sel.options.length;
  sel.value = 'g5'; sel.dispatchEvent(new Event('change'));
  out.groupIdAfterChange = fcs[1].groupId; out.countG5 = document.getElementById('gcnt_g5').textContent;
  sel.blur();
  out.afterBlur = sel.options.length; out.blurValue = sel.value; out.blurLabel = sel.options[1].textContent;
  // addGroup must not touch existing dropdowns, but the new group must be selectable on focus
  addGroup(); const newG = fcGroups[fcGroups.length - 1]; newG.code = 'FCGNEW'; newG.name = 'Mới';
  out.optionsAfterAdd = document.querySelectorAll('#fcTbody option').length;
  sel.focus(); out.hasNew = !!sel.querySelector('option[value="' + newG.id + '"]'); out.fullCount = sel.options.length; sel.blur();
  // rename group -> compact selects showing it get the new label
  fcGroups[4].name = 'Đổi tên'; patchGroupOptionLabels(fcGroups[4]);
  out.renamed = sel.options[1].textContent;
  // delete the group f2 belongs to -> its select falls back to "no group"
  delGroup(fcGroups[4], null);
  out.afterDel = { gid: fcs[1].groupId, opts: sel.options.length, val: sel.value, groups: fcGroups.length };
  // filters
  document.getElementById('fcFilter').value = 'nhóm 3'; applyFcFilter();
  out.visibleByGroupName = [...document.querySelectorAll('#fcTbody tr')].filter(tr => tr.style.display !== 'none').length;
  document.getElementById('fcFilter').value = ''; applyFcFilter();
  document.getElementById('grpFilter').value = 'FCG1'; applyGrpFilter();
  out.visibleGroups = [...document.querySelectorAll('#grpTbody tr[data-gid]')].filter(tr => tr.style.display !== 'none').length;
  document.getElementById('grpFilter').value = ''; applyGrpFilter();
  // flowBlocks equivalence: group view codes + FC view group labels
  const gv = flowBlocks(); flowViewByFc = true; const fv = flowBlocks(); flowViewByFc = false;
  out.groupViewFcLine = gv.find(b => b.head.startsWith('FCG3 ')).head.split('\n').pop();
  out.fcViewGroupLine = fv.find(b => b.head.startsWith('FC3\n')).head.split('\n')[2];
  out.fcViewNoGroup = fv.find(b => b.head.startsWith('FC0\n')).head.split('\n')[2]; out.noGroupLabel = t('optNoGroup');
  return out;
});
check('#3 compact: ~2 options per row instead of 31', d.optionsCompact === 171 * 2 + 29, String(d.optionsCompact));
check('#3 mousedown expands to all groups, value kept', d.afterMousedown === 31 && d.valueKept === 'g2', JSON.stringify([d.afterMousedown, d.valueKept]));
check('#3 focus after mousedown is idempotent', d.afterFocus === 31);
check('#3 change updates FC + group count', d.groupIdAfterChange === 'g5' && d.countG5.startsWith('7 FC'), JSON.stringify([d.groupIdAfterChange, d.countG5]));
check('#3 blur compacts to the new group', d.afterBlur === 2 && d.blurValue === 'g5' && d.blurLabel.indexOf('FCG4') === 0, JSON.stringify([d.afterBlur, d.blurValue, d.blurLabel]));
check('#3 addGroup no longer injects into every dropdown', d.optionsAfterAdd === d.optionsCompact, String(d.optionsAfterAdd));
check('#3 new group selectable on focus', d.hasNew && d.fullCount === 32, JSON.stringify([d.hasNew, d.fullCount]));
check('#3 rename patches compact label', d.renamed.indexOf('Đổi tên') >= 0, d.renamed);
check('#3 delGroup detaches FC and resets its dropdown', d.afterDel.gid === null && d.afterDel.opts === 1 && d.afterDel.val === '' && d.afterDel.groups === 30, JSON.stringify(d.afterDel));
check('#3 FC filter by group name still works', d.visibleByGroupName > 0, String(d.visibleByGroupName));
check('#3 group filter still works', d.visibleGroups === 12, String(d.visibleGroups));   // FCG1, FCG10..FCG19, FCGNEW
check('#3 flowBlocks group view lists FC codes', /^FC: FC3, FC33, FC93/.test(d.groupViewFcLine), d.groupViewFcLine);
check('#3 flowBlocks FC view resolves group + no-group', d.fcViewGroupLine.indexOf('FCG3') >= 0 && d.fcViewNoGroup === d.noGroupLabel, d.fcViewGroupLine + ' | ' + d.fcViewNoGroup);
check('no page/console errors', errors.length === 0, errors.join(' | '));
await close();
finish(R);
