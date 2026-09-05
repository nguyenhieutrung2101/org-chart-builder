"use strict";
/* [7] Xuất & Lưu: TSV, JSON (applyState), .drawio — Org Builder. Các file js/ dùng chung state global, nạp theo thứ tự trong index.html. */
/* ============ [7] XUẤT & LƯU ============ */
// Ô TSV cho Excel: quote ô có tab / xuống dòng / ngoặc kép; ô bắt đầu bằng = + - @ thêm dấu ' để Excel
// hiểu là text thay vì công thức (chặn formula injection; "-abc" cũng khỏi thành #NAME?). Dùng cho MỌI đường copy.
function q(s){
  s = String(s == null ? '' : s);
  if (/^\s*[=+\-@]/.test(s)) s = "'" + s;
  return /[\t\r\n"]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
}
function tsv(){
  var g = buildGrid(layout());
  var lines = [ g.header.map(q).join('\t') ];
  g.rows.forEach(function(r){ lines.push(r.map(q).join('\t')); });
  return lines.join('\n');
}
function copyText(txt, okMsg){
  function ok(){ msg(okMsg); }
  function fb(){
    var ta = document.createElement('textarea'); ta.value = txt;
    document.body.appendChild(ta); ta.select();
    try{
      if (!document.execCommand('copy')) throw new Error('copy failed');   // bị chặn thì trả false, không throw
      ok();
    }catch(e){ msg(t('msgCopyBlocked')); }
    document.body.removeChild(ta);
  }
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(ok, fb);
  } else fb();
}
function copyTable(){
  var L = layout();
  if (!L.vis.size){ msg(t('msgNothingCopy')); return; }
  var hidden = nodes.size - L.vis.size;
  copyText(tsv(), tf('msgCopiedView', { hidden: hidden ? tf('hiddenSuffix', { n: hidden }) : '' }));
}
function dl(blob, name){
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 500);
}
function ser(id){
  var n = nodes.get(id);
  return { id:n.id, dept:n.dept, title:n.title, person:n.person, t:n.t,
           star: n.star || undefined,
           br: n.br || undefined,
           collapsed: n.collapsed || undefined,
           focus: (id === focusId) || undefined,
           children: n.children.map(ser) };
}
function saveJSON(){
  dl(new Blob([JSON.stringify(serializeAll(), null, 1)], {type:'application/json'}), 'orgchart.json');
  dirty = false;
  msg(t('msgSavedJson'));
}
function applyState(d){
  if (!d || typeof d !== 'object' || !Array.isArray(d.roots)) throw new Error('bad root');

  var used = new Set(), maxN = 0;
  (function scan(list){
    list.forEach(function(o){
      if (o && typeof o.id === 'string' && /^n\d+$/.test(o.id)){
        used.add(o.id);
        var v = parseInt(o.id.slice(1), 10); if (v > maxN) maxN = v;
      }
      if (o && Array.isArray(o.children)) scan(o.children);
    });
  })(d.roots);
  function genId(){ do { maxN++; } while (used.has('n'+maxN)); return 'n'+maxN; }

  var tN = new Map(), tRoots = [], tFocus = null;
  function mk(o, parentId){
    if (!o || typeof o !== 'object') throw new Error('bad node');
    var pr = parentId ? rnum(tN.get(parentId).t) : 0;
    var r  = rnum(o.t);
    if (r < 0) r = parentId ? Math.min(8, pr+1) : 0;
    if (parentId && r < pr) r = pr;
    var id = (typeof o.id === 'string' && /^n\d+$/.test(o.id) && !tN.has(o.id)) ? o.id : genId();
    // file cũ (v≤7) dùng cờ boolean vh -> quy về nhánh 'VH'; một loại nhánh gán được nhiều box
    var br = (o.br && BRANCHES.indexOf(o.br) >= 0) ? o.br : (o.vh ? 'VH' : '');
    tN.set(id, { id:id,
                 dept:  String(o.dept  || '').toUpperCase(),
                 title: String(o.title || ''),
                 person:String(o.person|| ''),
                 t: LEVELS[r],
                 star: !!o.star, br: br, collapsed: !!o.collapsed,
                 parent: parentId, children: [] });
    if (o.focus && !tFocus) tFocus = id;
    (o.children || []).forEach(function(c){ tN.get(id).children.push(mk(c, id)); });
    return id;
  }
  d.roots.forEach(function(rt){ tRoots.push(mk(rt, null)); });

  var tCig = [], maxC = 0;
  (Array.isArray(d.cigs) ? d.cigs : []).forEach(function(c){
    if (!c || typeof c !== 'object') return;
    var okId = (typeof c.id === 'string' && /^c\d+$/.test(c.id));
    if (okId){ var v = parseInt(c.id.slice(1), 10); if (v > maxC) maxC = v; }
    tCig.push({ id: okId ? c.id : ('c' + (++maxC)), code:String(c.code||''), name:String(c.name||'') });
  });

  var tG = [], tF = [], maxG = 0, maxF = 0;
  (Array.isArray(d.fcGroups) ? d.fcGroups : []).forEach(function(g){
    if (!g || typeof g !== 'object') return;
    var okId = (typeof g.id === 'string' && /^g\d+$/.test(g.id));
    if (okId){ var v = parseInt(g.id.slice(1), 10); if (v > maxG) maxG = v; }
    var cbOk = g.cbqlns && tN.has(g.cbqlns);
    tG.push({ id: okId ? g.id : ('g' + (++maxG)),
              code: String(g.code||''),
              name: String(g.name||''),
              cbqlns: cbOk ? g.cbqlns : null,
              byCig: !!g.byCig });
  });
  (Array.isArray(d.fcs) ? d.fcs : []).forEach(function(x){
    if (!x || typeof x !== 'object') return;
    var okId = (typeof x.id === 'string' && /^f\d+$/.test(x.id));
    if (okId){ var v = parseInt(x.id.slice(1), 10); if (v > maxF) maxF = v; }
    var gid = tG.some(function(g){ return g.id === x.groupId; }) ? x.groupId : null;
    tF.push({ id: okId ? x.id : ('f' + (++maxF)),
              code: String(x.code||''), name: String(x.name||''), groupId: gid });
  });
  // Box vai trò + ma trận luật; file bản cũ (chưa có roleBoxes) -> dựng bộ mặc định, giữ tên từ finance cũ
  var tRB = [], maxR = 0;
  (Array.isArray(d.roleBoxes) ? d.roleBoxes : []).forEach(function(rb){
    if (!rb || typeof rb !== 'object') return;
    var okId = (typeof rb.id === 'string' && /^r\d+$/.test(rb.id));
    if (okId){ var v = parseInt(rb.id.slice(1), 10); if (v > maxR) maxR = v; }
    var id = okId ? rb.id : ('r' + (++maxR));
    if (rb.kind === 'node'){
      if (typeof rb.nodeId === 'string' && tN.has(rb.nodeId))
        tRB.push({ id:id, kind:'node', nodeId:rb.nodeId, pdBelow: !!rb.pdBelow });
    } else {
      tRB.push({ id:id, kind:'free', title:String(rb.title||''), person:String(rb.person||'') });
    }
  });
  // Luật: bản mới là ruleGrids theo scenario; bản cũ chỉ có ruleGrid -> thành scenario Chung ('')
  function cleanGrid(src){
    var out = {};
    if (!src || typeof src !== 'object') return out;
    FLOWS.forEach(function(fl){
      var row = src[fl];
      if (!row || typeof row !== 'object') return;
      COLS.forEach(function(c){
        if (FIXED_CBQLNS[fl] === c) return;
        var a = row[c];
        if (!a || typeof a !== 'object') return;
        var o = {};
        SCOPES.forEach(function(s){
          if (typeof a[s] !== 'string') return;
          if (a[s] === VLINE || tRB.some(function(r){ return r.id === a[s]; })) o[s] = a[s];
        });
        if (o.ALL) BRANCHES.concat('REST').forEach(function(s){ delete o[s]; });  // "Tất cả" đứng một mình
        if (SCOPES.some(function(s){ return o[s]; })) (out[fl] = out[fl] || {})[c] = o;
      });
    });
    return out;
  }
  function cleanFamily(src, legacy){
    var out = { '': {} };
    if (src && typeof src === 'object'){
      Object.keys(src).forEach(function(k){
        if (k !== '' && !tCig.some(function(c){ return c.id === k; })) return;  // grid mồ côi -> bỏ
        out[k] = cleanGrid(src[k]);
      });
    } else if (legacy && typeof legacy === 'object'){
      out[''] = cleanGrid(legacy);
    }
    return out;
  }
  var tGrids  = cleanFamily(d.ruleGrids, d.ruleGrid);
  var tVGrids = cleanFamily(d.vlineGrids, null);

  // Cây ngành dọc: node imported phải trỏ tới box còn tồn tại; hỏng thì hạ xuống manual rỗng? -> bỏ hẳn
  var tVN = new Map(), tVRoots = [], maxV = 0;
  function vmk(o, parentId){
    if (!o || typeof o !== 'object') return null;
    var okId = (typeof o.id === 'string' && /^v\d+$/.test(o.id) && !tVN.has(o.id));
    if (okId){ var vv = parseInt(o.id.slice(1), 10); if (vv > maxV) maxV = vv; }
    var id = okId ? o.id : ('v' + (++maxV));
    var orgId = (typeof o.orgId === 'string' && tN.has(o.orgId)) ? o.orgId : null;
    if (o.orgId && !orgId) return null;            // box SĐTC đã xóa -> bỏ node import mồ côi
    tVN.set(id, { id:id, dept:String(o.dept||'').toUpperCase(), title:String(o.title||''),
                  person:String(o.person||''), orgId:orgId, parent:parentId, children:[] });
    (o.children || []).forEach(function(c){
      var cid = vmk(c, id);
      if (cid) tVN.get(id).children.push(cid);
    });
    return id;
  }
  (Array.isArray(d.vroots) ? d.vroots : []).forEach(function(rt){
    var id = vmk(rt, null);
    if (id) tVRoots.push(id);
  });

  nodes = tN; rootIds = tRoots; focusId = tFocus;
  fcGroups = tG; fcs = tF;
  seq = maxN + 1; gseq = maxG + 1; fseq = maxF + 1;
  if (Array.isArray(d.roleBoxes)){ roleBoxes = tRB; ruleGrids = tGrids; vlineGrids = tVGrids; rseq = maxR + 1; }
  else seedRules();
  vnodes = tVN; vroots = tVRoots; vseq = maxV + 1; vsel = null;
  ruleMode = d.ruleMode === 'vline' ? 'vline' : 'flow';
  // CIG: file có key cigs (kể cả mảng rỗng — người dùng đã cố ý xóa hết) thì tôn trọng;
  // file cũ chưa có khái niệm CIG thì seed bộ mặc định (giữ ruleGrids đã đọc).
  if (Array.isArray(d.cigs)){ cigs = tCig; cseq = maxC + 1; }
  else { cigs = defaultCigs(); cseq = 4; }
  curCig = '';
  sel = null;
}
function loadJSON(file){
  file.text().then(function(txt){
    var d;
    try { d = JSON.parse(txt); }
    catch(e){ msg(t('msgBadJson')); return; }
    try { applyState(d); }
    catch(e){ msg(t('msgBadStruct')); return; }
    undoStack.length = 0; lastSnapKey = null; dirty = false;
    renderAll();
    if (typeof d.v === 'number' && d.v > SCHEMA_V) msg(tf('msgNewerFile', { v: d.v, s: SCHEMA_V }));
    else msg(t('msgOpened'));
  }).catch(function(){ msg(t('msgReadFail')); });
}
function xesc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function exportDrawio(){
  var L = layout();
  if (!L.vis.size){ msg(t('msgNothingExport')); return; }
  var cells = '<mxCell id="0"/><mxCell id="1" parent="0"/>';
  L.vis.forEach(function(id){
    var n = nodes.get(id), pv = L.pos.get(id);
    var fill = TCOLOR[n.t] || '#FFFFFF';
    var parts = [];
    if (n.dept)   parts.push('<b>' + xesc(n.dept) + '</b>');
    if (n.title)  parts.push('<b>' + xesc(n.title) + '</b>');
    if (n.person) parts.push('<i>' + xesc(n.person) + '</i>');
    cells += '<object label="' + xesc(parts.join('<br>')) + '" cap_T="' + xesc(n.t) + '"'
          +  ' dept="' + xesc(n.dept) + '" title_role="' + xesc(n.title) + '"'
          +  ' person="' + xesc(n.person) + '"' + (n.star ? ' cbqlns="1"' : '') + ' id="' + id + '">'
          +  '<mxCell style="rounded=0;whiteSpace=wrap;html=1;fillColor=' + fill + ';strokeColor=#000000;" vertex="1" parent="1">'
          +  '<mxGeometry x="' + pv.x + '" y="' + pv.y + '" width="' + BW + '" height="' + BH + '" as="geometry"/>'
          +  '</mxCell></object>';
  });
  var i = 0;
  L.vis.forEach(function(id){
    nodes.get(id).children.forEach(function(c){
      if (!L.vis.has(c)) return;
      cells += '<mxCell id="e' + (++i) + '" style="edgeStyle=orthogonalEdgeStyle;html=1;endArrow=none;"'
            +  ' edge="1" parent="1" source="' + id + '" target="' + c + '">'
            +  '<mxGeometry relative="1" as="geometry"/></mxCell>';
    });
  });
  var xml = '<mxfile host="app.diagrams.net"><diagram name="Org" id="org1">'
          + '<mxGraphModel dx="1000" dy="800" grid="1" gridSize="10" page="1" pageWidth="1600" pageHeight="1200"><root>'
          + cells + '</root></mxGraphModel></diagram></mxfile>';
  dl(new Blob([xml], {type:'application/xml'}), 'orgchart.drawio');
  var hidden = nodes.size - L.vis.size;
  msg(tf('msgDrawioSaved', { hidden: hidden ? tf('drawioHiddenSuffix', { n: hidden }) : '' }));
}
