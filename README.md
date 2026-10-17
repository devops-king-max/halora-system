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

## Chạy hằng ngày trên máy hiện tại (Windows)

Hướng dẫn này dành cho project đã cài đặt tại `C:\Users\anhxu\OneDrive\Desktop\halora-system`. Cấu hình cục bộ hiện dùng cổng **8081** cho web/API. Người mới clone source cần làm phần [cài đặt lần đầu](#cài-đặt-lần-đầu-với-docker) trước; nếu đặt project ở thư mục khác, thay đường dẫn trong lệnh `cd`.

### Chạy web quản trị và backend

Mở Docker Desktop, chờ Linux Engine sẵn sàng, rồi mở PowerShell:

```powershell
cd "C:\Users\anhxu\OneDrive\Desktop\halora-system"
docker compose up -d --wait
```

Mở [web quản trị](http://localhost:8081) và đăng nhập bằng tài khoản đã tạo. Database chạy trong Docker; không cần mở PostgreSQL trên Windows. Các lần chạy sau không cần cài lại dependency hoặc chạy bootstrap.

Khi có sửa code và muốn cập nhật bản Docker, chạy:

```powershell
docker compose up --build -d --wait
```

Sau khi cập nhật giao diện, nhấn **Ctrl + F5** trên trình duyệt. Có thể kiểm tra dịch vụ bằng `docker compose ps -a`; `migrate` kết thúc với mã 0 là bình thường.

### Chạy app trên Android Emulator

Chạy Docker theo bước trên để có backend/database. Máy cần cài Android Studio, Android SDK, tạo máy ảo Android và cài Expo Go tương thích **SDK 52** trong máy ảo. Mở máy ảo từ Device Manager trước, rồi mở PowerShell tại thư mục project:

Để giảm tải RAM/CPU trên máy 16 GB, có thể mở riêng máy ảo từ PowerShell, không cần mở project Halora trong Android Studio. Trên máy hiện tại, dùng:

```powershell
Start-Process "D:\Android\Sdk\emulator\emulator.exe" -ArgumentList "-avd Medium_Phone_API_37.0 -cores 2 -feature -Vulkan"
```

Chờ màn hình chính Android xuất hiện rồi chạy nhóm lệnh bên dưới. Chỉ mở một phiên máy ảo; thông báo “already running” cho biết phiên trước vẫn tồn tại. Android 17/API 37 tự nâng RAM máy ảo lên tối thiểu 4 GB trên system image hiện tại. Nếu IDE đang index toàn monorepo và máy thiếu RAM, đóng IDE sau khi mở máy ảo riêng. Trong lượt kiểm tra ngày 17/10, cold boot riêng với 2 lõi và Vulkan tắt hoàn tất sau khoảng 100 giây; `adb` online và `sys.boot_completed=1`. Không dùng `-no-snapshot-load` cho mọi lần chạy hằng ngày; chỉ thêm khi cần Cold Boot để xử lý lỗi.

```powershell
cd "C:\Users\anhxu\OneDrive\Desktop\halora-system"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
& "$env:ANDROID_HOME\platform-tools\adb.exe" reverse tcp:8081 tcp:8081

$env:EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:8081/api/v1"
pnpm --filter @halora/mobile exec expo start --port 8082 --android
```

Nếu SDK được cài ở nơi khác, thay `ANDROID_HOME` bằng đường dẫn đó. `adb reverse` chuyển yêu cầu tới cổng 8081 trong máy ảo về backend trên máy tính; chạy lại sau khi khởi động lại máy ảo. Expo dùng cổng **8082** vì cổng 8081 đang phục vụ Halora. Biến `EXPO_PUBLIC_API_BASE_URL` ở trên chỉ áp dụng cho cửa sổ PowerShell hiện tại; chạy lại cả nhóm lệnh mỗi lần mở cửa sổ mới.

Giữ cửa sổ chạy Expo mở trong lúc dùng app. App dành cho khách hàng: đăng ký hoặc đăng nhập bằng tài khoản khách hàng; tài khoản quản trị dùng ở web. Hướng dẫn này dành cho máy ảo; cấu hình điện thoại thật và đóng gói được ghi ở phần [App Android](#app-android).

Trên máy phát triển hiện tại, Android Studio, SDK và máy ảo được lưu tại `D:\Android\Android Studio`, `D:\Android\Sdk`, `D:\Android\avd` để giải phóng ổ C. Các thư mục cũ trên ổ C là junction trỏ sang ổ D nên shortcut và nhóm lệnh trên vẫn dùng được; có thể đặt trực tiếp `$env:ANDROID_HOME = "D:\Android\Sdk"`. Đây là cấu hình riêng của máy, không phải đường dẫn bắt buộc khi clone dự án.

### Dừng khi dùng xong

Nhấn **Ctrl + C** ở cửa sổ chạy Expo để dừng app development. Tại thư mục project, dừng các dịch vụ Docker bằng:

```powershell
docker compose stop
```

Database và ảnh vẫn được giữ trong Docker volume cho lần chạy tiếp theo. Không dùng `docker compose down --volumes` để dừng hằng ngày.

## Cài đặt lần đầu với Docker

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
| Web quản trị (cổng mặc định) | http://localhost:8080 |
| Swagger (cổng mặc định) | http://localhost:8080/api/docs |
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

## Nạp bộ dữ liệu mẫu để test trên Docker

Bộ mẫu nằm trong [database/seed-demo.sql](database/seed-demo.sql), dùng schema hiện có và PostgreSQL Docker của project. `schema.sql` chỉ tạo cấu trúc; seed là bước tùy chọn sau migration và bootstrap. Thực hiện tại thư mục project:

```powershell
docker compose up -d --wait
pnpm db:seed:demo:docker
```

Lệnh nạp tự backup database hiện tại vào `.local/backups` trước khi import. Bộ mẫu chạy trong một transaction và ghi dấu đã nạp; chạy lại không tạo trùng, không đặt lại mật khẩu hoặc ghi đè dữ liệu bạn đã chỉnh. Nếu tên đăng nhập/mã mẫu bị trùng với dữ liệu có sẵn, import thất bại và rollback toàn bộ. Không xóa dữ liệu cũ để xử lý trùng.

### Tài khoản mẫu

Mật khẩu trong lần nạp đầu là **`123456`**, gồm cả admin hiện có. SQL lưu mật khẩu dưới dạng Argon2id; quy tắc tối thiểu 10 ký tự khi đăng ký/đổi mật khẩu vẫn giữ nguyên. Các tài khoản này chỉ phục vụ môi trường test cục bộ.

| Vai trò | Tên đăng nhập | Nơi đăng nhập |
|---|---|---|
| Quản trị viên | Giữ username hiện có trong `.local/bootstrap-admin.env`; không tạo thêm | Web quản trị |
| Bán hàng | `banhang01`, `banhang02`, `banhang03` | Web quản trị |
| Kho | `kho01`, `kho02`, `kho03` | Web quản trị |
| Kế toán | `ketoan01`, `ketoan02`, `ketoan03` | Web quản trị |
| Khách hàng | `khachhang01`, `khachhang02`, `khachhang03` | App khách hàng |

Database cần có đúng một admin đã bootstrap và admin đang hoạt động. Lần nạp đầu thu hồi phiên cũ của admin sau khi đổi mật khẩu; đăng nhập lại bằng `123456`. Lệnh pnpm đồng bộ mật khẩu trong file quản trị cục bộ nếu file tồn tại. Tổng bộ mẫu là **13 tài khoản**, gồm 1 admin đã có và 12 tài khoản mới; các tài khoản khác có sẵn được giữ nguyên.

### Dữ liệu để thao tác

- 6 loại sản phẩm, 3 thương hiệu, 12 sản phẩm và 24 SKU.
- 3 nhà cung cấp và quan hệ cung ứng; 3 phiếu nhập đã ghi nhận, 1 phiếu nhập đang soạn.
- 1 phiếu điều chỉnh đã ghi nhận, tồn kho và lịch sử nhập/xuất/hoàn kho; có SKU tồn thấp.
- 3 khách hàng, 6 địa chỉ và 3 giỏ hàng có hàng.
- 4 chương trình khuyến mãi: `KM01` theo sản phẩm, `KM02` bản nháp theo sản phẩm, `KM03` theo hóa đơn và `KM04` theo voucher `VC01`.
- 6 đơn hàng gồm chờ xác nhận, đã xác nhận, đang giao, hoàn tất và hai tình huống hủy; 4 khoản thanh toán, 1 hoàn tiền và 1 hóa đơn đã ghi nhận từ đơn hoàn tất.

Nội dung hiển thị không gắn chữ `(mẫu)`, `[Mẫu]` hoặc hậu tố Demo, gồm tên, mô tả, địa chỉ, ghi chú và tên lưu trên giao dịch. Mã nghiệp vụ dùng dạng `SP01`, `SKU01`, `KM01`, `PN01`. Ảnh sản phẩm chưa được thêm; có thể upload ảnh thật qua giao diện. Khuyến mãi có hiệu lực từ 30 ngày trước tới 90 ngày sau thời điểm import đầu tiên. Dữ liệu được lưu thật trong Docker volume và hiển thị qua API; Docker khởi động thông thường không tự nạp seed. Migration `005_clean_display_labels.sql` làm sạch nội dung đã nạp, giữ nguyên username, email, mật khẩu, mã, số tiền và tồn kho.

Nếu muốn chạy trực tiếp service import (không tự backup/đồng bộ file quản trị), dùng `docker compose run --rm --no-deps -T seed-demo`. Thông thường nên dùng lệnh pnpm ở trên. Khi clone source sang máy khác, chạy cài đặt/khởi tạo admin trước rồi mới nạp mẫu; dữ liệu trên máy cũ không đi theo Git.

## Ảnh đại diện sản phẩm và thương hiệu

Trong bảng **Sản phẩm** hoặc **Thương hiệu**, chọn **Tải ảnh** tại cột **Ảnh đại diện**, chọn file rồi nhấn **Lưu ảnh đại diện**. Form tạo/sửa cũng có ô tải ảnh. Hỗ trợ PNG, JPEG, WebP tối đa 8 MB; ảnh được lưu qua API thật và giữ trong Docker volume `uploads`. Chỉ tài khoản có quyền cập nhật tương ứng và tải media mới thao tác được.

Ảnh được chọn cho sản phẩm hiển thị ở danh sách quản trị và app khách hàng; ảnh biến thể riêng được ưu tiên ở giỏ hàng/báo giá. Sản phẩm chưa chọn ảnh đại diện vẫn có thể dùng ảnh đầu trong thư viện ảnh hiện có. Thay ảnh không xóa file cũ hoặc thay snapshot trên đơn hàng đã ghi nhận. Migration `006_catalog_thumbnails.sql` bổ sung liên kết ảnh và các view; cập nhật Docker bằng `docker compose up --build -d --wait`.

## Mã nghiệp vụ và phân quyền tài khoản

Mã hiển thị gồm tiền tố và số thứ tự từ 01; mỗi loại có bộ đếm riêng, sau 99 tiếp tục 100. UUID trong API là khóa nội bộ để giữ liên kết. Giao diện sử dụng mã nghiệp vụ:

| Đối tượng | Ví dụ mã |
|---|---|
| Tài khoản / nhân viên / khách hàng | `TK01` / `NV01` / `KH01` |
| Loại sản phẩm / thương hiệu / sản phẩm / biến thể | `LSP01` / `TH01` / `SP01` / `SKU01` |
| Nhà cung cấp / khuyến mãi / voucher | `NCC01` / `KM01` / `VC01` |
| Đơn hàng / phiếu nhập / hóa đơn / điều chỉnh kho | `DH01` / `PN01` / `HD01` / `DC01` |

Mã mới được cấp tự động. Form SKU và voucher cho phép để trống để hệ thống cấp mã; mã nhập thủ công phải đúng mẫu và không được đổi SKU/voucher đã cấp. Migration `003_business_codes.sql` chuyển mã cũ, đồng bộ mã đơn/SKU/voucher trong snapshot và giữ nguyên UUID, tiền, số lượng, số dư kho và mật khẩu. Chạy cập nhật bản Docker bằng `docker compose up --build -d --wait`; migration chạy trước khi API mới hoạt động.

Mở **Phân quyền** hoặc **Tài khoản**, chọn **Gán vai trò** trên tài khoản nhân viên và lưu. Mỗi vai trò có bộ quyền cố định; một tài khoản có thể nhận nhiều vai trò nhân viên. Không có chức năng sửa bộ quyền của vai trò. Khách hàng luôn có vai trò Khách hàng. Chỉ admin gán vai trò, tài khoản bị đổi vai trò cần đăng nhập lại; hệ thống chặn việc loại bỏ admin hoạt động cuối cùng. Migration `004_fixed_role_permissions.sql` khôi phục ma trận quyền cố định và thu hồi phiên nhân viên cũ trong lần nâng cấp này; mật khẩu giữ nguyên.

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

Để chạy hằng ngày với bản Docker cổng 8081 trên máy hiện tại, dùng phần [Chạy app trên Android Emulator](#chạy-app-trên-android-emulator) ở trên. Phần dưới dành cho cấu hình API development cổng 3000, điện thoại thật và đóng gói.

Khi chạy API development cổng 3000, tạo `apps/mobile/.env`:

```dotenv
# API development cổng 3000; bản Docker build dùng cổng 8080
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000/api/v1
```

`10.0.2.2` là host từ Android Emulator. Điện thoại thật dùng IP LAN; cần mở API chủ động bằng `DEV_BIND_HOST=0.0.0.0`, đặt `DEV_PUBLIC_BASE_URL=http://<IP-LAN>:3000` để ảnh truy cập được. Bản Docker build dùng `WEB_BIND_HOST=0.0.0.0`, `DEMO_PUBLIC_BASE_URL=http://<IP-LAN>:8080` và app trỏ cùng IP/cổng. Chỉ mở LAN trong mạng phát triển tin cậy.

```powershell
pnpm --filter @halora/mobile exec expo start --port 8082
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

## Khuyến mãi và voucher

Trong **Khuyến mãi**, khi tạo chương trình phải chọn đúng một **Loại khuyến mãi**: **theo sản phẩm**, **theo hóa đơn** hoặc **theo voucher**. Trang chi tiết chỉ hiện phần điều kiện của loại đã chọn, cho thêm/sửa/xóa, tìm mã và phân trang. Chỉ đổi loại khi chương trình chưa có điều kiện, chưa từng dùng và chưa kết thúc. Danh sách chương trình lọc theo mã/tên, loại khuyến mãi, trạng thái, khoảng hiệu lực và sản phẩm. Mã điều kiện tự sinh KMSP01/KMHD01; voucher dùng VC01…

Một đơn hàng vẫn có thể kết hợp **các chương trình khác nhau**: backend chọn một ưu đãi sản phẩm tốt nhất trên mỗi dòng, một ưu đãi hóa đơn tốt nhất trên tiền hàng còn lại, sau đó một voucher. Mỗi chương trình chỉ đóng góp theo loại của mình. Phí giao hàng không được giảm. Trần bỏ trống là không giới hạn; trần bằng 0 giảm 0 đồng. Phần trăm trong 0–100, ngưỡng/giới hạn không âm. Đơn cũ giữ nguyên tên và tiền giảm đã chốt khi cấu hình được sửa cho đơn mới.

Voucher giữ lượt khi đặt đơn, chuyển sang đã dùng khi xác nhận, trả lượt khi hủy hợp lệ. Giới hạn tổng bỏ trống là không giới hạn; giới hạn 0 không cho dùng. Không hạ giới hạn thấp hơn lượt đang giữ/đã dùng. Ưu đãi từng áp dụng không được xóa; có thể tạm ngừng/kết thúc chương trình. Chương trình đã kết thúc không bật lại.

Migration 008 tự nâng cấu trúc khi chạy Docker và tách chương trình cũ có nhiều loại thành các chương trình riêng. Giữ mã chương trình gốc cho loại đầu tiên (ưu tiên sản phẩm, hóa đơn, voucher); các loại còn lại nhận mã KM mới. Giữ UUID điều kiện/voucher, mã voucher, lượt dùng/giữ và toàn bộ snapshot, số tiền, lịch sử giao dịch. Khóa ngoại trong PostgreSQL chặn gắn điều kiện sai loại, kể cả khi ghi SQL trực tiếp. Không reset hoặc nạp lại dữ liệu kiểm thử để cập nhật tính năng.

## APK Android cục bộ trên máy này

Các lệnh dưới đây chạy tại thư mục gốc dự án, dùng Android SDK ở `D:\Android\Sdk`, JDK 17 ở `D:\Android\Jdk17` và Gradle cache ở `D:\Android\GradleCache`. Máy ảo là `Medium_Phone_API_37.0`. Docker Desktop phải hoạt động.

```powershell
# Build APK khi mã app thay đổi (lần đầu tải thư viện Gradle có thể lâu)
pnpm android:build:local

# Cài/cập nhật APK, khởi động Docker và mở app trên máy ảo
pnpm android:install:local

# Những lần sau: khởi động Docker, máy ảo và app đã cài
pnpm android:run:local
```

APK được lưu ở `.local/android/halora-local-x86_64.apk`, có JS đi kèm nên không cần Metro hay Expo Go. Đây là bản kiểm thử cho máy ảo x86_64, ký bằng khóa debug do Expo tạo; không dùng để phát hành Play Store hay cài điện thoại ARM. Script nối cổng `8081` qua `adb reverse` mỗi lần chạy để app dùng backend Docker. Khi máy ảo khởi động lại, cần chạy lại script để nối cổng.

Đăng nhập app bằng tài khoản **khách hàng**, ví dụ `khachhang01` / `123456` nếu đã nạp bộ dữ liệu kiểm thử. Tài khoản admin dùng trên web `http://localhost:8081`. Thay đường dẫn công cụ bằng các tham số `-SdkRoot`, `-JavaHome`, `-GradleCache` khi gọi trực tiếp script PowerShell trong `infra/scripts/` trên máy khác. Công cụ build cần Android platform 35, build-tools 34.0.0/35.0.0, NDK 26.1.10909125 và CMake 3.22.1. Tạm đóng Android Studio khi build/mở máy ảo để giảm áp lực RAM.
