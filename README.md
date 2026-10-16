# Halora

Web quản trị, app khách hàng Android và API dùng chung cho hệ thống bán mỹ phẩm. Backend triển khai 12 nhóm chức năng theo [OpenAPI](docs/api/openapi.yaml), không tự tạo dữ liệu nghiệp vụ khi khởi động.

| Thành phần | Công nghệ / vị trí |
|---|---|
| Web quản trị | React 18, Vite 6, Ant Design 5 — `apps/admin` |
| App khách hàng | React Native 0.76, Expo 52, Expo Router — `apps/mobile` |
| API | NestJS 11, Node.js 24, TypeScript, SQL tham số hóa — `apps/api` |
| API client chung | TypeScript ESM — `packages/api-client` |
| Database | PostgreSQL 18 — `database/migrations`, `database/schema.sql` |
| Vận hành | Docker Compose, Nginx, Mailpit — `infra/docker` |

Quy ước trong [AGENTS.md](AGENTS.md); ERD và từ điển dữ liệu trong [database.md](docs/architecture/database.md); nghiệp vụ, bảo mật và báo cáo trong [backend.md](docs/architecture/backend.md).

Mỗi tài khoản, gồm quản trị viên, nhân viên và khách hàng, có thể sửa họ tên, email và số điện thoại của chính mình. Web: mở menu tài khoản → **Hồ sơ tài khoản**; app: tab **Tài khoản** → **Chỉnh sửa thông tin cá nhân**. Lưu thành công cập nhật tên hiển thị; tên đăng nhập, vai trò và trạng thái không thuộc form này. Trang hồ sơ không hiển thị danh sách mã quyền.

## Chạy bản build bằng Docker

Cần Node.js 24, pnpm 11.25.0 và Docker Desktop chạy Linux containers (Compose 2.24.4 trở lên để dùng cấu hình development). Tại thư mục gốc:

```powershell
pnpm install --frozen-lockfile
pnpm setup:local
docker compose config --quiet
docker compose up --build -d
docker compose ps -a
pnpm db:bootstrap:docker
```

`setup:local` chỉ tạo `.env` và `.local/bootstrap-admin.env` nếu chưa có, sinh mật khẩu/JWT/quote secret ngẫu nhiên. Bootstrap tạo quản trị thật theo file cục bộ; chạy lại không đổi mật khẩu tài khoản đã có. Xem username/password trong `.local/bootstrap-admin.env`, không gửi file lên Git. Email `@halora.test` được sinh theo yêu cầu thông tin ngẫu nhiên; có thể sửa trước bootstrap hoặc cập nhật hồ sơ bằng thông tin thực sau đăng nhập.

| Dịch vụ | Địa chỉ |
|---|---|
| Web quản trị | http://localhost:8080 |
| Swagger | http://localhost:8080/api/docs |
| Liveness / readiness | `/api/v1/health`, `/api/v1/ready` trên cổng web |
| Mailpit xem email reset | http://localhost:8025 |

Database/SMTP chỉ mở trong mạng Compose ở bản build. `migrate` chạy một lần; API chờ migration thành công, web chờ API healthy. Database dùng named volume tại `/var/lib/postgresql`; ảnh dùng volume riêng. API runtime chạy bằng user `node`.

Nếu cổng 8080 đang được sử dụng, đổi đồng thời `WEB_PORT`, `DEMO_PUBLIC_BASE_URL`, `DEMO_STAFF_RESET_URL` và thêm origin mới vào `CORS_ORIGINS` trong `.env`. Xem `verification.md` để biết cổng đã chọn trên máy bàn giao.

```powershell
docker compose logs --tail=100 api migrate admin db mailpit
docker compose stop
docker compose start
```

Không xóa volume để sửa lỗi khởi động. Đổi mật khẩu trong `.env` không đổi mật khẩu PostgreSQL đã khởi tạo. `COOKIE_SECURE=false` dành cho HTTP cục bộ; triển khai HTTPS cần đặt `true`, đổi public/reset URL, origin và SMTP thật.

Sau khi sửa giao diện và đang chạy bản build Docker, cập nhật riêng web bằng:

```powershell
docker compose build admin
docker compose up -d --no-deps --wait admin
```

Tải lại trang bằng `Ctrl+F5` để nhận giao diện mới.

## Lỗi Bad Gateway khi đăng nhập

Kiểm tra `docker compose ps -a` và `http://localhost:<WEB_PORT>/api/v1/ready` (máy hiện dùng cổng 8081). Readiness phải trả HTTP 200. Healthcheck web kiểm tra cả trang HTML và đường proxy tới API.

Nginx dùng DNS nội bộ Docker và tự cập nhật địa chỉ API khi container được tạo lại; pg pool xử lý kết nối chờ bị đóng khi PostgreSQL khởi động lại. Sau khi lấy bản sửa cấu hình/mã backend, cập nhật bằng `docker compose up --build -d --wait`. Với container web còn dùng cấu hình cũ, `docker compose exec admin nginx -s reload` có thể khôi phục kết nối tạm thời. Không cần đổi mật khẩu hay xóa volume để xử lý lỗi proxy này.

## Docker Desktop chưa chạy trên Windows

Nếu `docker compose` báo `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`, hãy khởi động Docker Desktop và chờ Linux Engine sẵn sàng:

```powershell
docker desktop start
docker version
```

Chỉ chạy lại `docker compose up --build -d` khi `docker version` hiển thị cả **Client** và **Server**. Nếu CLI không hỗ trợ `docker desktop start`, mở Docker Desktop từ Start Menu và chờ trạng thái Engine running. Sau đó kiểm tra `docker compose ps -a`; lỗi thiếu pipe không cần reset database hoặc xóa volume.

## Phát triển

Chạy toàn bộ dịch vụ có hot reload:

```powershell
docker compose -f compose.yaml -f compose.dev.yaml config --quiet
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
```

Vite tại http://localhost:5173, API tại http://localhost:3000/api/v1, PostgreSQL tại `127.0.0.1:5433`, SMTP tại `127.0.0.1:1025`. Tài khoản/database lấy từ `.env`. Kết nối SQL trong container không đưa mật khẩu lên dòng lệnh:

```powershell
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Hoặc chỉ chạy hạ tầng bằng Docker rồi chạy code trên máy:

```powershell
docker compose -f compose.yaml -f compose.dev.yaml up -d db mailpit
pnpm db:migrate
pnpm db:bootstrap
pnpm dev:api
# Terminal riêng
pnpm dev:admin
```

Web mặc định gọi `/api/v1` cùng origin; Vite proxy tới `http://127.0.0.1:3000`. Trong Docker proxy tới `http://api:3000`. Chỉ đặt `VITE_API_BASE_URL` khi cố ý tách origin và đã cấu hình CORS. Không chứa secret trong biến `VITE_*`/`EXPO_PUBLIC_*`.

## Database: cài mới và nâng cấp

```powershell
pnpm db:migrate
```

`001_initial.sql` tạo bảng/ràng buộc/view; `002_access_control.sql` tạo vai trò/quyền hệ thống. Không có sản phẩm, đơn hàng, khách hàng hay mật khẩu mẫu. Tạo dữ liệu thật qua API/giao diện sau đăng nhập.

`database/schema.sql` dùng cho **database trống**, gồm quyền/vai trò và lịch sử migration để lần nâng cấp sau không chạy lại migration cũ. Nhập bằng `psql --set ON_ERROR_STOP=1 --file database/schema.sql` với kết nối qua biến môi trường PostgreSQL. Không nhập đè database đang sử dụng. Database hiện hữu nâng cấp bằng migration mới; migration hạ cấu trúc tự động bị chặn để bảo toàn giao dịch.

```powershell
# Cần pg_dump 18 trong PATH hoặc PG_DUMP_PATH; xuất từ database sạch đã migrate
pnpm db:export-schema
# TEST_DATABASE_URL phải trỏ PostgreSQL riêng có quyền CREATEDB
pnpm db:verify-schema
```

## Backup và restore

```powershell
pnpm db:backup:docker
pnpm db:restore-check:docker C:\duong-dan\halora-system\.local\backups\ten-file.dump
```

Backup dùng `pg_dump -Fc` trong container rồi chép nhị phân ra `.local/backups`, tránh pipeline văn bản PowerShell. Lệnh kiểm tra restore tạo database `halora_restore_<uuid>` riêng, phục hồi và kiểm tra lịch sử migration rồi xóa đúng database thử đó. Không thay thế database ứng dụng.

Phục hồi vận hành: dừng API/web, tạo database mới với tên do người vận hành chọn, chép backup bằng `docker compose cp`, chạy `pg_restore --exit-on-error --no-owner -U <user> -d <database-mới> /tmp/<file.dump>`, kiểm tra số liệu rồi đổi `POSTGRES_DB` cho API/migrate sang database mới. Giữ database cũ để quay lại. Sao lưu `.env` bằng kênh bảo mật riêng và sao lưu ảnh cùng thời điểm:

```powershell
docker compose exec -T api tar -C /app/.local/uploads -czf /tmp/halora-uploads.tar.gz .
docker compose cp api:/tmp/halora-uploads.tar.gz .local/backups/halora-uploads.tar.gz
```

## Kiểm chứng

```powershell
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

`lint` hiện kiểm tra TypeScript, chưa có ESLint riêng. Không có `TEST_DATABASE_URL` thì chỉ test tính tiền chạy; tích hợp báo skipped. Để chạy đủ, đặt trong `.env.test.local` (Git bỏ qua) hoặc biến môi trường:

```dotenv
TEST_DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5433/postgres
MAILPIT_TEST_URL=http://127.0.0.1:8025
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
```

User kiểm thử cần quyền tạo database. Mỗi lần chạy tạo `halora_test_<uuid>`, nhập dữ liệu kiểm chứng qua API thật và xóa database riêng khi hoàn tất. Không đưa dữ liệu kiểm thử vào database `halora`.

```powershell
$env:HALORA_BROWSER_TEST='true'
pnpm test
pnpm db:verify-schema
```

Chrome cần cài trên máy; Linux CI dùng Playwright Chromium. Kiểm thử bao gồm bootstrap, cookie refresh/replay, quyền và sở hữu, SMTP reset một lần, tính tiền, voucher/SKU cuối đồng thời, snapshot lịch sử, nhập/xuất/hủy lặp, thanh toán/hoàn tiền, hóa đơn, báo cáo, PDF/XLSX, upload và web gọi API thật. Kết quả thực tế ghi tại [verification.md](docs/handoff/verification.md).

## App Android

Tạo `apps/mobile/.env`:

```dotenv
# API development cổng 3000; bản Docker build dùng cổng 8080
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000/api/v1
```

`10.0.2.2` là host từ Android Emulator. Điện thoại thật dùng IP LAN; cần mở API chủ động bằng `DEV_BIND_HOST=0.0.0.0`, đặt `DEV_PUBLIC_BASE_URL=http://<IP-LAN>:3000` để ảnh truy cập được. Bản Docker build dùng `WEB_BIND_HOST=0.0.0.0`, `DEMO_PUBLIC_BASE_URL=http://<IP-LAN>:8080` và app trỏ cùng IP/cổng. Chỉ mở LAN trong mạng phát triển tin cậy.

```powershell
pnpm dev:mobile
pnpm --filter @halora/mobile typecheck
pnpm --filter @halora/mobile exec expo export --platform android --output-dir ../../.local/mobile-export
```

Export tạo bundle JS/Hermes, **không tạo APK**. Expo 52 cần Expo Go tương thích SDK 52 hoặc development build; không mặc định Expo Go mới nhất chạy được dự án cũ. Workspace dùng `nodeLinker: hoisted` để Metro/Expo 52 phân giải dependency.

`apps/mobile/eas.json` có profile `preview` xuất APK, `production` xuất AAB. Build sau khi cấu hình URL API truy cập được từ thiết bị và tài khoản/project Expo:

```powershell
cd apps/mobile
pnpm dlx eas-cli login
pnpm dlx eas-cli build --platform android --profile preview
```

Build/ký APK, cài thiết bị và nghiệm thu trọn luồng cần tài khoản EAS hoặc Android SDK/JDK phù hợp. Các bước này không được thay bằng tuyên bố typecheck đã nghiệm thu Android.
