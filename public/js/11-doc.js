"use strict";
/* [10] Module "Trình bày sơ đồ" — Org Builder. Trang in SVG theo mm: tiêu đề, khối mã văn bản, bảng màu cấp,
   ghi chú, box cao cố định (chữ tự co), xếp theo HÀNG như kệ sách (người dùng đẩy box lên/xuống hàng),
   đường nối 2 kiểu (dàn ngang / nhóm xếp dọc), cụm mô tả chức năng; zoom mượt + pan; in / tải PDF.
   Dùng chung cây `nodes` với module Luồng duyệt; chỉ đọc/ghi thêm các trường trình bày + `doc`. */

var PAGE_MM = { A4:[210, 297], A3:[297, 420], A2:[420, 594] };   // [cạnh ngắn, cạnh dài] mm
var DOC_M   = 10;                                        // lề trang (mm)
// w × h: kích thước box cố định (~5 dòng); gx: giữa các cột; gy: khoảng giữa hai HÀNG (thanh ngang ở giữa khoảng này,
// badge chữ cái nằm dưới thanh ngang); stub: đường dọc → cạnh trái box; sx: đường dọc lệch trái box cha; logoH: cao logo
var DBOX    = { w:46, h:23, gx:5, gy:12, stub:4, sx:4, logoH:8 };
var BADGE   = { s:4.2, up:4.6 };                          // badge chữ cái: cạnh s, đỉnh cách mép trên box "up" (hở ~1.2 mm với thanh ngang)
var DOC_FONTS = {                                        // css: hiển thị; pdf: tên họ font nhúng khi tải PDF
  app:   { css:'system-ui, "Segoe UI", Arial, sans-serif',          pdf:'DocSans'  },
  arial: { css:'Arial, "Liberation Sans", Helvetica, sans-serif',    pdf:'DocSans'  },
  times: { css:'"Times New Roman", "Liberation Serif", Times, serif', pdf:'DocSerif' }
};
// Bảng màu "gốc văn bản" (mã màu chuẩn của sơ đồ tổ chức đang dùng); pastel = TCOLOR của app
var TCOLOR_CLASSIC = { 'ĐB':'#c8c82d', CC:'#5e8cf9', T1:'#ea9651', T2:'#92d050', T3:'#f6d5b9',
                       T4:'#77e3f2', T5:'#cfc8dd', T6:'#ffffff', T7:'#ffffff', T8:'#ffffff' };
var PX_PER_MM = 96 / 25.4;
var INK = '#1F1B16';
var SVGNS = 'http://www.w3.org/2000/svg';
var DOC_PAD = 22;                                        // padding của #docWrap (px) — dùng cho toán zoom quanh con trỏ
var dzoom = 1, dzoomAnim = null;                         // zoom màn hình của trang (view-state, không lưu) + animation
// Kết quả render gần nhất: tỉ lệ co sơ đồ, gốc sơ đồ trong trang, vị trí box, hàng tự nhiên, chiều cao trang thực tế
var docView = { scale:1, tx:0, ty:0, pos:new Map(), rowBase:new Map(), maxRow:0, pageH:0, chartW:0 };
var docRowDrag = null;                                   // đang kéo box đổi hàng -> vẽ đường kẻ hàng hướng dẫn

function docPageSize(){
  var s = PAGE_MM[doc.page] || PAGE_MM.A4;
  return doc.orient === 'P' ? { w:s[0], h:s[1] } : { w:s[1], h:s[0] };
}
function docColors(){ return doc.scheme === 'pastel' ? TCOLOR : TCOLOR_CLASSIC; }
function docFont(){ return DOC_FONTS[doc.font] || DOC_FONTS.app; }
function docLevelName(L){ return L === 'ĐB' ? t('lvlDB') : L === 'CC' ? t('lvlCC') : L; }
function rowPitch(){ return DBOX.h + DBOX.gy; }

/* ---------- đo chữ bằng canvas — mọi kích thước theo mm ---------- */
var _mctx = null;
function textW(str, size, weight, style, fam){
  if (!_mctx) _mctx = document.createElement('canvas').getContext('2d');
  _mctx.font = (style || 'normal') + ' ' + (weight || 'normal') + ' ' + (size * PX_PER_MM) + 'px ' + fam;
  return _mctx.measureText(str).width / PX_PER_MM;
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
// Ngắt dòng, nếu quá maxLines thì co cỡ chữ dần (tới minSize); vẫn quá thì giữ minSize và cho thêm dòng — không bao giờ cắt chữ
function fitLines(str, maxW, size, minSize, maxLines, weight, style, fam){
  var s = size;
  for (;;){
    var lines = wrapText(str, maxW, s, weight, style, fam);
    if (lines.length <= maxLines || s <= minSize + 0.001) return { lines:lines, size:s };
    s = Math.max(minSize, s - 0.2);
  }
}
// Nội dung 3 khối của một box trong chiều cao cố định DBOX.h (~5 dòng): tên phòng ≤ 2 dòng rồi co; chức danh (+cấp) 1 dòng rồi co;
// người phụ trách mỗi dòng nhập = ≥1 dòng vẽ. Tổng quá cao -> co đồng loạt cả 3 khối (giữ tỉ lệ) tới khi vừa, không phình box.
function boxContent(n, fam, W){
  var maxW = W - 3, limit = DBOX.h - 3.2, best = null;
  for (var f = 1; f >= 0.5; f -= 0.05){
    var dept = n.dept ? fitLines(n.dept, maxW, 3.1 * f, 2.3 * f, 2, 'bold', 'normal', fam) : { lines:[], size:3.1 * f };
    var ttl = n.title || '';
    if (!n.hideLv) ttl = ttl ? ttl + ' (' + n.t + ')' : '(' + n.t + ')';
    var title = ttl ? fitLines(ttl, maxW, 2.9 * f, 2.3 * f, 1, 'bold', 'normal', fam) : { lines:[], size:2.9 * f };
    var person = n.person ? { lines:wrapText(n.person, maxW, 2.9 * f, 'normal', 'italic', fam), size:2.9 * f } : { lines:[], size:2.9 * f };
    var blocks = [dept, title, person].filter(function(b){ return b.lines.length; });
    var contentH = blocks.reduce(function(s, b){ return s + b.lines.length * b.size * 1.2; }, 0) + Math.max(0, blocks.length - 1) * 0.5;
    best = { dept:dept, title:title, person:person, contentH:contentH, scale:f };
    if (contentH <= limit) break;
  }
  return best;
}

/* ---------- tạo phần tử SVG ---------- */
function sv(name, attrs, parent){
  var e = document.createElementNS(SVGNS, name);
  if (attrs) Object.keys(attrs).forEach(function(k){ if (attrs[k] != null) e.setAttribute(k, attrs[k]); });
  if (parent) parent.appendChild(e);
  return e;
}
// o: size, weight, style, anchor, fill, deco, cls. Gạch chân vẽ bằng <line> thật (svg2pdf không hiểu text-decoration)
function svText(parent, x, y, str, o){
  var e = sv('text', { x:x, y:y, 'font-size':o.size, 'font-weight':o.weight || null, 'font-style':o.style || null,
                       'text-anchor':o.anchor || null, fill:o.fill || INK, class:o.cls || null }, parent);
  e.textContent = str;
  if (o.deco === 'underline'){
    var w = textW(str, o.size, o.weight, o.style, parent.ownerSVGElement ? parent.ownerSVGElement.getAttribute('font-family') : 'sans-serif');
    var x1 = o.anchor === 'middle' ? x - w / 2 : x;
    sv('line', { x1:x1, y1:y + o.size * 0.18, x2:x1 + w, y2:y + o.size * 0.18, stroke:o.fill || INK, 'stroke-width':o.size * 0.06 }, parent);
  }
  return e;
}

/* ---------- layout: HÀNG như kệ sách + cột theo cây con ----------
   Mọi box cao bằng nhau; hàng r nằm ở y = r × (h + gy). Hàng tự nhiên: con = cha + 1; box trong nhóm xếp dọc nối tiếp nhau
   (box sau nằm ngay dưới cây con của box trước). rowShift ≥ 0 của một box đẩy chính nó xuống thêm; mọi thứ bên dưới đùn theo.
   Bề ngang: con "dàn ngang" mỗi con một cột; con "xếp dọc" (stack) gom thành một cột — ngoài cùng bên trái nếu còn con
   dàn ngang, treo ngay dưới cha nếu chỉ có nhóm này. measure() memo bề rộng cây con, place() gán toạ độ tuyệt đối. */
function docLayout(fam){
  var W = DBOX.w, H = DBOX.h, PITCH = rowPitch();
  var box = new Map(), meas = new Map(), pos = new Map(), row = new Map(), rowBase = new Map();
  nodes.forEach(function(n, id){ box.set(id, boxContent(n, fam, W)); });
  function kids(id){
    var n = nodes.get(id);
    return { spread:n.children.filter(function(c){ return !nodes.get(c).stack; }),
             stacked:n.children.filter(function(c){ return nodes.get(c).stack; }) };
  }
  function assignRows(id, base){                      // trả về hàng sâu nhất của cây con
    var r = base + (nodes.get(id).rowShift || 0), k = kids(id), bottom = r;
    rowBase.set(id, base); row.set(id, r);
    k.spread.forEach(function(c){ bottom = Math.max(bottom, assignRows(c, r + 1)); });
    var next = r + 1;
    k.stacked.forEach(function(c){ var b = assignRows(c, next); bottom = Math.max(bottom, b); next = b + 1; });
    return bottom;
  }
  function measure(id){
    if (meas.has(id)) return meas.get(id);
    var k = kids(id), m;
    var sm = k.spread.map(measure), tm = k.stacked.map(measure);
    var stackW = tm.length ? Math.max.apply(null, tm.map(function(x){ return x.w; })) : 0;
    if (sm.length){
      var cols = (tm.length ? [DBOX.stub + stackW] : []).concat(sm.map(function(x){ return x.w; }));
      var colsW = cols.reduce(function(s, x){ return s + x; }, 0) + (cols.length - 1) * DBOX.gx;
      var w = Math.max(W, colsW);
      m = { w:w, bx:(w - W) / 2, colsX:(w - colsW) / 2, groupW:tm.length ? DBOX.stub + stackW : 0 };
    } else if (tm.length) m = { w:DBOX.sx + Math.max(W, stackW), bx:DBOX.sx };
    else m = { w:W, bx:0 };
    meas.set(id, m);
    return m;
  }
  function place(id, x){
    var m = measure(id), k = kids(id);
    pos.set(id, { x:x + m.bx, y:row.get(id) * PITCH, w:W, h:H, row:row.get(id) });
    if (k.spread.length){
      var cx = x + m.colsX;
      if (k.stacked.length){ k.stacked.forEach(function(c){ place(c, cx + DBOX.stub); }); cx += m.groupW + DBOX.gx; }
      k.spread.forEach(function(c){ place(c, cx); cx += measure(c).w + DBOX.gx; });
    } else if (k.stacked.length) k.stacked.forEach(function(c){ place(c, x + DBOX.sx); });
  }
  var x0 = 0, maxRow = 0;
  rootIds.forEach(function(r){ maxRow = Math.max(maxRow, assignRows(r, 0)); });
  rootIds.forEach(function(r){ place(r, x0); x0 += measure(r).w + DBOX.gx * 2; });
  return { pos:pos, box:box, rowBase:rowBase, maxRow:maxRow };
}
// Đường nối của một box cha tới các con, theo toạ độ đã đặt. Trả về mảng {pts, arrow}
function docEdges(id, pos){
  var n = nodes.get(id), p = pos.get(id), out = [];
  var spread = n.children.filter(function(c){ return !nodes.get(c).stack; });
  var stacked = n.children.filter(function(c){ return nodes.get(c).stack; });
  var cxP = p.x + p.w / 2, bottom = p.y + p.h;
  function stubs(spineX, topY){                       // đường dọc từ topY xuống giữa box cuối + nhánh vào cạnh trái từng box
    var last = pos.get(stacked[stacked.length - 1]);
    out.push({ pts:[[spineX, topY], [spineX, last.y + last.h / 2]] });
    stacked.forEach(function(c){ var q = pos.get(c); out.push({ pts:[[spineX, q.y + q.h / 2], [q.x, q.y + q.h / 2]], arrow:true }); });
  }
  if (spread.length){
    var first = pos.get(spread[0]);
    var topY = Math.min.apply(null, spread.concat(stacked).map(function(c){ return pos.get(c).y; }));
    var busY = topY - DBOX.gy / 2;                    // thanh ngang ngay trên hàng con cao nhất, không phải sát đáy cha
    if (spread.length === 1 && !stacked.length && Math.abs(first.x + first.w / 2 - cxP) < 0.01){
      out.push({ pts:[[cxP, bottom], [cxP, first.y]], arrow:true });
      return out;
    }
    var xs = spread.map(function(c){ var q = pos.get(c); return q.x + q.w / 2; });
    var spineX = stacked.length ? pos.get(stacked[0]).x - DBOX.stub : null;
    var minX = Math.min.apply(null, xs.concat([cxP]).concat(spineX != null ? [spineX] : []));
    var maxX = Math.max.apply(null, xs.concat([cxP]));
    out.push({ pts:[[cxP, bottom], [cxP, busY]] });
    out.push({ pts:[[minX, busY], [maxX, busY]] });
    spread.forEach(function(c, i){ var q = pos.get(c); out.push({ pts:[[xs[i], busY], [xs[i], q.y]], arrow:true }); });
    if (stacked.length) stubs(spineX, busY);
  } else if (stacked.length){
    var sx = p.x - DBOX.sx, yS = p.y + p.h * 0.62;
    out.push({ pts:[[p.x, yS], [sx, yS]] });
    stubs(sx, yS);
  }
  return out;
}

/* ---------- dựng trang ---------- */
// forExport = true: không highlight/đường kẻ hàng, font-family = tên font nhúng PDF (svg2pdf tra theo tên đã addFont)
function buildDocSvg(forExport){
  var P = docPageSize(), M = DOC_M, F = docFont(), fam = forExport ? F.pdf : F.css, COL = docColors();
  var svg = sv('svg', { xmlns:SVGNS, 'font-family':fam });
  var bg = sv('rect', { x:0, y:0, width:P.w, height:P.h, fill:'#fff' }, svg);
  var y = M, blocks = [];                             // blocks: vùng đã dùng ở đầu trang (mã văn bản + ghi chú, bảng màu) để sơ đồ né
  if (doc.header.trim()){
    svText(svg, P.w / 2, y + 5, doc.header, { size:5.5, weight:'bold', anchor:'middle' });
    y += 9;
  }
  var leftY = y, rightY = y, x0 = M, leftW = 0;
  var logo = doc.logo ? docLogoSvg(doc.logo) : null;
  if (logo){                                          // logo cố định 8 mm cao ở góc trái trên, không co theo trang
    var lw0 = DBOX.logoH * logo.ratio;
    logo.el.setAttribute('x', M); logo.el.setAttribute('y', M); logo.el.setAttribute('width', lw0); logo.el.setAttribute('height', DBOX.logoH);
    svg.appendChild(logo.el);
    leftY = Math.max(leftY, M + DBOX.logoH + 3); leftW = Math.max(leftW, lw0);
  }
  if (doc.show.code){
    var labels = [['dcCode', 'code'], ['dcDate', 'date'], ['dcAuthor', 'author'], ['dcReviewer', 'reviewer'], ['dcApprover', 'approver']];
    var lw = 0;
    labels.forEach(function(l){ lw = Math.max(lw, textW(t(l[0]), 2.7, 'normal', 'italic', fam)); });
    labels.forEach(function(l, i){
      var yy = leftY + 3 + i * 3.9;
      svText(svg, x0, yy, t(l[0]), { size:2.7, style:'italic' });
      svText(svg, x0 + lw + 1.5, yy, ':', { size:2.7, style:'italic' });
      if (doc.code[l[1]]){ svText(svg, x0 + lw + 4, yy, doc.code[l[1]], { size:2.7, style:'italic' }); leftW = Math.max(leftW, lw + 4 + textW(doc.code[l[1]], 2.7, 'normal', 'italic', fam)); }
      else leftW = Math.max(leftW, lw + 3);
    });
    leftY += 5 * 3.9 + 2.5;
  }
  if (doc.show.notes && doc.notes.length){
    svText(svg, x0 + 1.5, leftY + 2.8, t('notesH') + ':', { size:2.8, weight:'bold', style:'italic', deco:'underline' });
    leftY += 4.6;
    doc.notes.forEach(function(nt, i){
      var yy = leftY + i * 4.2;
      sv('rect', { x:x0, y:yy, width:3.6, height:3.6, fill:'#fff', stroke:INK, 'stroke-width':0.25 }, svg);
      svText(svg, x0 + 1.8, yy + 2.7, nt.key, { size:2.4, weight:'bold', anchor:'middle' });
      svText(svg, x0 + 5.5, yy + 2.7, nt.text, { size:2.7, style:'italic' });
      leftW = Math.max(leftW, 5.5 + textW(nt.text, 2.7, 'normal', 'italic', fam));
    });
    leftY += doc.notes.length * 4.2 + 2.5;
  }
  if (leftY > y || logo) blocks.push({ x0:M, x1:M + leftW, y0:Math.min(y, M), y1:leftY });
  if (doc.show.legend){
    var items = [['ĐB', docLevelName('ĐB')], ['CC', docLevelName('CC')], ['T1', 'T1'], ['T2', 'T2'], ['T3', 'T3'], ['T4', 'T4'], ['T5', 'T5'], ['T6', 'T6/T7/T8']];
    var lgW = 22, lgH = 4.4, lx = P.w - M - lgW;
    var gl = sv('g', { class:'dlegend' }, svg);
    items.forEach(function(it, i){
      var yy = rightY + i * lgH;
      sv('rect', { x:lx, y:yy, width:lgW, height:lgH, fill:COL[it[0]], stroke:INK, 'stroke-width':0.25 }, gl);
      svText(gl, lx + lgW / 2, yy + 3.05, it[1], { size:2.7, anchor:'middle' });
    });
    rightY += items.length * lgH + 2.5;
    blocks.push({ x0:lx, x1:P.w - M, y0:y, y1:rightY });
  }

  // ---- sơ đồ ----
  var g = sv('g', { class:'dchart' }, svg);
  var L = docLayout(fam), pos = L.pos, ids = Array.from(pos.keys()), H = DBOX.h, PITCH = rowPitch();
  docView = { scale:1, tx:0, ty:0, pos:pos, rowBase:L.rowBase, maxRow:L.maxRow, pageH:P.h, chartW:0 };
  if (!ids.length){
    svg.setAttribute('viewBox', '0 0 ' + P.w + ' ' + P.h);
    svText(svg, P.w / 2, Math.max(leftY, rightY) + 20, t('docNoTree'), { size:4, anchor:'middle', fill:'#8C857A' });
    return svg;
  }
  var minX = Infinity, maxX = -Infinity, rowX = {};        // rowX[r] = [minX, maxX] của hàng r (kể cả đường dọc nhóm)
  ids.forEach(function(id){
    var p = pos.get(id), n = nodes.get(id);
    var l = p.x - (n.children.some(function(c){ return nodes.get(c).stack; }) ? DBOX.sx : 0), r = p.x + p.w;
    minX = Math.min(minX, l); maxX = Math.max(maxX, r);
    var rx = rowX[p.row] || (rowX[p.row] = [Infinity, -Infinity]);
    rx[0] = Math.min(rx[0], l); rx[1] = Math.max(rx[1], r);
  });
  var maxY = (L.maxRow + 1) * PITCH - DBOX.gy;
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
  var chartW = maxX - minX, chartH = descs.length ? descTop + descH : maxY, availW = P.w - 2 * M;
  // Sơ đồ bắt đầu ngay dưới tiêu đề và tận dụng khoảng trống giữa ghi chú / bảng màu: chỉ đẩy xuống khi một hàng
  // thực sự chạm vào khối đó (thử lại vì tỉ lệ co phụ thuộc chỗ còn lại theo chiều cao)
  var chartTop = y + 2, s, tx;
  function geom(top){
    var availH = P.h - M - top;
    s = doc.show.fit ? Math.min(1, availW / chartW, doc.autoH ? 1 : availH / chartH) : 1;
    tx = M + (availW - chartW * s) / 2 - minX * s;
  }
  for (var it = 0; it < 12; it++){
    geom(chartTop);
    var hit = null;
    Object.keys(rowX).some(function(r){
      var top = chartTop + r * PITCH * s - 6 * s, bot = chartTop + (r * PITCH + H) * s, x1 = tx + rowX[r][0] * s, x2 = tx + rowX[r][1] * s;
      return blocks.some(function(b){ if (bot > b.y0 && top < b.y1 + 2 && x2 > b.x0 - 3 && x1 < b.x1 + 3){ hit = { r:+r, b:b }; return true; } return false; });
    });
    if (!hit) break;
    chartTop = Math.max(chartTop + 0.5, hit.b.y1 + 2 + 6 * s - hit.r * PITCH * s);
  }
  geom(chartTop);
  var pageH = doc.autoH ? Math.max(P.h, Math.ceil(chartTop + chartH * s + M)) : P.h;
  svg.setAttribute('viewBox', '0 0 ' + P.w + ' ' + pageH); bg.setAttribute('height', pageH);
  g.setAttribute('transform', 'translate(' + tx + ' ' + chartTop + ') scale(' + s + ')');
  docView = { scale:s, tx:tx, ty:chartTop, pos:pos, rowBase:L.rowBase, maxRow:L.maxRow, pageH:pageH, chartW:chartW };

  // đường kẻ hàng hướng dẫn khi đang kéo box đổi hàng (chỉ trên màn hình)
  if (!forExport && docRowDrag){
    var gg = sv('g', { class:'drows' }, g), cur = pos.get(docRowDrag.id).row;
    for (var r = 0; r <= L.maxRow + 2; r++){
      var yy = r * PITCH;
      sv('line', { x1:minX - 8, y1:yy, x2:maxX + 8, y2:yy, class:'drow' + (r === cur ? ' cur' : '') }, gg);
      sv('line', { x1:minX - 8, y1:yy + H, x2:maxX + 8, y2:yy + H, class:'drow' + (r === cur ? ' cur' : '') }, gg);
    }
  }
  // đường nối (vẽ trước để nằm dưới box); mũi tên vẽ bằng path để svg2pdf in đúng
  ids.forEach(function(id){
    docEdges(id, pos).forEach(function(e){
      var pts = e.pts;
      sv('path', { d:pts.map(function(q, i){ return (i ? 'L' : 'M') + q[0] + ' ' + q[1]; }).join(''), class:'dedge',
                   fill:'none', stroke:INK, 'stroke-width':0.35, 'stroke-linejoin':'round' }, g);
      if (!e.arrow) return;
      var a = pts[pts.length - 1], b = pts[pts.length - 2];
      var dx = a[0] - b[0], dy = a[1] - b[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, A = 1.9, hx = -uy * A * 0.55, hy = ux * A * 0.55;
      sv('path', { d:'M' + a[0] + ' ' + a[1] + 'L' + (a[0] - ux * A + hx) + ' ' + (a[1] - uy * A + hy) + 'L' + (a[0] - ux * A - hx) + ' ' + (a[1] - uy * A - hy) + 'Z', fill:INK }, g);
    });
  });
  // box: nền theo cấp; nội dung căn giữa dọc; badge chữ cái góc trên-trái (nằm trong khoảng giữa hai hàng); định biên góc dưới-phải
  ids.forEach(function(id){
    var n = nodes.get(id), p = pos.get(id), c = L.box.get(id), w = p.w, h = p.h;
    var gb = sv('g', { class:'dbox' + (!forExport && id === sel ? ' sel' : ''), 'data-id':id }, g);
    sv('rect', { class:'bg', x:p.x, y:p.y, width:w, height:h, fill:COL[n.t] || '#fff', stroke:INK, 'stroke-width':0.35 }, gb);
    var cx = p.x + w / 2, cur = p.y + (h - c.contentH) / 2, firstTop = cur;
    [['dept', 'bold', null], ['title', 'bold', null], ['person', null, 'italic']].forEach(function(spec){
      var b = c[spec[0]];
      if (!b.lines.length) return;
      if (cur > firstTop + 0.01) cur += 0.5;
      b.lines.forEach(function(ln){
        svText(gb, cx, cur + b.size * 0.95, ln, { size:b.size, weight:spec[1], style:spec[2], anchor:'middle', cls:'l-' + spec[0] });
        cur += b.size * 1.2;
      });
    });
    if (n.annot){
      sv('rect', { class:'annot', x:p.x, y:p.y - BADGE.up, width:BADGE.s, height:BADGE.s, fill:'#fff', stroke:INK, 'stroke-width':0.3 }, gb);
      svText(gb, p.x + BADGE.s / 2, p.y - BADGE.up + BADGE.s * 0.76, n.annot, { size:2.7, weight:'bold', anchor:'middle' });
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

/* ---------- logo SVG người dùng dán vào ---------- */
// Trả về { el: <svg> đã lọc, ratio: rộng/cao } hoặc null nếu không phải SVG. Loại bỏ script / sự kiện / foreignObject / href javascript:.
// Fill/stroke khai báo qua <style> theo class được chuyển thành thuộc tính inline để svg2pdf in đúng (svg2pdf không đọc <style>).
function docLogoSvg(code){
  var d;
  try{ d = new DOMParser().parseFromString(String(code), 'image/svg+xml'); }catch(_){ return null; }
  var root = d.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || d.querySelector('parsererror')) return null;
  var css = {};
  Array.prototype.slice.call(root.querySelectorAll('style')).forEach(function(st){
    (st.textContent || '').replace(/\.([\w-]+)\s*\{([^}]*)\}/g, function(_, cls, body){
      var props = {};
      body.split(';').forEach(function(kv){ var m = kv.split(':'); if (m.length === 2 && /^(fill|stroke|fill-opacity|stroke-width|opacity)$/.test(m[0].trim())) props[m[0].trim()] = m[1].trim(); });
      css[cls] = props; return '';
    });
    st.remove();
  });
  Array.prototype.slice.call(root.querySelectorAll('*')).forEach(function(el){
    var name = el.nodeName.toLowerCase();
    if (name === 'script' || name === 'foreignobject'){ el.remove(); return; }
    Array.prototype.slice.call(el.attributes).forEach(function(at){
      if (/^on/i.test(at.name) || (/href$/i.test(at.name) && /^\s*javascript:/i.test(at.value))) el.removeAttribute(at.name);
    });
    (el.getAttribute('class') || '').split(/\s+/).forEach(function(c){ var p = css[c]; if (p) Object.keys(p).forEach(function(k){ if (!el.hasAttribute(k)) el.setAttribute(k, p[k]); }); });
  });
  var vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  var w = parseFloat(root.getAttribute('width')), h = parseFloat(root.getAttribute('height'));
  if (vb.length !== 4 || vb.some(isNaN)){ if (!(w > 0 && h > 0)) return null; vb = [0, 0, w, h]; }
  var el = document.importNode(root, true);
  Array.prototype.slice.call(el.attributes).forEach(function(at){ if (!/^(xmlns|xmlns:xlink|viewBox|id)$/.test(at.name)) el.removeAttribute(at.name); });
  el.setAttribute('viewBox', vb.join(' ')); el.setAttribute('preserveAspectRatio', 'xMinYMin meet'); el.setAttribute('class', 'dlogo');
  return { el:el, ratio:vb[2] / vb[3] };
}

/* ---------- render màn hình + zoom mượt ---------- */
function renderDoc(){
  var host = $('docPage');
  if (!host) return;
  host.innerHTML = ''; host.appendChild(buildDocSvg(false));
  applyDZoom();
}
function renderDocAll(){ renderDoc(); renderDPanel(); renderDPage(); }
// Chọn box trong module trình bày (select() chuyển sang đây khi MOD === 'doc')
function dSelect(id, focusInput){
  sel = id;
  renderDoc(); renderDPanel();
  if (focusInput){ var f = $('dfD'); if (f) f.focus(); }
}
// Áp zoom: chỉ đổi kích thước svg (vector) — không dựng lại trang. Chiều cao theo trang thực tế (có thể dài hơn khổ giấy khi autoH)
function applyDZoom(){
  var svg = $('docPage').firstChild, P = docPageSize();
  if (svg){ svg.style.width = (P.w * PX_PER_MM * dzoom) + 'px'; svg.style.height = (docView.pageH * PX_PER_MM * dzoom) + 'px'; }
  var lbl = $('dzoomLbl'); if (lbl) lbl.textContent = Math.round(dzoom * 100) + '%';
}
function clampDZoom(z){ return Math.min(4, Math.max(0.15, z)); }
function dZoomTo(z){ dzoomAnim = null; dzoom = clampDZoom(z); applyDZoom(); }
function dZoomFit(){
  var w = $('docWrap'), P = docPageSize();
  dZoomTo(Math.min((w.clientWidth - 2 * DOC_PAD - 4) / (P.w * PX_PER_MM), (w.clientHeight - 2 * DOC_PAD - 4) / (docView.pageH * PX_PER_MM)));
  w.scrollLeft = 0; w.scrollTop = 0;
}
// Zoom MƯỢT quanh điểm (ax,ay) của viewport #docWrap — cùng cơ chế với tab Sơ đồ (ease-out, lăn dồn dập chỉ nâng target)
function dAnimateZoomTo(nz, ax, ay){
  nz = clampDZoom(nz);
  var w = $('docWrap');
  if (ax == null){ ax = w.clientWidth / 2; ay = w.clientHeight / 2; }
  var k = PX_PER_MM * dzoom, running = !!dzoomAnim;
  dzoomAnim = { target:nz, ax:ax, ay:ay, wx:(w.scrollLeft + ax - DOC_PAD) / k, wy:(w.scrollTop + ay - DOC_PAD) / k };
  if (!running) requestAnimationFrame(dZoomStep);
}
function dZoomStep(){
  var a = dzoomAnim; if (!a) return;
  var w = $('docWrap'), d = a.target - dzoom, done = Math.abs(d) < 0.0015;
  dzoom = done ? a.target : dzoom + d * 0.3;
  applyDZoom();
  var k = PX_PER_MM * dzoom;
  w.scrollLeft = a.wx * k + DOC_PAD - a.ax; w.scrollTop = a.wy * k + DOC_PAD - a.ay;
  if (done){ dzoomAnim = null; return; }
  requestAnimationFrame(dZoomStep);
}

/* ---------- panel Box ---------- */
function setRowShift(id, v){
  var n = nodes.get(id), nv = Math.max(0, Math.round(v));
  if (nv === (n.rowShift || 0)) return;
  snap(null); n.rowShift = nv; renderDoc(); renderDPanel();
}
function renderDPanel(){
  var p = $('dBoxBody');
  if (!sel || !nodes.has(sel)){ p.innerHTML = '<div class="hint">' + t('docEmptyHint') + '</div>'; return; }
  var n = nodes.get(sel), leaf = !n.children.length;
  var minR = n.parent ? rnum(nodes.get(n.parent).t) : 0, opts = '';
  for (var i = minR; i <= LMAX; i++) opts += '<option>' + LEVELS[i] + '</option>';
  var keys = doc.notes.map(function(x){ return x.key; }).filter(Boolean);
  var aOpts = '<option value="">' + t('annotNone') + '</option>' + keys.map(function(k){ return '<option value="' + xesc(k) + '">' + xesc(k) + '</option>'; }).join('');
  if (n.annot && keys.indexOf(n.annot) < 0) aOpts += '<option value="' + xesc(n.annot) + '">' + xesc(n.annot) + ' ' + t('annotUndefined') + '</option>';
  p.innerHTML =
      '<label>' + t('lblDept') + '</label><input id="dfD" autocomplete="off">'
    + '<label>' + t('lblTitle') + '</label><input id="dfC" autocomplete="off">'
    + '<div class="ck"><input type="checkbox" id="dfLv"><label for="dfLv" style="margin:0">' + t('ckShowLv') + '</label></div>'
    + '<label>' + t('lblPerson') + '</label><textarea id="dfP" rows="2" placeholder="' + t('phPersonLines') + '"></textarea>'
    + '<div class="row2"><div><label>' + t('lblLevel') + '</label><select id="dfT">' + opts + '</select></div>'
    + '<div><label>' + t('lblHc') + '</label><input id="dfHc" type="number" min="0" step="1" autocomplete="off"' + (leaf ? '' : ' disabled') + '></div></div>'
    + '<div class="hint">' + (leaf ? t('hcLeafNote') : t('hcAutoNote')) + '</div>'
    + '<label>' + t('lblAnnot') + '</label><select id="dfA">' + aOpts + '</select>'
    + (n.parent ? '<div class="ck"><input type="checkbox" id="dfStack"><label for="dfStack" style="margin:0">' + t('ckStack') + '</label></div><div class="hint">' + t('stackHint') + '</div>' : '')
    + '<div class="row"><button id="dbUp"' + (n.rowShift ? '' : ' disabled') + '>' + t('btnRowUp') + '</button><button id="dbDown">' + t('btnRowDown') + '</button></div>'
    + '<div class="hint">' + t('rowHint') + '</div>'
    + '<label>' + t('lblDesc') + '</label><textarea id="dfDesc" rows="5"></textarea>'
    + '<div class="hint">' + t('descHint') + '</div>'
    + '<div class="row"><button id="dbChild" class="primary">' + t('btnChild') + '</button><button id="dbSib">' + t('btnSib') + '</button></div>'
    + '<div class="row"><button id="dbL">◀</button><button id="dbR">▶</button><button id="dbDel" class="danger">' + t('btnDel') + '</button></div>';
  var fD = $('dfD'); fD.value = n.dept;
  fD.oninput = function(){
    snap('e:' + sel + ':d');
    var s = fD.selectionStart, up = fD.value.toUpperCase();
    if (up !== fD.value){ fD.value = up; try{ fD.setSelectionRange(s, s); }catch(_){/**/} }
    n.dept = fD.value; renderDoc();
  };
  var fC = $('dfC'); fC.value = n.title;
  fC.oninput = function(){ snap('e:' + sel + ':c'); n.title = fC.value; renderDoc(); };
  var fLv = $('dfLv'); fLv.checked = !n.hideLv;
  fLv.onchange = function(){ snap(null); n.hideLv = !fLv.checked; renderDoc(); };
  var fP = $('dfP'); fP.value = n.person;
  fP.oninput = function(){ snap('e:' + sel + ':p'); n.person = fP.value; renderDoc(); };
  var sT = $('dfT'); sT.value = n.t;
  sT.onchange = function(){ setT(sel, sT.value); };
  var fHc = $('dfHc'); fHc.value = leaf ? (n.hc == null ? '' : n.hc) : hcOf(sel);
  fHc.oninput = function(){ setHc(sel, fHc.value); };
  var fA = $('dfA'); fA.value = n.annot || '';
  fA.onchange = function(){ snap(null); n.annot = fA.value; renderDoc(); };
  var fS = $('dfStack');
  if (fS){ fS.checked = !!n.stack; fS.onchange = function(){ snap(null); n.stack = fS.checked; renderDoc(); }; }
  var fDesc = $('dfDesc'); fDesc.value = n.desc || '';
  fDesc.oninput = function(){ snap('e:' + sel + ':desc'); n.desc = fDesc.value; renderDoc(); };
  $('dbUp').onclick    = function(){ setRowShift(sel, (n.rowShift || 0) - 1); };
  $('dbDown').onclick  = function(){ setRowShift(sel, (n.rowShift || 0) + 1); };
  $('dbChild').onclick = function(){ addChild(sel); };
  $('dbSib').onclick   = function(){ addSib(sel); };
  $('dbL').onclick     = function(){ moveSib(sel, -1); };
  $('dbR').onclick     = function(){ moveSib(sel, 1); };
  $('dbDel').onclick   = function(){ delNode(sel); };
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
      '<div class="row2"><div><label>' + t('lblPage') + '</label>' + sel1('dpPage', [['A4', 'A4'], ['A3', 'A3'], ['A2', 'A2']], doc.page) + '</div>'
    + '<div><label>' + t('lblOrient') + '</label>' + sel1('dpOrient', [['L', t('orientL')], ['P', t('orientP')]], doc.orient) + '</div></div>'
    + '<div class="ck"><input type="checkbox" id="dpAutoH"><label for="dpAutoH" style="margin:0">' + t('ckAutoH') + '</label></div>'
    + '<div class="row2"><div><label>' + t('lblFont') + '</label>' + sel1('dpFont', [['app', t('fontApp')], ['arial', 'Arial'], ['times', 'Times New Roman']], doc.font) + '</div>'
    + '<div><label>' + t('lblScheme') + '</label>' + sel1('dpScheme', [['classic', t('schemeClassic')], ['pastel', t('schemePastel')]], doc.scheme) + '</div></div>'
    + '<label>' + t('lblHeader') + '</label><input id="dpHeader" autocomplete="off" placeholder="' + t('phHeader') + '">'
    + '<label>' + t('lblLogo') + '</label><textarea id="dpLogo" rows="3" spellcheck="false" placeholder="' + xesc(t('phLogo')) + '"></textarea>'
    + '<div class="hint">' + t('logoHint') + '</div>'
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
  var ah = $('dpAutoH'); ah.checked = !!doc.autoH;
  ah.onchange = function(){ docSet('autoH', function(){ doc.autoH = ah.checked; }); };
  var lg = $('dpLogo'); lg.value = doc.logo;
  lg.onchange = function(){
    var v = lg.value.trim();
    if (v && !docLogoSvg(v)){ msg(t('logoBad')); return; }
    docSet('logo', function(){ doc.logo = v; });
  };
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
    renderDNotes(); renderDoc(); renderDPanel();
    var last = document.querySelector('#dpNotes .noteRow:last-child input.txt'); if (last) last.focus();
  };
}
// Sửa key/xóa ghi chú -> dropdown "Ghi chú" của panel Box cũng phải cập nhật
function renderDNotes(){
  var host = $('dpNotes'); host.innerHTML = '';
  doc.notes.forEach(function(nt, i){
    var row = document.createElement('div'); row.className = 'noteRow';
    var k = document.createElement('input'); k.className = 'k'; k.maxLength = 3; k.value = nt.key;
    var tx = document.createElement('input'); tx.className = 'txt'; tx.placeholder = t('phNoteText'); tx.value = nt.text;
    var del = document.createElement('button'); del.className = 'danger'; del.textContent = '✕'; del.title = t('tipDelNote');
    k.oninput  = function(){ docSet('note:' + i + ':k', function(){ nt.key = k.value.trim().slice(0, 3); }); renderDPanel(); };
    tx.oninput = function(){ docSet('note:' + i + ':t', function(){ nt.text = tx.value; }); };
    del.onclick = function(){ snap(null); doc.notes.splice(i, 1); renderDNotes(); renderDoc(); renderDPanel(); };
    row.appendChild(k); row.appendChild(tx); row.appendChild(del); host.appendChild(row);
  });
}

/* ---------- kéo box lên/xuống đổi hàng (đường kẻ hàng hướng dẫn hiện trong lúc kéo) ---------- */
function startRowDrag(id, e){
  var svg = $('docPage').firstChild, r = svg.getBoundingClientRect();
  return { id:id, y0:e.clientY, top:r.top, base:docView.rowBase.get(id), shift0:nodes.get(id).rowShift || 0, moved:false };
}
function moveRowDrag(d, e){
  if (!d.moved){ if (Math.abs(e.clientY - d.y0) < 6) return; d.moved = true; snap(null); docRowDrag = { id:d.id }; }
  var mm = (e.clientY - d.top) / (PX_PER_MM * dzoom);                 // toạ độ trang (mm)
  var chartY = (mm - docView.ty) / docView.scale;                     // toạ độ sơ đồ
  var target = Math.max(d.base, Math.round((chartY - DBOX.h / 2) / rowPitch()));
  var n = nodes.get(d.id), shift = target - d.base;
  if (shift !== (n.rowShift || 0)){ n.rowShift = shift; renderDoc(); }
  else if (!$('docPage').querySelector('.drows')) renderDoc();        // lần đầu: chỉ để hiện đường kẻ hàng
}
function endRowDrag(d){
  if (!d.moved) return;
  docRowDrag = null;
  renderDoc(); renderDPanel();
}

/* ---------- in / PDF ---------- */
function docPrint(){
  var P = docPageSize();
  $('printPage').textContent = '@page{size:' + P.w + 'mm ' + docView.pageH + 'mm;margin:0}';
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
    var svg = buildDocSvg(true), PH = docView.pageH;               // dựng trước để biết chiều cao trang thực tế (autoH)
    var pdf = new window.jspdf.jsPDF({ orientation:P.w > PH ? 'landscape' : 'portrait', unit:'mm', format:[P.w, PH] });
    fonts.forEach(function(f){ pdf.addFileToVFS(f.file, f.b64); pdf.addFont(f.file, F.pdf, f.style); });
    svg.setAttribute('width', P.w + 'mm'); svg.setAttribute('height', PH + 'mm');
    var holder = document.createElement('div');               // svg2pdf cần phần tử nằm trong DOM (đo chữ)
    holder.style.cssText = 'position:absolute;left:-10000px;top:0';
    holder.appendChild(svg); document.body.appendChild(holder);
    return pdf.svg(svg, { x:0, y:0, width:P.w, height:PH }).then(function(){
      holder.remove();
      pdf.save((doc.header.trim() || 'org-chart') + '.pdf');
      msg(t('msgPdfDone'));
    }, function(e){ holder.remove(); throw e; });
  }).catch(function(e){ console.error(e); msg(t('msgPdfFail')); });
}
