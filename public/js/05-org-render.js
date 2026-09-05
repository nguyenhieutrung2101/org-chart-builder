"use strict";
/* [6] Render tab Sơ đồ: canvas, panel, bảng phân cấp, renderAll — Org Builder. Các file js/ dùng chung state global, nạp theo thứ tự trong index.html. */
/* ============ [6] RENDER TAB SƠ ĐỒ ============ */
function renderCanvas(L){
  var cv = $('canvas'), svg = $('svg');
  cv.querySelectorAll('.node').forEach(function(e){ e.remove(); });
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  var maxX = 0;
  L.pos.forEach(function(p){ if (p.x > maxX) maxX = p.x; });
  var W = L.vis.size ? maxX + BW + PAD : 300;
  var H = L.vis.size ? PAD*2 + L.keys.length*(BH+GY) - GY : 300;
  W = Math.max(W, 300); H = Math.max(H, 300);
  worldW = W; worldH = H;
  cv.style.width  = W + 'px';
  cv.style.height = H + 'px';
  svg.setAttribute('width',  W);
  svg.setAttribute('height', H);
  applyZoomView();                                  // sizer = world×zoom + scale(zoom)

  var NS = 'http://www.w3.org/2000/svg';
  L.vis.forEach(function(id){
    var n = nodes.get(id);
    n.children.forEach(function(c){
      if (!L.vis.has(c)) return;
      var a = L.pos.get(id), b = L.pos.get(c);
      var x1 = a.x + BW/2, y1 = a.y + BH, x2 = b.x + BW/2, y2 = b.y, m = y1 + GY/2;
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M '+x1+' '+y1+' V '+m+' H '+x2+' V '+y2);
      p.setAttribute('fill','none'); p.setAttribute('stroke','#1F1B16'); p.setAttribute('stroke-width','2');
      svg.appendChild(p);
    });
  });

  L.vis.forEach(function(id){
    var n = nodes.get(id), pv = L.pos.get(id);
    var d = document.createElement('div');
    d.className = 'node' + (id === sel ? ' sel' : '');
    d.dataset.id = id;                                 // cho select() vá class tại chỗ
    d.style.left = pv.x + 'px'; d.style.top = pv.y + 'px';
    d.style.background = TCOLOR[n.t] || '#ffffff';

    var tt = document.createElement('div'); tt.className='tt'; tt.textContent = n.t; d.appendChild(tt);
    if (n.star){
      var st = document.createElement('div'); st.className='st'; st.textContent='★';
      st.title = t('tipStar'); d.appendChild(st);
    }
    if (n.br){
      // Trùng màu badge với màu nền box theo cấp -> đảo (nền mực, chữ màu nhánh) cho khỏi hoà lẫn
      var inv = TCOLOR[n.t] === BR_COLOR[n.br] ? ' inv' : '';
      var vb = document.createElement('div'); vb.className = 'vh br-' + n.br + inv;
      vb.textContent = t('brBadge' + n.br);
      vb.title = tf('brTipNode', { br: segLabel(n.br) }); d.appendChild(vb);
    }
    var any = false;
    if (n.dept){  var e1=document.createElement('div'); e1.className='bd'; e1.textContent=n.dept;  d.appendChild(e1); any=true; }
    if (n.title){ var e2=document.createElement('div'); e2.className='bt'; e2.textContent=n.title; d.appendChild(e2); any=true; }
    if (n.person){var e3=document.createElement('div'); e3.className='bp'; e3.textContent=n.person;d.appendChild(e3); any=true; }
    if (!any){    var e0=document.createElement('div'); e0.className='be'; e0.textContent = t('emptyBox'); d.appendChild(e0); }

    if (n.collapsed && n.children.length){
      var hd = document.createElement('div'); hd.className='hid';
      hd.textContent = '+' + (subCount(id)-1);
      hd.title = tf('hidTip', { n: subCount(id)-1 });
      hd.onclick = function(e){ e.stopPropagation(); toggleCollapse(id); };
      d.appendChild(hd);
    }
    d.title = cellText(n) + '\n[' + n.t + ']' + (n.br ? '\n[' + segLabel(n.br) + ']' : '');
    d.onclick    = function(e){ e.stopPropagation(); select(id); };
    d.ondblclick = function(e){ e.stopPropagation(); select(id, true); };
    cv.appendChild(d);
  });

  var chip = $('focusChip');
  if (focusId && nodes.has(focusId)){
    chip.hidden = false; $('focusName').textContent = dispName(nodes.get(focusId));
  } else chip.hidden = true;

  renderMinimap(L);
}

function renderPanel(){
  var p = $('panel');
  if (!sel || !nodes.has(sel)){
    p.innerHTML = '<h2>' + t('panelEmptyH') + '</h2><div class="hint">' + t('panelEmptyHint') + '</div>';
    return;
  }
  var n = nodes.get(sel);
  var minR = n.parent ? rnum(nodes.get(n.parent).t) : 0;
  var opts = '';
  for (var i = minR; i <= 8; i++) opts += '<option>' + LEVELS[i] + '</option>';
  var brOpts = '<option value="">' + t('brNone') + '</option>';
  BRANCHES.forEach(function(k){
    brOpts += '<option value="' + k + '">' + segLabel(k) + '</option>';
  });

  p.innerHTML =
      '<h2>' + t('panelH') + '</h2>'
    + '<label>' + t('lblDept') + '</label><input id="fD" autocomplete="off">'
    + '<label>' + t('lblTitle') + '</label><input id="fC" autocomplete="off">'
    + '<label>' + t('lblPerson') + '</label><input id="fP" autocomplete="off">'
    + '<label>' + t('lblLevel') + (minR > 0 ? tf('lblLevelMin', { L: LEVELS[minR] }) : '') + '</label>'
    + '<select id="fT">' + opts + '</select>'
    + '<div class="ck"><input type="checkbox" id="fStar"><label for="fStar" style="margin:0">' + t('ckCbqlns') + '</label></div>'
    + '<label>' + t('lblBranch') + '</label><select id="fBr">' + brOpts + '</select>'
    + '<div class="row"><button id="bChild" class="primary">' + t('btnChild') + '</button><button id="bSib">' + t('btnSib') + '</button></div>'
    + '<div class="row"><button id="bClps">' + (n.collapsed ? t('btnExpand') : t('btnCollapse')) + '</button>'
    +   '<button id="bFocus">' + (focusId === sel ? t('btnUnfocus') : t('btnFocus')) + '</button></div>'
    + '<div class="row"><button id="bL">◀</button><button id="bR">▶</button><button id="bDel" class="danger">' + t('btnDel') + '</button></div>'
    + '<div class="hint" style="margin-top:10px">' + t('panelHint') + '</div>';

  var fD = $('fD'); fD.value = n.dept;
  fD.oninput = function(){
    snap('e:' + sel + ':d');
    var s = fD.selectionStart, up = fD.value.toUpperCase();
    if (up !== fD.value){ fD.value = up; try{ fD.setSelectionRange(s,s); }catch(_){/**/} }
    n.dept = fD.value; refreshView();
  };
  var fC = $('fC'); fC.value = n.title;
  fC.oninput = function(){ snap('e:' + sel + ':c'); n.title = fC.value; refreshView(); };
  var fP = $('fP'); fP.value = n.person;
  fP.oninput = function(){ snap('e:' + sel + ':p'); n.person = fP.value; refreshView(); };

  var sT = $('fT'); sT.value = n.t;
  sT.onchange = function(){ setT(sel, sT.value); };
  var ck = $('fStar'); ck.checked = !!n.star;
  ck.onchange = function(){ toggleStar(sel); };
  var sBr = $('fBr'); sBr.value = n.br || '';
  sBr.onchange = function(){ setBranch(sel, sBr.value); };

  if (!n.children.length) $('bClps').disabled = true;
  $('bClps').onclick  = function(){ toggleCollapse(sel); };
  $('bFocus').onclick = function(){ (focusId === sel) ? clearFocus() : setFocus(sel); };
  $('bChild').onclick = function(){ addChild(sel); };
  $('bSib').onclick   = function(){ addSib(sel); };
  $('bL').onclick     = function(){ moveSib(sel,-1); };
  $('bR').onclick     = function(){ moveSib(sel, 1); };
  $('bDel').onclick   = function(){ delNode(sel); };
}

function paths(vis){
  var out = [];
  function dfs(id, acc){
    var n = nodes.get(id), a = acc.concat([n]);
    var kids = n.children.filter(function(c){ return vis.has(c); });
    if (!kids.length){ out.push(a); return; }
    kids.forEach(function(c){ dfs(c, a); });
  }
  rootIds.forEach(function(r){ if (vis.has(r)) dfs(r, []); });
  return out;
}

function buildGrid(L){
  var header = L.keys.map(keyLabel);
  var rows = paths(L.vis).map(function(pth){
    var cells = new Array(L.keys.length).fill('');
    var first = L.row.get(pth[0].id), last = L.row.get(pth[pth.length-1].id);
    for (var c = first; c <= last; c++) cells[c] = '—';
    pth.forEach(function(n){ cells[L.row.get(n.id)] = cellText(n); });
    return cells;
  });
  return { header: header, rows: rows };
}

// Bảng phân cấp: colgroup cố định độ rộng MỖI cột (COLW_ORG px)
// -> tên dài tự ngắt dòng trong cột, tổng bề rộng = số cột × COLW_ORG, cuộn ngang trong .scrollTbl
function renderTable(L){
  var host = $('tblHost'); host.innerHTML = '';
  if (!L.vis.size){
    host.innerHTML = '<div class="hint">' + t('orgTableEmpty') + '</div>';
    return;
  }
  var g = buildGrid(L);
  var sc = document.createElement('div'); sc.className = 'scrollTbl';
  var tb = document.createElement('table');
  tb.style.tableLayout = 'fixed';
  var cg = document.createElement('colgroup');
  g.header.forEach(function(){
    var c = document.createElement('col'); c.style.width = COLW_ORG + 'px'; cg.appendChild(c);
  });
  tb.appendChild(cg);
  var tr = document.createElement('tr');
  g.header.forEach(function(h){ var th=document.createElement('th'); th.textContent=h; tr.appendChild(th); });
  tb.appendChild(tr);
  g.rows.forEach(function(r){
    var trr = document.createElement('tr');
    r.forEach(function(cell){
      var td = document.createElement('td');
      td.textContent = cell;
      if (cell === '—') td.className = 'dash';
      trr.appendChild(td);
    });
    tb.appendChild(trr);
  });
  sc.appendChild(tb); host.appendChild(sc);
}

function renderAll(){
  var L = layout();
  if (sel && !L.vis.has(sel)) sel = null;
  renderCanvas(L); renderPanel(); renderTable(L); renderVline(); renderVPanel(); renderFlow(); renderRules();
}
function refreshView(){
  var L = layout();
  renderCanvas(L); renderTable(L); refreshFlowResultSoon();
}
