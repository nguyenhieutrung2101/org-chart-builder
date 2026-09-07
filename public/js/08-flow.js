"use strict";
/* [8a] engine luồng, [8b] nhóm FC, [8c] Fund Center, [8d] bảng kết quả — Org Builder. Các file js/ dùng chung state global, nạp theo thứ tự trong index.html. */
/* ============ [8] LUỒNG DUYỆT & ĐỊNH NGHĨA LUỒNG ============ */
/* [8a] Engine: ô = CBQLNS cố định, box vai trò chọn theo nhánh (Tất cả / VH / SM / BO / IT / KT / Còn lại),
   hoặc ngành dọc của CBQLNS (chế độ Ngành dọc). */
var flowViewByFc = false;                     // false = gộp theo nhóm (mặc định)
// Gõ trong bảng nhóm/FC/CIG/box vai trò -> tính lại bảng kết quả sau khi ngừng gõ, chỉ khi tab Luồng duyệt đang mở
// (tab ẩn đã được snap() đánh dấu cũ, sẽ vẽ lúc mở)
var refreshFlowResultSoon = debounce(function(){ if (MOD === 'flow' && curTab === 'flow') renderFlowResult(); }, 150);

function starredNodes(){
  var out = [];
  nodes.forEach(function(n){ if (n.star) out.push(n); });
  return out;
}
function roleById(rid){
  if (rid === VLINE) return { id:VLINE, kind:'vline' };   // box cố định "Ngành dọc của CBQLNS"
  for (var i = 0; i < roleBoxes.length; i++) if (roleBoxes[i].id === rid) return roleBoxes[i];
  return null;
}
function roleBoxText(rb){                     // nội dung đầy đủ (nhiều dòng) cho ô kết quả
  if (!rb) return '—';
  if (rb.kind === 'vline') return t('vlineBoxName');
  if (rb.kind === 'node'){
    var n = nodes.get(rb.nodeId);
    return n ? roleText(n) : t('roleDeleted');
  }
  return [rb.title, rb.person].filter(Boolean).join('\n') || t('unnamed');
}
// {t: chức danh, p: người} — chip/palette chỉ hiện 2 thông tin cần thiết, không kèm khối/phòng
function rolePair(rb){
  if (!rb) return { t:'—', p:'' };
  if (rb.kind === 'vline') return { t: t('vlineBoxName'), p:'' };
  if (rb.kind === 'node'){
    var n = nodes.get(rb.nodeId);
    return n ? { t: n.title || n.dept || t('emptyBox'), p: n.person || '' }
             : { t: t('roleDeleted'), p:'' };
  }
  return { t: rb.title || t('unnamed'), p: rb.person || '' };
}
function roleBoxName(rb){ return rolePair(rb).t; }
// Nhánh của CBQLNS: đi ngược tổ tiên, gặp cờ nhánh nào trước thì thuộc nhánh đó; không gặp -> 'REST'
function segmentOf(cb){
  var a = cb;
  while (a){
    if (a.br && BRANCHES.indexOf(a.br) >= 0) return a.br;
    a = a.parent ? nodes.get(a.parent) : null;
  }
  return 'REST';
}
// Box vai trò "từ sơ đồ" có tick "cấp dưới tự PD" và CBQLNS nằm trong cây con của nó
// -> chính CBQLNS ký thay ở ô đó (vd luồng Vàng: người dưới MCEO tự PD, khỏi đẩy lên MCEO).
function pdDelegated(rb, cb){
  return !!(rb && rb.kind === 'node' && rb.pdBelow && cb &&
            rb.nodeId && nodes.has(rb.nodeId) && isAncestor(rb.nodeId, cb.id));
}
// Nội dung một ô của bảng luồng duyệt
function resolveCell(flow, col, seg, cb, grid){
  grid = grid || gridFor('');
  if (FIXED_CBQLNS[flow] === col)
    return cb ? roleText(cb) + (cb.star ? '' : t('starRemoved')) : t('noCbqlns');
  var asg = (grid[flow] || {})[col];
  if (!asg) return '—';
  var rid = asg.ALL || asg[seg];
  if (!rid) return '—';
  if (rid === VLINE){                              // ngành dọc: tra cấp trên của CBQLNS trên cây tab 2
    if (!cb) return t('noCbqlns');
    var sup = vlineSuperiorOf(cb);
    if (!sup) return t('noVlineDef');
    var dv = vdisp(sup);
    return [dv.title || dv.dept, dv.person].filter(Boolean).join('\n') || t('emptyBox');
  }
  var rb = roleById(rid);
  if (pdDelegated(rb, cb)) return roleText(cb) + t('pdDelegatedNote');
  return roleBoxText(rb);
}

// renderFlow: dựng lại TOÀN BỘ tab (dùng khi đổi tab / undo / mở file / thay đổi từ tab Sơ đồ).
// Các thao tác lẻ bên trong tab dùng cập nhật ĐÍCH DANH ở dưới, không gọi hàm này.
function renderFlow(animate){ renderGroups(); renderFcs(); updateGroupCounts(); renderFlowResult(animate); }

/* ---------- [8b] NHÓM FC — bảng Mã FCG / Tên / CBQLNS, cập nhật đích danh ---------- */
function groupLabel(g){ return (g.code ? g.code + ' · ' : '') + (g.name || t('groupUnnamed')); }
function groupOption(g){
  var o = document.createElement('option');
  o.value = g.id; o.textContent = groupLabel(g);
  return o;
}
// Dropdown nhóm của một dòng FC. Bình thường chỉ chứa "Không" + nhóm đang chọn (DOM = F + G thay vì F × G —
// 2.000 FC × 50 nhóm từng sinh 100.000 option, render 2,4 s); focus/mousedown mới nạp đủ danh sách, blur gọn lại.
// Nhờ vậy thêm nhóm không phải bơm option vào từng dropdown nữa.
function fillGroupSelect(sel, groupId, full){
  sel.innerHTML = '';
  var o0 = document.createElement('option'); o0.value = ''; o0.textContent = t('optNoGroup');
  sel.appendChild(o0);
  fcGroups.forEach(function(g){ if (full || g.id === groupId) sel.appendChild(groupOption(g)); });
  sel.value = groupId || '';
}
// Sửa mã/tên nhóm -> vá NHÃN option trong những select của bảng FC đang chứa nhóm đó
function patchGroupOptionLabels(g){
  document.querySelectorAll('#fcTbody select option[value="' + g.id + '"]').forEach(function(o){
    o.textContent = groupLabel(g);
  });
}
// Một nhóm = một hàng bảng — cùng ngôn ngữ thiết kế với bảng Fund Center
function groupRow(g){
  var tr = document.createElement('tr'); tr.dataset.gid = g.id;

  var td0 = document.createElement('td');
  var code = document.createElement('input'); code.placeholder = t('phFcg'); code.value = g.code || '';
  var patch = function(){ patchGroupOptionLabels(g); refreshFlowResultSoon(); };
  code.oninput = function(){ mutate('g:' + g.id + ':code', function(){ g.code = code.value; }, patch); };
  td0.appendChild(code);

  var td1 = document.createElement('td');
  var inp = document.createElement('input'); inp.placeholder = t('phGrpName'); inp.value = g.name;
  inp.oninput = function(){ mutate('g:' + g.id + ':name', function(){ g.name = inp.value; }, patch); };
  td1.appendChild(inp);

  var td2 = document.createElement('td');
  var selE = document.createElement('select');
  var o0 = document.createElement('option'); o0.value=''; o0.textContent = t('optNoCbqlns');
  selE.appendChild(o0);
  var stars = starredNodes();
  if (g.cbqlns && nodes.has(g.cbqlns) && !nodes.get(g.cbqlns).star) stars.push(nodes.get(g.cbqlns));
  stars.forEach(function(n){
    var o = document.createElement('option');
    o.value = n.id;
    o.textContent = (n.star ? '★ ' : t('optStarRemoved')) + dispName(n) + (n.person ? ' — ' + n.person : '');
    selE.appendChild(o);
  });
  selE.value = g.cbqlns || '';
  selE.onchange = function(){ mutate(null, function(){ g.cbqlns = selE.value || null; }, renderFlowResult); };
  td2.appendChild(selE);

  var td3 = document.createElement('td');
  var cnt = document.createElement('span'); cnt.className='gcnt'; cnt.id = 'gcnt_' + g.id;
  td3.appendChild(cnt);

  // Toggle trình bày bảng kết quả: 1 dòng chung cho mọi CIG, hay tách dòng theo từng CIG
  var tdC = document.createElement('td');
  var cig = document.createElement('button'); cig.className = 'cigTgl' + (g.byCig ? ' on' : '');
  cig.textContent = g.byCig ? t('grpCigSplit') : t('grpCigAll');
  cig.title = t('tipGrpCig');
  cig.onclick = function(){
    mutate(null, function(){ g.byCig = !g.byCig; }, function(){
      cig.textContent = g.byCig ? t('grpCigSplit') : t('grpCigAll');
      cig.classList.toggle('on', g.byCig);
      renderFlowResult();
    });
  };
  tdC.appendChild(cig);

  var td4 = document.createElement('td');
  var del = document.createElement('button'); del.className='danger'; del.textContent='✕';
  del.title = t('tipDelGroup');
  del.onclick = function(){ delGroup(g, tr); };
  td4.appendChild(del);

  tr.appendChild(td0); tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
  tr.appendChild(tdC); tr.appendChild(td4);
  return tr;
}
function renderGroups(){
  var tb = $('grpTbody'); tb.innerHTML = '';
  if (!fcGroups.length){
    tb.innerHTML = '<tr id="grpEmpty"><td colspan="6" class="dash">' + t('grpEmpty') + '</td></tr>';
    return;
  }
  fcGroups.forEach(function(g){ tb.appendChild(groupRow(g)); });
  applyGrpFilter();
}
function addGroup(){
  var g = { id:'g' + (gseq++), code:'', name:'', cbqlns:null, byCig:false };   // cùng hình dạng với applyState/mergeGroupRows
  mutate(null, function(){ fcGroups.push(g); }, function(){
    var empty = $('grpEmpty'); if (empty) empty.remove();
    $('grpTbody').appendChild(groupRow(g));                    // append 1 hàng, không đập cả bảng
    updateGroupCounts();
    renderFlowResult();
  });
}
function delGroup(g, rowEl){
  mutate(null, function(){
    fcGroups = fcGroups.filter(function(x){ return x !== g; });
    fcs.forEach(function(f){ if (f.groupId === g.id) f.groupId = null; });
  }, function(){
    if (rowEl) rowEl.remove();
    document.querySelectorAll('#fcTbody select').forEach(function(s){   // dòng FC đang thuộc nhóm này -> về "Không"
      if (s.value === g.id) fillGroupSelect(s, null, false);
    });
    if (!fcGroups.length) renderGroups();
    updateGroupCounts();
    renderFlowResult();
  });
}
function applyGrpFilter(){
  var qy = ($('grpFilter').value || '').toLowerCase();
  var byId = new Map(fcGroups.map(function(g){ return [g.id, g]; }));
  document.querySelectorAll('#grpTbody tr[data-gid]').forEach(function(tr){
    var g = byId.get(tr.dataset.gid);
    if (!g) return;
    var hay = ((g.code || '') + ' ' + (g.name || '')).toLowerCase();
    tr.style.display = (!qy || hay.indexOf(qy) >= 0) ? '' : 'none';
  });
}
function updateGroupCounts(){
  var cnt = {};
  fcs.forEach(function(f){ if (f.groupId) cnt[f.groupId] = (cnt[f.groupId]||0) + 1; });
  fcGroups.forEach(function(g){
    var s = $('gcnt_' + g.id);
    if (s) s.textContent = (cnt[g.id]||0) + ' FC';
  });
  $('grpCount').textContent = '(' + fcGroups.length + ')';
  $('fcCount').textContent = '(' + fcs.length + ')';
}

/* ---------- [8c] FUND CENTER — bảng + lọc + dán từ Excel ---------- */
function fcRow(f){
  var tr = document.createElement('tr'); tr.dataset.fcid = f.id;
  var td1 = document.createElement('td');
  var code = document.createElement('input'); code.placeholder = t('phCode'); code.value = f.code;
  code.oninput = function(){ mutate('fc:'+f.id+':code', function(){ f.code = code.value; }, refreshFlowResultSoon); };
  td1.appendChild(code);
  var td2 = document.createElement('td');
  var name = document.createElement('input'); name.placeholder = t('phName'); name.value = f.name;
  name.oninput = function(){ mutate('fc:'+f.id+':name', function(){ f.name = name.value; }, refreshFlowResultSoon); };
  td2.appendChild(name);
  var td3 = document.createElement('td');
  var selE = document.createElement('select');
  fillGroupSelect(selE, f.groupId, false);
  selE.onmousedown = selE.onfocus = function(){ if (selE.options.length !== fcGroups.length + 1) fillGroupSelect(selE, f.groupId, true); };
  selE.onblur = function(){ fillGroupSelect(selE, f.groupId, false); };
  selE.onchange = function(){ mutate(null, function(){ f.groupId = selE.value || null; }, function(){ updateGroupCounts(); renderFlowResult(); }); };
  td3.appendChild(selE);
  var td4 = document.createElement('td');
  var del = document.createElement('button'); del.className='danger'; del.textContent='✕';
  del.title = t('tipDelFc');
  del.onclick = function(){ delFc(f, tr); };
  td4.appendChild(del);
  tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
  return tr;
}
function renderFcs(){
  var tb = $('fcTbody'); tb.innerHTML = '';
  fcs.forEach(function(f){ tb.appendChild(fcRow(f)); });
  applyFcFilter();
}
function delFc(f, rowEl){
  mutate(null, function(){ fcs = fcs.filter(function(x){ return x !== f; }); }, function(){ if (rowEl) rowEl.remove(); updateGroupCounts(); renderFlowResult(); });
}
function addFc(){
  var f = { id:'f' + (fseq++), code:'', name:'', groupId:null };
  mutate(null, function(){ fcs.push(f); }, function(){
    $('fcTbody').appendChild(fcRow(f));                        // append 1 dòng
    updateGroupCounts();
    applyFcFilter();
    renderFlowResult();
  });
}
function applyFcFilter(){
  var qy = ($('fcFilter').value || '').toLowerCase();
  var gname = {};
  fcGroups.forEach(function(g){ gname[g.id] = (g.name||'').toLowerCase(); });
  var byId = new Map(fcs.map(function(f){ return [f.id, f]; }));
  document.querySelectorAll('#fcTbody tr').forEach(function(tr){
    var f = byId.get(tr.dataset.fcid);
    if (!f) return;
    var hay = (f.code + ' ' + f.name + ' ' + (f.groupId ? (gname[f.groupId]||'') : '')).toLowerCase();
    tr.style.display = (!qy || hay.indexOf(qy) >= 0) ? '' : 'none';
  });
}
// Dòng tiêu đề khi dán từ Excel: ô đầu khớp đúng nhãn header mà nút Copy của app xuất ra (cả 2 ngôn ngữ),
// hoặc là từ chung "Mã"/"Ma"/"Code"/"FC"/"FCG" đứng riêng. KHÔNG được bắt nhầm mã thật dạng FCG01.
// Lưu ý: không dùng \b sau chữ có dấu — \b của JS chỉ hiểu ASCII nên "mã\b" không bao giờ khớp "Mã FCG".
function isHeaderRow(line){
  var first = (String(line||'').split('\t')[0]||'').trim().toLowerCase();
  if (!first) return false;
  var labels = [];
  ['thFcgCode','thFcCode'].forEach(function(k){ labels.push(STR.vi[k].toLowerCase(), STR.en[k].toLowerCase()); });
  if (labels.indexOf(first) >= 0) return true;
  return /^(mã|ma|code|fcg?)(\s|$)/.test(first);
}
/* ---------- dán từ Excel: tách dòng (thuần) -> gộp vào state (thuần) -> vỏ DOM ---------- */
// Tách text dán thành mảng dòng × ô đã trim, bỏ dòng tiêu đề nếu có. Thuần — test Node gọi trực tiếp.
function parsePaste(txt){
  var lines = String(txt||'').split(/\r?\n/).filter(function(l){ return l.trim(); });
  if (lines.length && isHeaderRow(lines[0])) lines.shift();
  return lines.map(function(l){ return l.split('\t').map(function(c){ return c.trim(); }); });
}
function normKey(v){ return String(v || '').trim().toLowerCase(); }
// key chuẩn hoá -> MẢNG mục trùng key. Chỉ tự gán khi đúng một mục; trùng thì để trống và báo — không còn "mục sau đè mục trước"
// (cùng một người kiêm nhiệm hai box ★, hai nhóm cùng tên: gán nhầm người duyệt mà không ai biết nguy hiểm hơn để trống).
function multiIndex(list, keyFn){
  var m = {};
  list.forEach(function(x){ var k = normKey(keyFn(x)); if (k) (m[k] = m[k] || []).push(x); });
  return m;
}
// Gộp dòng FCG (Mã ⇥ Tên ⇥ Tên người CBQLNS) vào fcGroups. Trùng mã -> cập nhật dòng cũ; CBQLNS khớp tên người của box ★,
// chỉ gán khi duy nhất. Trả về { added, updated, notes[] } — notes = dòng cần người xem lại.
function mergeGroupRows(rows){
  var st = { added:0, updated:0, notes:[] };
  var starByPerson = multiIndex(starredNodes(), function(n){ return n.person; });
  var byCode = multiIndex(fcGroups, function(g){ return g.code; });
  rows.forEach(function(c){
    var code = c[0] || '', name = c[1] || '', person = c[2] || '';
    if (!code && !name) return;
    var cb = null;
    if (person){
      var hits = starByPerson[normKey(person)] || [];
      if (hits.length === 1) cb = hits[0].id;
      else st.notes.push(hits.length ? tf('impAmbCb', { name:person, n:hits.length }) : tf('impNoCb', { name:person }));
    }
    var ex = code ? (byCode[normKey(code)] || []) : [];
    if (ex.length > 1){ st.notes.push(tf('impAmbCode', { code:code, n:ex.length })); return; }
    if (ex.length === 1){ ex[0].name = name || ex[0].name; if (cb) ex[0].cbqlns = cb; st.updated++; }
    else {
      var g = { id:'g'+(gseq++), code:code, name:name, cbqlns:cb, byCig:false };
      fcGroups.push(g);
      if (code) byCode[normKey(code)] = [g];
      st.added++;
    }
  });
  return st;
}
// Gộp dòng FC (Mã ⇥ Tên ⇥ Tên nhóm ⇥ [Mã nhóm]) vào fcs. Nhóm tìm theo MÃ trước (cột 4, rồi cột 3), không có thì theo tên,
// chỉ gán khi duy nhất; chưa có thì tạo; trùng -> FC để không nhóm và báo. Trả về { added, groups, notes[] }.
function mergeFcRows(rows){
  var st = { added:0, groups:0, notes:[] };
  var byCode = multiIndex(fcGroups, function(g){ return g.code; }), byName = multiIndex(fcGroups, function(g){ return g.name; });
  function hits(ref){ var k = normKey(ref); if (!k) return []; var h = byCode[k] || []; return h.length ? h : (byName[k] || []); }
  rows.forEach(function(c){
    var code = c[0] || '', name = c[1] || '', gName = c[2] || '', gCode = c[3] || '';
    if (!code && !name) return;
    var h = gCode ? hits(gCode) : [];
    if (!h.length && gName) h = hits(gName);
    var g = null;
    if (h.length === 1) g = h[0];
    else if (h.length > 1) st.notes.push(tf('impAmbGrp', { name:gCode || gName, n:h.length }));
    else if (gName || gCode){
      g = { id:'g'+(gseq++), code:gCode, name:gName || gCode, cbqlns:null, byCig:false };
      fcGroups.push(g); st.groups++;
      if (gCode) byCode[normKey(gCode)] = [g];
      if (gName) byName[normKey(gName)] = [g];
    }
    fcs.push({ id:'f'+(fseq++), code:code, name:name, groupId: g ? g.id : null });
    st.added++;
  });
  return st;
}
// Đuôi thông báo sau khi dán: số dòng cần xem lại + tối đa 3 lý do đầu
function importNotes(st){
  if (!st.notes.length) return '';
  return ' · ' + tf('msgImportNotes', { n: st.notes.length }) + st.notes.slice(0, 3).join('; ') + (st.notes.length > 3 ? '; …' : '');
}
function importGrpPaste(txt){
  var rows = parsePaste(txt);
  if (!rows.length){ msg(t('msgNothingImport')); return; }
  var st = mutate(null, function(){ return mergeGroupRows(rows); });
  $('pasteTaGrp').value = ''; $('pasteBoxGrp').style.display = 'none';
  msg(tf('msgGrpImported', { n: st.added, u: st.updated }) + importNotes(st));
}
function importPaste(txt){
  var rows = parsePaste(txt);
  if (!rows.length){ msg(t('msgNothingImport')); return; }
  var st = mutate(null, function(){ return mergeFcRows(rows); });
  $('pasteTa').value = ''; $('pasteBox').style.display = 'none';
  msg(tf('msgImported', { n: st.added }) + (st.groups ? tf('msgImportedGroups', { g: st.groups }) : '') + importNotes(st));
}
// TSV của hai bảng nhập liệu cho nút Copy — cùng cột với định dạng dán, nên copy ở app này rồi dán lại vẫn khớp đúng nhóm (theo mã)
function groupsTsv(){
  var lines = [ [t('thFcgCode'), t('thGrpName'), t('thCbqlns')].map(q).join('\t') ];
  fcGroups.forEach(function(g){
    var cb = cbqlnsOf(g);
    lines.push([g.code || '', g.name || '', cb ? (cb.person || dispName(cb)) : ''].map(q).join('\t'));
  });
  return lines.join('\n');
}
function fcsTsv(){
  var byId = new Map(fcGroups.map(function(g){ return [g.id, g]; }));
  var lines = [ [t('thFcCode'), t('thFcName'), t('thFcGroup'), t('thFcgCode')].map(q).join('\t') ];
  fcs.forEach(function(f){
    var g = byId.get(f.groupId);
    lines.push([f.code || '', f.name || '', g ? (g.name || '') : '', g ? (g.code || '') : ''].map(q).join('\t'));
  });
  return lines.join('\n');
}

/* ---------- [8d] BẢNG KẾT QUẢ — gộp theo nhóm / bung theo FC ---------- */
// CBQLNS của nhóm: box ★ trên sơ đồ (null nếu box đã bị xoá)
function cbqlnsOf(g){
  return (g && g.cbqlns && nodes.has(g.cbqlns)) ? nodes.get(g.cbqlns) : null;
}
// Luồng duyệt là hàm của NHÓM (mọi FC cùng nhóm chung một luồng),
// nên mặc định gộp theo nhóm. Nhóm bật "theo CIG" -> nhân bản block cho từng CIG với grid riêng.
function flowBlocks(){
  var blocks = [];
  function segLine(cb){ return t('lineBranch') + segLabel(segmentOf(cb)); }
  function pushSplit(baseHead, cb, byCig){
    if (byCig && cigs.length){
      cigs.forEach(function(c){
        blocks.push({ head: baseHead + '\n' + t('lineCig') + (c.code || t('groupUnnamed')),
                      cb: cb, seg: segmentOf(cb), grid: gridFor(c.id) });
      });
    } else {
      blocks.push({ head: baseHead, cb: cb, seg: segmentOf(cb), grid: gridFor('') });
    }
  }
  if (!flowViewByFc){
    var codesByGroup = new Map();                 // gom mã FC theo nhóm 1 lượt, thay vì lọc lại cho mỗi nhóm
    fcs.forEach(function(f){
      if (!f.groupId) return;
      if (!codesByGroup.has(f.groupId)) codesByGroup.set(f.groupId, []);
      codesByGroup.get(f.groupId).push(f.code || t('noCode'));
    });
    fcGroups.forEach(function(g){
      var cb = cbqlnsOf(g);
      var codes = codesByGroup.get(g.id) || [];
      var head = groupLabel(g)
        + '\n' + t('lineCbqlns') + (cb ? (cb.person || dispName(cb)) : t('unassigned'))
        + '\n' + segLine(cb)
        + '\nFC: ' + (codes.length ? codes.join(', ') : t('noFc'));
      pushSplit(head, cb, g.byCig);
    });
  } else {
    var groupById = new Map(fcGroups.map(function(g){ return [g.id, g]; }));
    fcs.forEach(function(f){
      var g  = groupById.get(f.groupId) || null;
      var cb = cbqlnsOf(g);
      var head = (f.code || t('noCodeLong')) + '\n' + (f.name || '')
        + '\n' + (g ? (t('lineGroup') + groupLabel(g)) : t('optNoGroup'))
        + '\n' + segLine(cb);
      pushSplit(head, cb, g && g.byCig);
    });
  }
  return blocks;
}
// animate=true: 30 dòng đầu nổi lên so le — khi tab vừa mở lại với dữ liệu mới (renderTab) hoặc đổi cách xem;
// render lại trong lúc đang xem (gõ, đổi CBQLNS) thì không.
function renderFlowResult(animate){
  var host = $('flowResult'); host.innerHTML = '';
  var stagger = !!animate, ri = 0;
  if (!fcs.length && !fcGroups.length){
    host.innerHTML = '<div class="hint">' + t('flowEmptyHint') + '</div>';
    return;
  }
  var cols = COLS, order = RESULT_ORDER, colors = FLOW_COLORS;

  var sc = document.createElement('div'); sc.className = 'scrollTbl resScroll';   // header freeze khi cuộn
  var tb = document.createElement('table');
  tb.style.tableLayout = 'fixed';
  tb.style.width = '100%';
  var cg = document.createElement('colgroup');                  // cột chia %, không cuộn ngang
  var c0 = document.createElement('col'); c0.style.width = '19%'; cg.appendChild(c0);
  var c1 = document.createElement('col'); c1.style.width = '8%'; cg.appendChild(c1);
  var stepW = (73 / cols.length).toFixed(3) + '%';
  cols.forEach(function(){ var c = document.createElement('col'); c.style.width = stepW; cg.appendChild(c); });
  tb.appendChild(cg);

  var tr = document.createElement('tr');
  [ flowViewByFc ? t('colFundCenter') : t('colGroupFc'), t('colFlow') ]
    .concat(cols.map(colLabel)).forEach(function(h){
      var th = document.createElement('th'); th.textContent = h; tr.appendChild(th);
    });
  tb.appendChild(tr);

  flowBlocks().forEach(function(b, bi){
    order.forEach(function(flow, idx){
      var trr = document.createElement('tr');
      if (stagger && ri < 30){ trr.className = 'rise'; trr.style.animationDelay = (ri * 20) + 'ms'; }
      ri++;
      trr.dataset.blk = bi;                       // đánh dấu block để lọc theo tên nhóm/FC
      trr.dataset.hay = b.head.toLowerCase();
      if (idx === 0){
        var tdf = document.createElement('td');
        tdf.rowSpan = order.length;
        tdf.textContent = b.head;
        trr.appendChild(tdf);
      }
      var tdl = document.createElement('td');
      var dot = document.createElement('span'); dot.className='fdot';
      dot.style.background = colors[flow] || '#ccc';
      tdl.appendChild(dot); tdl.appendChild(document.createTextNode(flowLabel(flow)));
      trr.appendChild(tdl);
      cols.forEach(function(c){
        var td = document.createElement('td');
        var txt = resolveCell(flow, c, b.seg, b.cb, b.grid);
        td.textContent = txt;
        if (txt === '—') td.className = 'dash';
        trr.appendChild(td);
      });
      tb.appendChild(trr);
    });
  });

  // Ở chế độ gộp nhóm: FC chưa gán nhóm được liệt kê 1 dòng nhắc (không tính được luồng)
  if (!flowViewByFc){
    var un = fcs.filter(function(f){ return !f.groupId; });
    if (un.length){
      var trU = document.createElement('tr');
      var tdU = document.createElement('td');
      tdU.colSpan = cols.length + 2;
      tdU.textContent = t('unassignedRow')
        + un.map(function(f){ return f.code || t('noCode'); }).join(', ');
      tdU.className = 'dash';
      trU.appendChild(tdU); tb.appendChild(trU);
    }
  }
  sc.appendChild(tb); host.appendChild(sc);
  applyResFilter();                                // giữ nguyên từ khoá đang lọc sau khi render lại
}
// Lọc bảng kết quả theo tên nhóm / mã / tên Fund Center — ẩn nguyên block, không chỉ 1 dòng
function applyResFilter(){
  var inp = $('resFilter'); if (!inp) return;
  var qy = (inp.value || '').trim().toLowerCase();
  document.querySelectorAll('#flowResult tr[data-blk]').forEach(function(tr){
    tr.classList.toggle('hideRow', !!qy && tr.dataset.hay.indexOf(qy) < 0);
  });
}
function flowTsv(){
  var lines = [ [ flowViewByFc ? t('colFundCenter') : t('colGroupFc'), t('colFlow') ]
    .concat(COLS.map(colLabel)).map(q).join('\t') ];
  flowBlocks().forEach(function(b){
    RESULT_ORDER.forEach(function(flow){
      var cells = [ b.head, flowLabel(flow) ].concat(COLS.map(function(c){
        return resolveCell(flow, c, b.seg, b.cb, b.grid);
      }));
      lines.push(cells.map(q).join('\t'));
    });
  });
  return lines.join('\n');
}
function copyFlowTable(){
  if (!fcs.length && !fcGroups.length){ msg(t('msgNothingCopy')); return; }
  copyText(flowTsv(), tf('msgCopiedFlow', { view: flowViewByFc ? t('viewByFcWord') : t('viewByGroupWord') }));
}
