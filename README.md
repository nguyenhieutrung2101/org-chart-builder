# Org Builder ☕️

> **project affogato** — made with ❤️ by Trung

Công cụ vẽ **sơ đồ tổ chức** dùng cho hai việc: **trình bày sơ đồ trên trang in** (khổ giấy, font, bảng màu, ghi chú, định biên, PDF) và **sinh bảng luồng duyệt ngân sách** cho từng nhóm Fund Center từ luật phê duyệt — chạy hoàn toàn trên trình duyệt, không cần backend, không cài gì.

🌐 **Bản chạy thử:** https://org-chart-builder.nguyenhieutrung2101.workers.dev

Giao diện **song ngữ Anh / Việt** (mặc định English; nút ở góc landing hoặc header, nhớ lựa chọn cho lần sau). Thuật ngữ được dịch đồng nhất: CBQLNS ↔ BMO (Budget Management Officer), TĐ1–TĐ4 ↔ R1–R4, TĐ* ↔ R*, PD ↔ Approval, Xanh / Vàng / Đỏ / Tím / NNS ↔ Green / Yellow / Red / Purple / Additional budget.

---

## Hai module, một cây tổ chức

Mở app là vào **landing chọn module**: hai nửa màn hình (Trình bày = xanh ngọc, Luồng duyệt = vàng), rê chuột nửa nào thì nửa đó nở ra, bấm là chuyển module. Lần đầu mở mỗi phiên bản, **popup giới thiệu + Có gì mới** tự bật (cờ `ob_seen` trong localStorage); sau đó mở lại bằng nút **Có gì mới** / **Về dự án** ở góc dưới-trái landing. Cả hai module dùng chung **một cây tổ chức và một file JSON**: vẽ ở module nào thì module kia cũng cập nhật. Module Trình bày có thêm thông tin riêng (định biên, ghi chú, mô tả, vị trí kéo tay…) — module Luồng duyệt không cần và không bị ảnh hưởng; box tạo ở Luồng duyệt sang Trình bày chỉ để trống các thông tin đó.

| Module | Dùng để |
|---|---|
| 📄 **Trình bày sơ đồ** | Vẽ và căn chỉnh sơ đồ trên trang in, xuất PDF |
| 📗 **Luồng duyệt** | Sơ đồ + ngành dọc + ma trận luật → bảng luồng duyệt theo nhóm Fund Center |

Chuyển động trong app chỉ dùng transform/opacity, 120–450 ms, tôn trọng `prefers-reduced-motion`: chuyển module / tab nổi lên, tab đang chọn "lún" như nút bấm, toast là viên mực trượt lên từ đáy, box mới pop / box vừa chọn nháy vòng xanh / box xoá mờ dần, chip thả vào ô luật "đáp" xuống và ô đích đập nhịp khi rê qua, bảng luồng duyệt nổi so le khi vừa hiện, ô định vị minimap trượt mềm, nút Tải PDF chạy ba chấm khi đang dựng. Không animate khi render lại lúc đang gõ.

## 📄 Module Trình bày sơ đồ

- **Trang in thật**: chọn khổ **A4 / A3 / A2**, **ngang / dọc**; sơ đồ tự co cho vừa trang (tắt được); tuỳ chọn **chiều cao trang tự động theo nội dung** (giữ bề rộng khổ giấy, in/PDF đúng kích thước đó). Lề, cỡ chữ, khoảng cách tính bằng mm nên màn hình = bản in.
- **Logo** dán mã SVG (hiện cố định 8 mm cao ở góc trái trên, script bị lọc bỏ); **tiêu đề trang** đậm căn giữa; **khối mã văn bản** góc trái (Mã văn bản / Ngày áp dụng / Người soạn thảo / Người thẩm định / Người phê duyệt); **bảng màu cấp** góc phải (Đặc biệt → Cao cấp → T1…T5 → T6/T7/T8).
- **Ghi chú chữ cái**: khai báo danh sách A, B, C… kèm diễn giải; gán chữ cái cho từng box để hiện badge nhỏ ở góc trên-trái box, đúng như tài liệu sơ đồ tổ chức thông dụng.
- **Định biên**: box không có box con nhập số tự định nghĩa (trống = 1); box có con tự cộng **1 + tổng các box con**, hiện ở góc dưới-phải box (tắt được).
- **Cụm mô tả chức năng** phía dưới sơ đồ, thẳng cột với box; dòng bắt đầu bằng `# ` thành tiêu đề đậm gạch chân.
- **Box cao cố định (~5 dòng)**: tên phòng tối đa 2 dòng ở cỡ chuẩn (dài hơn thì co chữ, không bao giờ cắt "…"), chức danh 1 dòng có thể **ẩn/hiện "(Tx)" cho riêng từng box**, người phụ trách **nhiều dòng**; quá 5 dòng thì cả nội dung co lại cho vừa box.
- **Hàng như kệ sách**: mọi box nằm trên các hàng ngang thẳng tắp; con ở hàng ngay dưới cha, không ép cùng cấp T cùng hàng. Người dùng **kéo box lên/xuống** (có đường kẻ hàng hướng dẫn khi kéo; thả chuột mới ghi, một lần kéo = một bước Undo) hoặc bấm ▲▼ để đổi hàng — box phía dưới bị đùn theo. Sơ đồ bắt đầu ngay dưới tiêu đề và chỉ né khối ghi chú / bảng màu khi thật sự chạm; thanh ngang nối xuống con luôn nằm ngay trên hàng con nên không cắt qua ghi chú khi đẩy hàng.
- **Hai kiểu nối** giữ bản vẽ đồng nhất (không kéo đường nối tay): mặc định các con **dàn ngang** nối từ cạnh dưới cha; tick **"Xếp dọc thành nhóm"** cho một số con thì chúng thành **một cột dọc** nối bằng một đường dọc bên trái vào cạnh trái từng box (cột đứng ngoài cùng bên trái nếu còn con dàn ngang, treo ngay dưới cha nếu chỉ có nhóm này).
- **Zoom mượt** quanh con trỏ (lăn chuột) và **kéo nền để di chuyển trang** (không bôi đen chữ).
- **Font**: font của app, Arial, Times New Roman. **Bảng màu**: bảng màu gốc của văn bản sơ đồ tổ chức (mặc định, đúng mã màu chuẩn) hoặc pastel của app.
- **In / Save as PDF** qua hộp thoại in của trình duyệt (vector, đúng khổ giấy), hoặc **⬇ Tải PDF** trực tiếp — PDF vector **nhúng đúng font đang chọn**: trên Chrome/Edge desktop, app xin quyền đọc font máy (Local Font Access, hỏi một lần) để lấy chính Arial / Times New Roman đang hiện trên màn hình; trình duyệt khác hoặc từ chối thì nhúng Liberation cùng metric (đủ dấu tiếng Việt). Thư viện jsPDF + svg2pdf chỉ nạp khi bấm.

## 📗 Module Luồng duyệt

### 1. 🏢 Sơ đồ tổ chức
- Vẽ cây tổ chức theo cấp **ĐB (Đặc biệt) → CC (Cao cấp) → T1…T8**, mỗi box gồm 3 trường: *phòng/khối* (tự IN HOA), *chức danh*, *người phụ trách*; màu nền theo cấp.
- Ràng buộc cấp: box con tối thiểu bằng cấp box cha (tự nâng cấp dưới khi đổi cấp cha).
- Đánh dấu **★ CBQLNS** (cán bộ quản lý ngân sách) — nguồn để gán cho nhóm Fund Center và để đưa lên cây Ngành dọc.
- Đánh dấu **nhánh** bằng dropdown trong panel: **Vận hành (VH) / Kinh doanh (SM) / Hỗ trợ (BO) / IT / Kế toán (KT)**. Một loại nhánh có thể gắn lên nhiều box; cả cây con kế thừa; box không nằm dưới nhánh nào tính là **Còn lại**. Badge nhánh tự đổi màu khi trùng màu cấp để không bị hòa lẫn.
- **Zoom mượt 20%–200%** quanh con trỏ (lăn chuột, nút −/＋/100%/Vừa màn hình) + **minimap** góc trái tự co theo tỷ lệ sơ đồ, bấm/kéo để di chuyển nhanh.
- Kéo nền để pan, **focus một nhánh**, thu gọn/bung cấp dưới từng box, ẩn sơ đồ/panel, **hoàn tác Ctrl+Z**.
- **Bảng phân cấp** (mặc định thu gọn) tự cập nhật, cột thẳng hàng theo cấp.

### 2. 🌐 Ngành dọc
- Cây riêng mô tả CBQLNS thị trường **báo cáo lên ai ở Global**: vẽ **người global** (tự gõ 3 trường) rồi **import box ★ từ sơ đồ** làm cấp dưới — dropdown chỉ liệt kê box đã tick ★ và chưa có trên cây.
- Box import **mirror trực tiếp** nội dung từ tab Sơ đồ (sửa bên đó là bên này đổi theo, panel bên này read-only). Xoá box gốc thì node import tự gỡ, con nối lên ông bà.
- Cây này là đầu vào cho chế độ **"Xử lý theo: Ngành dọc"** ở tab Định nghĩa luồng.

### 3. 🧩 Định nghĩa luồng
- **Ma trận luật**: hàng = 5 luồng (Xanh / Vàng / Đỏ / Tím / NNS), cột = TĐ1–TĐ4, TĐ*, PD. Ô **🔒 CBQLNS** cố định (Xanh ở PD, các luồng khác ở TĐ1).
- **Box vai trò** kéo từ palette thả vào ô: box tự đặt (chức danh + người) hoặc **link từ sơ đồ tổ chức** (sửa bên sơ đồ là tự cập nhật). Box từ sơ đồ có trigger **"CBQLNS cấp dưới tự PD"**: nếu CBQLNS của nhóm nằm dưới box đó thì chính CBQLNS ký ở ô này thay vì đẩy lên.
- Toggle **Xử lý theo: Luồng | Ngành dọc** — hai bộ luật **độc lập hoàn toàn**, không trộn lẫn:
  - **Luồng**: mỗi box thả vào ô mang phạm vi **Tất cả → Vận hành → Kinh doanh → Hỗ trợ → IT → Kế toán → Còn lại** (bấm nhãn để xoay vòng). Một ô chứa 1 box "Tất cả" hoặc nhiều box mỗi nhánh một cái; người duyệt chọn theo nhánh của CBQLNS nhóm đó.
  - **Ngành dọc**: mỗi ô đúng 1 box, không có nhãn phạm vi. Palette có box cố định **"Ngành dọc của CBQLNS"** — thả vào ô nào thì ô đó resolve **theo từng nhóm** = cấp trên trực tiếp của CBQLNS nhóm đó trên cây Ngành dọc. Vẫn thả box thường cho các ô đặc thù.
- **Nhóm chi phí (CIG — Commitment Item Group)**: mặc định CI-SM / CI-TE / CI-OP, thêm/xoá tuỳ ý. Mỗi CIG có thể có **bộ luật riêng** (nút "Đang định nghĩa cho: Chung | CI-…" phía trên ma trận; mở lần đầu sẽ clone từ "Chung", sau đó sửa độc lập).

### 4. 📗 Luồng duyệt
- **Nhóm Fund Center** (mã FCG, tên, gán CBQLNS, toggle *1 luồng / Theo CIG*) và **Fund Center** (mã, tên, nhóm) — có lọc nhanh, nút **Copy** (TSV) và **Dán từ Excel** trên cả hai card:
  - FCG: `Mã ⇥ Tên ⇥ Tên người CBQLNS` — khớp người theo tên box ★ **chỉ khi có đúng một box ★ tên đó**; trùng mã thì cập nhật dòng cũ.
  - FC: `Mã ⇥ Tên ⇥ Tên nhóm ⇥ Mã nhóm` — nhóm tìm theo **mã** trước rồi theo tên, chỉ tự gán khi duy nhất; chưa có thì tạo mới.
  - Dòng không gán được (tên trùng, không có box ★): dòng mới để trống, dòng cập nhật giữ người cũ, và **danh sách đầy đủ hiện ngay trong hộp dán** để rà từng dòng. Nút Copy xuất đúng các cột này (FC kèm mã nhóm); ô có ngoặc kép, tab, xuống dòng vẫn round-trip.
  - Dòng tiêu đề: app **đoán** (chỉ khi ô đầu **đúng** nhãn app xuất ra hoặc "Mã"/"Code") và hiện kết quả ở checkbox **"Dòng đầu là tiêu đề"** cạnh hộp dán; mã thật như `FCG01`, `FC 001`, `ID` không bao giờ bị nuốt, còn một mã trùng chữ "Code" thì bỏ tick là nhập được. Ngoặc kép chưa đóng thì báo dòng và không nhập gì.
- **Bảng luồng duyệt** sinh tự động: mỗi nhóm × 5 luồng, người duyệt từng bước tính từ ma trận luật của chế độ đang chọn (Luồng: theo nhánh của CBQLNS; Ngành dọc: theo cây Ngành dọc). Nhóm bật "Theo CIG" được tách thành một khối cho mỗi CIG với bộ luật tương ứng.
- Xem gộp theo nhóm hoặc bung theo từng FC; **ô lọc nhanh** theo tên nhóm/FC; **copy bảng** dán thẳng vào Excel; nút ẩn khu nhập liệu để bảng chiếm trọn màn hình.

### 💾 Dữ liệu & xuất
- **Lưu / Mở JSON** (schema **v11**): sơ đồ (kèm định biên, ghi chú, mô tả, vị trí kéo tay) + thiết lập trang in + cây Ngành dọc + nhóm/FC + box vai trò + hai bộ luật (theo CIG) + danh sách CIG trong 1 file. Dữ liệu **chỉ nằm trong file của bạn**, không lưu trên server. File bản cũ vẫn mở được (tự nâng cấp); file lưu bằng bản mới hơn sẽ có cảnh báo.
- **Copy bảng** (TSV, dán vào Excel không vỡ cột) cho bảng phân cấp, bảng FCG/FC và bảng luồng duyệt.
- **Xuất .drawio** (mở bằng [draw.io](https://app.diagrams.net) — giữ màu, vị trí, thuộc tính).

## Cách dùng

Mở https://org-chart-builder.nguyenhieutrung2101.workers.dev — hoặc chạy cục bộ:

```bash
git clone https://github.com/nguyenhieutrung2101/org-chart-builder.git
# mở public/index.html bằng trình duyệt là xong — không cần cài gì
```

Ứng dụng là **trang tĩnh, không build step**: `public/index.html` + `css/app.css` + các file `js/` nạp theo thứ tự (state dùng chung là global). Không phụ thuộc thư viện ngoài, trừ jsPDF + svg2pdf (đã vendor, chỉ nạp khi tải PDF).

## Triển khai

Deploy tự động lên **Cloudflare Workers** (static assets) mỗi khi merge vào `main`:

```
org-chart-builder/
├── public/
│   ├── index.html          # markup: header, landing + popup giới thiệu, module Luồng duyệt (4 tab), module Trình bày, toast
│   ├── css/app.css         # toàn bộ style (cả rule in)
│   ├── js/01…12-*.js       # mỗi section một file, nạp theo thứ tự: hằng số, i18n, state, model, render,
│   │                       #   export, ngành dọc, luồng, luật, zoom, module Trình bày (11-doc.js), wiring
│   ├── js/vendor/          # jsPDF + svg2pdf (MIT) — chỉ nạp khi bấm "Tải PDF"
│   └── fonts/              # Liberation Sans/Serif (SIL OFL) nhúng vào PDF
├── tests/                  # ba tầng: logic + fuzz trong Node (_node.mjs), hành vi UI và chất lượng bằng Playwright (_browser.mjs)
├── docs/ARCHITECTURE.md    # một trang: dòng dữ liệu (mutate -> renderAll), ai được sửa gì, nạp/lưu, ba tầng test
├── docs/FUNCTIONS.md       # inventory mọi hàm theo file: chữ ký, mục đích, ai gọi ai, side-effect
├── package.json            # chỉ có devDependency playwright + script test/check
├── wrangler.jsonc          # cấu hình Cloudflare (assets = ./public)
└── README.md
```

## Kiểm thử

```bash
npm install          # cài playwright (Chromium)
npm test             # chạy mọi tests/*.test.mjs; node tests/run.mjs doc  -> chỉ bộ "doc"
node tests/run.mjs logic   # tầng Node: không cần Chromium, vài giây
npm run check        # node --check từng file js/
```

Ba tầng test (chi tiết trong `docs/ARCHITECTURE.md`):

- **Logic + fuzz trong Node** (`tests/logic.test.mjs`): nạp thẳng `js/01…11` vào một `vm` context với DOM giả, thay lớp vẽ bằng hàm rỗng. Kiểm tra mốc Save/undo, `applyState` nghiêm ngặt (ID trùng bị từ chối, tham chiếu hỏng được đếm), dán Excel, layout, engine luồng, và **400 thao tác ngẫu nhiên có seed**: sau mỗi bước bất biến dữ liệu (`checkInvariants`) phải rỗng, undo phải về đúng trạng thái trước, serialize → apply → serialize phải idempotent.
- **Hành vi UI** (`cleanup`, `review1`, `review2`, `doc`, `landing`): Playwright, những gì cần DOM thật.
- **Chất lượng** (`tests/quality.test.mjs`): mốc Save qua UI thật, **ngưỡng hiệu năng** với 2.000 FC (thao tác ở sơ đồ không dựng lại bảng đang ẩn, dưới 150 ms; xem theo FC × CIG chỉ dựng tối đa 2.500 dòng), dán mơ hồ qua UI, mở file JSON trùng ID / tham chiếu hỏng qua ô chọn file.

CI: `.github/workflows/test.yml` chạy toàn bộ trên mỗi PR.

Có sẵn Playwright ở nơi khác thì trỏ vào: `PW_MODULE=<…/playwright-core/index.mjs> PW_CHROMIUM=<…/chromium> npm test`.

Deploy thủ công: `npx wrangler deploy`

## Phím tắt & thao tác nhanh

| Thao tác | Cách làm |
|---|---|
| Hoàn tác | `Ctrl/⌘ + Z` (trong ô "Dán từ Excel" vẫn là undo gõ phím của trình duyệt) |
| Đổi ngôn ngữ | Nút **English / Tiếng Việt** ở góc landing hoặc header |
| Xem lại Có gì mới / Về dự án | Nút ở góc dưới-trái landing (Esc hoặc bấm ra ngoài để đóng) |
| Zoom sơ đồ | Lăn chuột trên canvas (quanh con trỏ), hoặc nút −/＋/100%/Vừa màn hình |
| Di chuyển vùng nhìn | Kéo nền canvas, hoặc bấm/kéo trên minimap |
| Sửa nhanh một box | Nháy đúp vào box |
| Đổi thứ tự box ngang hàng | Nút ◀ ▶ trong panel Chi tiết |
| Nhóm box xếp dọc (Trình bày) | Tick "Xếp dọc thành nhóm" trên từng box con muốn gộp |
| Đổi hàng của box (Trình bày) | Kéo box lên/xuống theo đường kẻ hàng, hoặc nút ▲ ▼ trong panel Box |
| Zoom / di chuyển trang (Trình bày) | Lăn chuột trên trang / kéo nền |
| In / PDF (Trình bày) | "In / Save as PDF" (hộp thoại in) hoặc "⬇ Tải PDF" |
| Quay lại chọn module | Nút "⌂ Module" ở header; địa chỉ `#doc` / `#flow` mở thẳng module (bỏ qua landing) |
| Thả box vai trò vào ô luật | Kéo ở tay nắm ⠿ trên card trong palette |
| Đổi phạm vi của box đã thả | Bấm nhãn phạm vi trên chip (chế độ Luồng) |
| Nhập FCG hàng loạt | "Dán từ Excel" trên card Nhóm Fund Center (Mã ⇥ Tên ⇥ Tên người CBQLNS) |
| Nhập Fund Center hàng loạt | "Dán từ Excel" trên card Fund Center (Mã ⇥ Tên ⇥ Tên nhóm ⇥ Mã nhóm; khớp mã trước, tên chỉ khi duy nhất) |

## Tài liệu cho người sửa code

`docs/ARCHITECTURE.md` là bản đồ một trang: mọi thay đổi dữ liệu đi qua `mutate()` (snapshot undo + cờ chưa lưu + vẽ lại luôn đi cùng nhau), `renderAll()` chỉ vẽ tab đang mở, `applyState()` là bộ validate duy nhất khi nạp file, `checkInvariants()` mô tả bất biến dữ liệu bằng code.

`docs/FUNCTIONS.md` liệt kê toàn bộ hàm trong `public/js/*.js` theo từng file (số dòng, chữ ký, mục đích, gọi đến / được gọi bởi, side-effect, entry point **[PUBLIC]**) kèm nhật ký các lần dọn dead code và sửa lỗi từ code review.
