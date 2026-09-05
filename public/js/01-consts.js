"use strict";
/* [1] Hằng số & tiện ích nhỏ — Org Builder. Các file js/ dùng chung state global, nạp theo thứ tự trong index.html. */
/* ============ [1] HẰNG SỐ & TIỆN ÍCH ============ */
var BW = 176, BH = 96;
var GX = 18,  GY = 70;
var PAD = 20;
var COLW_ORG  = 176;                    // độ rộng cột bảng phân cấp
var SCHEMA_V  = 10;                     // version schema file JSON: serializeAll ghi, loadJSON cảnh báo nếu file mới hơn

// Zoom sơ đồ (view-state tạm, KHÔNG lưu JSON). worldW/H = kích thước world lần render gần nhất.
var zoom = 1, worldW = 300, worldH = 300;
var ZMIN = 0.2, ZMAX = 2, ZSTEP = 1.2;
var MMW = 200, MMH = 150;               // khung minimap
