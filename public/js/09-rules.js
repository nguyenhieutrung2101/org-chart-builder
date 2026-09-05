"use strict";
/* [8e] Tab Định nghĩa luồng: palette, ma trận, CIG, mode Luồng/Ngành dọc — Org Builder. Các file js/ dùng chung state global, nạp theo thứ tự trong index.html. */
/* ---------- [8e] TAB ĐỊNH NGHĨA LUỒNG — palette box vai trò + kéo-thả vào ma trận ---------- */
function usageCount(rid){                     // đếm trên mọi scenario, cả 2 chế độ Luồng/Ngành dọc
  var c = 0;
  [ruleGrids, vlineGrids].forEach(function(fam){
  Object.keys(fam).forEach(function(k){
    var grid = fam[k];
    FLOWS.forEach(function(fl){
      var row = grid[fl] || {};
      COLS.forEach(function(col){
        var a = row[col] || {};
        SCOPES.forEach(function(s){ if (a[s] === rid) c++; });
      });
    });
  });
  });
  return c;
}
function dropRole(flow, col, rid){
  if (FIXED_CBQLNS[flow] === col){ msg(t('msgCellFixed')); return; }
  if (!roleById(rid)) return;
  snap(null);
  var g = curGrid();
  var row = g[flow] || (g[flow] = {});
  if (ruleMode === 'vline'){                        // mode Ngành dọc: mỗi ô đúng 1 box, thả là thay
    row[col] = {ALL: rid};
    renderRules(); renderFlowResult(); return;
  }
  var a = row[col];
  if (!a || a.ALL){ row[col] = {ALL: rid}; return void (renderRules(), renderFlowResult()); }
  // đã có phạm vi riêng -> điền vào phạm vi còn trống đầu tiên; đầy hết thì thay bằng "Tất cả"
  var free = BRANCHES.concat('REST').filter(function(s){ return !a[s]; })[0];
  if (free) a[free] = rid; else row[col] = {ALL: rid};
  renderRules(); renderFlowResult();
}
function cycleScope(flow, col, scope){   // Tất cả -> Vận hành -> Kinh doanh -> Hỗ trợ -> Còn lại -> ...
  snap(null);
  var a = curGrid()[flow][col];
  var rid = a[scope];
  var next = SCOPES[(SCOPES.indexOf(scope) + 1) % SCOPES.length];
  // bỏ qua phạm vi đang bị box khác chiếm, tránh ghi đè
  var guard = 0;
  while (next !== 'ALL' && a[next] && a[next] !== rid && guard++ < SCOPES.length){
    next = SCOPES[(SCOPES.indexOf(next) + 1) % SCOPES.length];
  }
  delete a[scope];
  if (next === 'ALL'){ BRANCHES.concat('REST').forEach(function(s){ delete a[s]; }); a.ALL = rid; }
  else { delete a.ALL; a[next] = rid; }
  renderRules(); renderFlowResult();
}
function removeAssign(flow, col, scope){
  snap(null);
  var row = curGrid()[flow], a = row[col];
  delete a[scope];
  if (!SCOPES.some(function(s){ return a[s]; })) delete row[col];
  renderRules(); renderFlowResult();
}
function addFreeRole(){
  snap(null);
  roleBoxes.push({ id:'r' + (rseq++), kind:'free', title:'', person:'' });
  renderRules();
  var last = document.querySelector('#roleList .roleCard:last-child input');
  if (last) last.focus();
}
function addNodeRole(){
  var nid = $('rolePick').value;
  if (!nid || !nodes.has(nid)){ msg(t('msgPickBox')); return; }
  if (roleBoxes.some(function(r){ return r.kind === 'node' && r.nodeId === nid; })){
    msg(t('msgBoxExists')); return;
  }
  snap(null);
  roleBoxes.push({ id:'r' + (rseq++), kind:'node', nodeId:nid, pdBelow:false });
  renderRules();
}
function deleteRole(rb){
  var used = usageCount(rb.id);
  if (used && !confirm(tf('cfmDelRole', { name: roleBoxName(rb), n: used }))) return;
  snap(null);
  roleBoxes = roleBoxes.filter(function(x){ return x !== rb; });
  scrubRole(rb.id);
  renderRules(); renderFlowResult();
}
// Gỡ một box vai trò khỏi mọi ô luật (cả 2 chế độ, mọi scenario); trả về số ô đã gỡ
function scrubRole(rid){
  var n = 0;
  [ruleGrids, vlineGrids].forEach(function(fam){
    Object.keys(fam).forEach(function(k){
      var grid = fam[k];
      FLOWS.forEach(function(fl){
        var row = grid[fl]; if (!row) return;
        COLS.forEach(function(col){
          var a = row[col]; if (!a) return;
          SCOPES.forEach(function(s){ if (a[s] === rid){ delete a[s]; n++; } });
          if (!SCOPES.some(function(s){ return a[s]; })) delete row[col];
        });
      });
    });
  });
  return n;
}
// Box vai trò "từ sơ đồ" mà box gốc không còn: gỡ ngay lúc xóa box, khớp với việc applyState bỏ chúng khi mở file
// (trước đây luật "biến mất im lặng" sau khi lưu/mở lại). Trả về số box + số ô luật đã gỡ để báo người dùng.
function pruneNodeRoles(){
  var boxes = 0, cells = 0;
  roleBoxes = roleBoxes.filter(function(rb){
    if (rb.kind !== 'node' || nodes.has(rb.nodeId)) return true;
    boxes++; cells += scrubRole(rb.id);
    return false;
  });
  return { boxes: boxes, cells: cells };
}
// Gõ tên trong palette -> vá nhãn chip đích danh, không đập cả tab (giữ focus input)
function patchRoleChips(rb){
  var pr = rolePair(rb);
  document.querySelectorAll('#ruleTbody .chip[data-rid="' + rb.id + '"]').forEach(function(ch){
    ch.title = roleBoxText(rb);
    var cn = ch.querySelector('.cn'); if (cn) cn.textContent = pr.t;
    var cp = ch.querySelector('.cp');
    if (pr.p){
      if (!cp){ cp = document.createElement('div'); cp.className = 'cp'; ch.appendChild(cp); }
      cp.textContent = pr.p;
    } else if (cp) cp.remove();
  });
}
function chipEl(flow, col, scope, rid){
  var rb = roleById(rid), pr = rolePair(rb);
  var ch = document.createElement('div'); ch.className = 'chip' + (rid === VLINE ? ' vlineChip' : '');
  ch.dataset.rid = rid;
  var top = document.createElement('div'); top.className = 'chipTop';
  if (ruleMode !== 'vline'){                        // mode Ngành dọc không phân phạm vi -> ẩn nhãn
    var sc = document.createElement('span');
    sc.className = 'sc sc-' + scope;
    sc.textContent = segLabel(scope);
    sc.title = t('tipCycleScope');
    sc.onclick = function(){ cycleScope(flow, col, scope); };
    top.appendChild(sc);
  }
  var rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = '✕';
  rm.title = t('tipRemoveFromCell'); rm.onclick = function(){ removeAssign(flow, col, scope); };
  top.appendChild(rm);
  var cn = document.createElement('div'); cn.className = 'cn'; cn.textContent = pr.t;
  ch.title = roleBoxText(rb);
  ch.appendChild(top); ch.appendChild(cn);
  if (pr.p){ var cp = document.createElement('div'); cp.className = 'cp'; cp.textContent = pr.p; ch.appendChild(cp); }
  return ch;
}
/* --- CIG: danh sách nhóm chi phí + toggle scenario của ma trận --- */
function cigById(id){ return cigs.find(function(c){ return c.id === id; }) || null; }
function setCurCig(id){
  if (id && !cigById(id)) id = '';
  // lần đầu mở một CIG chưa có luật riêng -> chép từ "Chung" để chỉnh phần khác biệt
  var fam = gridFamily();
  if (id && !fam[id]){
    snap(null);
    fam[id] = JSON.parse(JSON.stringify(fam[''] || {}));
  }
  curCig = id;
  renderRules();
}
function setRuleMode(m){
  if (m === ruleMode) return;
  snap(null);
  ruleMode = m;
  renderRules(); renderFlowResult();
}
function renderModeToggle(){
  var bF = $('modeFlow'), bV = $('modeVline');
  if (!bF) return;
  bF.classList.toggle('active', ruleMode === 'flow');
  bV.classList.toggle('active', ruleMode === 'vline');
  var note = $('modeNote');
  if (note) note.textContent = ruleMode === 'vline' ? t('modeVlineNote') : '';
}
// Dựng lại nút sẽ làm nút đang bị nhấn "nảy" (nút mới chưa nhận :hover) — nên chỉ
// dựng khi danh sách CIG đổi; bấm chọn scenario chỉ đổi class .active tại chỗ.
function renderCigToggle(rebuild){
  var host = $('cigToggle'); if (!host) return;
  var ids = [''].concat(cigs.map(function(c){ return c.id; }));
  var cur = [].map.call(host.children, function(b){ return b.dataset.cig; });
  if (rebuild || cur.length !== ids.length || ids.some(function(id, i){ return cur[i] !== id; })){
    host.innerHTML = '';
    ids.forEach(function(id){
      var b = document.createElement('button');
      b.className = 'tabbtn'; b.dataset.cig = id;
      b.textContent = id ? ((cigById(id)||{}).code || t('groupUnnamed')) : t('scenCommon');
      b.onclick = function(){ setCurCig(id); };
      host.appendChild(b);
    });
  } else {
    [].forEach.call(host.children, function(b){                 // chỉ vá nhãn, giữ nguyên phần tử
      var id = b.dataset.cig;
      b.textContent = id ? ((cigById(id)||{}).code || t('groupUnnamed')) : t('scenCommon');
    });
  }
  [].forEach.call(host.children, function(b){
    b.classList.toggle('active', b.dataset.cig === curCig);
  });
  var note = $('scenNote');
  if (note) note.textContent = curCig
    ? (gridFamily()[curCig] ? tf('scenOwn', { code: (cigById(curCig)||{}).code || '' }) : '')
    : t('scenCommonNote');
}
function renderCigs(){
  var tb = $('cigTbody'); if (!tb) return;
  tb.innerHTML = '';
  cigs.forEach(function(c){
    var tr = document.createElement('tr');
    var td1 = document.createElement('td');
    var code = document.createElement('input'); code.value = c.code; code.placeholder = t('phCigCode');
    code.oninput = function(){ snap('cig:'+c.id+':code'); c.code = code.value; renderCigToggle(); refreshFlowResultSoon(); };
    td1.appendChild(code);
    var td2 = document.createElement('td');
    var name = document.createElement('input'); name.value = c.name; name.placeholder = t('phCigName');
    name.oninput = function(){ snap('cig:'+c.id+':name'); c.name = name.value; refreshFlowResultSoon(); };
    td2.appendChild(name);
    var td3 = document.createElement('td');
    var del = document.createElement('button'); del.className = 'danger'; del.textContent = '✕';
    del.title = t('tipDelCig');
    del.onclick = function(){
      snap(null);
      cigs = cigs.filter(function(x){ return x !== c; });
      delete ruleGrids[c.id]; delete vlineGrids[c.id]; // luật riêng của CIG đó bỏ theo (cả 2 chế độ)
      if (curCig === c.id) curCig = '';
      renderCigToggle(true); renderRules(); renderFlowResult();
    };
    td3.appendChild(del);
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
    tb.appendChild(tr);
  });
}
function addCig(){
  snap(null);
  cigs.push({ id:'c' + (cseq++), code:'', name:'' });
  renderCigs(); renderCigToggle(true);
  var last = document.querySelector('#cigTbody tr:last-child input');
  if (last) last.focus();
}

function renderRules(){
  renderModeToggle(); renderCigToggle(); renderCigs();
  var tb = $('ruleTbody'); tb.innerHTML = '';
  FLOWS.forEach(function(flow){
    var tr = document.createElement('tr');
    var td0 = document.createElement('td'); td0.className = 'flowName';
    var dot = document.createElement('span'); dot.className = 'fdot';
    dot.style.background = FLOW_COLORS[flow] || '#ccc';
    td0.appendChild(dot); td0.appendChild(document.createTextNode(flowLabel(flow)));
    tr.appendChild(td0);
    COLS.forEach(function(col){
      var td = document.createElement('td'); td.className = 'slot';
      if (FIXED_CBQLNS[flow] === col){
        var lk = document.createElement('div'); lk.className = 'chip locked';
        lk.textContent = '🔒 ' + t('cbqlns');
        lk.title = t('tipLockedChip');
        td.appendChild(lk);
      } else {
        var a = (curGrid()[flow] || {})[col] || {};
        var any = false;
        SCOPES.forEach(function(s){
          if (a[s]){ td.appendChild(chipEl(flow, col, s, a[s])); any = true; }
        });
        if (!any){
          var h = document.createElement('div'); h.className = 'slotHint'; h.textContent = t('slotHint');
          td.appendChild(h);
        }
        td.ondragover  = function(e){ e.preventDefault(); td.classList.add('over'); };
        td.ondragleave = function(){ td.classList.remove('over'); };
        td.ondrop = function(e){
          e.preventDefault(); td.classList.remove('over');
          dropRole(flow, col, e.dataTransfer.getData('text/plain'));
        };
      }
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  renderRolePalette();
  fillRolePick();
}
function renderRolePalette(){
  var host = $('roleList'); host.innerHTML = '';
  if (ruleMode === 'vline'){
    // Box cố định "Ngành dọc của CBQLNS" — không xóa được, kéo thả như box thường
    var vc = document.createElement('div'); vc.className = 'roleCard vlineCard';
    var vtop = document.createElement('div'); vtop.className = 'topRow'; vtop.draggable = true;
    vtop.ondragstart = function(e){ e.dataTransfer.setData('text/plain', VLINE); vtop.classList.add('dragging'); document.body.classList.add('rdrag'); };
    vtop.ondragend = function(){ vtop.classList.remove('dragging'); document.body.classList.remove('rdrag'); };
    var vdh = document.createElement('span'); vdh.className = 'drag'; vdh.textContent = '⠿';
    var vttl = document.createElement('span'); vttl.className = 'ttl'; vttl.textContent = t('vlineBoxName');
    var vtag = document.createElement('span'); vtag.className = 'kindTag';
    var vused = usageCount(VLINE);
    vtag.textContent = t('tagFixed') + (vused ? ' · ' + tf('usedCells', { n: vused }) : '');
    vtop.appendChild(vdh); vtop.appendChild(vttl); vtop.appendChild(vtag);
    vc.appendChild(vtop);
    var vhint = document.createElement('div'); vhint.className = 'hint'; vhint.style.marginTop = '4px';
    vhint.textContent = t('vlineBoxHint');
    vc.appendChild(vhint);
    host.appendChild(vc);
  }
  if (!roleBoxes.length){
    var h0 = document.createElement('div'); h0.className = 'hint';
    h0.textContent = t('paletteEmpty');
    host.appendChild(h0);
    return;
  }
  roleBoxes.forEach(function(rb){
    var card = document.createElement('div'); card.className = 'roleCard';
    var top = document.createElement('div'); top.className = 'topRow'; top.draggable = true;
    top.ondragstart = function(e){
      e.dataTransfer.setData('text/plain', rb.id);
      document.body.classList.add('rdrag');
      top.classList.add('dragging');
    };
    top.ondragend = function(){ top.classList.remove('dragging'); document.body.classList.remove('rdrag'); };
    var dh = document.createElement('span'); dh.className = 'drag'; dh.textContent = '⠿';
    top.appendChild(dh);
    var ttl = document.createElement('span'); ttl.className = 'ttl';
    ttl.textContent = roleBoxName(rb);
    top.appendChild(ttl);
    var tag = document.createElement('span'); tag.className = 'kindTag';
    var used = usageCount(rb.id);
    tag.textContent = (rb.kind === 'node' ? t('tagFromChart') : t('tagCustom'))
                    + (used ? ' · ' + tf('usedCells', { n: used }) : '');
    top.appendChild(tag);
    var del = document.createElement('button'); del.className = 'rm'; del.textContent = '✕';
    del.title = t('tipDelRole'); del.onclick = function(){ deleteRole(rb); };
    top.appendChild(del);
    card.appendChild(top);
    if (rb.kind === 'free'){
      var fT = document.createElement('input'); fT.placeholder = t('phRoleTitle'); fT.value = rb.title;
      fT.oninput = function(){
        snap('r:' + rb.id + ':t'); rb.title = fT.value;
        ttl.textContent = roleBoxName(rb); patchRoleChips(rb); refreshFlowResultSoon();
      };
      var fP = document.createElement('input'); fP.placeholder = t('phRolePerson'); fP.value = rb.person;
      fP.style.fontStyle = 'italic';
      fP.oninput = function(){
        snap('r:' + rb.id + ':p'); rb.person = fP.value;
        patchRoleChips(rb); refreshFlowResultSoon();
      };
      card.appendChild(fT); card.appendChild(fP);
    } else {
      var pr = rolePair(rb);
      if (pr.p){
        var tx = document.createElement('div'); tx.className = 'nodeTxt';
        tx.style.fontStyle = 'italic';
        tx.textContent = pr.p;
        card.appendChild(tx);
      }
      // Trigger "CBQLNS cấp dưới tự PD" — chỉ áp dụng được khi dưới box thật sự CÓ box ★,
      // nên chỉ hiện với box lấy từ sơ đồ và có CBQLNS trong cây con.
      if (hasStarBelow(rb.nodeId)){
        var ckw = document.createElement('label'); ckw.className = 'pdCk';
        var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!rb.pdBelow;
        cb.onchange = function(){ snap(null); rb.pdBelow = cb.checked; renderRules(); renderFlowResult(); };
        ckw.appendChild(cb);
        ckw.appendChild(document.createTextNode(t('ckPdBelow')));
        ckw.title = t('tipPdBelow');
        card.appendChild(ckw);
      }
    }
    host.appendChild(card);
  });
}
function fillRolePick(){
  var s = $('rolePick'), cur = s.value; s.innerHTML = '';
  var o0 = document.createElement('option'); o0.value = ''; o0.textContent = t('optPickChart');
  s.appendChild(o0);
  var list = [];
  nodes.forEach(function(n){ list.push(n); });
  list.sort(function(a, b){ return dispName(a).localeCompare(dispName(b), 'vi'); });
  list.forEach(function(n){
    var o = document.createElement('option');
    o.value = n.id;
    o.textContent = dispName(n) + (n.person ? ' — ' + n.person : '') + ' [' + n.t + ']';
    s.appendChild(o);
  });
  if (cur && nodes.has(cur)) s.value = cur;
}
