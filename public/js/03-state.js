"use strict";
/* [2] State toàn cục + Undo (Ctrl+Z) + cờ dirty + serialize — Org Builder. Các file js/ dùng chung state global, nạp theo thứ tự trong index.html. */
/* ============ [2] STATE + UNDO + DIRTY ============ */
var nodes    = new Map();
var rootIds  = [];
var sel      = null;
var focusId  = null;
// Animation một lần cho phần tử sắp được render lại (box mới pop, box vừa chọn nháy, chip vừa thả "đáp"): renderer gọi takeAnim(id)
// và chỉ phần tử khớp id nhận class — render lại vì gõ phím không nháy lại.
var animNext = null;
function animNextBox(id, cls){ animNext = { id:id, cls:cls }; }
function takeAnim(id){ if (animNext && animNext.id === id){ var c = animNext.cls; animNext = null; return c; } return ''; }
var seq = 1, gseq = 1, fseq = 1;

var fcGroups = [];          // [{id, code, name, cbqlns}]
var fcs      = [];          // [{id, code, name, groupId}]

/* Ma trận luật (tab Định nghĩa luồng)
   - roleBoxes : box vai trò — kind 'free' (tự đặt chức danh/người) hoặc 'node' (link box trên Sơ đồ)
   - ruleGrids : luật theo scenario chi phí — ruleGrids[''] = "Chung", ruleGrids[cigId] = riêng cho CIG đó.
                 Mỗi grid: grid[luồng][cột] = {ALL:'r1'} hoặc {VH:'r1', REST:'r2'} (phạm vi theo nhánh)
   - Ô CBQLNS cố định theo FIXED_CBQLNS, không nằm trong grid                                     */
var FLOWS  = ['Xanh','Vàng','Đỏ','Tím','NNS'];          // thứ tự hàng trong tab Định nghĩa
var RESULT_ORDER = ['NNS','Tím','Đỏ','Vàng','Xanh'];    // thứ tự hàng trong bảng kết quả
var COLS   = ['TĐ1','TĐ2','TĐ3','TĐ4','TĐ*','PD'];
var FLOW_COLORS  = {'Xanh':'#A8D989','Vàng':'#FFD93D','Đỏ':'#F4645C','Tím':'#C3AEE8','NNS':'#6B8FE8'};
var FIXED_CBQLNS = {'Xanh':'PD','Vàng':'TĐ1','Đỏ':'TĐ1','Tím':'TĐ1','NNS':'TĐ1'};
// Nhánh đánh dấu trên sơ đồ (một loại gán được NHIỀU box — vd Vận hành bike + Vận hành car).
var BRANCHES = ['VH','SM','BO','IT','AC'];
var SCOPES   = ['ALL','VH','SM','BO','IT','AC','REST'];   // vòng xoay phạm vi trên chip ma trận
// Màu badge nhánh (khớp màu chip trong ma trận); nếu trùng màu nền box theo cấp -> đảo mực/màu
var BR_COLOR = {VH:'#6B8FE8', SM:'#A8D989', BO:'#FFB98A', IT:'#7ECEE0', AC:'#C3AEE8'};

var roleBoxes = [];
var VLINE = 'vline';             // id box cố định "Ngành dọc của CBQLNS" trong palette (không nằm trong roleBoxes)
var ruleMode  = 'flow';          // 'flow' = phân theo nhánh (chip phạm vi) | 'vline' = theo ngành dọc
var ruleGrids  = { '': {} };     // luật mode Luồng     — theo scenario CIG ('' = Chung)
var vlineGrids = { '': {} };     // luật mode Ngành dọc — cùng cấu trúc, mỗi ô 1 box {ALL:rid}
// Cây ngành dọc (tab Ngành dọc): node manual (tự gõ 3 trường) hoặc imported (orgId -> box ★ bên SĐTC,
// nội dung mirror trực tiếp). CBQLNS gắn dưới ai thì người đó là "ngành dọc" của họ.
var vnodes = new Map();
var vroots = [];
var vsel   = null;               // chọn trên tab Ngành dọc (view-state)
var vseq   = 1;
var curCig = '';                 // scenario đang sửa ở tab Định nghĩa ('' = Chung) — view-state, không lưu
var cigs = [];                   // [{id, code, name}] — nhóm chi phí (Commitment Item Group)
var rseq = 1, cseq = 1;
function gridFamily(){ return ruleMode === 'vline' ? vlineGrids : ruleGrids; }
function gridFor(cigId){ var f = gridFamily(); return f[cigId] || f['']; }  // CIG chưa có riêng -> Chung
// Grid của CIG đang chọn, CHỈ ĐỌC (renderer, kiểm tra chip). Không bao giờ tạo grid ở đây: bản cũ tạo {} rỗng ngay trong getter khi
// đổi mode, làm CIG mất fallback về Chung và người duyệt thành "—" — và renderer sửa document mà không có snapshot.
function curGrid(){ return gridFor(curCig); }
// Grid của CIG đang chọn để SỬA (gọi trong mutate): chưa có luật riêng thì chép từ Chung đúng lúc sửa lần đầu
function ownGrid(){ var f = gridFamily(); if (!f[curCig]) f[curCig] = JSON.parse(JSON.stringify(f[''] || {})); return f[curCig]; }
// Cây ngành dọc: serialize lồng nhau như roots; imported chỉ lưu orgId (nội dung mirror lúc render)
function vser(id){
  var n = vnodes.get(id);
  return { id:n.id, dept:n.dept, title:n.title, person:n.person,
           orgId: n.orgId || undefined, children:n.children.map(vser) };
}
// Node hiển thị của vnode: imported thì lấy trực tiếp từ box ★ bên SĐTC
function vdisp(n){
  if (n.orgId && nodes.has(n.orgId)){
    var o = nodes.get(n.orgId);
    return { dept:o.dept, title:o.title, person:o.person, star:o.star };
  }
  return { dept:n.dept, title:n.title, person:n.person, star:false };
}
// Ngành dọc của một CBQLNS (node ★ trên SĐTC): cha trực tiếp của vnode import tương ứng
function vlineSuperiorOf(cb){
  if (!cb) return null;
  var vn = null;
  vnodes.forEach(function(x){ if (x.orgId === cb.id && !vn) vn = x; });
  if (!vn || !vn.parent) return null;
  return vnodes.get(vn.parent);
}

// Bộ CIG mặc định cho tài liệu mới và cho file cũ chưa có khái niệm CIG (dùng chung với applyState)
function defaultCigs(){
  return [ {id:'c1', code:'CI-SM', name:'Chi phí Sales & Marketing'},
           {id:'c2', code:'CI-TE', name:'Chi phí Travel & Entertainment'},
           {id:'c3', code:'CI-OP', name:'Chi phí Vận hành'} ];
}
// Reset state luật cho tài liệu mới
function seedRules(){
  // Không nạp sẵn box vai trò hay luật nào — palette chỉ có box cố định "Ngành dọc của CBQLNS",
  // người dùng tự thêm box theo nhu cầu.
  roleBoxes = [];
  rseq = 1;
  ruleGrids  = { '': {} };
  vlineGrids = { '': {} };
  ruleMode = 'flow';
  curCig = '';
  cigs = defaultCigs();
  cseq = 4;
}

// Lớp trình bày của module "Trình bày sơ đồ" — không ảnh hưởng luồng duyệt
function defaultDoc(){
  return { page:'A4', orient:'L', autoH:false, font:'app', scheme:'classic', header:'', logo:'',
           code:{ code:'', date:'', author:'', reviewer:'', approver:'' },
           notes:[],
           show:{ legend:true, code:true, notes:true, hc:true, desc:true, fit:true } };
}
// Đọc lớp doc từ file: sai kiểu / thiếu -> mặc định (file cũ chưa có doc mở bình thường)
function cleanDoc(src){
  var d = defaultDoc();
  if (!src || typeof src !== 'object') return d;
  if (PAGE_MM[src.page]) d.page = src.page;
  if (src.orient === 'P' || src.orient === 'L') d.orient = src.orient;
  d.autoH = !!src.autoH;
  d.logo = typeof src.logo === 'string' ? src.logo.slice(0, 200000) : '';
  if (DOC_FONTS[src.font]) d.font = src.font;
  if (src.scheme === 'classic' || src.scheme === 'pastel') d.scheme = src.scheme;
  d.header = String(src.header || '');
  Object.keys(d.code).forEach(function(k){ if (src.code && src.code[k] != null) d.code[k] = String(src.code[k]); });
  if (Array.isArray(src.notes)) src.notes.forEach(function(n){
    if (n && typeof n === 'object') d.notes.push({ key:String(n.key || '').slice(0, 3), text:String(n.text || '') });
  });
  Object.keys(d.show).forEach(function(k){ if (src.show && typeof src.show[k] === 'boolean') d.show[k] = src.show[k]; });
  return d;
}
var doc = defaultDoc();

var undoStack = [], lastSnapKey = null, dirty = false;
// Tab của module Luồng duyệt đang "cũ" (dữ liệu đổi từ lần vẽ cuối). renderAll/refreshView chỉ vẽ tab đang mở;
// showTab vẽ tab cũ đúng lúc mở nó. mutate() đánh dấu tất cả khi commit vì mọi thay đổi dữ liệu đều đi qua đó.
var staleTabs = { org:true, vline:true, rules:true, flow:true };
function markStale(){ Object.keys(staleTabs).forEach(function(k){ staleTabs[k] = true; }); }

function serializeAll(){
  return { v:SCHEMA_V, roots:rootIds.map(ser),
           fcGroups:fcGroups, fcs:fcs, roleBoxes:roleBoxes, ruleGrids:ruleGrids,
           vlineGrids:vlineGrids, ruleMode:ruleMode, vroots:vroots.map(vser),
           cigs:cigs, doc:doc };
}
// Chụp snapshot cho Undo trước một thay đổi. key khác null = đang gõ liên tục vào cùng một ô: cả chuỗi gõ chỉ chụp một lần.
// dirty + cờ tab cũ đặt TRƯỚC khi quyết định gộp, vì thay đổi vẫn là thay đổi dù không chụp thêm snapshot
// (trước đây: Save rồi gõ tiếp đúng ô cũ -> gộp -> dirty vẫn false -> đóng tab không cảnh báo).
// CỬA DUY NHẤT cho mọi thay đổi dữ liệu — một transaction:
//   1. chụp JSON "trước"   2. chạy fn   3. kiểm tra bất biến   4. COMMIT: history (gộp khi gõ liên tục cùng một ô: key), dirty, cờ tab cũ
//   5. vẽ lại (after, mặc định renderAll; đang gõ thì truyền refreshView hoặc hàm vá nhẹ hơn).
// Lỗi ở bước 2/3 -> khôi phục đúng trạng thái trước; history CHƯA bị đụng (đẩy sau khi thành công, nên stack đầy 60 cũng không mất
// mốc cũ nhất), toast, ném lỗi tiếp để console/test thấy. fn không đổi gì (so JSON trước/sau) -> không ghi history, không dirty:
// một cú bấm không có tác dụng không thành một bước Undo. Lỗi trong after xảy ra SAU commit: không rollback. Trả về kết quả của fn.
function mutate(key, fn, after){
  var before = JSON.stringify(serializeAll()), r, bad;
  try { r = fn(); bad = checkInvariants(); }
  catch(e){ rollback(before); msg(t('msgMutateFail')); throw e; }
  if (bad.length){ rollback(before); msg(t('msgMutateFail')); throw new Error('invariants: ' + bad.join('; ')); }
  if (JSON.stringify(serializeAll()) !== before){
    if (key === null || key !== lastSnapKey){ undoStack.push(before); if (undoStack.length > 60) undoStack.shift(); }
    lastSnapKey = key; dirty = true; markStale();
  }
  (after || renderAll)();
  return r;
}
function rollback(before){ applyState(JSON.parse(before)); renderAll(); }   // dirty/history chưa đổi nên không cần phục hồi
function undo(){
  if (!undoStack.length){ msg(t('msgNoUndo')); return; }
  try { applyState(JSON.parse(undoStack.pop())); }
  catch(e){ msg(t('msgUndoErr')); return; }
  lastSnapKey = null; dirty = true;
  renderAll(); msg(t('msgUndone'));
}
// Bất biến dữ liệu — test gọi sau mỗi thao tác (và fuzz). Trả về danh sách vi phạm, rỗng = ổn.
// Cây: mỗi node đến được đúng một lần từ rootIds, parent/children khớp nhau, cấp con >= cấp cha, stack chỉ ở node có cha.
// Tham chiếu: focus, CBQLNS nhóm, nhóm của FC, box vai trò từ sơ đồ, ô luật -> box vai trò, grid -> CIG, node ngành dọc import -> box.
function checkInvariants(){
  var bad = [], seen = new Set();
  function walk(id, parent){
    var n = nodes.get(id);
    if (!n){ bad.push('missing node ' + id); return; }
    if (seen.has(id)){ bad.push('node reached twice ' + id); return; }
    seen.add(id);
    if (n.parent !== parent) bad.push('parent mismatch ' + id);
    if (parent && rnum(n.t) < rnum(nodes.get(parent).t)) bad.push('level below parent ' + id);
    if (n.stack && !parent) bad.push('stacked root ' + id);
    n.children.forEach(function(c){ walk(c, id); });
  }
  rootIds.forEach(function(r){ walk(r, null); });
  if (seen.size !== nodes.size) bad.push('unreachable nodes ' + (nodes.size - seen.size));
  if (focusId && !nodes.has(focusId)) bad.push('focus dangling');
  function uniq(list, label){ var s = new Set(list.map(function(x){ return x.id; })); if (s.size !== list.length) bad.push('duplicate ' + label + ' id'); return s; }
  var gids = uniq(fcGroups, 'group'), rids = uniq(roleBoxes, 'role'), cids = uniq(cigs, 'cig'); uniq(fcs, 'fc');
  fcGroups.forEach(function(g){ if (g.cbqlns && !nodes.has(g.cbqlns)) bad.push('group cbqlns dangling ' + g.id); });
  fcs.forEach(function(f){ if (f.groupId && !gids.has(f.groupId)) bad.push('fc group dangling ' + f.id); });
  roleBoxes.forEach(function(r){ if (r.kind === 'node' && !nodes.has(r.nodeId)) bad.push('role node dangling ' + r.id); });
  [ruleGrids, vlineGrids].forEach(function(fam){
    Object.keys(fam).forEach(function(k){
      if (k && !cids.has(k)) bad.push('grid for missing cig ' + k);
      FLOWS.forEach(function(fl){ COLS.forEach(function(c){
        var a = (fam[k][fl] || {})[c];
        if (a) SCOPES.forEach(function(s){ if (a[s] && a[s] !== VLINE && !rids.has(a[s])) bad.push('rule role dangling ' + a[s]); });
      }); });
    });
  });
  var vseen = new Set(), orgSeen = new Set();
  function vwalk(id, parent){
    var n = vnodes.get(id);
    if (!n){ bad.push('missing vnode ' + id); return; }
    if (vseen.has(id)){ bad.push('vnode reached twice ' + id); return; }
    vseen.add(id);
    if (n.parent !== parent) bad.push('vnode parent mismatch ' + id);
    if (n.orgId && !nodes.has(n.orgId)) bad.push('vnode org dangling ' + id);
    if (n.orgId){ if (orgSeen.has(n.orgId)) bad.push('org imported twice ' + n.orgId); orgSeen.add(n.orgId); }   // một box ★ chỉ có một cấp trên ngành dọc
    n.children.forEach(function(c){ vwalk(c, id); });
  }
  vroots.forEach(function(r){ vwalk(r, null); });
  if (vseen.size !== vnodes.size) bad.push('unreachable vnodes ' + (vnodes.size - vseen.size));
  return bad;
}
