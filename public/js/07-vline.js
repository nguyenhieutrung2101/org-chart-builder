"use strict";
/* [7v] Tab Ngành dọc — Org Builder. Các file js/ dùng chung state global, nạp theo thứ tự trong index.html. */
/* ============ [7v] TAB NGÀNH DỌC — cây CBQLNS → cấp global ============ */
var VGY = 64;
function vlayout(){
  var pos = new Map(), x = PAD;
  function walk(id, depth){
    var n = vnodes.get(id);
    if (!n.children.length){
      pos.set(id, { x: x, y: PAD + depth*(BH+VGY) });
      x += BW + GX;
      return pos.get(id).x;
    }
    var xs = n.children.map(function(c){ return walk(c, depth+1); });
    var cx = (xs[0] + xs[xs.length-1]) / 2;
    pos.set(id, { x: cx, y: PAD + depth*(BH+VGY) });
    return cx;
  }
  vroots.forEach(function(r){ walk(r, 0); });
  return pos;
}
function renderVline(){
  var cv = $('vcanvas'), svg = $('vsvg');
  if (!cv) return;
  var pos = vlayout();
  var W = 300, H = 300;
  pos.forEach(function(p){ W = Math.max(W, p.x + BW + PAD); H = Math.max(H, p.y + BH + PAD); });
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  cv.querySelectorAll('.node').forEach(function(el){ el.remove(); });
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  var NS = 'http://www.w3.org/2000/svg';
  vnodes.forEach(function(n, id){
    n.children.forEach(function(c){
      var a = pos.get(id), b = pos.get(c);
      var x1 = a.x + BW/2, y1 = a.y + BH, x2 = b.x + BW/2, y2 = b.y, m = y1 + VGY/2;
      var p2 = document.createElementNS(NS, 'path');
      p2.setAttribute('d', 'M '+x1+' '+y1+' V '+m+' H '+x2+' V '+y2);
      p2.setAttribute('fill','none'); p2.setAttribute('stroke','#1F1B16'); p2.setAttribute('stroke-width','2');
      svg.appendChild(p2);
    });
  });
  vnodes.forEach(function(n, id){
    var pv = pos.get(id), dp = vdisp(n);
    var d = document.createElement('div');
    d.className = 'node' + (id === vsel ? ' sel' : '');
    d.dataset.id = id;
    d.style.left = pv.x + 'px'; d.style.top = pv.y + 'px';
    d.style.background = n.orgId ? 'var(--paper)' : 'var(--cyan)';   // global tự vẽ = cyan, import = trắng
    var any = false;
    if (dp.dept){  var e1=document.createElement('div'); e1.className='bd'; e1.textContent=dp.dept;  d.appendChild(e1); any=true; }
    if (dp.title){ var e2=document.createElement('div'); e2.className='bt'; e2.textContent=dp.title; d.appendChild(e2); any=true; }
    if (dp.person){var e3=document.createElement('div'); e3.className='bp'; e3.textContent=dp.person;d.appendChild(e3); any=true; }
    if (!any){    var e0=document.createElement('div'); e0.className='be'; e0.textContent = t('emptyBox'); d.appendChild(e0); }
    if (n.orgId){
      var tg = document.createElement('div'); tg.className = 'vorg';
      tg.textContent = dp.star ? '★ ' + t('cbqlns') : t('optStarRemoved').trim();
      tg.title = t('vorgTip');
      d.appendChild(tg);
    }
    d.onclick = function(e){ e.stopPropagation(); vselect(id); };
    cv.appendChild(d);
  });
  fillVImportPick();
}
// Chọn/bỏ chọn: vá class tại chỗ (tránh dựng lại canvas làm box dưới con trỏ bị "nảy")
function vselect(id){
  vsel = id;
  document.querySelectorAll('#vcanvas .node').forEach(function(el){
    el.classList.toggle('sel', el.dataset.id === vsel);
  });
  renderVPanel();
}
function renderVPanel(){
  var p = $('vpanel');
  if (!p) return;
  if (!vsel || !vnodes.has(vsel)){
    p.innerHTML = '<h2>' + t('vpanelH') + '</h2><div class="hint">' + t('vpanelEmptyHint') + '</div>';
    return;
  }
  var n = vnodes.get(vsel), dp = vdisp(n), imported = !!n.orgId;
  p.innerHTML =
      '<h2>' + t('vpanelH') + '</h2>'
    + '<label>' + t('lblDept') + '</label><input id="vfD"' + (imported ? ' disabled' : '') + '>'
    + '<label>' + t('lblTitle') + '</label><input id="vfC"' + (imported ? ' disabled' : '') + '>'
    + '<label>' + t('lblPerson') + '</label><input id="vfP"' + (imported ? ' disabled' : '') + '>'
    + (imported ? '<div class="hint" style="margin-top:8px">' + t('vImportedNote') + '</div>' : '')
    + '<div class="row"><button id="vbChild">' + t('btnChild') + '</button><button id="vbSib">' + t('btnSib') + '</button></div>'
    + '<div class="row"><button id="vbL">◀</button><button id="vbR">▶</button><button id="vbDel" class="danger">' + t('btnDel') + '</button></div>';
  var fD = $('vfD'); fD.value = dp.dept;
  var fC = $('vfC'); fC.value = dp.title;
  var fP = $('vfP'); fP.value = dp.person;
  if (!imported){
    fD.oninput = function(){
      snap('v:' + vsel + ':d');
      var s0 = fD.selectionStart, up = fD.value.toUpperCase();
      if (up !== fD.value){ fD.value = up; try{ fD.setSelectionRange(s0,s0); }catch(_){/**/} }
      n.dept = fD.value; patchVNodeText(n);
    };
    fC.oninput = function(){ snap('v:' + vsel + ':c'); n.title = fC.value; patchVNodeText(n); };
    fP.oninput = function(){ snap('v:' + vsel + ':p'); n.person = fP.value; patchVNodeText(n); };
  }
  $('vbChild').onclick = function(){ vAdd(vsel); };
  $('vbSib').onclick   = function(){ vAddSib(vsel); };
  $('vbL').onclick     = function(){ vMove(vsel, -1); };
  $('vbR').onclick     = function(){ vMove(vsel, +1); };
  $('vbDel').onclick   = function(){ vDel(vsel); };
}
// Gõ 3 trường -> vá chữ trong box đích danh (không đập canvas, giữ focus input)
function patchVNodeText(n){
  var el = document.querySelector('#vcanvas .node[data-id="' + n.id + '"]');
  if (!el) return;
  el.querySelectorAll('.bd,.bt,.bp,.be').forEach(function(x){ x.remove(); });
  var dp = vdisp(n), any = false;
  if (dp.dept){  var e1=document.createElement('div'); e1.className='bd'; e1.textContent=dp.dept;  el.appendChild(e1); any=true; }
  if (dp.title){ var e2=document.createElement('div'); e2.className='bt'; e2.textContent=dp.title; el.appendChild(e2); any=true; }
  if (dp.person){var e3=document.createElement('div'); e3.className='bp'; e3.textContent=dp.person;el.appendChild(e3); any=true; }
  if (!any){    var e0=document.createElement('div'); e0.className='be'; e0.textContent = t('emptyBox'); el.appendChild(e0); }
}
function vnn(dept, title, person, orgId, parent){
  var id = 'v' + (vseq++);
  vnodes.set(id, { id:id, dept:dept, title:title, person:person, orgId:orgId||null,
                   parent:parent||null, children:[] });
  return id;
}
function vAddRoot(){
  snap(null);
  var id = vnn('','','',null,null);
  vroots.push(id);
  renderVline(); vselect(id);
  var f = $('vfD'); if (f) f.focus();
}
function vAdd(pid){
  snap(null);
  var id = vnn('','','',null,pid);
  vnodes.get(pid).children.push(id);
  renderVline(); vselect(id);
  var f = $('vfD'); if (f) f.focus();
}
function vAddSib(id){
  var n = vnodes.get(id);
  snap(null);
  var nid = vnn('','','',null,n.parent);
  var arr = n.parent ? vnodes.get(n.parent).children : vroots;
  arr.splice(arr.indexOf(id) + 1, 0, nid);
  renderVline(); vselect(nid);
  var f = $('vfD'); if (f) f.focus();
}
function vMove(id, dir){
  var n = vnodes.get(id);
  var arr = n.parent ? vnodes.get(n.parent).children : vroots;
  var i = arr.indexOf(id), j = i + dir;
  if (j < 0 || j >= arr.length) return;
  snap(null);
  arr[i] = arr[j]; arr[j] = id;
  renderVline(); vselect(id);
}
function vSubCount(id){
  var c = 1; vnodes.get(id).children.forEach(function(x){ c += vSubCount(x); });
  return c;
}
function vDel(id){
  var n = vnodes.get(id);
  var nm = vdisp(n);
  if (n.children.length &&
      !confirm(tf('cfmDelNode', { name: nm.dept || nm.title || nm.person || t('emptyBox'),
                                  n: vSubCount(id)-1 }))) return;
  snap(null);
  (function rm(x){
    vnodes.get(x).children.forEach(rm);
    vnodes.delete(x);
  })(id);
  var arr = n.parent && vnodes.has(n.parent) ? vnodes.get(n.parent).children : vroots;
  var i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1);
  vsel = null;
  renderVline(); renderVPanel(); refreshFlowResultSoon();
}
// Import: chỉ box ★ CBQLNS chưa có mặt trên cây ngành dọc
function fillVImportPick(){
  var s = $('vImportPick'); if (!s) return;
  var cur = s.value; s.innerHTML = '';
  var o0 = document.createElement('option'); o0.value=''; o0.textContent = t('optPickStar');
  s.appendChild(o0);
  var used = new Set();
  vnodes.forEach(function(n){ if (n.orgId) used.add(n.orgId); });
  starredNodes().forEach(function(n){
    if (used.has(n.id)) return;
    var o = document.createElement('option');
    o.value = n.id;
    o.textContent = '★ ' + dispName(n) + (n.person ? ' — ' + n.person : '');
    s.appendChild(o);
  });
  if (cur && nodes.has(cur) && !used.has(cur)) s.value = cur;
}
function vImport(){
  var nid = $('vImportPick').value;
  if (!nid || !nodes.has(nid)){ msg(t('msgPickStar')); return; }
  if (!vsel || !vnodes.has(vsel)){ msg(t('msgPickVParent')); return; }
  snap(null);
  var id = vnn('','','', nid, vsel);
  vnodes.get(vsel).children.push(id);
  renderVline(); vselect(id); refreshFlowResultSoon();
}
// Box SĐTC bị xóa -> gỡ node import mồ côi (con của nó nối lên cha)
function pruneVlineOrphans(){
  var orphans = [];
  vnodes.forEach(function(n){ if (n.orgId && !nodes.has(n.orgId)) orphans.push(n); });
  orphans.forEach(function(n){
    if (!vnodes.has(n.id)) return;
    var arr = n.parent && vnodes.has(n.parent) ? vnodes.get(n.parent).children : vroots;
    var i = arr.indexOf(n.id);
    var kids = n.children.slice();
    kids.forEach(function(c){ vnodes.get(c).parent = n.parent; });
    if (i >= 0) arr.splice.apply(arr, [i, 1].concat(kids));
    vnodes.delete(n.id);
    if (vsel === n.id) vsel = null;
  });
}
