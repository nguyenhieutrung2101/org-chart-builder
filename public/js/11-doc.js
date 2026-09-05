"use strict";
/* [10] Module "Trình bày sơ đồ" — Org Builder. Trang in SVG theo mm: tiêu đề, khối mã văn bản, bảng màu cấp,
   ghi chú, box (badge chữ cái, định biên), đường nối bẻ được, cụm mô tả chức năng; in qua trình duyệt / tải PDF.
   Dùng chung cây `nodes` với module Luồng duyệt; chỉ đọc/ghi thêm các trường trình bày (hc/annot/desc/dx/wp) + `doc`. */

var PAGE_MM = { A4:[210, 297], A3:[297, 420] };          // [cạnh ngắn, cạnh dài] mm
var DOC_M   = 10;                                        // lề trang (mm)
var DBOX    = { w:46, h:19, gx:5, gy:13 };               // box + khoảng cách trong sơ đồ (mm)
var DOC_FONTS = {                                        // css: hiển thị; pdf: tên họ font nhúng khi tải PDF
  app:   { css:'system-ui, "Segoe UI", Arial, sans-serif',          pdf:'DocSans'  },
  arial: { css:'Arial, "Liberation Sans", Helvetica, sans-serif',    pdf:'DocSans'  },
  times: { css:'"Times New Roman", "Liberation Serif", Times, serif', pdf:'DocSerif' }
};
// Bảng màu "gốc văn bản" (chụp từ sơ đồ tổ chức đang dùng); pastel = TCOLOR của app
var TCOLOR_CLASSIC = { 'ĐB':'#C7BC1F', CC:'#5C7CE6', T1:'#E9924D', T2:'#8DC63F', T3:'#F6D5B8',
                       T4:'#78E1EA', T5:'#BADDF3', T6:'#FFFFFF', T7:'#FFFFFF', T8:'#FFFFFF' };
var PX_PER_MM = 96 / 25.4;
var INK = '#1F1B16';
var SVGNS = 'http://www.w3.org/2000/svg';
var dzoom = 1;                                           // zoom màn hình của trang (view-state, không lưu)
var docView = { scale:1, tx:0, ty:0, pos:new Map() };    // sơ đồ nằm đâu trong trang ở lần render gần nhất (cho kéo-thả)

function docPageSize(){
  var s = PAGE_MM[doc.page] || PAGE_MM.A4;
  return doc.orient === 'P' ? { w:s[0], h:s[1] } : { w:s[1], h:s[0] };
}
function docColors(){ return doc.scheme === 'classic' ? TCOLOR_CLASSIC : TCOLOR; }
function docFont(){ return DOC_FONTS[doc.font] || DOC_FONTS.app; }
function docLevelName(L){ return L === 'ĐB' ? t('lvlDB') : L === 'CC' ? t('lvlCC') : L; }

/* ---------- đo chữ bằng canvas — mọi kích thước theo mm ---------- */
var _mctx = null;
function textW(str, size, weight, style, fam){
  if (!_mctx) _mctx = document.createElement('canvas').getContext('2d');
  _mctx.font = (style || 'normal') + ' ' + (weight || 'normal') + ' ' + (size * PX_PER_MM) + 'px ' + fam;
  return _mctx.measureText(str).width / PX_PER_MM;
}
// Co cỡ chữ để vừa maxW (tối thiểu 70% cỡ gốc); vẫn quá thì cắt bớt và thêm "…"
function fitText(str, maxW, size, weight, style, fam){
  str = String(str || '');
  var w = textW(str, size, weight, style, fam);
  if (w <= maxW) return { str:str, size:size };
  var s = Math.max(size * 0.7, size * maxW / w);
  if (textW(str, s, weight, style, fam) <= maxW) return { str:str, size:s };
  while (str.length > 1 && textW(str + '…', s, weight, style, fam) > maxW) str = str.slice(0, -1);
  return { str:str + '…', size:s };
}
// Ngắt dòng theo từ (từ đơn dài hơn dòng thì bẻ theo ký tự); giữ xuống dòng của người dùng
function wrapText(str, maxW, size, weight, style, fam){
  var out = [];
  String(str || '').split('\n').forEach(function(line){
    var words = line.split(/\s+/).filter(Boolean), cur = '';
    if (!words.length){ out.push(''); return; }
    words.forEach(function(w){
      var tryS = cur ? cur + ' ' + w : w;
      if (textW(tryS, size, weight, style, fam) <= maxW){ cur = tryS; return; }
      if (cur) out.push(cur);
      while (w.length > 1 && textW(w, size, weight, style, fam) > maxW){
        var k = w.length;
        while (k > 1 && textW(w.slice(0, k), size, weight, style, fam) > maxW) k--;
        out.push(w.slice(0, k)); w = w.slice(k);
      }
      cur = w;
    });
    out.push(cur);
  });
  return out;
}

/* ---------- tạo phần tử SVG ---------- */
function sv(name, attrs, parent){
  var e = document.createElementNS(SVGNS, name);
  if (attrs) Object.keys(attrs).forEach(function(k){ if (attrs[k] != null) e.setAttribute(k, attrs[k]); });
  if (parent) parent.appendChild(e);
  return e;
}
// o: size, weight, style, anchor, fill, deco. Gạch chân vẽ bằng <line> thật (svg2pdf không hiểu text-decoration)
function svText(parent, x, y, str, o){
  var e = sv('text', { x:x, y:y, 'font-size':o.size, 'font-weight':o.weight || null, 'font-style':o.style || null,
                       'text-anchor':o.anchor || null, fill:o.fill || INK }, parent);
  e.textContent = str;
  if (o.deco === 'underline'){
    var w = textW(str, o.size, o.weight, o.style, parent.ownerSVGElement ? parent.ownerSVGElement.getAttribute('font-family') : 'sans-serif');
    var x1 = o.anchor === 'middle' ? x - w / 2 : x;
    sv('line', { x1:x1, y1:y + o.size * 0.18, x2:x1 + w, y2:y + o.size * 0.18, stroke:o.fill || INK, 'stroke-width':o.size * 0.06 }, parent);
  }
  return e;
}

/* ---------- đường nối cha → con ---------- */
// Điểm neo: p0 giữa cạnh dưới box cha, pn giữa cạnh trên box con; busY = độ cao "thanh ngang" mặc định
function edgeEnds(id, pos){
  var n = nodes.get(id), pp = pos.get(n.parent), cp = pos.get(id);
  return { p0:[pp.x + DBOX.w / 2, pp.y + DBOX.h], pn:[cp.x + DBOX.w / 2, cp.y], busY:pp.y + DBOX.h + DBOX.gy / 2 };
}
function edgeDefaultWp(e){ return [[e.p0[0], e.busY], [e.pn[0], e.busY]]; }
// Toàn bộ điểm của đường nối: neo cha, các điểm gấp khúc (tự động hoặc người dùng đã bẻ), neo con
function edgePoints(id, pos){
  var e = edgeEnds(id, pos), n = nodes.get(id);
  var wp = (n.wp && n.wp.length) ? n.wp : edgeDefaultWp(e);
  return [e.p0].concat(wp.map(function(q){ return [q[0], q[1]]; })).concat([e.pn]);
}
// Sau khi kéo: bỏ điểm trùng / thẳng hàng; trùng đường mặc định thì về tự động (wp = null)
function normalizeWp(id){
  var n = nodes.get(id);
  if (!n.wp || !docView.pos.has(id) || !docView.pos.has(n.parent)) return;
  var e = edgeEnds(id, docView.pos);
  var pts = [e.p0].concat(n.wp).concat([e.pn]), same = function(a, b){ return Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01; };
  var out = [pts[0]];
  for (var i = 1; i < pts.length; i++) if (!same(pts[i], out[out.length - 1])) out.push(pts[i]);
  var res = [out[0]];
  for (var j = 1; j < out.length - 1; j++){
    var p = res[res.length - 1], c = out[j], q = out[j + 1];
    var col = (Math.abs(p[0] - c[0]) < 0.01 && Math.abs(c[0] - q[0]) < 0.01) || (Math.abs(p[1] - c[1]) < 0.01 && Math.abs(c[1] - q[1]) < 0.01);
    if (!col) res.push(c);
  }
  res.push(out[out.length - 1]);
  var wp = res.slice(1, -1), def = edgeDefaultWp(e);
  n.wp = (!wp.length || (wp.length === 2 && same(wp[0], def[0]) && same(wp[1], def[1]))) ? null : wp;
}

/* ---------- dựng trang ---------- */
// forExport = true: không handle/highlight, font-family = tên font nhúng PDF (svg2pdf tra theo tên đã addFont)
function buildDocSvg(forExport){
  var P = docPageSize(), M = DOC_M, F = docFont(), fam = forExport ? F.pdf : F.css, COL = docColors();
  var svg = sv('svg', { xmlns:SVGNS, viewBox:'0 0 ' + P.w + ' ' + P.h, 'font-family':fam });
  sv('rect', { x:0, y:0, width:P.w, height:P.h, fill:'#fff' }, svg);
  var y = M;
  if (doc.header.trim()){
    svText(svg, P.w / 2, y + 5, doc.header, { size:5.5, weight:'bold', anchor:'middle' });
    y += 9;
  }
  var leftY = y, rightY = y, x0 = M;
  if (doc.show.code){
    var labels = [['dcCode', 'code'], ['dcDate', 'date'], ['dcAuthor', 'author'], ['dcReviewer', 'reviewer'], ['dcApprover', 'approver']];
    var lw = 0;
    labels.forEach(function(l){ lw = Math.max(lw, textW(t(l[0]), 3.3, 'normal', 'italic', fam)); });
    labels.forEach(function(l, i){
      var yy = leftY + 3.6 + i * 4.6;
      svText(svg, x0, yy, t(l[0]), { size:3.3, style:'italic' });
      svText(svg, x0 + lw + 2, yy, ':', { size:3.3, style:'italic' });
      if (doc.code[l[1]]) svText(svg, x0 + lw + 5, yy, doc.code[l[1]], { size:3.3, style:'italic' });
    });
    leftY += 5 * 4.6 + 3;
  }
  if (doc.show.notes && doc.notes.length){
    svText(svg, x0 + 2, leftY + 3.4, t('notesH') + ':', { size:3.3, weight:'bold', style:'italic', deco:'underline' });
    leftY += 5.5;
    doc.notes.forEach(function(nt, i){
      var yy = leftY + i * 4.9;
      sv('rect', { x:x0, y:yy, width:4.2, height:4.2, fill:'#fff', stroke:INK, 'stroke-width':0.25 }, svg);
      svText(svg, x0 + 2.1, yy + 3.1, nt.key, { size:2.8, weight:'bold', anchor:'middle' });
      svText(svg, x0 + 6.5, yy + 3.1, nt.text, { size:3.1, style:'italic' });
    });
    leftY += doc.notes.length * 4.9 + 3;
  }
  if (doc.show.legend){
    var items = [['ĐB', docLevelName('ĐB')], ['CC', docLevelName('CC')], ['T1', 'T1'], ['T2', 'T2'], ['T3', 'T3'], ['T4', 'T4'], ['T5', 'T5'], ['T6', 'T6/T7/T8']];
    var lgW = 26, lgH = 5.2, lx = P.w - M - lgW;
    var gl = sv('g', { class:'dlegend' }, svg);
    items.forEach(function(it, i){
      var yy = rightY + i * lgH;
      sv('rect', { x:lx, y:yy, width:lgW, height:lgH, fill:COL[it[0]], stroke:INK, 'stroke-width':0.25 }, gl);
      svText(gl, lx + lgW / 2, yy + 3.6, it[1], { size:3.1, anchor:'middle' });
    });
    rightY += items.length * lgH + 3;
  }
  var chartTop = Math.max(leftY, rightY, y) + 2;

  // ---- sơ đồ: layout theo mm, mọi box (bỏ qua focus/thu gọn của tab Sơ đồ) + lệch ngang thủ công ----
  var g = sv('g', { class:'dchart' }, svg);
  var L = layout({ bw:DBOX.w, bh:DBOX.h, gx:DBOX.gx, gy:DBOX.gy, pad:0, all:true });
  var ids = Array.from(L.vis);
  var pos = new Map();
  ids.forEach(function(id){ var p = L.pos.get(id), n = nodes.get(id); pos.set(id, { x:p.x + (n.dx || 0), y:p.y }); });
  if (!ids.length){
    svText(svg, P.w / 2, chartTop + 20, t('docNoTree'), { size:4, anchor:'middle', fill:'#8C857A' });
    docView = { scale:1, tx:0, ty:0, pos:pos };
    return svg;
  }
  var minX = Infinity, maxX = -Infinity, maxY = 0;
  ids.forEach(function(id){
    var p = pos.get(id), n = nodes.get(id);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x + DBOX.w); maxY = Math.max(maxY, p.y + DBOX.h);
    (n.wp || []).forEach(function(q){ minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); maxY = Math.max(maxY, q[1]); });
  });
  // cụm mô tả chức năng: một khối dưới mỗi box có mô tả, cùng độ cao, thẳng cột với box
  var descs = [], descTop = maxY + 8, descH = 0, DS = 2.5, DLH = 3.3, DPAD = 1.6, DW = DBOX.w;
  if (doc.show.desc){
    ids.forEach(function(id){
      var n = nodes.get(id);
      if (!n.desc || !n.desc.trim()) return;
      var lines = [];
      n.desc.split('\n').forEach(function(raw){
        var head = /^#\s?/.test(raw);
        wrapText(raw.replace(/^#\s?/, ''), DW - 2 * DPAD, DS, head ? 'bold' : 'normal', 'normal', fam)
          .forEach(function(s){ lines.push({ s:s, head:head }); });
      });
      descs.push({ id:id, x:pos.get(id).x, lines:lines });
      descH = Math.max(descH, lines.length * DLH + 2 * DPAD);
    });
  }
  var chartW = maxX - minX, chartH = descs.length ? descTop + descH : maxY;
  var availW = P.w - 2 * M, availH = P.h - M - chartTop;
  var s = doc.show.fit ? Math.min(1, availW / chartW, availH / chartH) : 1;
  var tx = M + (availW - chartW * s) / 2 - minX * s, ty = chartTop;
  g.setAttribute('transform', 'translate(' + tx + ' ' + ty + ') scale(' + s + ')');
  docView = { scale:s, tx:tx, ty:ty, pos:pos };

  // đường nối (vẽ trước để nằm dưới box) + mũi tên tại box con + vùng bắt chuột từng đoạn
  ids.forEach(function(id){
    var n = nodes.get(id);
    if (!n.parent || !pos.has(n.parent)) return;
    var pts = edgePoints(id, pos);
    sv('path', { d:pts.map(function(q, i){ return (i ? 'L' : 'M') + q[0] + ' ' + q[1]; }).join(''),
                 fill:'none', stroke:INK, 'stroke-width':0.35, 'stroke-linejoin':'round' }, g);
    var a = pts[pts.length - 1], b = pts[pts.length - 2];
    var dx = a[0] - b[0], dy = a[1] - b[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, A = 1.9, hx = -uy * A * 0.55, hy = ux * A * 0.55;
    sv('path', { d:'M' + a[0] + ' ' + a[1] + 'L' + (a[0] - ux * A + hx) + ' ' + (a[1] - uy * A + hy) + 'L' + (a[0] - ux * A - hx) + ' ' + (a[1] - uy * A - hy) + 'Z', fill:INK }, g);
    if (!forExport) for (var i = 0; i < pts.length - 1; i++){
      var hor = Math.abs(pts[i][1] - pts[i + 1][1]) < 0.01;
      sv('line', { x1:pts[i][0], y1:pts[i][1], x2:pts[i + 1][0], y2:pts[i + 1][1], class:'dedge-hit ' + (hor ? 'hor' : 'ver'), 'data-id':id, 'data-seg':i }, g);
    }
  });
  // box: nền theo cấp, 3 dòng chữ co cho vừa, badge chữ cái góc trên-trái, định biên góc dưới-phải
  ids.forEach(function(id){
    var n = nodes.get(id), p = pos.get(id), w = DBOX.w, h = DBOX.h;
    var gb = sv('g', { class:'dbox' + (!forExport && id === sel ? ' sel' : ''), 'data-id':id }, g);
    sv('rect', { class:'bg', x:p.x, y:p.y, width:w, height:h, fill:COL[n.t] || '#fff', stroke:INK, 'stroke-width':0.35 }, gb);
    var cx = p.x + w / 2, maxW = w - 3;
    var l1 = fitText(n.dept, maxW, 3.1, 'bold', 'normal', fam);
    var l2 = fitText(n.title ? n.title + ' (' + n.t + ')' : '(' + n.t + ')', maxW, 2.9, 'bold', 'normal', fam);
    var l3 = fitText(n.person, maxW, 2.9, 'normal', 'italic', fam);
    if (n.dept)   svText(gb, cx, p.y + 6.0,  l1.str, { size:l1.size, weight:'bold', anchor:'middle' });
    svText(gb, cx, p.y + 10.8, l2.str, { size:l2.size, weight:'bold', anchor:'middle' });
    if (n.person) svText(gb, cx, p.y + 15.4, l3.str, { size:l3.size, style:'italic', anchor:'middle' });
    if (n.annot){
      sv('rect', { class:'annot', x:p.x, y:p.y - 5.4, width:4.6, height:4.6, fill:'#fff', stroke:INK, 'stroke-width':0.3 }, gb);
      svText(gb, p.x + 2.3, p.y - 2.0, n.annot, { size:2.9, weight:'bold', anchor:'middle' });
    }
    if (doc.show.hc){
      var hc = String(hcOf(id)), pw = Math.max(6, textW(hc, 2.5, 'bold', 'normal', fam) + 3);
      sv('rect', { class:'hc', x:p.x + w - pw + 1, y:p.y + h - 2.2, width:pw, height:4.2, rx:0.8, fill:'#fff', stroke:INK, 'stroke-width':0.3 }, gb);
      svText(gb, p.x + w - pw / 2 + 1, p.y + h + 1.0, hc, { size:2.5, weight:'bold', anchor:'middle' });
    }
  });
  descs.forEach(function(d){
    var gd = sv('g', { class:'ddesc', 'data-id':d.id }, g);
    sv('rect', { x:d.x, y:descTop, width:DW, height:descH, fill:'#fff', stroke:INK, 'stroke-width':0.3 }, gd);
    d.lines.forEach(function(ln, i){
      svText(gd, d.x + DPAD, descTop + DPAD + DLH * (i + 0.8), ln.s, { size:DS, weight:ln.head ? 'bold' : null, deco:ln.head ? 'underline' : null });
    });
  });
  return svg;
}

/* ---------- render màn hình ---------- */
function renderDoc(){
  var host = $('docPage');
  if (!host) return;
  var P = docPageSize(), svg = buildDocSvg(false);
  svg.style.width  = (P.w * PX_PER_MM * dzoom) + 'px';
  svg.style.height = (P.h * PX_PER_MM * dzoom) + 'px';
  host.innerHTML = ''; host.appendChild(svg);
  var lbl = $('dzoomLbl'); if (lbl) lbl.textContent = Math.round(dzoom * 100) + '%';
}
function renderDocAll(){ renderDoc(); renderDPanel(); renderDPage(); }
// Chọn box trong module trình bày (select() chuyển sang đây khi MOD === 'doc')
function dSelect(id, focusInput){
  sel = id;
  renderDoc(); renderDPanel();
  if (focusInput){ var f = $('dfD'); if (f) f.focus(); }
}
function dZoomTo(z){ dzoom = Math.min(3, Math.max(0.2, z)); renderDoc(); }
function dZoomFit(){
  var w = $('docWrap'), P = docPageSize();
  dZoomTo(Math.min((w.clientWidth - 48) / (P.w * PX_PER_MM), (w.clientHeight - 48) / (P.h * PX_PER_MM)));
}

/* ---------- panel Box ---------- */
function renderDPanel(){
  var p = $('dBoxBody');
  if (!sel || !nodes.has(sel)){ p.innerHTML = '<div class="hint">' + t('docEmptyHint') + '</div>'; return; }
  var n = nodes.get(sel), leaf = !n.children.length;
  var minR = n.parent ? rnum(nodes.get(n.parent).t) : 0, opts = '';
  for (var i = minR; i <= LMAX; i++) opts += '<option>' + LEVELS[i] + '</option>';
  p.innerHTML =
      '<label>' + t('lblDept') + '</label><input id="dfD" autocomplete="off">'
    + '<label>' + t('lblTitle') + '</label><input id="dfC" autocomplete="off">'
    + '<label>' + t('lblPerson') + '</label><input id="dfP" autocomplete="off">'
    + '<div class="row2"><div><label>' + t('lblLevel') + '</label><select id="dfT">' + opts + '</select></div>'
    + '<div><label>' + t('lblHc') + '</label><input id="dfHc" type="number" min="0" step="1" autocomplete="off"' + (leaf ? '' : ' disabled') + '></div></div>'
    + '<div class="hint">' + (leaf ? t('hcLeafNote') : t('hcAutoNote')) + '</div>'
    + '<label>' + t('lblAnnot') + '</label><input id="dfA" maxlength="3" autocomplete="off" style="width:70px;text-align:center;font-weight:800">'
    + '<label>' + t('lblDesc') + '</label><textarea id="dfDesc" rows="6"></textarea>'
    + '<div class="hint">' + t('descHint') + '</div>'
    + '<div class="row"><button id="dbChild" class="primary">' + t('btnChild') + '</button><button id="dbSib">' + t('btnSib') + '</button></div>'
    + '<div class="row"><button id="dbL">◀</button><button id="dbR">▶</button><button id="dbDel" class="danger">' + t('btnDel') + '</button></div>'
    + '<div class="row"><button id="dbPos"' + (n.dx ? '' : ' disabled') + '>' + t('btnResetPos') + '</button>'
    + '<button id="dbEdge"' + (n.wp && n.parent ? '' : ' disabled') + '>' + t('btnResetEdge') + '</button></div>';
  var fD = $('dfD'); fD.value = n.dept;
  fD.oninput = function(){
    snap('e:' + sel + ':d');
    var s = fD.selectionStart, up = fD.value.toUpperCase();
    if (up !== fD.value){ fD.value = up; try{ fD.setSelectionRange(s, s); }catch(_){/**/} }
    n.dept = fD.value; renderDoc();
  };
  var fC = $('dfC'); fC.value = n.title;
  fC.oninput = function(){ snap('e:' + sel + ':c'); n.title = fC.value; renderDoc(); };
  var fP = $('dfP'); fP.value = n.person;
  fP.oninput = function(){ snap('e:' + sel + ':p'); n.person = fP.value; renderDoc(); };
  var sT = $('dfT'); sT.value = n.t;
  sT.onchange = function(){ setT(sel, sT.value); };
  var fHc = $('dfHc'); fHc.value = leaf ? (n.hc == null ? '' : n.hc) : hcOf(sel);
  fHc.oninput = function(){ setHc(sel, fHc.value); };
  var fA = $('dfA'); fA.value = n.annot || '';
  fA.oninput = function(){ snap('e:' + sel + ':a'); n.annot = fA.value.trim().slice(0, 3); renderDoc(); };
  var fDesc = $('dfDesc'); fDesc.value = n.desc || '';
  fDesc.oninput = function(){ snap('e:' + sel + ':desc'); n.desc = fDesc.value; renderDoc(); };
  $('dbChild').onclick = function(){ addChild(sel); };
  $('dbSib').onclick   = function(){ addSib(sel); };
  $('dbL').onclick     = function(){ moveSib(sel, -1); };
  $('dbR').onclick     = function(){ moveSib(sel, 1); };
  $('dbDel').onclick   = function(){ delNode(sel); };
  $('dbPos').onclick   = function(){ snap(null); n.dx = 0; renderDoc(); renderDPanel(); };
  $('dbEdge').onclick  = function(){ snap(null); n.wp = null; renderDoc(); renderDPanel(); };
}

/* ---------- panel Trang ---------- */
function docSet(key, fn){ snap('doc:' + key); fn(); renderDoc(); }
function renderDPage(){
  var p = $('dPageBody');
  function sel1(id, opts, val){
    return '<select id="' + id + '">' + opts.map(function(o){ return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
  }
  var codeFields = [['code', 'dcCode'], ['date', 'dcDate'], ['author', 'dcAuthor'], ['reviewer', 'dcReviewer'], ['approver', 'dcApprover']];
  var shows = [['legend', 'ckLegend'], ['code', 'ckCode'], ['notes', 'ckNotes'], ['hc', 'ckHc'], ['desc', 'ckDesc'], ['fit', 'ckFit']];
  p.innerHTML =
      '<div class="row2"><div><label>' + t('lblPage') + '</label>' + sel1('dpPage', [['A4', 'A4'], ['A3', 'A3']], doc.page) + '</div>'
    + '<div><label>' + t('lblOrient') + '</label>' + sel1('dpOrient', [['L', t('orientL')], ['P', t('orientP')]], doc.orient) + '</div></div>'
    + '<div class="row2"><div><label>' + t('lblFont') + '</label>' + sel1('dpFont', [['app', t('fontApp')], ['arial', 'Arial'], ['times', 'Times New Roman']], doc.font) + '</div>'
    + '<div><label>' + t('lblScheme') + '</label>' + sel1('dpScheme', [['pastel', t('schemePastel')], ['classic', t('schemeClassic')]], doc.scheme) + '</div></div>'
    + '<label>' + t('lblHeader') + '</label><input id="dpHeader" autocomplete="off" placeholder="' + t('phHeader') + '">'
    + '<label>' + t('docCodeH') + '</label>'
    + codeFields.map(function(f){ return '<input id="dpc_' + f[0] + '" autocomplete="off" placeholder="' + t(f[1]) + '" style="margin-bottom:5px">'; }).join('')
    + '<label>' + t('notesH') + '</label><div id="dpNotes"></div>'
    + '<div class="row" style="margin-top:6px"><button id="dpAddNote">' + t('btnAddNote') + '</button></div>'
    + '<label>' + t('showH') + '</label>'
    + shows.map(function(s){ return '<div class="ck"><input type="checkbox" id="dps_' + s[0] + '"><label for="dps_' + s[0] + '" style="margin:0">' + t(s[1]) + '</label></div>'; }).join('');
  $('dpPage').onchange   = function(){ docSet('page',   function(){ doc.page   = $('dpPage').value;   }); };
  $('dpOrient').onchange = function(){ docSet('orient', function(){ doc.orient = $('dpOrient').value; }); };
  $('dpFont').onchange   = function(){ docSet('font',   function(){ doc.font   = $('dpFont').value;   }); };
  $('dpScheme').onchange = function(){ docSet('scheme', function(){ doc.scheme = $('dpScheme').value; }); };
  var h = $('dpHeader'); h.value = doc.header;
  h.oninput = function(){ docSet('header', function(){ doc.header = h.value; }); };
  codeFields.forEach(function(f){
    var el = $('dpc_' + f[0]); el.value = doc.code[f[0]];
    el.oninput = function(){ docSet('code.' + f[0], function(){ doc.code[f[0]] = el.value; }); };
  });
  shows.forEach(function(s){
    var ck = $('dps_' + s[0]); ck.checked = !!doc.show[s[0]];
    ck.onchange = function(){ docSet('show', function(){ doc.show[s[0]] = ck.checked; }); };
  });
  renderDNotes();
  $('dpAddNote').onclick = function(){
    snap(null);
    var used = doc.notes.map(function(x){ return x.key; }), k = 'A';
    while (used.indexOf(k) >= 0 && k < 'Z') k = String.fromCharCode(k.charCodeAt(0) + 1);
    doc.notes.push({ key:k, text:'' });
    renderDNotes(); renderDoc();
    var last = document.querySelector('#dpNotes .noteRow:last-child input.txt'); if (last) last.focus();
  };
}
function renderDNotes(){
  var host = $('dpNotes'); host.innerHTML = '';
  doc.notes.forEach(function(nt, i){
    var row = document.createElement('div'); row.className = 'noteRow';
    var k = document.createElement('input'); k.className = 'k'; k.maxLength = 3; k.value = nt.key;
    var tx = document.createElement('input'); tx.className = 'txt'; tx.placeholder = t('phNoteText'); tx.value = nt.text;
    var del = document.createElement('button'); del.className = 'danger'; del.textContent = '✕'; del.title = t('tipDelNote');
    k.oninput  = function(){ docSet('note:' + i + ':k', function(){ nt.key = k.value.trim().slice(0, 3); }); };
    tx.oninput = function(){ docSet('note:' + i + ':t', function(){ nt.text = tx.value; }); };
    del.onclick = function(){ snap(null); doc.notes.splice(i, 1); renderDNotes(); renderDoc(); };
    row.appendChild(k); row.appendChild(tx); row.appendChild(del); host.appendChild(row);
  });
}

/* ---------- kéo-thả trên trang: box dịch ngang trong hàng, đoạn đường nối bẻ vuông góc ---------- */
// mm trên sơ đồ ứng với 1px màn hình = 1 / (px/mm × zoom × tỉ lệ co sơ đồ)
function docMmPerPx(){ return 1 / (PX_PER_MM * dzoom * docView.scale); }
function startBoxDrag(id, e){ return { kind:'box', id:id, x0:e.clientX, dx0:nodes.get(id).dx || 0, moved:false }; }
// Bắt đầu kéo đoạn thứ seg của đường nối vào box id. Đoạn chạm điểm neo (cha/con) thì tách ra bằng một điểm gấp mới,
// nên kéo đoạn đầu/cuối sang ngang tạo thêm một khúc gập như draw.io.
function startEdgeDrag(id, seg, e){
  var n = nodes.get(id), ends = edgeEnds(id, docView.pos);
  var wp = (n.wp && n.wp.length) ? n.wp.map(function(q){ return [q[0], q[1]]; }) : edgeDefaultWp(ends);
  var i = seg;
  if (i === 0){ wp.unshift([ends.p0[0], ends.p0[1]]); i = 1; }
  if (i === wp.length) wp.push([ends.pn[0], ends.pn[1]]);
  var a = wp[i - 1], b = wp[i];
  return { kind:'edge', id:id, wp:wp, i:i, hor:Math.abs(a[1] - b[1]) < 0.01, x0:e.clientX, y0:e.clientY, a0:[a[0], a[1]], moved:false };
}
function moveDrag(d, e){
  var k = docMmPerPx(), dx = (e.clientX - d.x0) * k, dy = (e.clientY - d.y0 || 0) * k;
  if (!d.moved){ if (Math.hypot(dx, dy) < 0.8) return; d.moved = true; snap(null); }
  var r5 = function(v){ return Math.round(v * 2) / 2; };
  if (d.kind === 'box'){ nodes.get(d.id).dx = r5(d.dx0 + dx); }
  else {
    var a = d.wp[d.i - 1], b = d.wp[d.i];
    if (d.hor) a[1] = b[1] = r5(d.a0[1] + dy); else a[0] = b[0] = r5(d.a0[0] + dx);
    nodes.get(d.id).wp = d.wp;
  }
  renderDoc();
}
function endDrag(d){
  if (!d.moved) return;
  if (d.kind === 'edge') normalizeWp(d.id);
  renderDoc(); renderDPanel();
}

/* ---------- in / PDF ---------- */
function docPrint(){
  var P = docPageSize();
  $('printPage').textContent = '@page{size:' + P.w + 'mm ' + P.h + 'mm;margin:0}';
  window.print();
}
var _pdfLibs = null, _pdfFonts = {};
var PDF_FONT_FILES = { DocSans:'LiberationSans', DocSerif:'LiberationSerif' };
var PDF_STYLES = [['Regular', 'normal'], ['Bold', 'bold'], ['Italic', 'italic'], ['BoldItalic', 'bolditalic']];
function loadScript(src){
  return new Promise(function(res, rej){
    var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function(){ rej(new Error(src)); };
    document.head.appendChild(s);
  });
}
function loadPdfLibs(){
  if (!_pdfLibs) _pdfLibs = loadScript('js/vendor/jspdf.umd.min.js').then(function(){ return loadScript('js/vendor/svg2pdf.umd.min.js'); });
  return _pdfLibs;
}
function bufToB64(buf){
  var bin = '', u = new Uint8Array(buf);
  for (var i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(bin);
}
// Nạp 4 kiểu (thường/đậm/nghiêng/đậm-nghiêng) của họ font nhúng; chỉ tải một lần
function loadPdfFont(famName){
  if (!_pdfFonts[famName]) _pdfFonts[famName] = Promise.all(PDF_STYLES.map(function(st){
    var file = PDF_FONT_FILES[famName] + '-' + st[0] + '.ttf';
    return fetch('fonts/' + file).then(function(r){ if (!r.ok) throw new Error(file); return r.arrayBuffer(); })
      .then(function(buf){ return { file:file, style:st[1], b64:bufToB64(buf) }; });
  }));
  return _pdfFonts[famName];
}
function docPdf(){
  var F = docFont(), P = docPageSize();
  msg(t('msgPdfLoading'));
  return loadPdfLibs().then(function(){ return loadPdfFont(F.pdf); }).then(function(fonts){
    var pdf = new window.jspdf.jsPDF({ orientation:doc.orient === 'P' ? 'portrait' : 'landscape', unit:'mm', format:doc.page.toLowerCase() });
    fonts.forEach(function(f){ pdf.addFileToVFS(f.file, f.b64); pdf.addFont(f.file, F.pdf, f.style); });
    var svg = buildDocSvg(true);
    svg.setAttribute('width', P.w + 'mm'); svg.setAttribute('height', P.h + 'mm');
    var holder = document.createElement('div');               // svg2pdf cần phần tử nằm trong DOM (đo chữ)
    holder.style.cssText = 'position:absolute;left:-10000px;top:0';
    holder.appendChild(svg); document.body.appendChild(holder);
    return pdf.svg(svg, { x:0, y:0, width:P.w, height:P.h }).then(function(){
      holder.remove();
      pdf.save((doc.header.trim() || 'org-chart') + '.pdf');
      msg(t('msgPdfDone'));
    }, function(e){ holder.remove(); throw e; });
  }).catch(function(e){ console.error(e); msg(t('msgPdfFail')); });
}
