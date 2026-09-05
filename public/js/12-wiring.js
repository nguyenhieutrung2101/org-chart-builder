"use strict";
/* [9] Pan, phím tắt, nối sự kiện, thu/mở section, landing + chuyển module, khởi động — Org Builder. Các file js/ dùng chung state global, nạp theo thứ tự trong index.html. */
/* ============ [9] PAN + PHÍM TẮT + NỐI SỰ KIỆN ============ */
(function(){
  var cw = $('canvasWrap');
  var active=false, moved=false, px=0, py=0, sx=0, sy=0, pid=null;
  cw.addEventListener('pointerdown', function(e){
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.node')) return;
    active = true; moved = false; pid = e.pointerId;
    px = e.clientX; py = e.clientY; sx = cw.scrollLeft; sy = cw.scrollTop;
    if (cw.setPointerCapture && pid != null){ try{ cw.setPointerCapture(pid); }catch(_){/**/} }
  });
  cw.addEventListener('pointermove', function(e){
    if (!active) return;
    var dx = e.clientX - px, dy = e.clientY - py;
    if (!moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)){ moved = true; cw.classList.add('panning'); }
    if (moved){ cw.scrollLeft = sx - dx; cw.scrollTop = sy - dy; }
  });
  function up(){
    if (!active) return;
    active = false; cw.classList.remove('panning');
    if (cw.releasePointerCapture && pid != null){ try{ cw.releasePointerCapture(pid); }catch(_){/**/} }
    pid = null;
  }
  cw.addEventListener('pointerup', up);
  cw.addEventListener('pointercancel', up);
  cw.addEventListener('click', function(e){
    if (moved){ moved = false; e.stopPropagation(); e.preventDefault(); return; }
    if (!e.target.closest('.node')) select(null);      // bỏ chọn: vá class, không dựng lại canvas
  }, true);

  // Lăn chuột = zoom quanh con trỏ (kiểu Figma/Miro). Chỉ gắn trên canvas tab Sơ đồ.
  // Hệ số theo deltaY liên tục (exp) thay vì nấc cố định -> trackpad lẫn chuột đều mượt.
  cw.addEventListener('wheel', function(e){
    e.preventDefault();
    var rc = cw.getBoundingClientRect();
    var factor = Math.exp(-e.deltaY * 0.0022);
    factor = Math.max(0.6, Math.min(1.67, factor));
    var base = zoomAnim ? zoomAnim.target : zoom;      // lăn dồn dập: cộng dồn vào target
    animateZoomTo(base * factor, e.clientX - rc.left, e.clientY - rc.top);
  }, { passive:false });

  // Kéo nền / thanh cuộn -> đồng bộ ô viewport trên minimap
  cw.addEventListener('scroll', syncMiniView);
})();

document.addEventListener('keydown', function(e){
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && String(e.key).toLowerCase() === 'z'){
    if (e.target && e.target.tagName === 'TEXTAREA') return;   // ô dán Excel: để trình duyệt undo gõ phím
    e.preventDefault(); undo();
  }
});

var curTab = 'org';                            // tab đang mở của module Luồng duyệt
function showTab(which){
  curTab = which;
  // các tab đều là flex-column để con bên trong giãn hết chiều cao viewport
  $('tabOrg').style.display   = which === 'org'   ? 'flex' : 'none';
  $('tabVline').style.display = which === 'vline' ? 'flex' : 'none';
  $('tabRules').style.display = which === 'rules' ? 'flex' : 'none';
  $('tabFlow').style.display  = which === 'flow'  ? 'flex' : 'none';
  $('tabBtnOrg').classList.toggle('active',   which === 'org');
  $('tabBtnVline').classList.toggle('active', which === 'vline');
  $('tabBtnRules').classList.toggle('active', which === 'rules');
  $('tabBtnFlow').classList.toggle('active',  which === 'flow');
  if (which === 'vline'){ renderVline(); renderVPanel(); }
  if (which === 'rules') renderRules();
  if (which === 'flow')  renderFlow();
}
$('tabBtnOrg').onclick   = function(){ showTab('org'); };
$('tabBtnVline').onclick = function(){ showTab('vline'); };
$('tabBtnRules').onclick = function(){ showTab('rules'); };
$('tabBtnFlow').onclick  = function(){ showTab('flow'); };

$('bVRoot').onclick   = vAddRoot;
$('bVImport').onclick = vImport;
$('modeFlow').onclick  = function(){ setRuleMode('flow'); };
$('modeVline').onclick = function(){ setRuleMode('vline'); };
// Pan tab Ngành dọc: kéo nền để di chuyển (cùng mẫu pointer-capture với tab Sơ đồ)
(function(){
  var cw = $('vcanvasWrap');
  var active=false, moved=false, px=0, py=0, sx=0, sy=0, pid=null;
  cw.addEventListener('pointerdown', function(e){
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.node')) return;
    active = true; moved = false; pid = e.pointerId;
    px = e.clientX; py = e.clientY; sx = cw.scrollLeft; sy = cw.scrollTop;
    cw.classList.add('panning');
    if (cw.setPointerCapture){ try{ cw.setPointerCapture(pid); }catch(_){/**/} }
  });
  cw.addEventListener('pointermove', function(e){
    if (!active) return;
    var dx = e.clientX - px, dy = e.clientY - py;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    cw.scrollLeft = sx - dx; cw.scrollTop = sy - dy;
  });
  function up(){
    active = false; cw.classList.remove('panning');
    if (cw.releasePointerCapture && pid != null){ try{ cw.releasePointerCapture(pid); }catch(_){/**/} }
    pid = null;
  }
  cw.addEventListener('pointerup', up);
  cw.addEventListener('pointercancel', up);
  cw.addEventListener('click', function(e){
    if (moved){ moved = false; e.stopPropagation(); e.preventDefault(); return; }
    if (!e.target.closest('.node')) vselect(null);
  }, true);
})();

// Nút thu/mở dùng chung cho mọi section (▴ = đang mở, ▸ = đang thu).
// secId: thêm class .collapsed lên section để CSS bỏ flex-grow khi thu.
function wireCollapse(btnId, bodyId, secId, startOpen){
  var b = $(btnId), body = $(bodyId), sec = secId ? $(secId) : null;
  var open = startOpen !== false;
  function apply(){
    body.style.display = open ? '' : 'none';
    b.textContent = open ? '▴' : '▸';
    if (sec) sec.classList.toggle('collapsed', !open);
  }
  b.onclick = function(){ open = !open; apply(); };
  apply();
}
wireCollapse('tglRes', 'resBody', 'resSec');
wireCollapse('tglCig', 'cigBody', 'cigSec', false);        // CIG mặc định thu gọn
wireCollapse('tglPalette', 'paletteBody', 'paletteSec');

$('resFilter').oninput = applyResFilter;

// Tab Sơ đồ: ẩn/hiện sơ đồ (bảng chiếm toàn màn hình) và ẩn/hiện panel
var chartHidden = false, panelHidden = false;
// Nhãn phụ thuộc trạng thái — đọc state để đổi ngôn ngữ xong gọi lại là đúng
function refreshStateLabels(){
  $('bTglChart').textContent  = chartHidden   ? t('lblShowChart')  : t('lblHideChart');
  $('bTglPanel').textContent  = panelHidden   ? t('lblShowPanel')  : t('lblHidePanel');
  $('bTglDPanel').textContent = dpanelHidden  ? t('lblShowPanel')  : t('lblHidePanel');
  $('bTgl').textContent       = tblCollapsed  ? t('lblTblExpand')  : t('lblTblCollapse');
  $('bTglInputs').textContent = inputsHidden  ? t('lblShowInputs') : t('lblHideInputs');
  $('bFlowView').textContent  = flowViewByFc  ? t('lblViewByFc')   : t('lblViewByGroup');
}
$('bTglChart').onclick = function(){
  chartHidden = !chartHidden;
  document.querySelector('main').style.display = chartHidden ? 'none' : 'flex';
  $('tableSec').classList.toggle('full', chartHidden);
  refreshStateLabels();
};
$('bTglPanel').onclick = function(){
  panelHidden = !panelHidden;
  $('panel').style.display = panelHidden ? 'none' : '';
  refreshStateLabels();
};

$('bLang').onclick = function(){ setLang(LANG === 'vi' ? 'en' : 'vi'); };

$('bZoomIn').onclick    = function(){ animateZoomTo((zoomAnim ? zoomAnim.target : zoom) * ZSTEP); };
$('bZoomOut').onclick   = function(){ animateZoomTo((zoomAnim ? zoomAnim.target : zoom) / ZSTEP); };
$('bZoomReset').onclick = function(){ animateZoomTo(1); };
$('bZoomFit').onclick   = fitZoom;

$('bRoot').onclick   = addRoot;
$('bSave').onclick   = saveJSON;
$('bOpen').onclick   = function(){ $('fileIn').click(); };
$('fileIn').onchange = function(e){ if (e.target.files[0]) loadJSON(e.target.files[0]); e.target.value=''; };
$('bCopy').onclick   = copyTable;
$('bDrawio').onclick = exportDrawio;
$('bUndo').onclick   = undo;
$('bUnfocus').onclick= clearFocus;

$('bAddFreeRole').onclick = addFreeRole;
$('bAddNodeRole').onclick = addNodeRole;
$('bAddCig').onclick   = addCig;

$('bAddGrp').onclick = addGroup;
$('bAddFc').onclick  = addFc;
$('fcFilter').oninput  = applyFcFilter;
$('grpFilter').oninput = applyGrpFilter;

// Ẩn/hiện cả khu nhập liệu (Nhóm FC / FC) — chỉ còn bảng luồng duyệt
var inputsHidden = false;
$('bTglInputs').onclick = function(){
  inputsHidden = !inputsHidden;
  $('flowInputs').style.display = inputsHidden ? 'none' : '';
  refreshStateLabels();
};
$('bPaste').onclick  = function(){
  var pb = $('pasteBox');
  pb.style.display = (pb.style.display === 'none' || !pb.style.display) ? 'block' : 'none';
};
$('bPasteGo').onclick     = function(){ importPaste($('pasteTa').value); };
$('bPasteCancel').onclick = function(){ $('pasteTa').value=''; $('pasteBox').style.display='none'; };

// Copy 2 bảng nhập liệu ra TSV (dán thẳng vào Excel) + dán nhóm FCG từ Excel
$('bCopyGrp').onclick = function(){
  if (!fcGroups.length){ msg(t('msgNothingCopy')); return; }
  var lines = [ [t('thFcgCode'), t('thGrpName'), t('thCbqlns')].map(q).join('\t') ];
  fcGroups.forEach(function(g){
    var cb = cbqlnsOf(g);
    lines.push([g.code || '', g.name || '', cb ? (cb.person || dispName(cb)) : ''].map(q).join('\t'));
  });
  copyText(lines.join('\n'), t('msgCopiedTbl'));
};
$('bCopyFc').onclick = function(){
  if (!fcs.length){ msg(t('msgNothingCopy')); return; }
  var gname = {};
  fcGroups.forEach(function(g){ gname[g.id] = g.name || g.code || ''; });
  var lines = [ [t('thFcCode'), t('thFcName'), t('thFcGroup')].map(q).join('\t') ];
  fcs.forEach(function(f){
    lines.push([f.code || '', f.name || '', f.groupId ? (gname[f.groupId] || '') : ''].map(q).join('\t'));
  });
  copyText(lines.join('\n'), t('msgCopiedTbl'));
};
$('bPasteGrp').onclick = function(){
  var pb = $('pasteBoxGrp');
  pb.style.display = (pb.style.display === 'none' || !pb.style.display) ? 'block' : 'none';
};
$('bPasteGrpGo').onclick     = function(){ importGrpPaste($('pasteTaGrp').value); };
$('bPasteGrpCancel').onclick = function(){ $('pasteTaGrp').value=''; $('pasteBoxGrp').style.display='none'; };
$('bFlowView').onclick = function(){
  flowViewByFc = !flowViewByFc;
  refreshStateLabels();
  renderFlowResult();
};
$('bCopyFlow').onclick = copyFlowTable;

var tblCollapsed = true;                       // Bảng phân cấp mặc định thu gọn
function applyTblCollapsed(){
  $('tblHost').style.display = tblCollapsed ? 'none' : 'flex';
  $('tableSec').classList.toggle('collapsed', tblCollapsed);
  refreshStateLabels();
}
$('bTgl').onclick = function(){ tblCollapsed = !tblCollapsed; applyTblCollapsed(); };

/* ---------- [10] Landing + module Trình bày sơ đồ ---------- */
// MOD: 'landing' | 'flow' | 'doc'. renderAll()/select()/refreshView() rẽ nhánh theo MOD nên mọi thao tác model dùng chung.
var MOD = 'landing', dzoomInit = false, dpanelHidden = false;
function showModule(m){
  MOD = m;
  $('landing').style.display  = m === 'landing' ? 'flex' : 'none';
  $('tabDoc').style.display   = m === 'doc' ? 'flex' : 'none';
  $('flowTabs').style.display = m === 'flow' ? '' : 'none';
  if (m === 'flow'){ renderAll(); showTab(curTab); }
  else ['tabOrg', 'tabVline', 'tabRules', 'tabFlow'].forEach(function(id){ $(id).style.display = 'none'; });
  if (m === 'doc'){ renderDocAll(); if (!dzoomInit){ dZoomFit(); dzoomInit = true; } }
  var want = m === 'landing' ? '' : '#' + m;
  if (location.hash !== want) history.replaceState(null, '', location.pathname + location.search + want);
}
function moduleFromHash(){ var m = /^#(doc|flow)$/.exec(location.hash); return m ? m[1] : 'landing'; }
window.addEventListener('hashchange', function(){ var m = moduleFromHash(); if (m !== MOD) showModule(m); });
$('bModDoc').onclick  = function(){ showModule('doc'); };
$('bModFlow').onclick = function(){ showModule('flow'); };
$('bHome').onclick    = function(){ showModule('landing'); };
$('bDocRoot').onclick   = addRoot;
$('bDZoomIn').onclick    = function(){ dZoomTo(dzoom * ZSTEP); };
$('bDZoomOut').onclick   = function(){ dZoomTo(dzoom / ZSTEP); };
$('bDZoomReset').onclick = function(){ dZoomTo(1); };
$('bDZoomFit').onclick   = dZoomFit;
$('bPrint').onclick = docPrint;
$('bPdf').onclick   = docPdf;
$('bTglDPanel').onclick = function(){ dpanelHidden = !dpanelHidden; $('dpanel').style.display = dpanelHidden ? 'none' : ''; refreshStateLabels(); };
wireCollapse('tglDBox',  'dBoxBody',  'dBoxSec');
wireCollapse('tglDPage', 'dPageBody', 'dPageSec');
// Kéo-thả trên trang: pointer capture trên #docPage (svg bị dựng lại mỗi lần render nên không capture trên svg)
(function(){
  var host = $('docPage'), drag = null;
  host.addEventListener('pointerdown', function(e){
    if (e.button !== 0) return;
    var box = e.target.closest('.dbox'), hit = e.target.classList.contains('dedge-hit') ? e.target : null;
    if (box){ var id = box.getAttribute('data-id'); if (sel !== id) select(id); drag = startBoxDrag(id, e); }
    else if (hit) drag = startEdgeDrag(hit.getAttribute('data-id'), +hit.getAttribute('data-seg'), e);
    else { if (sel) select(null); return; }
    try{ host.setPointerCapture(e.pointerId); }catch(_){/**/}
    e.preventDefault();
  });
  host.addEventListener('pointermove', function(e){ if (drag) moveDrag(drag, e); });
  function up(){ if (!drag) return; var d = drag; drag = null; endDrag(d); }
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
  host.addEventListener('dblclick', function(e){ var box = e.target.closest('.dbox'); if (box) select(box.getAttribute('data-id'), true); });
})();

window.onbeforeunload = function(){ return dirty ? true : null; };   // dirty đã bao trùm mọi dữ liệu (FC, luật, ngành dọc…), không chỉ box sơ đồ

seedRules();
applyStatic();
applyTblCollapsed();
renderAll();
showModule(moduleFromHash());
