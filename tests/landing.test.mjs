// Landing mới (popup giới thiệu / Có gì mới / Về dự án, chọn module) + animation core app (toast, tab, box, chip, bảng kết quả, minimap, PDF)
import { openApp, finish } from './_browser.mjs';
const { page, errors, close, url } = await openApp({ hash: '' });          // vào landing, localStorage trống
const R = []; const check = (n, ok, x) => R.push((ok ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  → ' + x : ''));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const vis = (s) => ev((s) => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display !== 'none'; }, s);

// ---- lần đầu: English, không header, popup giới thiệu tự mở, focus nằm trên hộp ----
check('default language is English; header hidden on landing; corner visible', (await ev(() => LANG)) === 'en' && !(await vis('header')) && (await vis('#landingCorner')));
await page.waitForSelector('#overlay.open');
const intro = await ev(() => ({ body: document.body.classList.contains('intro'), inert: document.getElementById('landingSplit').inert && document.getElementById('landingCorner').inert,
                                 active: document.activeElement.className, mode: !document.getElementById('overlay').classList.contains('logonly') && !document.getElementById('overlay').classList.contains('aboutonly') }));
check('intro popup auto-opens once per version: blur+inert behind, focus on the box, intro mode', intro.body && intro.inert && intro.active === 'modal' && intro.mode, JSON.stringify(intro));
await page.keyboard.press('Tab');
check('Tab reaches "Choose a module" with the blue focus ring (no Chrome white ring)', await ev(() => document.activeElement.id === 'go' && getComputedStyle(document.activeElement).outlineColor === 'rgb(107, 143, 232)'));
await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Enter');
await page.waitForSelector('#overlay:not(.open)');
check('Enter closes it, marks version seen, halves slide in', (await ev(() => localStorage.getItem('ob_seen'))) === String(await ev(() => APP_VER)) && (await ev(() => document.getElementById('landingSplit').classList.contains('entering') && !document.body.classList.contains('intro'))));
check('version label comes from APP_VER in header and corner', (await ev(() => document.getElementById('ver').textContent + '|' + document.getElementById('verCorner').textContent)) === 'version ' + (await ev(() => APP_VER)) + '|version ' + (await ev(() => APP_VER)));

// ---- corner: ngôn ngữ, Có gì mới, Về dự án ----
await page.click('#bLangLanding');
check('corner language button switches the whole app (VI)', (await page.textContent('#bModDoc h2')) === 'Trình bày sơ đồ' && (await page.textContent('#bLang')) === 'English' && (await ev(() => document.documentElement.lang)) === 'vi');
await page.click('#openLog'); await page.waitForSelector('#overlay.open');
check('What\'s new opens in log-only mode with a "mới" badge on v11', await ev(() => document.getElementById('overlay').classList.contains('logonly') && getComputedStyle(document.querySelector('.entry.new .ver'), '::after').content === '"mới"'));
await page.keyboard.press('Escape'); await page.waitForSelector('#overlay:not(.open)');
await page.click('#openAbout'); await page.waitForSelector('#overlay.open');
check('About opens in about-only mode', await ev(() => document.getElementById('overlay').classList.contains('aboutonly') && getComputedStyle(document.querySelector('.about')).display === 'flex'));
await page.click('#overlay', { position: { x: 5, y: 5 } }); await page.waitForSelector('#overlay:not(.open)');
check('click outside closes', await ev(() => !document.body.classList.contains('intro')));
await ev(() => setLang('en'));

// ---- reload: đã xem -> không tự mở nữa ----
await page.goto(url + 'index.html'); await page.waitForTimeout(500);
check('seen version: popup does not auto-open again; halves slide in instead', !(await ev(() => document.getElementById('overlay').classList.contains('open'))) && (await ev(() => document.getElementById('landingSplit').classList.contains('entering'))));

// ---- chọn module: nửa nở ra rồi chuyển; tab hiện lên với animation; header quay lại ----
await page.click('#bModFlow');
check('chosen half expands first', await ev(() => document.getElementById('landingSplit').classList.contains('choosing') && document.getElementById('bModFlow').classList.contains('chosen') && MOD === 'landing'));
await page.waitForSelector('#tabOrg', { state: 'visible' });
check('then flow module opens with header, hash #flow, tab carries the rise animation', (await ev(() => MOD)) === 'flow' && (await vis('header')) && (await ev(() => location.hash)) === '#flow' && (await ev(() => getComputedStyle(document.getElementById('tabOrg')).animationName)) === 'rise');
check('active tab button looks pressed (translate 2px, no shadow)', await ev(() => { const cs = getComputedStyle(document.getElementById('tabBtnOrg')); return cs.transform === 'matrix(1, 0, 0, 1, 2, 2)' && cs.boxShadow === 'none'; }));
check('switching tab restarts the rise animation on the new tab', await ev(() => { showTab('rules'); return document.getElementById('tabRules').getAnimations().length > 0 && getComputedStyle(document.getElementById('tabRules')).display !== 'none'; }));
await page.click('#bHome');
check('⌂ back to landing: header hidden, choosing state cleared, halves slide in', !(await vis('header')) && (await ev(() => !document.getElementById('landingSplit').classList.contains('choosing') && !document.querySelector('.half.chosen') && document.getElementById('landingSplit').classList.contains('entering'))));
await ev(() => showModule('flow')); await ev(() => showTab('org'));

// ---- toast ----
await ev(() => msg('hello toast'));
check('toast pill slides up with the text', await ev(() => document.getElementById('msg').classList.contains('show') && document.getElementById('msg').textContent === 'hello toast' && getComputedStyle(document.getElementById('msg')).position === 'fixed'));
await page.waitForTimeout(3700);
check('toast hides after 3.5 s', !(await ev(() => document.getElementById('msg').classList.contains('show'))));

// ---- box: pop khi thêm, nháy khi chọn, mờ dần khi xoá ----
await ev(() => addRoot());
check('new box pops in', await ev(() => document.querySelector('#canvas .node').classList.contains('pop')));
const flash = await ev(() => { const a = rootIds[0]; addChild(a); const c = nodes.get(a).children[0]; select(a); const el = document.querySelector('#canvas .node[data-id="' + a + '"]'); return { flash: el.classList.contains('flash'), childPop: document.querySelector('#canvas .node[data-id="' + c + '"]').classList.contains('pop'), animNext: animNext }; });
check('selecting an existing box flashes it; animNext consumed (no re-flash on later re-render)', flash.flash && flash.childPop && flash.animNext === null, JSON.stringify(flash));
const gone = await ev(() => { const a = rootIds[0], c = nodes.get(a).children[0]; select(c); delNode(c); return { ghost: document.querySelectorAll('#canvas .node.gone').length, live: document.querySelectorAll('#canvas .node:not(.gone)').length }; });
await page.waitForTimeout(350);
check('deleted box leaves a fading ghost that is removed afterwards', gone.ghost === 1 && gone.live === 1 && (await ev(() => document.querySelectorAll('#canvas .node.gone').length)) === 0, JSON.stringify(gone));
check('minimap viewport box eases (transition on left/top)', await ev(() => /left/.test(getComputedStyle(document.getElementById('miniView')).transitionProperty)));

// ---- chip: đáp khi thả, lật nhãn khi xoay phạm vi; ô ma trận pulse khi rê qua ----
const chip = await ev(() => {
  showTab('rules');                                          // tab ẩn không được vẽ: mở tab trước khi kiểm tra DOM của nó
  addFreeRole(); const rid = roleBoxes[roleBoxes.length - 1].id;
  dropRole('Xanh', 'TĐ1', rid);
  const land = document.querySelector('#ruleTbl .chip[data-rid="' + rid + '"]').classList.contains('land');
  cycleScope('Xanh', 'TĐ1', 'ALL');
  const flip = document.querySelector('#ruleTbl .chip[data-rid="' + rid + '"]').classList.contains('flip');
  renderRules();
  const again = document.querySelector('#ruleTbl .chip[data-rid="' + rid + '"]').className;
  const slot = document.querySelector('#ruleTbl td.slot'); slot.classList.add('over'); const pulse = getComputedStyle(slot).animationName; slot.classList.remove('over');
  return { land, flip, again, pulse };
});
check('dropped chip lands, cycled scope flips, plain re-render stays still; hovered slot pulses', chip.land && chip.flip && chip.again === 'chip' && chip.pulse === 'slotPulse', JSON.stringify(chip));

// ---- bảng luồng duyệt: dòng nổi so le khi tab vừa mở (tab cũ) hoặc đổi cách xem; render lại trong tab (như lúc gõ) thì không ----
const rows = await ev(() => {
  for (let i = 0; i < 8; i++){ addGroup(); fcGroups[fcGroups.length - 1].code = 'G' + i; }
  showTab('rules'); addFreeRole();                            // thao tác ở tab khác -> tab Luồng duyệt thành cũ
  const staleBefore = staleTabs.flow;
  showTab('flow');                                            // mở tab cũ -> vẽ lại với hiệu ứng nổi so le
  const revealed = document.querySelectorAll('#flowResult tr.rise').length;
  const delay = document.querySelectorAll('#flowResult tr.rise')[3].style.animationDelay;
  renderFlowResult();                                         // render lại khi đang xem (như lúc gõ) -> không nổi lại
  const visible = document.querySelectorAll('#flowResult tr.rise').length;
  renderFlowResult(true);                                     // đổi cách xem -> nổi so le
  const forced = document.querySelectorAll('#flowResult tr.rise').length;
  return { staleBefore, revealed, delay, visible, forced, total: document.querySelectorAll('#flowResult tr[data-blk]').length };
});
check('result rows stagger (max 30, 20 ms apart) only when the table is (re)revealed', rows.staleBefore && rows.revealed === 30 && rows.delay === '60ms' && rows.visible === 0 && rows.forced === 30 && rows.total === 40, JSON.stringify(rows));

// ---- module Trình bày: pop / nháy trên SVG, đường kẻ hàng hiện dần một lần, nút PDF bận ----
await ev(() => showModule('doc'));
const dpop = await ev(() => { addRoot(); const id = sel; const pop = document.querySelector('#docPage .dbox[data-id="' + id + '"]').classList.contains('pop'); select(rootIds[0]); const fl = document.querySelector('#docPage .dbox[data-id="' + rootIds[0] + '"]').classList.contains('flash'); renderDoc(); const still = document.querySelector('#docPage .dbox[data-id="' + rootIds[0] + '"]').className.baseVal; return { pop, fl, still }; });
check('doc module: new box pops, selected box flashes, plain re-render stays still', dpop.pop && dpop.fl && dpop.still === 'dbox sel', JSON.stringify(dpop));
const drows = await ev(() => { docRowDrag = { id: rootIds[0] }; renderDoc(); const first = document.querySelector('#docPage .drows').classList.contains('in') && document.querySelector('#docPage .dbox.drag') !== null; renderDoc(); const second = document.querySelector('#docPage .drows').classList.contains('in'); docRowDrag = null; renderDoc(); return { first, second, cleared: !document.querySelector('#docPage .drows') }; });
check('row guides fade in on the first frame of a drag only; dragged box is lifted', drows.first && !drows.second && drows.cleared, JSON.stringify(drows));
const busy = await ev(async () => { const p = docPdf(); const b = document.getElementById('bPdf'); const during = b.disabled && b.classList.contains('busy'); await p; return { during, after: b.disabled || b.classList.contains('busy') }; });
check('PDF button shows busy dots while generating, then recovers', busy.during && !busy.after, JSON.stringify(busy));

check('no page/console errors', errors.length === 0, errors.join(' | '));
await close();
finish(R);
