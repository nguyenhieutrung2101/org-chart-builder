import { openApp, finish } from './_browser.mjs';
const { page, errors, close } = await openApp();

const results = [];
const check = (name, ok, extra) => results.push((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  → ' + extra : ''));

// 1. i18n static labels (vi)
let fcH = await page.textContent('#fcSec .cardH span[data-i18n="fcH"]');
let focusLbl = await page.textContent('#focusChip span[data-i18n="focusLbl"]');
check('vi: fcH', fcH === 'Fund Center', fcH);
check('vi: focusLbl', focusLbl === 'Focus:', focusLbl);

// 2. switch to EN
await page.click('#bLang');
fcH = await page.textContent('#fcSec .cardH span[data-i18n="fcH"]');
focusLbl = await page.textContent('#focusChip span[data-i18n="focusLbl"]');
check('en: fcH', fcH === 'Fund Centers', fcH);
check('en: focusLbl', focusLbl === 'Focus:', focusLbl);
const missing = await page.evaluate(() => Object.keys(STR.vi).filter(k => !(k in STR.en)).concat(Object.keys(STR.en).filter(k => !(k in STR.vi))));
check('vi/en key sets identical', missing.length === 0, missing.join(','));

// 3. focus chip still renders name next to label
await page.click('#bRoot');
await page.click('#bRoot');
await page.evaluate(() => { const id = rootIds[0]; nodes.get(id).dept = 'ALPHA'; select(id); addChild(id); setFocus(id); });
const chipTxt = await page.textContent('#focusChip');
check('focus chip shows label + name', /Focus:\s*ALPHA/.test(chipTxt), chipTxt.trim());
check('#focusName populated', (await page.textContent('#focusName')) === 'ALPHA');

// 4. copyText fallback path: clipboard + execCommand both fail → toast must show, no throw
const fallback = await page.evaluate(() => {
  const origClip = navigator.clipboard;
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  const origExec = document.execCommand;
  document.execCommand = () => { throw new Error('blocked'); };
  let threw = null;
  try { copyText('hello', 'ok!'); } catch (e) { threw = e.message; }
  const toast = document.getElementById('msg') ? document.getElementById('msg').textContent : document.body.innerText;
  document.execCommand = origExec;
  Object.defineProperty(navigator, 'clipboard', { value: origClip, configurable: true });
  return { threw, toast, expected: t('msgCopyBlocked') };
});
check('copyText double-fallback does not throw', fallback.threw === null, fallback.threw);
check('copyText double-fallback shows blocked toast', fallback.toast.includes(fallback.expected), JSON.stringify(fallback));

// 5. zoom still works without applyZoom
const z = await page.evaluate(async () => {
  animateZoomTo(1.4); await new Promise(r => setTimeout(r, 400)); const a = zoom;
  fitZoom(); const b = zoom;
  return { a, b, hasApplyZoom: typeof window.applyZoom };
});
check('animateZoomTo reaches target', Math.abs(z.a - 1.4) < 0.01, JSON.stringify(z));
check('applyZoom removed', z.hasApplyZoom === 'undefined');

// 6. no runtime errors
check('no page/console errors', errors.length === 0, errors.join(' | '));

await close();
finish(results);
