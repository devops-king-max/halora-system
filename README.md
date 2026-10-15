# Halora — Hệ thống Bán Mỹ phẩm

Hệ thống bán mỹ phẩm Halora bao gồm Web Quản trị React, App Khách hàng React Native/Expo, package TypeScript API Client dùng chung, hạ tầng PostgreSQL và Mailpit. Quy ước phát triển bắt buộc được ghi nhận trong [AGENTS.md](AGENTS.md).

---

## 1. Cấu trúc Dự án

```text
halora-system/
├── apps/
│   ├── admin/                # Web Quản trị (React 19 + Vite + Ant Design)
│   └── mobile/               # App Khách hàng (React Native + Expo 52 + Expo Router)
├── packages/
│   └── api-client/           # Shared TypeScript API Client & Types
├── docs/
│   ├── api/
│   │   └── openapi.yaml      # Hợp đồng tích hợp OpenAPI 3.0.3 chính thức
│   └── handoff/
│       ├── frontend-handoff.md     # Tài liệu bàn giao kỹ thuật cho Backend
│       └── screen-api-mapping.md   # Ánh xạ chi tiết Màn hình -> API Endpoint
├── docker-compose.yml        # PostgreSQL 18 & Mailpit
├── .env.example
├── README.md
└── AGENTS.md
```

---

## 2. Công nghệ Sử dụng

- **Quản lý Workspace:** `pnpm workspace` (Node.js 24+, pnpm 10+).
- **Web Quản trị (`apps/admin`):** React 19, Vite 6, Ant Design 5, React Router 7, TanStack Query 5, React Hook Form, Zod.
- **App Khách hàng (`apps/mobile`):** React Native 0.76, Expo 52, Expo Router 4, React Native Paper 5, TanStack Query 5, React Hook Form, Zod, Expo SecureStore.
- **API Client Package (`packages/api-client`):** TypeScript native ESM, Fetch API, khử trùng lặp token refresh tự động, gắn Idempotency-Key.
- **Hạ tầng cục bộ:** Docker Compose (PostgreSQL 18, Mailpit).

---

## 3. Cài đặt và Chạy Ứng dụng

### 3.1. Cài đặt Dependencies toàn bộ Monorepo
```powershell
pnpm install
```

### 3.2. Biên dịch Package API Client
```powershell
pnpm --filter @halora/api-client run build
```

### 3.3. Web Quản trị (`apps/admin`)

Tạo file `apps/admin/.env` (tham khảo `apps/admin/.env.example`):
```bash
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Các lệnh khả dụng:
```powershell
# Chạy máy chủ phát triển (mặc định tại http://localhost:5173)
pnpm --filter @halora/admin run dev

# Kiểm tra kiểu TypeScript và build production
pnpm --filter @halora/admin run build

# Xem trước bản build production
pnpm --filter @halora/admin run preview
```

### 3.4. App Khách hàng (`apps/mobile`)

Tạo file `apps/mobile/.env` (tham khảo `apps/mobile/.env.example`):
```bash
# Đối với Android Emulator (truy cập localhost của máy tính host)
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000/api/v1

# Đối với thiết bị Android thật (cùng mạng Wi-Fi LAN)
# EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3000/api/v1
```

Các lệnh khả dụng:
```powershell
# Kiểm tra kiểu TypeScript
pnpm --filter @halora/mobile run typecheck

# Khởi động Expo Metro bundler
pnpm --filter @halora/mobile run start

# Mở trực tiếp trên Android Emulator (yêu cầu AVD đã khởi chạy)
pnpm --filter @halora/mobile run android
```

---

## 4. Quy ước Nghiệp vụ & Dữ liệu

1. **Tuyệt đối không sử dụng dữ liệu nghiệp vụ giả:**
   - Không có mock API, Faker, hay seed dữ liệu mẫu hiển thị trên giao diện.
   - Khi chưa kết nối được máy chủ backend, giao diện hiển thị thông báo lỗi kết nối và nút **"Thử lại"**.
   - Trạng thái danh sách rỗng chỉ hiển thị khi API phản hồi thành công với mảng rỗng (`[]`).
   - Nếu sản phẩm chưa có ảnh, hiển thị khung với nhãn **"Chưa có ảnh"**.
2. **Thuật ngữ tiếng Việt:** Sử dụng thống nhất cụm từ **"loại sản phẩm"** trong giao diện và tài liệu.
3. **Tiền tệ & Thời gian:** Tiền tệ định dạng VND (`150.000 ₫`); ngày giờ hiển thị theo múi giờ `Asia/Ho_Chi_Minh` (`dd/MM/yyyy HH:mm`).
4. **Idempotency-Key:** Các thao tác thanh toán, hủy đơn, xác nhận xuất kho, ghi nhận nhập kho đều tự động đính kèm `Idempotency-Key` để bảo vệ an toàn giao dịch.

---

## 5. Hạ tầng Cơ sở Dữ liệu & Email Thử nghiệm

Khởi chạy PostgreSQL và Mailpit bằng Docker Compose:

```powershell
docker compose config --quiet
docker compose up -d
docker compose ps
docker compose logs --tail=100 db mailpit
```

- PostgreSQL port: `5433` (kết nối máy host `127.0.0.1:5433`).
- Mailpit UI: [http://localhost:8025](http://localhost:8025).
- SMTP Mailpit: `127.0.0.1:1025`.

Dừng container (giữ volume dữ liệu):
```powershell
docker compose stop
```

---

## 6. Tài liệu Tích hợp & Bàn giao

- **Hợp đồng OpenAPI:** [docs/api/openapi.yaml](docs/api/openapi.yaml)
- **Tài liệu Bàn giao Kỹ thuật:** [docs/handoff/frontend-handoff.md](docs/handoff/frontend-handoff.md)
- **Bản đồ Ánh xạ Màn hình & Endpoint:** [docs/handoff/screen-api-mapping.md](docs/handoff/screen-api-mapping.md)
