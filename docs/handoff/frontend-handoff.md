# Halora — Tài liệu Bàn giao Frontend (Frontend Handoff Document)

Tài liệu này được biên soạn cho đội ngũ phát triển Backend, DevOps và Quản trị hệ thống, cung cấp toàn bộ thông tin kiến trúc, cấu hình tích hợp, danh mục quyền hạn, luồng xác thực và hướng dẫn vận hành cho giao diện **Web Quản trị (`apps/admin`)** và **App Khách hàng (`apps/mobile`)** thuộc hệ thống mỹ phẩm Halora.

---

## 1. Tổng quan Kiến trúc Frontend

Hệ thống frontend của Halora được tổ chức dưới dạng monorepo quản lý bằng `pnpm workspace`:

```text
halora-system/
├── apps/
│   ├── admin/                # Web Quản trị (React + Vite + Ant Design)
│   └── mobile/               # App Khách hàng (React Native + Expo Router + Paper)
├── packages/
│   └── api-client/           # Package TypeScript API Client dùng chung
├── docs/
│   ├── api/
│   │   └── openapi.yaml      # Hợp đồng tích hợp OpenAPI 3.0.3 chính thức
│   └── handoff/
│       ├── frontend-handoff.md     # Tài liệu bàn giao kỹ thuật
│       └── screen-api-mapping.md   # Bản đồ ánh xạ màn hình & endpoint
├── .env.example
├── README.md
└── AGENTS.md
```

### Nguyên tắc cốt lõi đã hiện thực:
1. **Không sử dụng dữ liệu nghiệp vụ giả (Zero Mock Data):**
   - Không tồn tại mock service, fixture, Faker, hay dữ liệu hardcode giả lập danh sách sản phẩm, đơn hàng, hóa đơn hay báo cáo.
   - Khi API chưa sẵn sàng hoặc gặp sự cố, giao diện hiển thị trạng thái lỗi kết nối cùng nút **"Thử lại"**.
   - Trạng thái danh sách rỗng ("Chưa có dữ liệu") chỉ hiển thị khi API phản hồi HTTP 200 với mảng dữ liệu thực sự rỗng.
   - Số liệu dashboard không tự điền số `0` khi request thất bại.
   - Nếu sản phẩm chưa có ảnh từ API, hệ thống hiển thị khung nhãn **"Chưa có ảnh"**, không dùng ảnh placeholder từ bên ngoài.
2. **Bộ kiểu dữ liệu dùng chung duy nhất (`@halora/api-client`):**
   - Web và App cùng import types và API client từ `@halora/api-client`. Không duy trì hai bộ kiểu dữ liệu độc lập.
3. **Phân quyền và nghiệp vụ do Backend quyết định:**
   - Frontend không tự tính toán giảm giá, phí vận chuyển hay tồn kho. Màn hình thanh toán gửi yêu cầu sang `POST /api/v1/me/checkout/quote` và hiển thị chính xác kết quả bóc tách từ backend (`subtotalAmount`, `productDiscountAmount`, `orderDiscountAmount`, `voucherDiscountAmount`, `shippingFee`, `totalAmount`).
4. **Thuật ngữ thống nhất:**
   - Toàn bộ giao diện và tài liệu tiếng Việt sử dụng cụm **"loại sản phẩm"** (tên kỹ thuật API/database giữ `categories` và `categoryId`).

---

## 2. Xác thực và Bảo mật (Authentication & Security)

Hệ thống phân tách thành hai realm xác thực độc lập:

### 2.1. Realm Nhân viên (`STAFF`)
- **Phạm vi sử dụng:** Web Quản trị (`apps/admin`).
- **Endpoint:**
  - `POST /api/v1/auth/staff/login`: Trả về `accessToken` và đặt cookie `refreshToken` HttpOnly (`credentials: "include"`).
  - `POST /api/v1/auth/staff/refresh`: Làm mới token tự động qua HttpOnly cookie.
  - `POST /api/v1/auth/staff/logout`: Hủy phiên làm việc.
  - `GET /api/v1/auth/me`: Lấy thông tin tài khoản, vai trò và danh sách permission.
- **Lưu trữ token:** Access token lưu trong bộ nhớ (in-memory); **tuyệt đối không lưu token vào localStorage** để chống tấn công XSS.

### 2.2. Realm Khách hàng (`CUSTOMER`)
- **Phạm vi sử dụng:** App Khách hàng Android/iOS (`apps/mobile`).
- **Endpoint:**
  - `POST /api/v1/auth/customer/login`: Trả về `{ accessToken, refreshToken, principal }`.
  - `POST /api/v1/auth/customer/register`: Đăng ký tài khoản mới.
  - `POST /api/v1/auth/customer/refresh`: Gửi kèm `{ refreshToken }` trong body để lấy access token mới.
  - `POST /api/v1/auth/customer/logout`: Gửi kèm `{ refreshToken }` để thu hồi phiên.
  - `POST /api/v1/auth/customer/forgot-password` & `POST /api/v1/auth/customer/reset-password`.
- **Lưu trữ token:** Access token lưu in-memory; Refresh token lưu trong **`expo-secure-store`** (mã hóa cấp phần cứng Keychain trên iOS và Keystore trên Android). Không lưu vào AsyncStorage hay Plaintext JSON.

### 2.3. Cơ chế Khử trùng lặp Làm mới Token (Refresh Token Deduplication)
Lớp `HaloraApiClient` tích hợp sẵn hàng đợi Promise (`refreshPromise`). Khi nhiều request đồng thời gặp lỗi 401:
- Chỉ có 1 request refresh duy nhất được gửi đến máy chủ.
- Các request đang chờ sẽ nhận access token mới và tự động thực hiện lại (retry đúng 1 lần).
- Nếu refresh thất bại, client gọi hàm callback xóa phiên và chuyển người dùng về màn hình đăng nhập.

---

## 3. Khóa Idempotency trên các Thao tác Thay đổi Trạng thái

Để bảo vệ chống ghi nhận lặp khi người dùng bấm nút nhiều lần hoặc mạng chập chờn, Frontend tự động đính kèm header **`Idempotency-Key`** trên các mutation quan trọng:

| Thao tác nghiệp vụ | Endpoint API | Định dạng Idempotency-Key |
| :--- | :--- | :--- |
| **Tạo đơn hàng khách hàng** | `POST /api/v1/me/orders` | `halora-order-${timestamp}-${random}` |
| **Xác nhận đơn hàng (Xuất kho)** | `POST /api/v1/admin/orders/:id/confirm` | `halora-ord-confirm-${id}-${timestamp}` |
| **Ghi nhận phiếu nhập (Cộng tồn)**| `POST /api/v1/admin/goods-receipts/:id/post` | `halora-gr-post-${id}-${timestamp}` |
| **Ghi nhận kiểm kê điều chỉnh kho**| `POST /api/v1/admin/inventory-adjustments/:id/post` | `halora-adj-post-${id}-${timestamp}` |
| **Xác nhận thanh toán đơn hàng** | `POST /api/v1/admin/orders/:id/payments/:paymentId/confirm`| `halora-pay-confirm-${paymentId}-${timestamp}`|
| **Xác nhận hoàn tiền** | `POST /api/v1/admin/orders/:id/payments/:paymentId/refunds`| `halora-refund-${paymentId}-${timestamp}` |
| **Lập hóa đơn từ đơn hàng** | `POST /api/v1/admin/orders/:id/invoices` | `halora-inv-post-${id}-${timestamp}` |

> **Lưu ý phía Backend:** Backend cần lưu trữ khóa `Idempotency-Key` trong Redis hoặc bảng chuyên biệt (TTL 24h). Nếu nhận lại cùng một khóa, backend trả về kết quả đã lưu trước đó thay vì thực thi lại logic trừ/cộng kho hay tạo bút toán trùng lặp.

---

## 4. Hệ thống Phân quyền (RBAC Matrix)

Phía Web Quản trị sử dụng component `PermissionGuard` để ẩn/hiện và chặn các hành động không được phép dựa trên mảng `permissions` trong `Principal`:

| Mã Quyền (Permission Code) | Ý nghĩa nghiệp vụ | Màn hình tương ứng trên Web |
| :--- | :--- | :--- |
| `CATEGORY_READ` / `CATEGORY_WRITE` | Xem và quản lý loại sản phẩm | `/categories` |
| `BRAND_READ` / `BRAND_WRITE` | Xem và quản lý thương hiệu | `/brands` |
| `PRODUCT_READ` / `PRODUCT_WRITE` | Quản lý sản phẩm, biến thể SKU và media | `/products`, `/products/:id` |
| `INVENTORY_READ` | Tra cứu số dư kho và thẻ kho | `/inventory` |
| `GOODS_RECEIPT_READ` / `WRITE` / `POST` | Lập và xác nhận nhập kho | `/goods-receipts` |
| `INVENTORY_ADJUST_READ` / `WRITE` / `POST`| Lập và xác nhận kiểm kê kho | `/inventory-adjustments` |
| `CUSTOMER_READ` / `CUSTOMER_WRITE` | Quản lý khách hàng, khóa tài khoản | `/customers`, `/customers/:id` |
| `EMPLOYEE_READ` / `EMPLOYEE_WRITE` | Quản lý nhân sự, cấp tài khoản, gán role| `/employees`, `/employees/:id` |
| `ROLE_READ` / `ROLE_WRITE` | Xem và thiết lập vai trò & quyền hạn | `/roles` |
| `ORDER_READ` / `ORDER_WRITE` | Quản lý đơn, cập nhật trạng thái đơn | `/orders`, `/orders/:id` |
| `PAYMENT_WRITE` | Xác nhận thanh toán và hoàn tiền | `/orders/:id` |
| `INVOICE_READ` / `INVOICE_WRITE` | Lập và in hóa đơn bán hàng | `/invoices`, `/invoices/:id` |
| `PROMOTION_READ` / `PROMOTION_WRITE` | Quản lý chương trình khuyến mãi, voucher | `/promotions`, `/promotions/:id` |
| `REPORT_READ` | Xem báo cáo tài chính, doanh thu và kho | `/dashboard`, `/reports` |

---

## 5. Quy chuẩn Dữ liệu và Định dạng

- **Định dạng tiền tệ:** Truyền nhận qua API dưới dạng chuỗi số nguyên VND (ví dụ `"150000"`). Frontend format chuẩn hiển thị qua `Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" })` (ví dụ: `150.000 ₫`).
- **Ngày giờ:** API truyền chuỗi ISO 8601 UTC (ví dụ `"2026-10-15T14:30:00.000Z"`). Frontend hiển thị theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`) định dạng `dd/MM/yyyy HH:mm`.
- **Khóa chính & Quan hệ:** Toàn bộ ID sử dụng chuỗi UUID v4.
- **Khóa phiên bản (Optimistic Locking):** Mọi request cập nhật (`PATCH`/`PUT`) đều truyền kèm trường `version: number`. Backend cần kiểm tra `version` hiện tại trong DB; nếu không khớp, trả về lỗi HTTP 409 Conflict với mã `CONCURRENT_MODIFICATION`.

---

## 6. Cấu hình Môi trường (Environment Variables)

### 6.1. Web Quản trị (`apps/admin/.env`)
```bash
# URL API Backend phục vụ Web Admin (mặc định localhost)
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### 6.2. App Khách hàng (`apps/mobile/.env`)
```bash
# URL API Backend phục vụ App Mobile:
# - Với Android Emulator: dùng 10.0.2.2 để kết nối máy chủ chạy trên máy chủ host
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000/api/v1

# - Với thiết bị Android thật (kết nối cùng Wi-Fi): thay bằng IP LAN máy phát triển
# EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3000/api/v1
```

---

## 7. Hướng dẫn Chạy, Kiểm thử và Build Ứng dụng

### 7.1. Cài đặt toàn bộ Workspace
```bash
# Tại thư mục gốc halora-system/
pnpm install
```

### 7.2. Build và Typecheck Package API Client
```bash
pnpm --filter @halora/api-client run build
```

### 7.3. Chạy và Build Web Quản trị (`apps/admin`)
```bash
# Khởi chạy máy chủ phát triển (mặc định http://localhost:5173)
pnpm --filter @halora/admin run dev

# Kiểm tra kiểu dữ liệu và build production
pnpm --filter @halora/admin run build

# Xem trước bản build production
pnpm --filter @halora/admin run preview
```

### 7.4. Chạy và Kiểm thử App Khách hàng (`apps/mobile`)
```bash
# Kiểm tra kiểu TypeScript (đã nghiệm thu 0 lỗi)
pnpm --filter @halora/mobile run typecheck

# Khởi chạy Metro Bundler
pnpm --filter @halora/mobile run start

# Mở trực tiếp trên Android Emulator (yêu cầu Android Studio / AVD đã mở)
pnpm --filter @halora/mobile run android
```

### 7.5. Hướng dẫn Kết nối Thiết bị Thật & Build APK Android
1. **Chạy trên thiết bị Android thật qua Expo Go:**
   - Cài đặt ứng dụng **Expo Go** từ Google Play Store trên điện thoại.
   - Kết nối máy tính và điện thoại cùng mạng Wi-Fi.
   - Cấu hình file `apps/mobile/.env`: `EXPO_PUBLIC_API_BASE_URL=http://<IP-MAY-TINH>:3000/api/v1`.
   - Chạy `pnpm --filter @halora/mobile run start`.
   - Quét mã QR hiển thị trên màn hình terminal bằng ứng dụng Expo Go.

2. **Tạo bản build APK độc lập (Standalone APK):**
   - Đảm bảo đã cài đặt EAS CLI: `npm install -g eas-cli`.
   - Đăng nhập tài khoản Expo: `eas login`.
   - Cấu hình file `eas.json` cho profile build APK xem trước:
     ```json
     {
       "build": {
         "preview": {
           "android": {
             "buildType": "apk"
           }
         }
       }
     }
     ```
   - Chạy lệnh build:
     ```bash
     cd apps/mobile
     eas build -p android --profile preview
     ```
   - Sau khi hoàn thành, liên kết tải trực tiếp file `.apk` sẽ được xuất ra trên console để cài đặt trên mọi máy Android.

---

## 8. Danh mục Nghiệp vụ Chờ Tích hợp Phía Backend

Khi triển khai Backend (NestJS + PostgreSQL), đội ngũ backend cần hoàn thành theo đúng hợp đồng `docs/api/openapi.yaml`:

- [ ] **Khởi tạo Database:** Chạy migration tạo schema đầy đủ theo bảng dữ liệu.
- [ ] **Triển khai 13 endpoint Xác thực:** Phân tách Realm STAFF (cookie) và CUSTOMER (bearer token).
- [ ] **Triển khai Báo giá Checkout (`POST /me/checkout/quote`):** Thuật toán tính toán giảm giá bậc thang theo sản phẩm, theo đơn và voucher; tính phí giao hàng và phát sinh `quoteToken`.
- [ ] **Transaction Trừ kho Đơn hàng:** Xác nhận đơn (`POST /admin/orders/:id/confirm`) trừ tồn khả dụng và ghi log lịch sử; Hủy đơn (`POST /admin/orders/:id/cancel` hoặc `/me/orders/:id/cancel`) hoàn kho đúng 1 lần duy nhất.
- [ ] **Transaction Cộng kho Nhập hàng:** Ghi nhận phiếu nhập (`POST /admin/goods-receipts/:id/post`) cộng tồn kho và ghi sổ thẻ kho trong cùng một transaction.
- [ ] **Lập hóa đơn độc lập:** Lập hóa đơn (`POST /admin/orders/:id/invoices`) không làm thay đổi tồn kho; lấy snapshot đơn giá gốc chốt trên dòng đơn hàng.
- [ ] **Hỗ trợ Header Idempotency-Key:** Bắt buộc áp dụng bộ lọc idempotent trên các endpoint đã quy định tại Mục 3.
- [ ] **CORS & Cookie HttpOnly:** Cho phép domain Web Admin truy cập với `credentials: true` để nhận cookie refresh token.
