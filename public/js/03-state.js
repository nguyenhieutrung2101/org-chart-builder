"use strict";
/* [2] State toàn cục + Undo (Ctrl+Z) + cờ dirty + serialize — Org Builder. Các file js/ dùng chung state global, nạp theo thứ tự trong index.html. */
/* ============ [2] STATE + UNDO + DIRTY ============ */
var nodes    = new Map();
var rootIds  = [];
var sel      = null;
var focusId  = null;
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
function curGrid(){ var f = gridFamily(); return f[curCig] || (f[curCig] = {}); }
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
  return { page:'A4', orient:'L', font:'app', scheme:'pastel', header:'',
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

function serializeAll(){
  return { v:SCHEMA_V, roots:rootIds.map(ser),
           fcGroups:fcGroups, fcs:fcs, roleBoxes:roleBoxes, ruleGrids:ruleGrids,
           vlineGrids:vlineGrids, ruleMode:ruleMode, vroots:vroots.map(vser),
           cigs:cigs, doc:doc };
}
function snap(key){
  if (key !== null && key === lastSnapKey) return;
  undoStack.push(JSON.stringify(serializeAll()));
  if (undoStack.length > 60) undoStack.shift();
  lastSnapKey = key;
  dirty = true;
}
function undo(){
  if (!undoStack.length){ msg(t('msgNoUndo')); return; }
  try { applyState(JSON.parse(undoStack.pop())); }
  catch(e){ msg(t('msgUndoErr')); return; }
  lastSnapKey = null; dirty = true;
  renderAll(); msg(t('msgUndone'));
}
