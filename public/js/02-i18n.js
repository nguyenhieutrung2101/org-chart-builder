"use strict";
/* [1b] i18n: từ điển STR{vi,en}, t()/tf(), applyStatic() — Org Builder. Các file js/ dùng chung state global, nạp theo thứ tự trong index.html. */
/* ============ [1b] I18N — Anh/Việt ============
   Nguyên tắc: KHÓA DỮ LIỆU giữ nguyên (FLOWS/COLS/LEVELS/scope trong JSON),
   chỉ dịch NHÃN hiển thị. Ngôn ngữ là tuỳ chọn UI, lưu localStorage.        */
var LANG = (function(){ try{ return localStorage.getItem('ob_lang') || 'vi'; }catch(_){ return 'vi'; } })();

var STR = {
vi: {
  docTitle:'Org Builder — sơ đồ, bảng phân cấp & luồng duyệt',
  tabOrg:'Sơ đồ tổ chức', tabVline:'Ngành dọc', tabRules:'Định nghĩa luồng', tabFlow:'Luồng duyệt',
  // --- landing + module ---
  landingTitle:'Chọn module', btnHome:'⌂ Module', tipHome:'Về màn hình chọn module',
  modDocH:'Trình bày sơ đồ', modDocD:'Vẽ và căn chỉnh sơ đồ tổ chức trên trang in: khổ giấy, font, bảng màu, ghi chú, định biên, in / PDF.',
  modFlowH:'Luồng duyệt', modFlowD:'Sơ đồ tổ chức, ngành dọc, ma trận luật và bảng luồng duyệt theo nhóm Fund Center.',
  landingHint:'Hai module dùng chung một cây tổ chức và một file JSON — vẽ ở module nào cũng cập nhật ở cả hai.',
  // --- cấp + định biên ---
  lvlDB:'Đặc biệt', lvlCC:'Cao cấp',
  lblHc:'Định biên', hcAutoNote:'Tự cộng: 1 (box này) + tổng định biên các box con.', hcLeafNote:'Box không có box con: nhập số (trống = 1, chính nó).',
  // --- module trình bày ---
  docPageH:'Trang', docBoxH:'Box', lblPage:'Khổ giấy', lblOrient:'Hướng', orientL:'Ngang', orientP:'Dọc',
  lblFont:'Font', fontApp:'Font của app', lblScheme:'Bảng màu', schemePastel:'Pastel (app)', schemeClassic:'Gốc văn bản',
  lblHeader:'Tiêu đề trang', phHeader:'VD: SƠ ĐỒ TỔ CHỨC CÔNG TY …',
  docCodeH:'Khối mã văn bản', dcCode:'Mã văn bản', dcDate:'Ngày áp dụng', dcAuthor:'Người soạn thảo', dcReviewer:'Người thẩm định (*)', dcApprover:'Người phê duyệt',
  notesH:'Ghi chú', btnAddNote:'＋ Ghi chú', phNoteText:'Báo cáo đồng thời cho …', tipDelNote:'Xóa ghi chú',
  showH:'Hiển thị', ckLegend:'Bảng màu cấp (góc phải)', ckCode:'Khối mã văn bản (góc trái)', ckNotes:'Danh sách ghi chú',
  ckHc:'Số định biên trên box', ckDesc:'Cụm mô tả chức năng', ckFit:'Tự co sơ đồ cho vừa trang',
  btnPrint:'🖨 In / Save as PDF', btnPdf:'⬇ Tải PDF', msgPdfLoading:'Đang chuẩn bị PDF (nạp font)…', msgPdfDone:'Đã tạo PDF', msgPdfFail:'Không tạo được PDF',
  lblAnnot:'Ghi chú (chữ cái góc trái box)', lblDesc:'Mô tả chức năng (hiện dưới sơ đồ)', descHint:'Dòng bắt đầu bằng "# " thành tiêu đề đậm gạch chân.',
  btnResetPos:'Về vị trí tự động', btnResetEdge:'Nối lại tự động',
  docEmptyHint:'Bấm một box để sửa. Kéo box sang ngang để dịch trong hàng; kéo một đoạn đường nối để bẻ gấp khúc.',
  docNoTree:'Chưa có box nào — bấm "＋ Box gốc".',
  // --- tab Ngành dọc ---
  btnVRoot:'＋ Người global', btnVImport:'＋ CBQLNS từ SĐTC',
  vlineBarHint:'Chọn box cha trên cây rồi import — chỉ box đã tick ★ CBQLNS mới chọn được.',
  vpanelH:'Chi tiết', vorgTip:'Import từ Sơ đồ tổ chức — nội dung tự cập nhật theo box gốc',
  vpanelEmptyHint:'Cây ngành dọc: mỗi CBQLNS của thị trường gắn dưới người phụ trách ngành dọc của họ trên Global.<br><br>Bắt đầu: "＋ Người global" để vẽ người global, nhập 3 trường. Chọn box đó rồi "＋ CBQLNS từ SĐTC" để gắn CBQLNS vào dưới.<br><br>Box import lấy nội dung trực tiếp từ tab Sơ đồ tổ chức — sửa bên đó là bên này đổi theo.',
  vImportedNote:'Box import từ Sơ đồ tổ chức — muốn sửa nội dung thì sửa ở tab đó.',
  optPickStar:'(chọn box ★ CBQLNS…)',
  msgPickStar:'Chọn một box ★ CBQLNS trong danh sách trước',
  msgPickVParent:'Chọn box cha trên cây ngành dọc trước (người global)',
  // --- mode Luồng / Ngành dọc ---
  modeLbl:'Xử lý theo:', modeFlow:'Luồng', modeVline:'Ngành dọc',
  modeVlineNote:'Ô nào thả box "Ngành dọc của CBQLNS" sẽ tự tra cây Ngành dọc theo từng nhóm.',
  vlineBoxName:'Ngành dọc của CBQLNS', tagFixed:'cố định',
  vlineBoxHint:'Thả vào ô: người duyệt = cấp trên ngành dọc của CBQLNS nhóm đó (định nghĩa ở tab Ngành dọc).',
  noVlineDef:'(chưa định nghĩa ngành dọc)',
  // --- copy/paste bảng nhập liệu ---
  btnCopyTbl:'Copy', msgCopiedTbl:'Đã copy bảng — dán thẳng vào Excel',
  pasteGrpHint:'Dán 3 cột từ Excel: <b>Mã FCG ⇥ Tên nhóm ⇥ Tên người CBQLNS</b> (cột CBQLNS được phép trống; khớp theo tên người của box ★ trên sơ đồ, không phân biệt hoa thường; trùng mã FCG thì cập nhật dòng cũ).',
  msgGrpImported:'Đã nhập {n} nhóm mới, cập nhật {u} nhóm trùng mã',
  btnSave:'Lưu JSON', btnOpen:'Mở JSON', btnUndo:'↶ Hoàn tác',
  btnRoot:'＋ Box gốc', btnCopy:'Copy bảng', btnDrawio:'Xuất .drawio',
  tipZoomOut:'Thu nhỏ', tipZoomReset:'Về 100%', tipZoomIn:'Phóng to', btnZoomFit:'Vừa màn hình',
  lblHideChart:'Ẩn sơ đồ', lblShowChart:'Hiện sơ đồ', lblHidePanel:'Ẩn panel', lblShowPanel:'Hiện panel',
  lblTblCollapse:'Thu gọn ▾', lblTblExpand:'Mở ▴',
  lblHideInputs:'Ẩn khu nhập liệu ▴', lblShowInputs:'Hiện khu nhập liệu ▸',
  lblViewByGroup:'Đang xem: theo nhóm', lblViewByFc:'Đang xem: từng FC',
  orgTableH:'Bảng phân cấp (cột thẳng hàng theo cấp)',
  orgTableEmpty:'Bảng sẽ tự cập nhật khi bạn vẽ. Mỗi nhánh là một dòng; mỗi cột là một hàng cấp trên chart. Ô "—" nghĩa là nhánh đi xuyên qua cấp đó.',
  // --- thuật ngữ miền (đồng nhất mọi nơi) ---
  cbqlns:'CBQLNS',
  tipStar:'CBQLNS — Cán bộ quản lý ngân sách',
  brBadgeVH:'VH', brBadgeSM:'SM', brBadgeBO:'BO', brBadgeIT:'IT', brBadgeAC:'KT',
  segALL:'Tất cả', segVH:'Vận hành', segSM:'Kinh doanh', segBO:'Hỗ trợ', segIT:'IT', segAC:'Kế toán', segREST:'Còn lại',
  brNone:'— Không đánh dấu —', lblBranch:'Nhánh (tính luồng duyệt)',
  brTipNode:'Gốc nhánh {br} — CBQLNS dưới nhánh này tính luồng theo "{br}"',
  // CIG — nhóm chi phí
  cigH:'Nhóm chi phí (CIG)', btnAddCig:'＋ CIG', tipDelCig:'Xóa CIG',
  phCigCode:'CI-…', phCigName:'Tên nhóm chi phí',
  cigHint:'Commitment Item Group — loại chi phí. Mỗi CIG có thể có bộ luật riêng (toggle phía trên ma trận).',
  scenLbl:'Đang định nghĩa cho:', scenCommon:'Chung',
  scenCommonNote:'Luật áp cho mọi CIG chưa có bộ luật riêng.',
  scenOwn:'{code} có bộ luật riêng — đổi ở đây không ảnh hưởng "Chung".',
  thCig:'CIG', grpCigAll:'1 luồng', grpCigSplit:'Theo CIG',
  tipGrpCig:'Bảng kết quả: 1 dòng chung cho mọi CIG, hay tách dòng theo từng CIG',
  lineCig:'CIG: ',
  // Trigger "CBQLNS cấp dưới tự PD" trên box vai trò link từ sơ đồ
  ckPdBelow:'CBQLNS cấp dưới tự PD',
  tipPdBelow:'Nếu CBQLNS của nhóm nằm dưới box này, chính CBQLNS đó sẽ ký ở ô có box này — '
           + 'không phải đẩy lên box này nữa.',
  pdDelegatedNote:'\n(CBQLNS tự PD)',
  // --- panel chi tiết ---
  panelH:'Chi tiết box', panelEmptyH:'Chi tiết',
  panelEmptyHint:'Chọn một box để sửa.<br><br>Bắt đầu: bấm "＋ Box gốc", nhập thông tin, rồi "＋ Cấp dưới".<br><br>Kéo chuột trên nền để di chuyển vùng nhìn. Ctrl+Z để hoàn tác.<br><br>Cấp cao nhất là CC, rồi tới T1…T8. Cấp của box con tối thiểu bằng cấp của box cha.<br><br>★ = CBQLNS (cán bộ quản lý ngân sách), dùng cho tab Luồng duyệt.<br><br>Dropdown "Nhánh" đánh dấu gốc của nhánh Vận hành / Kinh doanh / Hỗ trợ — CBQLNS nằm dưới nhánh nào thì tính luồng theo nhánh đó, ngoài hết thì tính theo "Còn lại".',
  lblDept:'Tên phòng / khối (tự IN HOA, đậm)', lblTitle:'Chức danh (đậm)', lblPerson:'Người phụ trách (nghiêng)',
  lblLevel:'Cấp', lblLevelMin:' (tối thiểu {L} theo cấp cha)',
  ckCbqlns:'★ CBQLNS (quản lý ngân sách)',
  btnChild:'＋ Cấp dưới', btnSib:'＋ Ngang hàng', btnCollapse:'Thu gọn cấp dưới', btnExpand:'Bung cấp dưới',
  btnFocus:'Focus nhánh', btnUnfocus:'Bỏ focus', btnDel:'Xóa', focusLbl:'Focus:',
  panelHint:'◀ ▶ đổi thứ tự với box ngang hàng. Chữ dài quá khung sẽ thu gọn bằng "…", rê chuột vào box để xem đủ.',
  emptyBox:'(chưa nhập)', unnamed:'(chưa đặt tên)',
  hidTip:'Đang ẩn {n} box cấp dưới — bấm để bung',
  // --- thông báo/confirm ---
  msgUnfocusRoot:'Đã bỏ focus để thêm box gốc',
  cfmDelNode:'Xóa "{name}" cùng {n} box cấp dưới?',
  msgRaised:'Đã nâng {n} box cấp dưới cho khớp cấp mới',
  msgFocusCleared:'Đã bỏ focus (nhánh focus nằm trong vùng vừa thu gọn)',
  msgNoUndo:'Không còn gì để hoàn tác', msgUndoErr:'Lỗi hoàn tác', msgUndone:'Đã hoàn tác',
  msgNothingCopy:'Chưa có gì để copy',
  msgCopiedView:'Đã copy theo view hiện tại{hidden} — dán thẳng vào Excel',
  hiddenSuffix:' (đang ẩn {n} box)',
  msgSavedJson:'Đã tải orgchart.json',
  msgBadJson:'File không phải JSON hợp lệ — giữ nguyên dữ liệu hiện tại',
  msgBadStruct:'Cấu trúc file không đúng — giữ nguyên dữ liệu hiện tại',
  msgOpened:'Đã mở file', msgReadFail:'Không đọc được file',
  msgNewerFile:'File lưu bằng bản mới hơn (schema v{v}, app này hỗ trợ tới v{s}) — đã mở, dữ liệu lạ có thể bị bỏ qua',
  msgRolesPruned:'Đã gỡ {n} box vai trò link tới box vừa xóa ({c} ô luật) — Ctrl+Z để hoàn tác',
  msgNothingExport:'Chưa có gì để xuất',
  msgDrawioSaved:'Đã tải orgchart.drawio{hidden}', drawioHiddenSuffix:' (theo view — đang ẩn {n} box)',
  msgCopyBlocked:'Trình duyệt chặn copy',
  // --- engine luồng ---
  roleDeleted:'(box sơ đồ đã bị xóa)', starRemoved:'\n(box đã bỏ ★)', noCbqlns:'(chưa gán CBQLNS)',
  groupUnnamed:'(nhóm chưa đặt tên)',
  // --- nhóm FC / FC ---
  phFcg:'FCG…', phGrpName:'Tên nhóm', optNoCbqlns:'(chưa gán CBQLNS)', optStarRemoved:'(đã bỏ ★) ',
  tipDelGroup:'Xóa nhóm', grpH:'Nhóm Fund Center', fcH:'Fund Center',
  grpFilterPh:'Lọc nhanh theo mã / tên nhóm…', btnAddGrp:'＋ Nhóm',
  thFcgCode:'Mã FCG', thGrpName:'Tên nhóm', thCbqlns:'CBQLNS (★)',
  grpHint:'Mỗi nhóm gán 1 CBQLNS (box có ★ bên tab Sơ đồ). Luồng duyệt tính theo nhóm.',
  grpEmpty:'Chưa có nhóm nào — bấm "＋ Nhóm" hoặc Dán từ Excel.',
  fcFilterPh:'Lọc nhanh theo mã / tên / nhóm…', btnPaste:'Dán từ Excel',
  pasteHint:'Dán 3 cột từ Excel: <b>Mã FC ⇥ Tên ⇥ Tên nhóm</b> (cột nhóm được phép trống; nhóm chưa tồn tại sẽ được tạo và khớp theo tên, không phân biệt hoa thường).',
  btnPasteGo:'Nhập', btnPasteCancel:'Hủy',
  thFcCode:'Mã', thFcName:'Tên Fund Center', thFcGroup:'Nhóm',
  phCode:'Mã', phName:'Tên', optNoGroup:'(chưa gán nhóm)', tipDelFc:'Xóa FC',
  msgNothingImport:'Chưa có dữ liệu để nhập',
  msgImported:'Đã nhập {n} FC', msgImportedGroups:', tạo mới {g} nhóm',
  inputsHint:'Ẩn khu Nhóm / Fund Center để chỉ xem bảng luồng duyệt.',
  // --- bảng kết quả ---
  resH:'Bảng luồng duyệt', btnCopyFlow:'Copy bảng luồng',
  resFilterPh:'Tìm nhanh nhóm / Fund Center…',
  flowEmptyHint:'Thêm Fund Center (hoặc Dán từ Excel) và gán nhóm/CBQLNS để xem luồng duyệt.',
  colGroupFc:'Nhóm (FC)', colFundCenter:'Fund Center', colFlow:'Luồng', colFlowName:'Màu',
  lineCbqlns:'CBQLNS: ', lineBranch:'Nhánh: ', lineGroup:'nhóm: ',
  unassigned:'(chưa gán)', noFc:'(chưa có FC)', noCode:'(chưa mã)', noCodeLong:'(chưa có mã)',
  unassignedRow:'(Chưa gán nhóm — không tính được luồng) FC: ',
  msgCopiedFlow:'Đã copy bảng luồng ({view}) — dán thẳng vào Excel',
  viewByGroupWord:'theo nhóm', viewByFcWord:'theo FC',
  resHint:'Luật của từng luồng định nghĩa bằng kéo-thả ở tab <b>Định nghĩa luồng</b>. Nhánh của mỗi nhóm (Vận hành / Kinh doanh / Hỗ trợ / IT / Kế toán / Còn lại) suy ra từ vị trí CBQLNS trên Sơ đồ tổ chức.',
  // --- tab định nghĩa luồng ---
  rulesH:'Ma trận luồng duyệt — kéo box vai trò từ cột phải thả vào ô',
  rulesHint:'Ô <b>🔒 CBQLNS</b> là cố định. Bấm nhãn phạm vi trên box đã thả để xoay vòng <b>Tất cả → Vận hành → Kinh doanh → Hỗ trợ → IT → Kế toán → Còn lại</b> — một ô chứa 1 box "Tất cả", hoặc nhiều box mỗi nhánh một cái. Nhánh đánh dấu bằng dropdown trong panel Chi tiết box. Tick <b>"CBQLNS cấp dưới tự PD"</b> trên box vai trò lấy từ sơ đồ để CBQLNS nằm dưới box đó tự ký thay.',
  paletteH:'Box vai trò', btnAddFreeRole:'＋ Box mới', btnAddNodeRole:'＋ Từ sơ đồ',
  paletteHint:'Box "từ sơ đồ" lấy trực tiếp chức danh/người từ box trên Sơ đồ tổ chức (vd MCEO, MD) — sửa bên sơ đồ là bên này tự cập nhật. Kéo ở tay nắm ⠿ để thả vào ma trận.',
  msgCellFixed:'Ô này cố định là CBQLNS',
  msgPickBox:'Chọn một box trên sơ đồ trước', msgBoxExists:'Box này đã có trong danh sách',
  cfmDelRole:'Box "{name}" đang dùng ở {n} ô — xóa khỏi cả ma trận?',
  tipCycleScope:'Bấm để đổi phạm vi: Tất cả → Vận hành → Kinh doanh → Hỗ trợ → IT → Kế toán → Còn lại',
  tipRemoveFromCell:'Bỏ khỏi ô',
  tipLockedChip:'Cố định: CBQLNS của nhóm (box có ★ bên tab Sơ đồ)',
  slotHint:'thả vào đây',
  paletteEmpty:'Chưa có box vai trò nào — bấm "＋ Box mới" hoặc thêm từ sơ đồ.',
  tagFromChart:'từ sơ đồ', tagCustom:'tự đặt', usedCells:'{n} ô',
  tipDelRole:'Xóa box vai trò', phRoleTitle:'Chức danh', phRolePerson:'Người phụ trách',
  optPickChart:'(chọn box trên sơ đồ…)'
},
en: {
  docTitle:'Org Builder — org chart, hierarchy table & approval flows',
  tabOrg:'Org Chart', tabVline:'Vertical Line', tabRules:'Flow Rules', tabFlow:'Approval Flow',
  landingTitle:'Choose a module', btnHome:'⌂ Modules', tipHome:'Back to module selection',
  modDocH:'Chart layout', modDocD:'Lay out the org chart on a printable page: paper size, fonts, colour scheme, notes, headcount, print / PDF.',
  modFlowH:'Approval flow', modFlowD:'Org chart, vertical line, rule matrix and approval-flow tables per Fund Center group.',
  landingHint:'Both modules share one org tree and one JSON file — edits in either module show up in both.',
  lvlDB:'Special', lvlCC:'Senior',
  lblHc:'Headcount', hcAutoNote:'Auto: 1 (this box) + sum of the child boxes.', hcLeafNote:'Leaf box: enter a number (blank = 1, itself).',
  docPageH:'Page', docBoxH:'Box', lblPage:'Paper', lblOrient:'Orientation', orientL:'Landscape', orientP:'Portrait',
  lblFont:'Font', fontApp:'App font', lblScheme:'Colour scheme', schemePastel:'Pastel (app)', schemeClassic:'Classic (document)',
  lblHeader:'Page header', phHeader:'e.g. COMPANY ORGANISATION CHART',
  docCodeH:'Document code block', dcCode:'Document code', dcDate:'Effective date', dcAuthor:'Prepared by', dcReviewer:'Reviewed by (*)', dcApprover:'Approved by',
  notesH:'Notes', btnAddNote:'＋ Note', phNoteText:'Also reports to …', tipDelNote:'Delete note',
  showH:'Show', ckLegend:'Level legend (top right)', ckCode:'Document code block (top left)', ckNotes:'Notes list',
  ckHc:'Headcount on boxes', ckDesc:'Function descriptions', ckFit:'Shrink chart to fit the page',
  btnPrint:'🖨 Print / Save as PDF', btnPdf:'⬇ Download PDF', msgPdfLoading:'Preparing PDF (loading fonts)…', msgPdfDone:'PDF created', msgPdfFail:'Could not create the PDF',
  lblAnnot:'Note key (top-left badge)', lblDesc:'Function description (shown below the chart)', descHint:'Lines starting with "# " become bold underlined headings.',
  btnResetPos:'Reset position', btnResetEdge:'Reset connector',
  docEmptyHint:'Click a box to edit it. Drag a box sideways within its row; drag a connector segment to bend it.',
  docNoTree:'No boxes yet — click "＋ Root box".',
  btnVRoot:'＋ Global person', btnVImport:'＋ BMO from chart',
  vlineBarHint:'Select a parent box on the tree, then import — only ★ BMO boxes are listed.',
  vpanelH:'Details', vorgTip:'Imported from the Org Chart — content mirrors the source box',
  vpanelEmptyHint:'Vertical-line tree: each market BMO hangs under their global vertical-line superior.<br><br>Start with "＋ Global person" and fill in the fields. Select that box, then "＋ BMO from chart" to attach BMOs beneath it.<br><br>Imported boxes mirror the Org Chart — edit them there.',
  vImportedNote:'Imported from the Org Chart — edit its content on that tab.',
  optPickStar:'(pick a ★ BMO box…)',
  msgPickStar:'Pick a ★ BMO box from the list first',
  msgPickVParent:'Select a parent box on the vertical-line tree first (a global person)',
  modeLbl:'Resolve by:', modeFlow:'Flows', modeVline:'Vertical line',
  modeVlineNote:'Cells holding the "BMO\'s vertical line" box look up the Vertical Line tree per group.',
  vlineBoxName:"BMO's vertical line", tagFixed:'fixed',
  vlineBoxHint:"Drop into a cell: the approver becomes that group's BMO vertical-line superior (defined on the Vertical Line tab).",
  noVlineDef:'(vertical line not defined)',
  btnCopyTbl:'Copy', msgCopiedTbl:'Table copied — paste straight into Excel',
  pasteGrpHint:'Paste 3 columns from Excel: <b>FCG code ⇥ Group name ⇥ BMO person name</b> (BMO column may be blank; matched against ★ box person names, case-insensitive; existing FCG codes are updated in place).',
  msgGrpImported:'Imported {n} new groups, updated {u} matching codes',
  btnSave:'Save JSON', btnOpen:'Open JSON', btnUndo:'↶ Undo',
  btnRoot:'＋ Root box', btnCopy:'Copy table', btnDrawio:'Export .drawio',
  tipZoomOut:'Zoom out', tipZoomReset:'Reset to 100%', tipZoomIn:'Zoom in', btnZoomFit:'Fit to screen',
  lblHideChart:'Hide chart', lblShowChart:'Show chart', lblHidePanel:'Hide panel', lblShowPanel:'Show panel',
  lblTblCollapse:'Collapse ▾', lblTblExpand:'Expand ▴',
  lblHideInputs:'Hide input area ▴', lblShowInputs:'Show input area ▸',
  lblViewByGroup:'View: by group', lblViewByFc:'View: per FC',
  orgTableH:'Hierarchy table (columns aligned by level)',
  orgTableEmpty:'The table updates as you draw. Each branch is one row; each column is a level row on the chart. A "—" cell means the branch passes through that level.',
  cbqlns:'BMO',
  tipStar:'BMO — Budget Management Officer',
  brBadgeVH:'OPS', brBadgeSM:'SM', brBadgeBO:'BO', brBadgeIT:'IT', brBadgeAC:'AC',
  segALL:'All', segVH:'Operations', segSM:'Sales', segBO:'Back office', segIT:'IT', segAC:'Accounting', segREST:'Others',
  brNone:'— None —', lblBranch:'Branch (drives approval flow)',
  brTipNode:'Root of the {br} branch — BMOs under it use the "{br}" flow',
  cigH:'Cost groups (CIG)', btnAddCig:'＋ CIG', tipDelCig:'Delete CIG',
  phCigCode:'CI-…', phCigName:'Cost group name',
  cigHint:'Commitment Item Group — a cost category. Each CIG can carry its own rule set (toggle above the matrix).',
  scenLbl:'Defining rules for:', scenCommon:'Common',
  scenCommonNote:'Applies to every CIG without its own rule set.',
  scenOwn:'{code} has its own rules — edits here do not touch "Common".',
  thCig:'CIG', grpCigAll:'Single', grpCigSplit:'Per CIG',
  tipGrpCig:'Result table: one row for all CIGs, or split into one row per CIG',
  lineCig:'CIG: ',
  ckPdBelow:'BMO below approves directly',
  tipPdBelow:'When a group\'s BMO sits under this box, that BMO signs the cell holding this box '
           + 'instead of escalating up to it.',
  pdDelegatedNote:'\n(BMO approves directly)',
  panelH:'Box details', panelEmptyH:'Details',
  panelEmptyHint:'Select a box to edit.<br><br>Start with "＋ Root box", fill in the details, then "＋ Child".<br><br>Drag the background to pan. Ctrl+Z to undo.<br><br>The top level is CC, then T1…T8. A child\'s level is at least its parent\'s.<br><br>★ = BMO (Budget Management Officer), used by the Approval Flow tab.<br><br>The "Branch" dropdown marks the root of the Operations / Sales / Back office branch — a BMO under one of them uses that branch\'s flow; anyone outside uses "Others".',
  lblDept:'Department / division (auto UPPERCASE, bold)', lblTitle:'Job title (bold)', lblPerson:'Person in charge (italic)',
  lblLevel:'Level', lblLevelMin:' (min {L}, from parent)',
  ckCbqlns:'★ BMO (Budget Management Officer)',
  btnChild:'＋ Child', btnSib:'＋ Sibling', btnCollapse:'Collapse children', btnExpand:'Expand children',
  btnFocus:'Focus branch', btnUnfocus:'Unfocus', btnDel:'Delete', focusLbl:'Focus:',
  panelHint:'◀ ▶ reorder among siblings. Long text is clipped with "…" — hover a box to see it in full.',
  emptyBox:'(empty)', unnamed:'(unnamed)',
  hidTip:'Hiding {n} descendant boxes — click to expand',
  msgUnfocusRoot:'Focus cleared to add a root box',
  cfmDelNode:'Delete "{name}" and {n} descendant boxes?',
  msgRaised:'Raised {n} descendant boxes to match the new level',
  msgFocusCleared:'Focus cleared (the focused branch is inside the collapsed area)',
  msgNoUndo:'Nothing to undo', msgUndoErr:'Undo failed', msgUndone:'Undone',
  msgNothingCopy:'Nothing to copy',
  msgCopiedView:'Copied current view{hidden} — paste straight into Excel',
  hiddenSuffix:' ({n} boxes hidden)',
  msgSavedJson:'Downloaded orgchart.json',
  msgBadJson:'Not a valid JSON file — current data kept',
  msgBadStruct:'Unexpected file structure — current data kept',
  msgOpened:'File opened', msgReadFail:'Could not read the file',
  msgNewerFile:'Saved by a newer version (schema v{v}, this app supports up to v{s}) — opened, unknown data may be ignored',
  msgRolesPruned:'Removed {n} role box(es) linked to the deleted box ({c} rule cells) — Ctrl+Z to undo',
  msgNothingExport:'Nothing to export',
  msgDrawioSaved:'Downloaded orgchart.drawio{hidden}', drawioHiddenSuffix:' (current view — {n} boxes hidden)',
  msgCopyBlocked:'Clipboard blocked by the browser',
  roleDeleted:'(chart box deleted)', starRemoved:'\n(★ removed from box)', noCbqlns:'(no BMO assigned)',
  groupUnnamed:'(unnamed group)',
  phFcg:'FCG…', phGrpName:'Group name', optNoCbqlns:'(no BMO assigned)', optStarRemoved:'(★ removed) ',
  tipDelGroup:'Delete group', grpH:'Fund Center Groups', fcH:'Fund Centers',
  grpFilterPh:'Quick filter by code / group name…', btnAddGrp:'＋ Group',
  thFcgCode:'FCG code', thGrpName:'Group name', thCbqlns:'BMO (★)',
  grpHint:'Each group is assigned one BMO (★ box on the Org Chart tab). Flows are computed per group.',
  grpEmpty:'No groups yet — click "＋ Group" or Paste from Excel.',
  fcFilterPh:'Quick filter by code / name / group…', btnPaste:'Paste from Excel',
  pasteHint:'Paste 3 columns from Excel: <b>FC code ⇥ Name ⇥ Group name</b> (the group column may be blank; unknown groups are created and matched by name, case-insensitive).',
  btnPasteGo:'Import', btnPasteCancel:'Cancel',
  thFcCode:'Code', thFcName:'Fund Center name', thFcGroup:'Group',
  phCode:'Code', phName:'Name', optNoGroup:'(no group)', tipDelFc:'Delete FC',
  msgNothingImport:'No data to import',
  msgImported:'Imported {n} FCs', msgImportedGroups:', created {g} new groups',
  inputsHint:'Hide the Groups / Fund Center area to see only the approval flow table.',
  resH:'Approval flow table', btnCopyFlow:'Copy flow table',
  resFilterPh:'Find group / Fund Center…',
  flowEmptyHint:'Add Fund Centers (or Paste from Excel) and assign groups/BMO to see approval flows.',
  colGroupFc:'Group (FC)', colFundCenter:'Fund Center', colFlow:'Flow', colFlowName:'Flow',
  lineCbqlns:'BMO: ', lineBranch:'Branch: ', lineGroup:'group: ',
  unassigned:'(unassigned)', noFc:'(no FCs)', noCode:'(no code)', noCodeLong:'(no code)',
  unassignedRow:'(No group assigned — flow cannot be computed) FC: ',
  msgCopiedFlow:'Copied flow table ({view}) — paste straight into Excel',
  viewByGroupWord:'by group', viewByFcWord:'per FC',
  resHint:'Flow rules are defined by drag-and-drop on the <b>Flow Rules</b> tab. Each group\'s branch (Operations / Sales / Back office / IT / Accounting / Others) is derived from its BMO\'s position on the org chart.',
  rulesH:'Approval flow matrix — drag role boxes from the right panel into cells',
  rulesHint:'The <b>🔒 BMO</b> cells are fixed. Click the scope tag on a placed box to cycle <b>All → Operations → Sales → Back office → IT → Accounting → Others</b> — a cell holds one "All" box, or one box per branch. Mark branches with the dropdown in the Box details panel. Tick <b>"BMO below approves directly"</b> on a from-chart box to let a BMO under it sign in its place.',
  paletteH:'Role boxes', btnAddFreeRole:'＋ New box', btnAddNodeRole:'＋ From chart',
  paletteHint:'A "from chart" box pulls its title/person straight from an Org Chart box (e.g. MCEO, MD) — edit it there and it updates here. Drag by the ⠿ handle to drop into the matrix.',
  msgCellFixed:'This cell is fixed to the BMO',
  msgPickBox:'Pick a chart box first', msgBoxExists:'This box is already in the list',
  cfmDelRole:'Box "{name}" is used in {n} cells — remove it from the matrix too?',
  tipCycleScope:'Click to cycle scope: All → Operations → Sales → Back office → IT → Accounting → Others',
  tipRemoveFromCell:'Remove from cell',
  tipLockedChip:"Fixed: the group's BMO (★ box on the Org Chart tab)",
  slotHint:'drop here',
  paletteEmpty:'No role boxes yet — click "＋ New box" or add one from the chart.',
  tagFromChart:'from chart', tagCustom:'custom', usedCells:'{n} cells',
  tipDelRole:'Delete role box', phRoleTitle:'Job title', phRolePerson:'Person',
  optPickChart:'(pick a chart box…)'
}
};
function t(k){ var d = STR[LANG]; return (d && d[k] !== undefined ? d[k] : STR.vi[k]) || k; }
function tf(k, p){ return t(k).replace(/\{(\w+)\}/g, function(_, n){ return p[n]; }); }
// Nhãn miền: khóa dữ liệu -> nhãn hiển thị theo ngôn ngữ (khóa JSON không đổi)
var FLOW_EN = {'Xanh':'Green','Vàng':'Yellow','Đỏ':'Red','Tím':'Purple','NNS':'Additional budget'};
var COL_EN  = {'TĐ1':'R1','TĐ2':'R2','TĐ3':'R3','TĐ4':'R4','TĐ*':'R*','PD':'Approval'};
function flowLabel(f){ return LANG === 'en' ? (FLOW_EN[f] || f) : f; }
function colLabel(c){ return LANG === 'en' ? (COL_EN[c] || c) : c; }
function segLabel(s){ return t('seg' + s); }
// Áp chuỗi tĩnh (data-i18n*) + tiêu đề trang; gọi lúc khởi động và mỗi lần đổi ngôn ngữ
function applyStatic(){
  document.querySelectorAll('[data-i18n]').forEach(function(el){ el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-html]').forEach(function(el){ el.innerHTML = t(el.getAttribute('data-i18n-html')); });
  document.querySelectorAll('[data-i18n-ph]').forEach(function(el){ el.placeholder = t(el.getAttribute('data-i18n-ph')); });
  document.querySelectorAll('[data-i18n-title]').forEach(function(el){ el.title = t(el.getAttribute('data-i18n-title')); });
  document.querySelectorAll('[data-col]').forEach(function(el){ el.textContent = colLabel(el.getAttribute('data-col')); });
  document.title = t('docTitle');
  document.documentElement.lang = LANG;
  var bl = $('bLang'); if (bl) bl.textContent = LANG === 'vi' ? 'English' : 'Tiếng Việt';
  refreshStateLabels();
}
function setLang(l){
  LANG = l;
  try{ localStorage.setItem('ob_lang', l); }catch(_){/**/}
  applyStatic();
  renderAll();
}

var LEVELS = ['ĐB','CC','T1','T2','T3','T4','T5','T6','T7','T8'];   // ĐB = Đặc biệt (trên Cao cấp)
var LMAX = LEVELS.length - 1;
// Màu cấp — pastel, cùng hệ với bảng màu UI (xem :root trong CSS)
var TCOLOR = {'ĐB':'#F0A6C0',CC:'#6B8FE8',T1:'#FFB98A',T2:'#A8D989',T3:'#FFD93D',
              T4:'#7ECEE0',T5:'#C3AEE8',T6:'#FFFDF8',T7:'#FFFDF8',T8:'#FFFDF8'};

function $(id){ return document.getElementById(id); }
function rnum(lv){ return LEVELS.indexOf(lv); }
function msg(s){
  var m = $('msg'); m.textContent = s;
  clearTimeout(msg._t); msg._t = setTimeout(function(){ m.textContent=''; }, 3500);
}
function debounce(fn, ms){                       // gõ liền mạch -> chỉ chạy 1 lần sau khi ngừng
  var tm; return function(){ clearTimeout(tm); tm = setTimeout(fn, ms); };
}
function dispName(n){ return n.dept || n.title || n.person || t('emptyBox'); }
function cellText(n){
  var p = [n.dept, n.title, n.person].filter(Boolean);
  if (n.star) p.push('★ ' + t('cbqlns'));
  return p.length ? p.join('\n') : t('emptyBox');
}
function roleText(n){
  return [n.title || n.dept, n.person].filter(Boolean).join('\n') || t('emptyBox');
}
