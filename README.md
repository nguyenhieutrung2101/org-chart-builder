# Org Builder ☕️

> **project affogato** — made with ❤️ by Trung

Công cụ vẽ **sơ đồ tổ chức**, định nghĩa **luồng phê duyệt ngân sách** và sinh **bảng luồng duyệt** cho từng nhóm Fund Center — chạy hoàn toàn trên trình duyệt, không cần backend.

🌐 **Bản chạy thử:** https://org-chart-builder.nguyenhieutrung2101.workers.dev

---

## Tính năng

### 1. 🏢 Sơ đồ tổ chức
- Vẽ cây tổ chức theo cấp **CC → T1…T8**, mỗi box gồm 3 trường: *phòng/khối* (tự IN HOA), *chức danh*, *người phụ trách*; màu nền theo cấp.
- Ràng buộc cấp: box con tối thiểu bằng cấp box cha (tự nâng cấp dưới khi đổi cấp cha).
- Đánh dấu **★ CBQLNS** (cán bộ quản lý ngân sách) và **nhánh VẬN HÀNH** (chỉ 1 nhánh, cả cây con kế thừa) — hai dữ liệu đầu vào cho luồng duyệt.
- **Zoom** (lăn chuột quanh con trỏ, nút −/＋/100%/Vừa màn hình) + **minimap** góc trái với ô định vị, bấm/kéo để di chuyển nhanh.
- Kéo nền để pan, **focus một nhánh**, thu gọn/bung cấp dưới từng box, ẩn sơ đồ/panel, **hoàn tác Ctrl+Z**.
- **Bảng phân cấp** tự cập nhật, cột thẳng hàng theo cấp.

### 2. 🧩 Định nghĩa luồng
- **Ma trận luật** phê duyệt: hàng = 5 luồng (Xanh / Vàng / Đỏ / Tím / NNS), cột = TĐ1–TĐ4, TĐ*, PD.
- **Kéo-thả box vai trò** từ palette vào ô; box tự đặt (chức danh + người) hoặc **link từ sơ đồ tổ chức** (sửa bên sơ đồ là tự cập nhật, ví dụ MCEO/MD).
- Mỗi box thả vào ô mang phạm vi **Tất cả / Vận hành / Còn lại** (bấm nhãn để xoay vòng) — một ô chứa 1 box "Tất cả" hoặc cặp "Vận hành" + "Còn lại".
- Ô **🔒 CBQLNS** cố định (Xanh ở PD, các luồng khác ở TĐ1).

### 3. 📗 Luồng duyệt
- Khai báo **Nhóm Fund Center** (mã FCG, tên, gán CBQLNS) và **Fund Center** (mã, tên, nhóm) — có lọc nhanh và **dán thẳng từ Excel**.
- **Bảng luồng duyệt** sinh tự động: mỗi nhóm × 5 luồng, người duyệt từng bước tính từ ma trận luật + nhánh của CBQLNS (Vận hành / Còn lại).
- Xem gộp theo nhóm hoặc bung theo từng FC; **copy bảng** dán thẳng vào Excel.

### 💾 Dữ liệu & xuất
- **Lưu / Mở JSON** (schema v10): toàn bộ sơ đồ + nhóm/FC + box vai trò + ma trận luật trong 1 file. Dữ liệu **chỉ nằm trong file của bạn**, không lưu trên server. File bản cũ vẫn mở được (tự nâng cấp).
- **Copy bảng** (TSV, dán vào Excel không vỡ cột) và **xuất .drawio** (mở bằng [draw.io](https://app.diagrams.net) — giữ màu, vị trí, thuộc tính).

## Cách dùng

Mở https://org-chart-builder.nguyenhieutrung2101.workers.dev — hoặc chạy cục bộ:

```bash
git clone https://github.com/nguyenhieutrung2101/org-chart-builder.git
# mở public/index.html bằng trình duyệt là xong — không cần cài gì
```

Toàn bộ ứng dụng là **một file HTML tĩnh duy nhất** (`public/index.html`), không phụ thuộc thư viện ngoài.

## Triển khai

Deploy tự động lên **Cloudflare Workers** (static assets) mỗi khi merge vào `main`:

```
org-chart-builder/
├── public/
│   └── index.html      # toàn bộ ứng dụng
├── wrangler.jsonc      # cấu hình Cloudflare (assets = ./public)
└── README.md
```

Deploy thủ công: `npx wrangler deploy`

## Phím tắt & thao tác nhanh

| Thao tác | Cách làm |
|---|---|
| Hoàn tác | `Ctrl/⌘ + Z` |
| Zoom sơ đồ | Lăn chuột trên canvas (quanh con trỏ) |
| Di chuyển vùng nhìn | Kéo nền canvas, hoặc bấm/kéo trên minimap |
| Sửa nhanh một box | Nháy đúp vào box |
| Đổi thứ tự box ngang hàng | Nút ◀ ▶ trong panel Chi tiết |
| Nhập Fund Center hàng loạt | "Dán từ Excel" (Mã ⇥ Tên ⇥ Nhóm) |
