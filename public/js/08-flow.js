"use strict";
/* [8a] engine luồng, [8b] nhóm FC, [8c] Fund Center, [8d] bảng kết quả — Org Builder. Các file js/ dùng chung state global, nạp theo thứ tự trong index.html. */
/* ============ [8] LUỒNG DUYỆT & ĐỊNH NGHĨA LUỒNG ============ */
/* [8a] Engine: ô = CBQLNS cố định, box vai trò chọn theo nhánh (Tất cả / VH / SM / BO / IT / KT / Còn lại),
   hoặc ngành dọc của CBQLNS (chế độ Ngành dọc). */
var flowViewByFc = false;                     // false = gộp theo nhóm (mặc định)
var refreshFlowResultSoon = debounce(function(){ renderFlowResult(); }, 150);

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
function renderFlow(){ renderGroups(); renderFcs(); updateGroupCounts(); renderFlowResult(); }

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
  code.oninput = function(){ snap('g:' + g.id + ':code'); g.code = code.value; patchGroupOptionLabels(g); refreshFlowResultSoon(); };
  td0.appendChild(code);

  var td1 = document.createElement('td');
  var inp = document.createElement('input'); inp.placeholder = t('phGrpName'); inp.value = g.name;
  inp.oninput = function(){ snap('g:' + g.id + ':name'); g.name = inp.value; patchGroupOptionLabels(g); refreshFlowResultSoon(); };
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
  selE.onchange = function(){ snap(null); g.cbqlns = selE.value || null; renderFlowResult(); };
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
    snap(null); g.byCig = !g.byCig;
    cig.textContent = g.byCig ? t('grpCigSplit') : t('grpCigAll');
    cig.classList.toggle('on', g.byCig);
    renderFlowResult();
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
  snap(null);
  var g = { id:'g' + (gseq++), code:'', name:'', cbqlns:null };
  fcGroups.push(g);
  var empty = $('grpEmpty'); if (empty) empty.remove();
  $('grpTbody').appendChild(groupRow(g));                      // append 1 hàng, không đập cả bảng
  updateGroupCounts();
  renderFlowResult();
}
function delGroup(g, rowEl){
  snap(null);
  fcGroups = fcGroups.filter(function(x){ return x !== g; });
  fcs.forEach(function(f){ if (f.groupId === g.id) f.groupId = null; });
  if (rowEl) rowEl.remove();
  document.querySelectorAll('#fcTbody select').forEach(function(s){   // dòng FC đang thuộc nhóm này -> về "Không"
    if (s.value === g.id) fillGroupSelect(s, null, false);
  });
  if (!fcGroups.length) renderGroups();
  updateGroupCounts();
  renderFlowResult();
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
  code.oninput = function(){ snap('fc:'+f.id+':code'); f.code = code.value; refreshFlowResultSoon(); };
  td1.appendChild(code);
  var td2 = document.createElement('td');
  var name = document.createElement('input'); name.placeholder = t('phName'); name.value = f.name;
  name.oninput = function(){ snap('fc:'+f.id+':name'); f.name = name.value; refreshFlowResultSoon(); };
  td2.appendChild(name);
  var td3 = document.createElement('td');
  var selE = document.createElement('select');
  fillGroupSelect(selE, f.groupId, false);
  selE.onmousedown = selE.onfocus = function(){ if (selE.options.length !== fcGroups.length + 1) fillGroupSelect(selE, f.groupId, true); };
  selE.onblur = function(){ fillGroupSelect(selE, f.groupId, false); };
  selE.onchange = function(){ snap(null); f.groupId = selE.value || null; updateGroupCounts(); renderFlowResult(); };
  td3.appendChild(selE);
  var td4 = document.createElement('td');
  var del = document.createElement('button'); del.className='danger'; del.textContent='✕';
  del.title = t('tipDelFc');
  del.onclick = function(){ snap(null); fcs = fcs.filter(function(x){ return x !== f; }); tr.remove(); updateGroupCounts(); renderFlowResult(); };
  td4.appendChild(del);
  tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
  return tr;
}
function renderFcs(){
  var tb = $('fcTbody'); tb.innerHTML = '';
  fcs.forEach(function(f){ tb.appendChild(fcRow(f)); });
  applyFcFilter();
}
function addFc(){
  snap(null);
  var f = { id:'f' + (fseq++), code:'', name:'', groupId:null };
  fcs.push(f);
  $('fcTbody').appendChild(fcRow(f));                          // append 1 dòng
  updateGroupCounts();
  applyFcFilter();
  renderFlowResult();
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
// Dán nhóm FCG: Mã ⇥ Tên ⇥ Tên người CBQLNS (khớp person của box ★, không phân biệt hoa thường);
// trùng mã thì cập nhật dòng cũ thay vì tạo mới.
function importGrpPaste(txt){
  var lines = String(txt||'').split(/\r?\n/).filter(function(l){ return l.trim(); });
  if (!lines.length){ msg(t('msgNothingImport')); return; }
  if (isHeaderRow(lines[0])) lines.shift();
  if (!lines.length){ msg(t('msgNothingImport')); return; }
  snap(null);
  var starByPerson = {};
  starredNodes().forEach(function(n){
    if (n.person) starByPerson[n.person.trim().toLowerCase()] = n.id;
  });
  var byCode = {};
  fcGroups.forEach(function(g){ if (g.code) byCode[g.code.trim().toLowerCase()] = g; });
  var nG = 0, nUp = 0;
  lines.forEach(function(l){
    var c = l.split('\t');
    var code = (c[0]||'').trim(), name = (c[1]||'').trim(), person = (c[2]||'').trim();
    if (!code && !name) return;
    var cb = person ? (starByPerson[person.toLowerCase()] || null) : null;
    var ex = code ? byCode[code.toLowerCase()] : null;
    if (ex){                                        // trùng mã -> cập nhật tên/CBQLNS
      ex.name = name || ex.name;
      if (cb) ex.cbqlns = cb;
      nUp++;
    } else {
      var g = { id:'g'+(gseq++), code:code, name:name, cbqlns:cb, byCig:false };
      fcGroups.push(g);
      if (code) byCode[code.toLowerCase()] = g;
      nG++;
    }
  });
  $('pasteTaGrp').value = ''; $('pasteBoxGrp').style.display = 'none';
  renderGroups(); renderFcs(); updateGroupCounts(); renderFlowResult();
  msg(tf('msgGrpImported', { n: nG, u: nUp }));
}
// Dán FC: Mã ⇥ Tên ⇥ Tên nhóm. Nhóm khớp theo tên (không phân biệt hoa thường), chưa có thì tạo mới.
function importPaste(txt){
  var lines = String(txt||'').split(/\r?\n/).filter(function(l){ return l.trim(); });
  if (!lines.length){ msg(t('msgNothingImport')); return; }
  if (isHeaderRow(lines[0])) lines.shift();
  if (!lines.length){ msg(t('msgNothingImport')); return; }
  snap(null);
  var byName = {};
  fcGroups.forEach(function(g){ byName[(g.name||'').trim().toLowerCase()] = g; });
  var nFc = 0, nG = 0;
  lines.forEach(function(l){
    var c = l.split('\t');
    var code = (c[0]||'').trim(), name = (c[1]||'').trim(), gn = (c[2]||'').trim();
    if (!code && !name) return;
    var gid = null;
    if (gn){
      var key = gn.toLowerCase();
      var g = byName[key];
      if (!g){ g = { id:'g'+(gseq++), code:'', name:gn, cbqlns:null }; fcGroups.push(g); byName[key] = g; nG++; }
      gid = g.id;
    }
    fcs.push({ id:'f'+(fseq++), code:code, name:name, groupId:gid });
    nFc++;
  });
  $('pasteTa').value = ''; $('pasteBox').style.display = 'none';
  renderGroups(); renderFcs(); updateGroupCounts(); renderFlowResult();
  msg(tf('msgImported', { n: nFc }) + (nG ? tf('msgImportedGroups', { g: nG }) : ''));
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
function renderFlowResult(){
  var host = $('flowResult'); host.innerHTML = '';
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
