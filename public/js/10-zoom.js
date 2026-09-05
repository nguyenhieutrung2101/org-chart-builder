"use strict";
/* [8f] Zoom + minimap (chỉ tab Sơ đồ) — Org Builder. Các file js/ dùng chung state global, nạp theo thứ tự trong index.html. */
/* ============ [8f] ZOOM + MINIMAP (chỉ tab Sơ đồ, view-state tạm) ============ */
// Áp zoom hiện tại: sizer nhận kích thước world×zoom (tạo vùng cuộn), canvas scale(zoom).
function applyZoomView(){
  var sz = $('canvasSizer');
  if (sz){ sz.style.width = (worldW*zoom)+'px'; sz.style.height = (worldH*zoom)+'px'; }
  $('canvas').style.transform = 'scale(' + zoom + ')';
  var lbl = $('zoomLbl'); if (lbl) lbl.textContent = Math.round(zoom*100) + '%';
}
function clampZoom(z){ return Math.min(ZMAX, Math.max(ZMIN, z)); }
function fitZoom(){
  var cw = $('canvasWrap');
  var z = Math.min(cw.clientWidth / worldW, cw.clientHeight / worldH, 1);
  zoomAnim = null;                                  // huỷ animation dở dang
  zoom = clampZoom(z);
  applyZoomView();
  cw.scrollLeft = 0; cw.scrollTop = 0;
  syncMiniView();
}

// Zoom MƯỢT: không nhảy thẳng tới mức mới mà nội suy ease-out mỗi frame về target,
// suốt quá trình giữ nguyên điểm world dưới con trỏ (anchor). Lăn dồn dập chỉ nâng target.
var zoomAnim = null;
function animateZoomTo(nz, ax, ay){
  nz = clampZoom(nz);
  var cw = $('canvasWrap');
  if (ax == null){ ax = cw.clientWidth/2; ay = cw.clientHeight/2; }
  var running = !!zoomAnim;
  zoomAnim = { target: nz, ax: ax, ay: ay,
               wx: (cw.scrollLeft + ax) / zoom,
               wy: (cw.scrollTop  + ay) / zoom };
  if (!running) requestAnimationFrame(zoomStep);
}
function zoomStep(){
  var a = zoomAnim; if (!a) return;
  var cw = $('canvasWrap');
  var d = a.target - zoom;
  var done = Math.abs(d) < 0.0015;
  zoom = done ? a.target : zoom + d * 0.3;
  applyZoomView();
  cw.scrollLeft = a.wx * zoom - a.ax;
  cw.scrollTop  = a.wy * zoom - a.ay;
  syncMiniView();
  if (done){ zoomAnim = null; return; }
  requestAnimationFrame(zoomStep);
}

var miniScale = 1;
// Vẽ snapshot: mỗi node visible = 1 rect nhỏ (màu theo cấp T). Luôn vẽ khi có node để lúc
// zoom vượt viewport có thể hiện ngay; quyết định ẩn/hiện để syncMiniView lo (chạy mỗi zoom/cuộn).
function renderMinimap(L){
  var mm = $('minimap'), svg = $('miniSvg');
  if (!mm || !svg) return;
  if (!L.vis.size){ mm.classList.add('hidden'); return; }
  // Khung minimap co đúng theo tỉ lệ sơ đồ (MMW×MMH chỉ là ngân sách tối đa) —
  // sơ đồ ngang dài không còn để trống một dải to bên dưới.
  miniScale = Math.min(MMW / worldW, MMH / worldH);
  mm.style.width  = Math.round(worldW * miniScale) + 'px';
  mm.style.height = Math.round(worldH * miniScale) + 'px';
  svg.setAttribute('viewBox', '0 0 ' + worldW + ' ' + worldH);
  svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
  var NS = 'http://www.w3.org/2000/svg';
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  L.vis.forEach(function(id){
    var n = nodes.get(id), p = L.pos.get(id);
    var r = document.createElementNS(NS, 'rect');
    r.setAttribute('data-id', id);
    r.setAttribute('x', p.x); r.setAttribute('y', p.y);
    r.setAttribute('width', BW); r.setAttribute('height', BH);
    r.setAttribute('fill', TCOLOR[n.t] || '#ffffff');
    r.setAttribute('stroke', id === sel ? '#6B8FE8' : '#1F1B16');
    r.setAttribute('stroke-width', id === sel ? 8 : 3);
    svg.appendChild(r);
  });
  syncMiniView();
}
// Ô viewport trên minimap = vùng world đang hiển thị; đồng thời tự ẩn khi cả sơ đồ đã lọt viewport.
function syncMiniView(){
  var mm = $('minimap'), mv = $('miniView'), cw = $('canvasWrap');
  if (!mm || !mv) return;
  var needed = $('miniSvg').querySelector('rect') &&
               (worldW*zoom > cw.clientWidth + 4 || worldH*zoom > cw.clientHeight + 4);
  mm.classList.toggle('hidden', !needed);
  if (!needed) return;
  mv.style.left   = (cw.scrollLeft/zoom * miniScale) + 'px';
  mv.style.top    = (cw.scrollTop /zoom * miniScale) + 'px';
  mv.style.width  = Math.min(worldW, cw.clientWidth /zoom) * miniScale + 'px';
  mv.style.height = Math.min(worldH, cw.clientHeight/zoom) * miniScale + 'px';
}
// Bấm/kéo trên minimap: canh vùng nhìn vào điểm world tương ứng (tái dùng mẫu pointer-capture).
(function(){
  var mm = $('minimap'), cw = $('canvasWrap');
  if (!mm) return;
  var dragging = false, pid = null;
  function jump(e){
    var rc = mm.getBoundingClientRect();
    var wx = (e.clientX - rc.left) / miniScale;         // toạ độ world từ vị trí bấm trên minimap
    var wy = (e.clientY - rc.top)  / miniScale;
    cw.scrollLeft = wx*zoom - cw.clientWidth/2;          // canh giữa viewport vào điểm đó
    cw.scrollTop  = wy*zoom - cw.clientHeight/2;
    syncMiniView();
  }
  mm.addEventListener('pointerdown', function(e){
    dragging = true; pid = e.pointerId;
    if (mm.setPointerCapture){ try{ mm.setPointerCapture(pid); }catch(_){/**/} }
    jump(e); e.preventDefault();
  });
  mm.addEventListener('pointermove', function(e){ if (dragging) jump(e); });
  function up(){ dragging = false;
    if (mm.releasePointerCapture && pid!=null){ try{ mm.releasePointerCapture(pid); }catch(_){/**/} }
    pid = null; }
  mm.addEventListener('pointerup', up);
  mm.addEventListener('pointercancel', up);
})();
