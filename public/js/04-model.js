"use strict";
/* [3] Model cây + [4] visibleSet + [5] layout thuần — Org Builder. Các file js/ dùng chung state global, nạp theo thứ tự trong index.html. */
/* ============ [3] MODEL: THAO TÁC TRÊN CÂY ============ */
// Trường trình bày (module Trình bày sơ đồ): hc định biên tự nhập (null = trống), annot chữ cái badge,
// desc mô tả chức năng, dx lệch ngang thủ công (mm), wp điểm gấp khúc đường nối từ box cha (mm, null = tự động)
function nn(dept, title, person, lv, parent, id){
  var nid = id || ('n' + (seq++));
  nodes.set(nid, {id:nid, dept:dept, title:title, person:person, t:lv,
                  star:false, br:'', collapsed:false, parent:parent, children:[],
                  hc:null, annot:'', desc:'', dx:0, wp:null});
  return nid;
}
function addRoot(){
  if (focusId){ focusId = null; msg(t('msgUnfocusRoot')); }
  snap(null);
  var id = nn('','','','CC', null);
  rootIds.push(id); select(id, true);
}
function addChild(pid){
  snap(null);
  var p = nodes.get(pid);
  p.collapsed = false;
  var r = Math.min(LMAX, rnum(p.t) + 1);
  var id = nn('','','', LEVELS[r], pid);
  p.children.push(id); select(id, true);
}
function addSib(id){
  snap(null);
  var n = nodes.get(id);
  var nid = nn('','','', n.t, n.parent);
  var arr = n.parent ? nodes.get(n.parent).children : rootIds;
  arr.splice(arr.indexOf(id) + 1, 0, nid);
  select(nid, true);
}
function subCount(id){
  var n = nodes.get(id), s = 1;
  n.children.forEach(function(c){ s += subCount(c); });
  return s;
}
function wipe(id){
  var n = nodes.get(id);
  n.children.forEach(wipe);
  nodes.delete(id);
}
function delNode(id){
  var n = nodes.get(id);
  if (n.children.length &&
      !confirm(tf('cfmDelNode', { name: dispName(n), n: subCount(id)-1 }))) return;
  snap(null);
  var arr = n.parent ? nodes.get(n.parent).children : rootIds;
  arr.splice(arr.indexOf(id), 1);
  wipe(id);
  if (focusId && !nodes.has(focusId)) focusId = null;
  fcGroups.forEach(function(g){ if (g.cbqlns && !nodes.has(g.cbqlns)) g.cbqlns = null; });
  pruneVlineOrphans();                           // node import trên cây ngành dọc trỏ box vừa xóa
  var gone = pruneNodeRoles();                   // box vai trò link tới box vừa xóa (+ ô luật đang dùng nó)
  sel = null; renderAll();
  if (gone.boxes) msg(tf('msgRolesPruned', { n: gone.boxes, c: gone.cells }));
}
function moveSib(id, dir){
  var n = nodes.get(id);
  var arr = n.parent ? nodes.get(n.parent).children : rootIds;
  var i = arr.indexOf(id), j = i + dir;
  if (j < 0 || j >= arr.length) return;
  snap(null);
  var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  renderAll();
}
function setT(id, t){
  snap(null);
  var n = nodes.get(id); n.t = t;
  var fixed = 0;
  (function fix(pid){
    nodes.get(pid).children.forEach(function(c){
      var ch = nodes.get(c);
      if (rnum(ch.t) < rnum(nodes.get(pid).t)){ ch.t = nodes.get(pid).t; fixed++; }
      fix(c);
    });
  })(id);
  if (fixed) msg(tf('msgRaised', { n: fixed }));
  renderAll();
}
function toggleStar(id){
  snap(null);
  var n = nodes.get(id); n.star = !n.star;
  renderAll();
}
// Một loại nhánh gán được nhiều box (vd Vận hành bike + Vận hành car là 2 gốc VH riêng).
function setBranch(id, kind){
  snap(null);
  nodes.get(id).br = kind || '';
  renderAll();
}
// Trong cây con của id (không tính chính nó) có box nào đánh dấu ★ CBQLNS không?
function hasStarBelow(id){
  if (!id || !nodes.has(id)) return false;
  var found = false;
  (function walk(x){
    if (found) return;
    nodes.get(x).children.forEach(function(c){
      if (found) return;
      if (nodes.get(c).star){ found = true; return; }
      walk(c);
    });
  })(id);
  return found;
}
function isAncestor(a, b){
  var p = nodes.get(b) && nodes.get(b).parent;
  while (p){ if (p === a) return true; p = nodes.get(p).parent; }
  return false;
}
function toggleCollapse(id){
  var n = nodes.get(id);
  if (!n.children.length) return;
  if (!n.collapsed && focusId && isAncestor(id, focusId)){
    focusId = null; msg(t('msgFocusCleared'));
  }
  snap(null);
  n.collapsed = !n.collapsed;
  renderAll();
}
function setFocus(id){
  snap(null);
  focusId = id;
  var a = nodes.get(id).parent;
  while (a){ nodes.get(a).collapsed = false; a = nodes.get(a).parent; }
  renderAll();
  scrollNodeIntoView(id);
}
function clearFocus(){
  snap(null);
  var keep = focusId;             // giữ box vừa bỏ focus trong tầm nhìn (điểm neo định hướng)
  focusId = null;
  renderAll();
  scrollNodeIntoView(keep);
}
// Cuộn canvas sao cho box nằm giữa vùng nhìn — layout() thuần nên gọi lại không có side effect
function scrollNodeIntoView(id){
  if (!id || !nodes.has(id)) return;
  var L = layout();
  if (!L.vis.has(id)) return;
  var p = L.pos.get(id), cw = $('canvasWrap');
  cw.scrollLeft = Math.max(0, (p.x + BW/2)*zoom - cw.clientWidth/2);
  cw.scrollTop  = Math.max(0, (p.y + BH/2)*zoom - cw.clientHeight/2);
  syncMiniView();
}
// Chọn box: nếu box đã có trên canvas (hoặc bỏ chọn) thì chỉ VÁ class tại chỗ —
// dựng lại canvas làm box dưới con trỏ mất :hover, nhìn như bị "nảy". Box mới tạo
// (chưa có DOM, gọi từ addRoot/addChild/addSib) mới cần render đầy đủ.
function select(id, focusInput){
  if (MOD === 'doc'){ dSelect(id, focusInput); return; }
  sel = id;
  var onCanvas = !id || document.querySelector('#canvas .node[data-id="' + id + '"]');
  if (onCanvas){ applySelDom(); renderPanel(); }
  else renderAll();
  if (focusInput){ var f = $('fD'); if (f) f.focus(); }
}
function applySelDom(){
  document.querySelectorAll('#canvas .node').forEach(function(el){
    el.classList.toggle('sel', el.dataset.id === sel);
  });
  document.querySelectorAll('#miniSvg rect').forEach(function(r){
    var s = r.getAttribute('data-id') === sel;
    r.setAttribute('stroke', s ? '#6B8FE8' : '#1F1B16');
    r.setAttribute('stroke-width', s ? 8 : 3);
  });
}

/* ============ [4] HIỂN THỊ / ẨN ============ */
function visibleSet(){
  var allow = null;
  if (focusId && nodes.has(focusId)){
    allow = new Set();
    var a = focusId;
    while (a){ allow.add(a); a = nodes.get(a).parent; }
    (function sub(id){
      allow.add(id);
      nodes.get(id).children.forEach(sub);
    })(focusId);
  }
  var vis = new Set();
  function walk(id){
    if (allow && !allow.has(id)) return;
    vis.add(id);
    var n = nodes.get(id);
    if (!n.collapsed) n.children.forEach(walk);
  }
  rootIds.forEach(walk);
  return vis;
}

/* ============ [5] LAYOUT THUẦN ============ */
// dim (tuỳ chọn): {bw,bh,gx,gy,pad} kích thước riêng (module Trình bày dùng mm), all=true: vẽ mọi box (bỏ qua focus/thu gọn)
function layout(dim){
  dim = dim || {};
  var bw = dim.bw || BW, bh = dim.bh || BH, gx = dim.gx || GX, gy = dim.gy || GY, pad = dim.pad != null ? dim.pad : PAD;
  var vis = dim.all ? new Set(nodes.keys()) : visibleSet();
  var rank = new Map(), layer = new Map(), codes = new Set();

  function pass1(id){
    if (!vis.has(id)) return;
    var n = nodes.get(id);
    var p = (n.parent && vis.has(n.parent)) ? n.parent : null;
    var r = rnum(n.t); if (r < 0) r = rnum('CC');
    var k = (p && rank.get(p) === r) ? layer.get(p) + 1 : 1;
    rank.set(id, r); layer.set(id, k);
    codes.add(r * 1000 + k);
    n.children.forEach(pass1);
  }
  rootIds.forEach(pass1);

  var keys = Array.from(codes).sort(function(a,b){ return a-b; })
    .map(function(c){ return {r: Math.floor(c/1000), k: c%1000, code: c}; });
  var rowOf = new Map(); keys.forEach(function(kk,i){ rowOf.set(kk.code, i); });

  var row = new Map(), X = new Map(), next = 0;
  function pass2(id){
    var n = nodes.get(id);
    row.set(id, rowOf.get(rank.get(id)*1000 + layer.get(id)));
    var kids = n.children.filter(function(c){ return vis.has(c); });
    var x;
    if (!kids.length){ x = next++; }
    else {
      var xs = kids.map(pass2);
      x = (xs[0] + xs[xs.length-1]) / 2;
    }
    X.set(id, x); return x;
  }
  rootIds.forEach(function(r, i){
    if (!vis.has(r)) return;
    if (i && next) next += 0.5;
    pass2(r);
  });

  var pos = new Map();
  vis.forEach(function(id){
    pos.set(id, { x: pad + X.get(id)*(bw+gx),
                  y: pad + row.get(id)*(bh+gy) });
  });
  return { vis:vis, row:row, pos:pos, keys:keys };
}
function keyLabel(kk){
  var L = LEVELS[kk.r];
  return kk.k === 1 ? L : (L + ' (' + kk.k + ')');
}

// Định biên: box lá = số tự nhập (trống = 1, chính nó); box có con = 1 (chính nó) + tổng định biên các box con
function hcOf(id){
  var n = nodes.get(id);
  if (!n.children.length) return n.hc == null ? 1 : n.hc;
  return 1 + n.children.reduce(function(s, c){ return s + hcOf(c); }, 0);
}
function setHc(id, v){
  snap('e:' + id + ':hc');
  nodes.get(id).hc = (v === '' || v == null || !isFinite(+v)) ? null : Math.max(0, Math.round(+v));
  refreshView();
}
