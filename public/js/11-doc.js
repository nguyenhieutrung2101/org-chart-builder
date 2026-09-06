"use strict";
/* [10] Module "Trình bày sơ đồ" — Org Builder. Trang in SVG theo mm: tiêu đề, khối mã văn bản, bảng màu cấp,
   ghi chú, box (chữ nhiều dòng, co giãn chiều cao, badge chữ cái, định biên), đường nối theo 2 kiểu
   (dàn ngang / nhóm xếp dọc), cụm mô tả chức năng; zoom mượt + pan; in qua trình duyệt / tải PDF.
   Dùng chung cây `nodes` với module Luồng duyệt; chỉ đọc/ghi thêm các trường trình bày + `doc`. */

var PAGE_MM = { A4:[210, 297], A3:[297, 420] };          // [cạnh ngắn, cạnh dài] mm
var DOC_M   = 10;                                        // lề trang (mm)
// w: bề rộng box; hMin: cao tối thiểu; gx: giữa các cột; gy: cha → con dàn ngang; gy1: cha → nhóm xếp dọc treo dưới;
// gyS: giữa các box trong nhóm xếp dọc; stub: đường dọc → cạnh trái box; sx: đường dọc lệch trái so với box cha
var DBOX    = { w:46, hMin:19, gx:5, gy:12, gy1:6, gyS:4.5, stub:4, sx:4 };
var DOC_FONTS = {                                        // css: hiển thị; pdf: tên họ font nhúng khi tải PDF
  app:   { css:'system-ui, "Segoe UI", Arial, sans-serif',          pdf:'DocSans'  },
  arial: { css:'Arial, "Liberation Sans", Helvetica, sans-serif',    pdf:'DocSans'  },
  times: { css:'"Times New Roman", "Liberation Serif", Times, serif', pdf:'DocSerif' }
};
// Bảng màu "gốc văn bản" (theo bảng màu của sơ đồ tổ chức đang dùng); pastel = TCOLOR của app
var TCOLOR_CLASSIC = { 'ĐB':'#C9BE2A', CC:'#5A7BE3', T1:'#E89347', T2:'#8DC63F', T3:'#F5D5B7',
                       T4:'#6EDFE8', T5:'#B8DAF2', T6:'#FFFFFF', T7:'#FFFFFF', T8:'#FFFFFF' };
var PX_PER_MM = 96 / 25.4;
var INK = '#1F1B16';
var SVGNS = 'http://www.w3.org/2000/svg';
var DOC_PAD = 22;                                        // padding của #docWrap (px) — dùng cho toán zoom quanh con trỏ
var dzoom = 1, dzoomAnim = null;                         // zoom màn hình của trang (view-state, không lưu) + animation
var docView = { scale:1, pos:new Map(), box:new Map() }; // sơ đồ nằm đâu trong trang ở lần render gần nhất (cho kéo-thả)

function docPageSize(){
  var s = PAGE_MM[doc.page] || PAGE_MM.A4;
  return doc.orient === 'P' ? { w:s[0], h:s[1] } : { w:s[1], h:s[0] };
}
function docColors(){ return doc.scheme === 'pastel' ? TCOLOR : TCOLOR_CLASSIC; }
function docFont(){ return DOC_FONTS[doc.font] || DOC_FONTS.app; }
function docLevelName(L){ return L === 'ĐB' ? t('lvlDB') : L === 'CC' ? t('lvlCC') : L; }

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
// Nội dung 3 khối của một box + chiều cao box theo số dòng:
// tên phòng: tối đa 2 dòng ở cỡ chuẩn, dài hơn thì co chữ; chức danh (+ cấp) 1 dòng co chữ; người phụ trách: mỗi dòng nhập = ≥1 dòng vẽ
function boxContent(n, fam){
  var maxW = DBOX.w - 3;
  var dept = n.dept ? fitLines(n.dept, maxW, 3.1, 2.3, 2, 'bold', 'normal', fam) : { lines:[], size:3.1 };
  var ttl = n.title || '';
  if (!n.hideLv) ttl = ttl ? ttl + ' (' + n.t + ')' : '(' + n.t + ')';
  var title = ttl ? fitLines(ttl, maxW, 2.9, 2.3, 1, 'bold', 'normal', fam) : { lines:[], size:2.9 };
  var person = n.person ? { lines:wrapText(n.person, maxW, 2.9, 'normal', 'italic', fam), size:2.9 } : { lines:[], size:2.9 };
  var blocks = [dept, title, person].filter(function(b){ return b.lines.length; });
  var contentH = 0;
  blocks.forEach(function(b){ contentH += b.lines.length * b.size * 1.2; });
  contentH += Math.max(0, blocks.length - 1) * 0.5;
  return { dept:dept, title:title, person:person, contentH:contentH, h:Math.max(DBOX.hMin, contentH + 4.6) };
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

/* ---------- layout theo cây con (không ép cùng cấp cùng hàng) ----------
   Con của một box chia 2 loại: "dàn ngang" (mỗi con một cột, nối từ cạnh dưới cha qua thanh ngang) và "xếp dọc"
   (các con có stack=true thành một cột, nối bằng đường dọc bên trái vào cạnh trái từng box).
   - Có con dàn ngang: cột xếp dọc (nếu có) đứng ngoài cùng bên trái, đường dọc được nuôi từ thanh ngang.
   - Chỉ có con xếp dọc: các con treo ngay dưới cha, đường dọc đi ra từ cạnh trái cha.
   measure() tính kích thước cây con (memo), place() gán toạ độ tuyệt đối (góc trên-trái). */
function docLayout(fam){
  var box = new Map(), meas = new Map(), pos = new Map();
  nodes.forEach(function(n, id){ box.set(id, boxContent(n, fam)); });
  function kids(id){
    var n = nodes.get(id);
    return { spread:n.children.filter(function(c){ return !nodes.get(c).stack; }),
             stacked:n.children.filter(function(c){ return nodes.get(c).stack; }) };
  }
  function measure(id){
    if (meas.has(id)) return meas.get(id);
    var b = box.get(id), k = kids(id), m;
    var sm = k.spread.map(measure), tm = k.stacked.map(measure);
    var stackW = tm.length ? Math.max.apply(null, tm.map(function(x){ return x.w; })) : 0;
    var stackH = tm.reduce(function(s, x){ return s + x.h; }, 0) + Math.max(0, tm.length - 1) * DBOX.gyS;
    if (sm.length){
      var cols = (tm.length ? [DBOX.stub + stackW] : []).concat(sm.map(function(x){ return x.w; }));
      var colsW = cols.reduce(function(s, x){ return s + x; }, 0) + (cols.length - 1) * DBOX.gx;
      var childH = Math.max(stackH, Math.max.apply(null, sm.map(function(x){ return x.h; })));
      var w = Math.max(DBOX.w, colsW);
      m = { w:w, h:b.h + DBOX.gy + childH, bx:(w - DBOX.w) / 2, colsX:(w - colsW) / 2, groupW:tm.length ? DBOX.stub + stackW : 0 };
    } else if (tm.length){
      var innerW = Math.max(DBOX.w, stackW);
      m = { w:DBOX.sx + innerW, h:b.h + DBOX.gy1 + stackH, bx:DBOX.sx };
    } else m = { w:DBOX.w, h:b.h, bx:0 };
    meas.set(id, m);
    return m;
  }
  function place(id, x, y){
    var n = nodes.get(id), b = box.get(id), m = measure(id), k = kids(id);
    pos.set(id, { x:x + m.bx + (n.dx || 0), y:y, w:DBOX.w, h:b.h });
    if (k.spread.length){
      var cx = x + m.colsX, cy = y + b.h + DBOX.gy;
      if (k.stacked.length){
        var yy = cy;
        k.stacked.forEach(function(c){ place(c, cx + DBOX.stub, yy); yy += measure(c).h + DBOX.gyS; });
        cx += m.groupW + DBOX.gx;
      }
      k.spread.forEach(function(c){ place(c, cx, cy); cx += measure(c).w + DBOX.gx; });
    } else if (k.stacked.length){
      var y2 = y + b.h + DBOX.gy1;
      k.stacked.forEach(function(c){ place(c, x + DBOX.sx, y2); y2 += measure(c).h + DBOX.gyS; });
    }
  }
  var x0 = 0;
  rootIds.forEach(function(r){ place(r, x0, 0); x0 += measure(r).w + DBOX.gx * 2; });
  return { pos:pos, box:box };
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
    var busY = bottom + DBOX.gy / 2;
    var first = pos.get(spread[0]);
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
// forExport = true: không highlight, font-family = tên font nhúng PDF (svg2pdf tra theo tên đã addFont)
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

  // ---- sơ đồ ----
  var g = sv('g', { class:'dchart' }, svg);
  var L = docLayout(fam), pos = L.pos, ids = Array.from(pos.keys());
  if (!ids.length){
    svText(svg, P.w / 2, chartTop + 20, t('docNoTree'), { size:4, anchor:'middle', fill:'#8C857A' });
    docView = { scale:1, pos:pos, box:L.box };
    return svg;
  }
  var minX = Infinity, maxX = -Infinity, maxY = 0;
  ids.forEach(function(id){
    var p = pos.get(id);
    minX = Math.min(minX, p.x - (nodes.get(id).children.some(function(c){ return nodes.get(c).stack; }) ? DBOX.sx : 0));
    maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h);
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
  docView = { scale:s, pos:pos, box:L.box };

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
  // box: nền theo cấp; nội dung căn giữa dọc; badge chữ cái góc trên-trái; định biên góc dưới-phải
  ids.forEach(function(id){
    var n = nodes.get(id), p = pos.get(id), c = L.box.get(id), w = p.w, h = p.h;
    var gb = sv('g', { class:'dbox' + (!forExport && id === sel ? ' sel' : ''), 'data-id':id }, g);
    sv('rect', { class:'bg', x:p.x, y:p.y, width:w, height:h, fill:COL[n.t] || '#fff', stroke:INK, 'stroke-width':0.35 }, gb);
    var cx = p.x + w / 2, cur = p.y + (h - c.contentH) / 2;
    [['dept', 'bold', null], ['title', 'bold', null], ['person', null, 'italic']].forEach(function(spec, bi){
      var b = c[spec[0]];
      if (!b.lines.length) return;
      if (bi && cur > p.y + (h - c.contentH) / 2 + 0.01) cur += 0.5;
      b.lines.forEach(function(ln){
        svText(gb, cx, cur + b.size * 0.95, ln, { size:b.size, weight:spec[1], style:spec[2], anchor:'middle', cls:'l-' + spec[0] });
        cur += b.size * 1.2;
      });
    });
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
// Áp zoom: chỉ đổi kích thước svg (vector) — không dựng lại trang
function applyDZoom(){
  var svg = $('docPage').firstChild, P = docPageSize();
  if (svg){ svg.style.width = (P.w * PX_PER_MM * dzoom) + 'px'; svg.style.height = (P.h * PX_PER_MM * dzoom) + 'px'; }
  var lbl = $('dzoomLbl'); if (lbl) lbl.textContent = Math.round(dzoom * 100) + '%';
}
function clampDZoom(z){ return Math.min(4, Math.max(0.15, z)); }
function dZoomTo(z){ dzoomAnim = null; dzoom = clampDZoom(z); applyDZoom(); }
function dZoomFit(){
  var w = $('docWrap'), P = docPageSize();
  dZoomTo(Math.min((w.clientWidth - 2 * DOC_PAD - 4) / (P.w * PX_PER_MM), (w.clientHeight - 2 * DOC_PAD - 4) / (P.h * PX_PER_MM)));
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
    + '<label>' + t('lblDesc') + '</label><textarea id="dfDesc" rows="5"></textarea>'
    + '<div class="hint">' + t('descHint') + '</div>'
    + '<div class="row"><button id="dbChild" class="primary">' + t('btnChild') + '</button><button id="dbSib">' + t('btnSib') + '</button></div>'
    + '<div class="row"><button id="dbL">◀</button><button id="dbR">▶</button><button id="dbDel" class="danger">' + t('btnDel') + '</button></div>'
    + '<div class="row"><button id="dbPos"' + (n.dx ? '' : ' disabled') + '>' + t('btnResetPos') + '</button></div>';
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
  $('dbChild').onclick = function(){ addChild(sel); };
  $('dbSib').onclick   = function(){ addSib(sel); };
  $('dbL').onclick     = function(){ moveSib(sel, -1); };
  $('dbR').onclick     = function(){ moveSib(sel, 1); };
  $('dbDel').onclick   = function(){ delNode(sel); };
  $('dbPos').onclick   = function(){ snap(null); n.dx = 0; renderDoc(); renderDPanel(); };
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
    + '<div><label>' + t('lblScheme') + '</label>' + sel1('dpScheme', [['classic', t('schemeClassic')], ['pastel', t('schemePastel')]], doc.scheme) + '</div></div>'
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

/* ---------- kéo box sang ngang trong hàng ---------- */
function docMmPerPx(){ return 1 / (PX_PER_MM * dzoom * docView.scale); }   // mm sơ đồ ứng với 1px màn hình
function startBoxDrag(id, e){ return { id:id, x0:e.clientX, dx0:nodes.get(id).dx || 0, moved:false }; }
function moveBoxDrag(d, e){
  var dx = (e.clientX - d.x0) * docMmPerPx();
  if (!d.moved){ if (Math.abs(dx) < 0.8) return; d.moved = true; snap(null); }
  nodes.get(d.id).dx = Math.round((d.dx0 + dx) * 2) / 2;
  renderDoc();
}
function endBoxDrag(d){ if (d.moved){ renderDoc(); renderDPanel(); } }

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
