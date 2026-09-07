# Kiến trúc Org Builder (một trang)

App tĩnh, không build step: `public/index.html` (markup) + `public/css/app.css` + `public/js/01…12-*.js` là các
classic script dùng chung một state global, nạp theo thứ tự số. Không framework, không bundler; mở file là chạy.

## Dòng dữ liệu

```
người dùng bấm / gõ
        │
        ▼
mutate(key, fn, after)          ← CỬA DUY NHẤT cho mọi thay đổi dữ liệu (03-state.js)
   ├─ snap(key)                 ← dirty = true, mọi tab đánh dấu "cũ", snapshot Undo (gộp khi gõ liên tục cùng một ô)
   ├─ fn()                      ← thay đổi state: nodes / fcGroups / fcs / roleBoxes / ruleGrids / vnodes / cigs / doc
   └─ after()                   ← vẽ lại: mặc định renderAll(); đang gõ thì refreshView() hoặc hàm vá nhẹ hơn
        │
        ▼
renderAll()                     ← chỉ vẽ MODULE / TAB ĐANG MỞ (05-org-render.js)
   ├─ MOD === 'doc'  → renderDocAll()
   └─ MOD === 'flow' → renderTab(curTab)     tab khác vẽ khi mở nhờ cờ staleTabs (showTab)
```

Quy tắc bất di bất dịch:

1. **Không nơi nào sửa state ngoài `mutate`.** `snap()` chỉ được gọi bên trong `mutate`. Nhờ vậy undo, cờ dirty
   (cảnh báo đóng tab) và vẽ lại luôn đi cùng nhau; lỗi "Save rồi gõ tiếp đúng ô cũ không được cảnh báo" không thể tái diễn.
2. **Tab ẩn không được vẽ.** Thao tác ở sơ đồ với 2.000 FC không dựng lại bảng FC hay bảng luồng duyệt đang ẩn.
   Test hoặc code nào cần DOM của một tab phải `showTab()` trước.
3. **Chỉ animation một lần** đi qua `animNextBox`/`takeAnim`: render lại vì gõ phím không nháy lại.
4. **View-state không vào snapshot**: `sel`, `vsel`, `curCig`, `curTab`, `MOD`, zoom. Chúng không nằm trong `serializeAll()`.

## Ai được sửa gì

| Vùng state | File khai báo | Mutation qua |
|---|---|---|
| `nodes`, `rootIds`, `focusId` (cây tổ chức) | 03-state | 04-model (`addRoot/addChild/addSib/delNode/setT/toggleStar/setBranch/moveSib/toggleCollapse/setFocus/clearFocus/setHc`), panel 05 / 11 (gõ 3 trường) |
| `vnodes`, `vroots` (ngành dọc) | 03-state | 07-vline (`vAddRoot/vAdd/vAddSib/vMove/vDel/vImport`) |
| `fcGroups`, `fcs` | 03-state | 08-flow (`addGroup/delGroup/addFc/delFc`, handler ô bảng, `mergeGroupRows/mergeFcRows` khi dán) |
| `roleBoxes`, `ruleGrids`, `vlineGrids`, `ruleMode`, `cigs` | 03-state | 09-rules (`dropRole/cycleScope/removeAssign/addFreeRole/addNodeRole/deleteRole/setRuleMode/setCurCig/addCig/delCig`) |
| `doc` (lớp trình bày) | 03-state | 11-doc (`docSet`, panel Box/Trang, `setRowShift`, kéo đổi hàng) |

## Nạp / lưu

`serializeAll()` → JSON schema `v: SCHEMA_V`. `applyState(d)` là bộ validate duy nhất: cấu trúc, ID hợp lệ và **duy nhất theo từng loại**
(trùng → ném lỗi, file bị từ chối, dữ liệu hiện tại giữ nguyên), ID thiếu được cấp mới không đụng ID có sẵn, cấp con ≥ cấp cha,
tham chiếu hỏng bị bỏ và **đếm** để `loadJSON` báo. Undo dùng chính `applyState` với snapshot của `serializeAll()`.
Bất biến dữ liệu được mô tả bằng code trong `checkInvariants()`; test gọi nó sau mỗi thao tác.

## Dán / copy Excel

`parsePaste` (thuần) → `mergeGroupRows` / `mergeFcRows` (thuần, chỉ đụng state) → vỏ DOM `importGrpPaste` / `importPaste`.
Tên chỉ dùng để khớp khi **duy nhất**; nhóm khớp theo **mã** trước. Dòng mơ hồ để trống và được liệt kê trong toast.
`groupsTsv` / `fcsTsv` xuất cùng cột với định dạng dán (FC có thêm cột mã nhóm) nên copy ở app rồi dán lại vẫn đúng nhóm.

## Module và thứ tự nạp

| File | Vai trò |
|---|---|
| 01-consts | hằng số hình học, `SCHEMA_V`, `APP_VER` |
| 02-i18n | từ điển vi/en, `t/tf`, `$`, `msg` (toast), `replay`, `debounce` |
| 03-state | state global, `serializeAll`, `snap`, **`mutate`**, `staleTabs`, `undo`, `checkInvariants`, lớp `doc` |
| 04-model | thao tác cây, `select`, `visibleSet`, `layout` (thuần) |
| 05-org-render | canvas, panel, bảng phân cấp, **`renderTab` / `renderAll` / `refreshView`** |
| 06-export | TSV (`q` chặn formula injection), `saveJSON`, **`applyState`**, `loadJSON`, .drawio |
| 07-vline | tab Ngành dọc |
| 08-flow | engine luồng (`resolveCell`, `flowBlocks`), bảng nhóm/FC, dán/copy Excel, bảng kết quả |
| 09-rules | ma trận luật, palette box vai trò, CIG |
| 10-zoom | zoom + minimap tab Sơ đồ |
| 11-doc | module Trình bày sơ đồ (SVG mm, PDF) |
| 12-wiring | landing, popup, tab, module, mọi handler nút, init |

## Kiểm thử ba tầng

1. **Node, không trình duyệt** (`tests/logic.test.mjs` qua `tests/_node.mjs`): nạp 01…11 vào một `vm` context với DOM giả,
   thay lớp vẽ bằng hàm rỗng. Test mốc Save/undo, `applyState`, dán Excel, layout, engine luồng và **fuzz 400 thao tác** có seed:
   sau mỗi bước `checkInvariants()` rỗng, undo về đúng trạng thái trước, serialize → apply → serialize idempotent. Chạy trong vài giây.
2. **Playwright, hành vi UI** (`cleanup`, `review1`, `review2`, `doc`, `landing`): những gì cần DOM thật.
3. **Playwright, chất lượng** (`tests/quality.test.mjs`): mốc Save qua UI thật, **ngưỡng hiệu năng** (2.000 FC: thao tác ở sơ đồ
   không dựng lại bảng ẩn, dưới 150 ms), dán mơ hồ qua UI, mở file JSON trùng ID / tham chiếu hỏng qua ô chọn file.

`npm test` chạy tất cả; `node tests/run.mjs logic` chạy riêng tầng Node.
