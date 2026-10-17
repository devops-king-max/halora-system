# Bàn giao tích hợp frontend Halora

Web quản trị và app khách hàng dùng `@halora/api-client`, gọi API NestJS theo `docs/api/openapi.yaml`. Backend/database đã triển khai; hướng dẫn chạy, migration, tạo quản trị, backup và build có trong README. Không dùng dữ liệu nghiệp vụ giả để lấp giao diện.

## Quy ước dữ liệu

API prefix `/api/v1`; JSON camelCase, ID UUID, tiền là chuỗi nguyên VND, thời gian ISO 8601. Thành công trả `{ data }` hoặc `{ data, meta }`; delete thành công 204. Lỗi trả `{ error: { code, message, fieldErrors, requestId } }`. Backend quyết định tiền, kho, quyền và chủ sở hữu.

OpenAPI là hợp đồng chính thức. Tên technical `categories`/`categoryId` giữ nguyên; nội dung tiếng Việt dùng **loại sản phẩm**. Các tài liệu mapping chỉ hỗ trợ tra cứu; khi có khác biệt phải đối chiếu OpenAPI và cập nhật cùng client.

## Xác thực

| Nhóm | Đăng nhập / làm mới / đăng xuất | Lưu token |
|---|---|---|
| Nhân viên | `/auth/staff/login`, `/refresh`, `/logout` | Access trong bộ nhớ, refresh cookie HttpOnly |
| Khách hàng | `/auth/customer/login`, `/refresh`, `/logout` | Access trong bộ nhớ, refresh SecureStore |

`GET /auth/me` trả Principal và quyền. Đăng ký khách gửi username riêng cùng họ tên/email/điện thoại/mật khẩu. Mật khẩu mới dài 10–128 ký tự. Forgot/reset gửi email qua SMTP thật; response forgot giống nhau dù email chưa có tài khoản. Reset và đổi mật khẩu thu hồi phiên; giao diện yêu cầu đăng nhập lại.

Hồ sơ cá nhân dùng `apiClient.auth.getProfile()` / `updateProfile(input)` qua `GET/PATCH /auth/profile` cho cả STAFF và CUSTOMER. Form gửi `{ fullName, email, phone, version }`, không có ID tài khoản đích. Admin và nhân viên không có quyền quản lý nhân sự vẫn sửa được hồ sơ của mình. Web `/profile` bỏ danh sách mã quyền, giữ thông tin tài khoản và vai trò để xem; app có màn `/profile` từ tab Tài khoản. Lưu cập nhật tên/email trên giao diện, giữ phiên; lỗi version/trùng email được hiển thị và có nút tải lại. Tên đăng nhập, quyền, trạng thái, chức vụ không chỉnh qua form này.

API client dùng chung Promise refresh theo realm cho cả khôi phục sau reload và các request 401, tránh xoay cùng token hai lần trong React StrictMode. Refresh thất bại xóa phiên; không lưu refresh token vào localStorage. Cookie cần cùng site/origin được cấu hình cho CORS.

## Quyền

Frontend ẩn/chặn nút theo quyền trả trong Principal; backend vẫn kiểm tra mọi request. Vai trò mặc định và quyền cấp sẵn nằm trong migration 002.

| Nhóm | Mã quyền |
|---|---|
| Loại sản phẩm, thương hiệu, sản phẩm | `categories.*`, `brands.*`, `products.*`; thao tác `read/create/update/delete` |
| Khách hàng | `customers.read/update/delete` |
| Nhân viên | `employees.read/create/update/delete/createAccount/assignRoles` |
| Tài khoản, vai trò | `accounts.read/update`, `roles.read`, `employees.assignRoles`; bộ quyền từng vai trò cố định |
| Nhà cung cấp, khuyến mãi | `suppliers.*`, `promotions.*`; thao tác `read/create/update/delete` |
| Đơn hàng | `orders.read/confirm/dispatch/complete/cancel` |
| Thu/hoàn tiền | `payments.create/confirm/fail`, `refunds.confirm/fail` |
| Hóa đơn | `invoices.read/create/update/delete/post/export` |
| Nhập hàng | `goodsReceipts.read/create/update/delete/post/export` |
| Kho và điều chỉnh | `inventory.read`, `inventoryAdjustments.read/create/update/delete/post` |
| Báo cáo, upload | `reports.read/export`, `media.create` |

Ký hiệu `*` trong bảng là viết gọn nhóm thao tác, không phải wildcard cấp quyền ở runtime. Khách chỉ được `/me` thuộc chính mình. Khóa account/nhân viên hoặc thay vai trò làm phiên cũ mất hiệu lực; bảo vệ quản trị viên hoạt động cuối cùng.

## Chống thao tác lặp và xung đột

`Idempotency-Key` là UUID. Cùng một lần thao tác khi retry dùng lại khóa; thành công rồi thao tác mới cần khóa mới. Backend lưu response trong transaction, cùng khóa khác method/path/body trả `IDEMPOTENCY_CONFLICT`. Không gửi khóa dạng tiền tố + timestamp. Những endpoint bắt buộc header được ghi trong OpenAPI.

| Thao tác | Endpoint POST chính xác |
|---|---|
| Đặt hàng | `/me/orders` |
| Xác nhận / giao / hoàn tất / hủy | `/admin/orders/:id/confirm`, `/dispatch`, `/complete`, `/cancel` |
| Ghi nhận nhập / điều chỉnh | `/admin/goods-receipts/:id/post`, `/admin/inventory-adjustments/:id/post` |
| Đối soát thu | `/admin/payments/:id/confirm` |
| Đối soát hoàn | `/admin/refunds/:id/confirm` |
| Tạo hóa đơn | `/admin/orders/:id/invoice` |
| Ghi nhận hóa đơn | `/admin/invoices/:id/post` |

Update gửi `version` theo schema; version cũ trả `VERSION_CONFLICT` 409 và cần tải lại. Không có trạng thái đóng gói/bàn giao riêng. Đơn đi `PENDING_CONFIRMATION → CONFIRMED → SHIPPING → COMPLETED`; chỉ pending/confirmed được nhân viên hủy, khách chỉ pending.

## Checkout và lịch sử

Frontend gửi items/addressId/paymentMethod/voucherCode để lấy quote; hiển thị amounts do backend trả. Đặt hàng gửi thêm quoteToken, note và UUID idempotency. Quote hết hạn/thay đổi phải lấy lại và cho khách xác nhận. Backend chỉ bỏ khỏi giỏ số lượng đã mua, giữ các mặt hàng khác.

Giỏ/pending chưa giữ kho. Confirm xuất một lần; cancel confirmed hoàn một lần. Receipt/adjustment chỉ đổi kho khi POSTED. Invoice từ đơn COMPLETED, tổng theo giá gốc snapshot, không đổi kho. Giao diện tách tổng hóa đơn, số phải trả, tiền đã thu và tiền đã hoàn.

## Môi trường và nghiệm thu

Web mặc định dùng URL `/api/v1` cùng origin; Vite proxy qua backend. App cần URL theo Android Emulator hoặc IP LAN, không dùng localhost trên điện thoại. Xem README cho cổng demo/development và EAS profile.

Bộ kiểm thử tự động đã có API thật + PostgreSQL riêng, SMTP Mailpit và browser web. Android JS export khác APK; việc cài/ký APK và kiểm tra thiết bị cần môi trường Android/EAS. Phạm vi thực tế, kết quả và giới hạn ghi tại `docs/handoff/verification.md`.

Khuyến mãi/voucher (17/10/2026): mỗi chương trình bắt buộc chọn một `type` PRODUCT/ORDER/VOUCHER khi tạo. Chi tiết chỉ có phần CRUD của loại đó; danh sách server có phân trang/tìm mã và lọc type. `Promotion` trả type/hasConditions/hasUsage; chỉ đổi loại khi chưa có điều kiện, chưa dùng và chưa kết thúc. Input PATCH kèm version; output điều kiện có code/hasUsage. Backend cho sửa mức giảm cho đơn mới sau khi ưu đãi đã dùng, giữ snapshot giao dịch cũ, khóa thay phạm vi đã dùng và cấm xóa. Xem mapping mục 1.10 và OpenAPI cho type/from/to/productId, giới hạn 0/null, usedCount/reservedCount. Đơn hàng vẫn kết hợp các chương trình khác nhau; app lấy toàn bộ tiền giảm từ checkout quote, không nhân phần trăm tại frontend. API báo giá không đổi, APK hiện có tiếp tục sử dụng được.

## App Android native trên Windows

Expo prebuild sinh thư mục `apps/mobile/android` (bỏ qua Git/Docker context). Cấu hình được giữ trong app.json và plugins: `withAndroidKotlin` đưa phiên bản Kotlin khai báo vào classpath để đồng bộ Expo 52/Compose với React Native 0.76.6; `withLocalApi` cho HTTP đúng ba host localhost, 127.0.0.1 và 10.0.2.2, các host khác bắt buộc HTTPS. Metro dùng gốc apps/mobile, watch workspace để đọc API client, tối đa 2 worker; xử lý entry tương đối của Gradle trên Windows. Không sửa thư viện trong node_modules.

Lệnh build/cài/chạy cục bộ nằm trong `infra/scripts/` và được gọi qua `pnpm android:build:local`, `pnpm android:install:local`, `pnpm android:run:local`. APK x86_64 ký debug để chạy máy ảo, kèm bundle Hermes, không cần Metro; API tại 127.0.0.1:8081 được nối qua adb reverse. SDK/JDK17/Gradle cache dùng ổ D, không sửa JAVA_HOME toàn hệ thống. Đăng nhập app dùng identifier là tên đăng nhập hoặc email, giữ refresh token trong SecureStore.
