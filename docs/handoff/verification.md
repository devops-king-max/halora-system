# Kết quả kiểm chứng bàn giao — 15/10/2026

## Lọc giá bằng thanh trượt và toán tử — 05/11/2026

- Thêm `priceOperator` (`GT/LT/GTE/LTE/EQ/NE`) và `priceValue` (chuỗi số nguyên VND) cho `GET /products` và `GET /admin/products`; backend từ chối khi chỉ gửi một trong hai hoặc toán tử/giá sai định dạng bằng `VALIDATION_ERROR` tiếng Việt. Giá sản phẩm so sánh là giá biến thể thấp nhất (storefront chỉ biến thể ACTIVE, admin mọi biến thể), khớp cách `minPrice` đang dùng; câu SQL tham số hóa.
- Thêm `GET /products/price-range` và `GET /admin/products/price-range` trả `{ minPrice, maxPrice }` thật từ dữ liệu (nullable khi chưa có sản phẩm) để thanh trượt lấy hai đầu, không hardcode giá. OpenAPI, API client và mapping màn hình/API đã cập nhật cùng thay đổi.
- Web quản trị dùng Ant Design `Slider` có tooltip luôn mở tại núm + `Segmented` toán tử ngay trên thanh; app khách hàng dùng component `PriceOperatorSlider` tự dựng bằng `PanResponder`, toán tử chọn trên thanh và giá hiển thị trong bong bóng tại núm. Bỏ ô nhập số và dropdown toán tử; không dùng dữ liệu giả, chỉ hiện thanh trượt khi API trả khoảng giá.
- Kiểm chứng đã chạy: `pnpm --filter @halora/api-client run build` đạt; `pnpm --filter @halora/admin run build` đạt (Vite build thành công, chỉ cảnh báo chunk > 500 kB có sẵn); `pnpm --filter @halora/mobile run typecheck` đạt; `pnpm typecheck` đạt toàn workspace; `pnpm test` đạt 2 test, 30 test bị bỏ qua vì không có `TEST_DATABASE_URL`. Contract mới được kiểm tra bằng `Contract`: hai route price-range được nhận đúng thứ tự trước route `{id}`, query hợp lệ và toán tử lạ bị từ chối. Lượt chạy lại cuối cùng trong cây làm việc chung ghi nhận lỗi typecheck ở `apps/api/src/insights/insights.service.ts` và lỗi build admin ở `apps/admin/src/pages/reports/ReportsPage.tsx`; cả hai là file đang được worker khác sửa (báo cáo/insights), không thuộc thay đổi lọc giá này.
- Chưa chạy: suite tích hợp cần PostgreSQL thật (`TEST_DATABASE_URL`) trong đó có test mới cho sáu toán tử và biên giá; chưa build/chạy APK hay kiểm tra giao diện trên máy ảo trong lượt này.

## Mỗi chương trình khuyến mãi một loại — 17/10/2026

- Theo lựa chọn của người dùng: mỗi chương trình có đúng một type PRODUCT/ORDER/VOUCHER; đơn vẫn kết hợp các chương trình khác nhau. Form tạo bắt buộc chọn loại, danh sách có cột/bộ lọc loại, chi tiết chỉ tải phần điều kiện tương ứng. API, OpenAPI, shared client và khóa ngoại PostgreSQL đồng bộ.
- Kiểm chứng 29 trường hợp trong 4 suite với database UUID riêng, Chrome và Mailpit thật: lượt toàn bộ có 28 test đạt; test migration được chạy lại riêng và đạt sau khi sửa kỳ vọng SQLSTATE của ON UPDATE RESTRICT thành 23001. Bao gồm chặn điều kiện sai loại, cấm đổi loại khi có điều kiện/đã dùng, cạnh tranh đổi loại/thêm điều kiện, giữ kết hợp các chương trình và chuyển dữ liệu nhiều loại cũ mà không đổi giao dịch. Database thử được dọn sau kiểm tra.
- Typecheck workspace đạt; image API/admin build thành công. `db:verify-schema` thành công với đủ 8 migration; tái tạo từ điển từ schema thực (43 bảng, 17 view). `docker compose config --quiet` đạt.
- Đã backup trước khi nâng cấp vào `.local/backups/halora-2026-10-17T12-11-06.397Z-3d4aa0d5.dump`. Migration 008 đã chạy thật trên Docker: KM01 PRODUCT, KM02 bản nháp PRODUCT, KM03 ORDER, KM04 VOUCHER. VC01 giữ mã/UUID; lượt HELD=1, USED=3, RELEASED=2. Không nạp lại seed.
- Đối chiếu số dòng và hash toàn bộ bản ghi trước/sau migration: orders, order_items, order_discounts, voucher_redemptions, promotion_usage, stock_movements, inventory_balances, invoices, invoice_items giữ nguyên. Không có điều kiện thuộc sai loại chương trình.
- `db`, `api`, `admin`, `mailpit` healthy; `migrate` exit 0; ready qua Nginx trả 200. PostgreSQL trở lại mạng nội bộ Compose, web tại http://localhost:8081. Chrome đăng nhập thật, mở từng KM01/KM03/KM04, xác nhận chỉ một phần cấu hình đúng loại, VC01 còn nguyên; form tạo có đủ ba lựa chọn độc lập, không có exception. Ảnh cục bộ `.local/promotion-type-{product,order,voucher,create}-runtime.png`.
- Không build/cài lại APK trong thay đổi này: API báo giá và luồng khách hàng giữ nguyên; APK đã cài ở lượt nghiệm thu Android bên dưới tiếp tục dùng backend mới.

## Khởi động máy ảo Android — 17/10/2026

Máy ảo API 37 xuất hiện ở adb dưới trạng thái offline trong các lượt mở từ IDE. Quan sát thực tế: IDE đang index monorepo, chiếm khoảng 2.3 GB RAM và nhiều CPU; system image yêu cầu 4 GB RAM dù cấu hình AVD đặt 2 GB. Tại một lượt kiểm tra trước đó host chỉ còn khoảng 450 MB RAM. Đây là các yếu tố gây áp lực tài nguyên; chưa xác định một nguyên nhân duy nhất cho mọi lần offline.

Đã đóng IDE theo yêu cầu đóng cửa sổ thông thường, mở riêng máy ảo với `-no-snapshot-load -cores 2 -feature -Vulkan`. Host còn khoảng 2.27 GB RAM trống trong lúc khởi động. Emulator log báo **Boot completed in 99580 ms**; adb trả trạng thái **device**, `sys.boot_completed=1`, boot animation `stopped`. Máy ảo đang mở riêng để người dùng tiếp tục chạy Expo. Không wipe data hoặc xóa AVD, không đổi mã nguồn ứng dụng, không build APK hay xác nhận Halora đã chạy trên thiết bị trong lượt này. Hướng dẫn khởi động riêng được ghi trong README và tài liệu kiến trúc.

## Chuyển công cụ Android sang ổ D — 17/10/2026

Theo yêu cầu người dùng, đã chuyển Android Studio (3.339 GB), SDK (4.262 GB), AVD (0.500 GB) và file cài đặt trong Downloads (1.408 GB) sang `D:\Android`, tổng khoảng 9.51 GB. Android Studio/SDK/AVD giữ vị trí cũ trên ổ C bằng NTFS junction. Sao chép và đối chiếu SHA256 đầy đủ trước khi chuyển đường dẫn và xóa bản gốc; phiên bị ngắt đã được tiếp tục từ bản sao, có receipt/log riêng trong `.local/android-relocation`. Không chuyển database hoặc volume Docker.

Kiểm tra thực tế: adb 37.0.1 chạy được từ cả đường dẫn cũ và mới; emulator nhận `Medium_Phone_API_37.0`; accel-check báo WHPX installed and usable. Windows báo khoảng 31.13 GB còn trống qua chính đường dẫn AVD cũ, xác nhận dữ liệu máy ảo được tạo trên ổ D. Ổ C còn khoảng 16.2 GB tại thời điểm kiểm tra. Đã yêu cầu mở lại Android Studio từ ổ D với project Halora. README và tài liệu kiến trúc đã cập nhật vị trí công cụ.

Lượt này chỉ kiểm chứng di chuyển công cụ, chưa boot máy ảo hoặc chạy app/đóng gói lại Android bundle/APK. Docker Engine hiện chưa kết nối được (thiếu pipe dockerDesktopLinuxEngine); không khởi động hoặc thay đổi container trong lượt chuyển file. Cần mở Docker Desktop trước khi chạy backend cho app. Không chạy lại test ứng dụng vì không thay đổi mã nguồn ứng dụng.

## Ảnh đại diện sản phẩm và thương hiệu — 16/10/2026

Thêm tải ảnh ngay tại bảng và form tạo/sửa sản phẩm, thương hiệu. Dùng upload thật qua API client, xem trước và lưu theo mediaId/version; PNG/JPEG/WebP tối đa 8 MB. Migration 006 thêm liên kết media, view quản trị và ảnh đại diện public; đã xuất lại schema từ database sạch sau đủ 6 migration. File ảnh tiếp tục dùng volume uploads. App chi tiết sản phẩm ưu tiên ảnh đại diện; giỏ hàng/báo giá ưu tiên ảnh riêng biến thể rồi ảnh đại diện. Không đổi snapshot giao dịch cũ hoặc thêm ảnh vào dữ liệu ứng dụng.

Build API/client/admin, typecheck toàn workspace và đối chiếu schema thành công. **3 suite, 26/26 test passed**, chạy PostgreSQL 18, Mailpit và Chrome thật trên database riêng. Kiểm tra upload PNG, lưu ảnh sản phẩm/thương hiệu, public URL đọc được, MIME đúng, chống version cũ, media không tồn tại, truy cập khách hàng và URL giả. Chrome chọn file, lưu, kiểm tra ảnh giải mã và reload giữ ảnh cho cả hai bảng; ảnh kiểm chứng tại `.local/products-thumbnail-integration.png`, `.local/brands-thumbnail-integration.png`. Database test và file upload thử đã dọn; database sót từ lượt kiểm thử bị ngắt cũng đã xác minh tên/nội dung/không kết nối trước khi xóa.

Backup trước triển khai: `.local/backups/halora-2026-10-16T16-50-31.284Z-c7096ec4.dump`. Không build lại Android bundle/APK hoặc chạy thiết bị trong lượt này; phần app được typecheck.

Đã build và triển khai image API/web, áp dụng migration 006 trên Docker. db/api/admin/mailpit healthy, migrate Exited (0). Kiểm tra SQL xác nhận đủ 6 migration và vẫn có 13 tài khoản, 12 sản phẩm, 3 thương hiệu, 6 đơn; không còn database test. Chrome kiểm tra cả hai cửa sổ upload trên bản Docker tại cổng 8081, kiểm tra 16 trang quản trị và Swagger không có exception hoặc response API lỗi. Lượt kiểm tra Docker chỉ đọc dữ liệu/mở form; không thêm ảnh kiểm thử vào database ứng dụng. README, OpenAPI, API client và mapping đã đồng bộ.

## Bỏ nhãn dữ liệu trên toàn hệ thống — 16/10/2026

Theo yêu cầu người dùng, migration `005_clean_display_labels.sql` bỏ `(mẫu)`, `[Mẫu]`, chữ mẫu và hậu tố Demo khỏi các trường hiển thị trên mọi bảng nghiệp vụ: loại sản phẩm, thương hiệu, sản phẩm, nhân viên, khách hàng, nhà cung cấp, khuyến mãi, địa chỉ, mô tả/ghi chú, tên snapshot và lịch sử chứng từ. Các trường tên/ghi chú trong response idempotency cũng được làm sạch; không đổi fingerprint, username/email, mật khẩu, mã, số tiền hoặc tồn kho. File seed tạo nội dung sạch ngay từ đầu; marker seed giữ nguyên.

Đã backup trước thay đổi tại `.local/backups/halora-2026-10-16T16-34-08.321Z-a746b654.dump`. Thử migration trên database riêng phục hồi từ backup xác nhận thông tin tài khoản, UUID, tiền và tồn kho không đổi. Suite seed **4/4 test passed**, gồm ca dữ liệu cũ ở nhiều bảng và JSON cache, uppercase MẪU, bảo toàn email/credentials/tiền/số dư; database thử được xóa. Xuất lại schema sạch và `db:verify-schema` thành công với đủ 5 migration. Không chạy lại toàn bộ suite hoặc Android trong lượt sửa này.

Đã build image API và áp dụng migration vào database Docker thật. Kiểm tra toàn bộ cột nội dung hiển thị không còn nhãn, ledger không có chênh lệch và không còn database test. Chrome kiểm tra 12 trang nghiệp vụ không còn chữ mẫu và không có API lỗi; ảnh `.local/categories-clean.png`. Các service db/api/admin/mailpit healthy, migrate Exited (0). README và hướng dẫn kiến trúc đã cập nhật.

## Mã nghiệp vụ và vai trò cố định — 16/10/2026

- Thêm migration 003 cho TK/NV/KH/LSP/TH/SP/SKU/NCC/KM/VC/DH/HD/PN/DC: số thứ tự tối thiểu 2 chữ số, bộ đếm từng loại trong transaction; check format và trigger theo dõi mã được nhập hợp lệ. Mã có DEMO và mã cũ đã chuyển, snapshot SKU/mã đơn/voucher đồng bộ. UUID liên kết giữ nguyên. Seed SQL dùng mã mới, marker import cũ giữ nguyên để tránh tạo trùng hoặc đặt lại mật khẩu.
- Migration 004 quy định bộ quyền cố định của các vai trò. Bỏ PATCH quyền vai trò và permission `roles.update`; thay bằng PUT `/admin/accounts/{id}/roles`. Customer giữ vai trò khách hàng; chỉ ADMIN gán vai trò STAFF, kiểm tra version, thu hồi phiên và chặn bỏ admin cuối. Endpoint gán vai trò qua employee vẫn được hỗ trợ.
- OpenAPI/client/types đồng bộ: Account có code/roleIds, Principal có accountCode, SKU/voucher có thể bỏ trống để cấp mã. Trang Phân quyền/Tài khoản hiển thị TK01 và gán vai trò bằng checkbox, không chỉnh permission. Hồ sơ dùng mã tài khoản. Các form sản phẩm/biến thể liên quan nhập bằng bộ chọn mã SP/SKU từ API thay vì nhập UUID; bỏ UUID ở các khu vực hiển thị kỹ thuật đã sửa.
- Build API/client/admin, typecheck workspace, cấu hình Compose và đối chiếu schema thành công. `schema.sql` xuất lại từ database sạch sau đủ 4 migration, gồm bộ đếm hệ thống và baseline migration, không chứa tài khoản hay dữ liệu nghiệp vụ.
- **3 suite, 25/25 test passed** trên PostgreSQL thật/Mailpit/Chrome. Ca mới kiểm tra gán vai trò qua tài khoản, 403 vượt quyền/CUSTOMER, 409 version/admin cuối, thu hồi phiên, không còn API chỉnh quyền và giữ nguyên ma trận quyền. Cấp đồng thời 110 mã không trùng, giữ đủ số 100/110. Chrome lưu vai trò ở database kiểm thử rồi reload xác nhận và kiểm tra không còn nút lưu permission.
- Đã phục hồi backup vào database ngẫu nhiên riêng, chạy hai migration và so sánh UUID, mật khẩu, tiền đơn/chứng từ và tồn kho trước/sau: không đổi. Đã dọn database phục hồi thử. Backup trước triển khai thực tế: `.local/backups/halora-2026-10-16T16-24-29.511Z-c944dbaf.dump`.
- Đã build/deploy API và web Docker, áp dụng migration thật: KM01/KM02, PN01–PN04, TK01 là admin cũ. Kiểm tra ledger không có chênh lệch; mật khẩu vẫn `123456`. API đăng nhập đủ 13 tài khoản và quote đơn mẫu khớp tiền. Chrome mở 16 trang và Swagger thành công; trang Phân quyền hiển thị đúng vai trò, 4 lựa chọn vai trò nhân viên, customer không có nút gán; lượt kiểm tra Docker không đổi vai trò thật. Ảnh: `.local/role-assignment-integration.png`, `.local/role-assignment-docker.png`.
- `db`, `api`, `admin`, `mailpit` healthy, `migrate` Exited (0). Database ngẫu nhiên còn lại từ lượt Jest bị ngắt khi phát hiện lỗi khởi động đã được xác minh tên/nội dung/kết nối rồi xóa đúng database đó. Không reset hoặc xóa volume. Chưa build lại Android bundle/APK hoặc chạy thiết bị Android trong lượt sửa này; typecheck app thành công.

## Bộ dữ liệu mẫu theo yêu cầu — 16/10/2026

Đã thêm `database/seed-demo.sql`, service Compose `seed-demo` trong profile `tools` và lệnh `pnpm db:seed:demo:docker`. Schema hiện có chỉ bổ sung chú thích dẫn tới file mẫu; migration và validation mật khẩu mới giữ nguyên. README có lệnh import, bảng tài khoản và mô tả dữ liệu. AGENTS ghi ngoại lệ do người dùng yêu cầu trực tiếp.

- Docker Desktop ban đầu không khởi động do socket IPC cũ trong `Docker/run` và `docker-secrets-engine`; đã giữ lại các thư mục socket bằng đổi tên và tạo lại thư mục IPC. Không reset Docker hoặc xóa volume. Linux Engine hoạt động lại.
- Kiểm tra Compose bản build/development, build và typecheck API thành công. **3 suite, 23/23 test passed**, chạy PostgreSQL 18 thật, Mailpit và Chrome. Suite seed dùng database ngẫu nhiên riêng, kiểm tra số tài khoản/vai trò, đăng nhập đủ 13 tài khoản bằng `123456`, thu hồi phiên admin cũ, bảo toàn validation mật khẩu mới, ownership, tiền đơn/hóa đơn/hoàn tiền, ledger và chạy lại không ghi đè thay đổi/mật khẩu/phiên. Database kiểm thử được xóa khi hoàn tất; đã xác nhận không còn `halora_test_*`.
- Trước import, database ứng dụng có 1 tài khoản, 0 sản phẩm và 0 đơn. Đã backup vào `.local/backups/halora-2026-10-16T15-24-57.611Z-7363355c.dump`, rồi nạp file SQL thành công qua service Docker.
- Database ứng dụng sau import: 13 tài khoản, 10 nhân viên (gồm admin), 3 khách hàng, 6 loại sản phẩm, 3 thương hiệu, 12 sản phẩm, 24 SKU, 3 nhà cung cấp, 4 phiếu nhập, 1 phiếu điều chỉnh, 2 chương trình khuyến mãi, 1 voucher, 6 đơn, 4 thanh toán, 1 hoàn tiền và 1 hóa đơn. ADMIN giữ 1 tài khoản; SALES/WAREHOUSE/ACCOUNTANT mỗi vai trò 3 tài khoản; CUSTOMER có 3 tài khoản qua realm khách hàng.
- Admin giữ username cũ, mật khẩu đổi thành `123456`; `.local/bootstrap-admin.env` đã đồng bộ. Mật khẩu trong database là Argon2id; phiên/reset cũ của admin được thu hồi. Không tạo thêm admin.
- API qua Nginx tại 8081: đăng nhập thật đủ 13 tài khoản, vai trò đúng, khách hàng chỉ thấy 2 đơn của mình. Báo giá trực tiếp cho đơn mẫu chờ xác nhận khớp đủ 6 trường tiền với snapshot SQL. Chrome mở 16 trang quản trị và Swagger, không có exception hoặc response API lỗi sau đăng nhập.
- `db`, `api`, `admin`, `mailpit` healthy, `migrate` Exited (0). Service import đã thoát và được xóa sau khi chạy; không tự import khi Compose khởi động. Ảnh mẫu chưa thêm. Không build lại bundle/APK hoặc chạy thiết bị Android trong lượt này; xác thực CUSTOMER được kiểm tra qua API thật.

## Cập nhật giao diện — 16/10/2026

### Sửa Bad Gateway khi đăng nhập

Nguyên nhân thực tế: Nginx còn trỏ tới IP API cũ `172.19.0.4`, trong khi DNS Docker đã chuyển API sang `172.19.0.3`; backend healthy nhưng đăng nhập qua web trả 502. Nạp lại Nginx khôi phục HTTP 200. Đã sửa upstream dùng DNS Docker với `resolve` và shared zone cho cả API/media; healthcheck web kiểm tra thêm readiness qua proxy. pg pool bổ sung listener thông báo cố định để lỗi kết nối đang chờ khi database khởi động lại không làm chết Node hoặc in đối tượng client nhạy cảm.

Kiểm chứng lượt sửa: API build/typecheck, Compose bản build/development hợp lệ; **20/20 test passed** trên PostgreSQL thật, Mailpit và Chrome, gồm ca ngắt đúng một kết nối pool của database kiểm thử riêng rồi đăng nhập lại. Image API/web đã build và triển khai. Script Docker đã khởi động lại riêng database, xác nhận API không khởi động lại, tạo lại riêng API, đăng nhập thật thành công và kiểm tra số tài khoản/marker volume ảnh không đổi. Kiểm tra DNS riêng giữ IP API cũ bằng container tạm, tạo lại API với IP `172.19.0.4 → 172.19.0.6`: container web giữ nguyên, readiness và đăng nhập/quyền phiên trả thành công; container tạm đã xóa. Chrome kiểm tra lại đăng nhập và trang hồ sơ thật. Không đổi mật khẩu, không reset database hoặc xóa volume; không chạy lại Android bundle/APK trong lượt sửa này.

### Chỉnh sửa hồ sơ cá nhân

Đã bỏ khối danh sách mã quyền khỏi trang hồ sơ web. Mọi tài khoản STAFF/CUSTOMER, gồm ADMIN và nhân viên không có quyền quản lý nhân sự, có thể sửa fullName/email/phone của chính mình qua GET/PATCH `/auth/profile`; web và app dùng cùng API client. Email được đồng bộ với tài khoản, version chống ghi đè; trường ID đích, quyền, vai trò, trạng thái và chức vụ bị từ chối. Không thay cấu trúc database.

Kiểm chứng: build API/client/admin và typecheck toàn workspace thành công; **19/19 test passed** trên PostgreSQL thật, SMTP Mailpit và Chrome. Các ca mới kiểm tra admin, nhân viên không có quyền, khách hàng, sở hữu, email trùng rollback nguyên tử, version cũ, validation và từ chối trường vượt phạm vi. Chrome kiểm tra lưu hồ sơ, tên thanh đầu trang và reload giữ thông tin trên database kiểm thử riêng. Bundle Android mới export thành công; chưa chạy thiết bị/APK. Bản Docker đã cập nhật, Chrome tại 8081 xác nhận form tải đúng dữ liệu quản trị thật và không còn khối mã quyền; lượt kiểm tra bản chạy chỉ đọc dữ liệu cá nhân. Ảnh: `.local/profile-integration.png`, `.local/profile-docker.png`.

### Căn chỉnh thanh đầu trang

Đã sửa khu vực tài khoản ở thanh đầu trang: bỏ kế thừa line-height 64px gây cắt tên, căn giữa avatar/tên/vai trò, thu gọn tên dài và dùng nút mở menu tài khoản. Build web thành công, đã cập nhật container admin và xác nhận healthy. Chrome kiểm tra trực tiếp tại cổng 8081 ở chiều rộng 1366px và 390px (thu gọn sidebar): avatar, tên và vai trò nằm trong header; menu tài khoản mở được trang hồ sơ. Ảnh kiểm chứng cục bộ: `.local/header-desktop.png`, `.local/header-narrow.png`.

## Kiểm tra lại lỗi Docker Desktop — 16/10/2026

- Ban đầu Docker CLI có mặt nhưng Linux Engine chưa chạy; WSL `docker-desktop` ở trạng thái Stopped và CLI báo thiếu pipe `dockerDesktopLinuxEngine`.
- Đã khởi động Docker Desktop; `docker version` hiển thị Client và Server, `docker desktop status` trả running.
- Đã chạy lại build image API/web. Hai lệnh Compose chạy đồng thời gây một lỗi xung đột tên container tạm ở lượt này; lệnh còn lại hoàn tất. Trạng thái cuối: `db`, `api`, `admin`, `mailpit` healthy; `migrate` Exited (0), không còn tiến trình `docker compose up` đang chạy.
- Web `http://localhost:8081/`, Swagger `/api/docs`, liveness `/api/v1/health` và readiness `/api/v1/ready` đều trả HTTP 200 sau khi container API được tạo lại.
- Cấu hình Compose bản build và development đều qua `config --quiet`. Không reset database, không xóa volume, không đổi thông tin quản trị.
- Lượt sửa lỗi này chỉ kiểm tra Docker và HTTP; không chạy lại bộ test ứng dụng, Android bundle hoặc build APK. Giới hạn Android bên dưới vẫn áp dụng.

## Hệ thống đang chạy trên máy

- Web quản trị: http://localhost:8081
- Swagger: http://localhost:8081/api/docs
- API: http://localhost:8081/api/v1; health/readiness trả thành công.
- Mailpit: http://localhost:8025.
- PostgreSQL và thư mục ảnh dùng named volume; database không mở cổng ra host trong bản build.
- `db`, `api`, `admin`, `mailpit` healthy; `migrate` kết thúc mã 0.

Cổng 8080 đang do dự án khác sử dụng nên `.env` cục bộ đặt Halora tại 8081, đồng bộ public/reset URL và CORS. Các container của dự án khác được giữ nguyên. Docker Desktop đã khởi động được sau khi sao lưu các thư mục IPC chứa socket bị kẹt; không sử dụng reset database/xóa volume để khởi động Halora.

Quản trị đầu tiên đã được tạo thật bằng bootstrap, theo yêu cầu thông tin ngẫu nhiên. Username/password/email/họ tên/điện thoại nằm trong `.local/bootstrap-admin.env`, Git và Docker build context bỏ qua. Database ứng dụng có một tài khoản quản trị; chưa có sản phẩm, khách hàng hay đơn hàng. Không đưa dữ liệu kiểm thử vào database ứng dụng.

## Kiểm tra đã chạy thành công

| Kiểm tra | Kết quả thực tế |
|---|---|
| Cài theo lockfile, build API/client/admin | Thành công với Node.js 24 và pnpm 11.25.0 |
| Typecheck toàn workspace, lint TypeScript | Thành công |
| Jest/Supertest | 2 suite, **17 test passed**, không skipped ở lượt nghiệm thu đầy đủ |
| PostgreSQL tích hợp | Chạy cả PostgreSQL 18 cục bộ riêng và PostgreSQL 18 trong Docker; tạo database tên UUID riêng rồi xóa |
| Migration và schema | Cài mới bằng cả hai cách; so sánh bảng/sequence, cột, chỉ mục, FK/check/unique, view, trigger, function, quyền/vai trò và tên migration; import schema rồi migrate không chạy lại migration cũ |
| Database bàn giao | 41 bảng nghiệp vụ/hỗ trợ, 13 view; thêm bảng lịch sử migration |
| Compose bản build và development | `config --quiet` thành công cho cả hai; image đã build thực tế, hai cấu hình đã khởi động healthy |
| Restart giữ dữ liệu | Số tài khoản không đổi, marker trên volume ảnh còn nguyên sau restart database/API/web; marker đã được dọn |
| Backup/restore | `pg_dump -Fc` thật; restore thành công vào database kiểm tra riêng rồi xóa đúng database đó |
| Web development | Chrome đăng nhập qua Vite proxy, đọc dữ liệu API thật, reload khôi phục cookie phiên |
| Web qua Nginx | Chrome đăng nhập quản trị thật, mở 16 trang quản trị và Swagger, không có exception trình duyệt hoặc lỗi API nghiệp vụ |
| Development | Vite 5173 trả HTML, proxy `/api/v1/ready` và API 3000 trả ready; watcher dùng polling để hỗ trợ bind mount Windows |
| Android | Typecheck và `expo export --platform android` thành công; tạo một bundle Hermes khoảng 3,75 MB và tài nguyên đi kèm |

Các bài tích hợp kiểm tra trực tiếp HTTP/SQL: dữ liệu request không hợp lệ; bảo vệ chủ sở hữu; một địa chỉ mặc định khi cập nhật đồng thời; nhập kho một lần; ưu đãi theo từng bước và tiền nguyên; cạnh tranh SKU/lượt voucher cuối; giải phóng voucher khi hủy; chỉ bỏ số lượng đã mua khỏi giỏ; quote thay đổi khi đổi địa chỉ; thu/hoàn không ghi nhận lặp; hóa đơn theo giá gốc; giữ snapshot lịch sử; ledger khớp số dư; phân quyền và thu hồi phiên; bảo vệ quản trị cuối; refresh/replay/CSRF; email reset qua SMTP Mailpit thật, token dùng một lần; upload, PDF và Excel thật.

Kiểm tra đủ handler cho mọi operation OpenAPI chạy khi startup. Điều này không có nghĩa mọi tổ hợp request của mọi endpoint đã được thử trên giao diện. Các thao tác nghiệp vụ được kiểm chứng bằng API tích hợp; lượt Chrome kiểm tra đăng nhập, danh sách/báo cáo và khôi phục phiên.

## Các chỉnh sửa tích hợp đáng chú ý

- Đồng bộ Promise refresh cho cả reload và tự refresh khi 401, tránh dùng cùng refresh token hai lần trong React StrictMode.
- Web gọi API cùng origin qua Vite/Nginx; hỗ trợ cấu hình URL tương đối.
- Giới hạn tần suất xác thực không tính lượt GET đọc Principal, tránh mất phiên khi reload nhiều trang.
- App dùng UUID idempotency ổn định cho cùng lần đặt hàng; báo giá hết hạn/thay đổi phải lấy lại.
- Đồng bộ trạng thái `SHIPPING`, `SUCCEEDED`, `CANCELLED`; tên đăng nhập riêng khi đăng ký; mật khẩu mới 10–128 ký tự.
- Tiền hiển thị/tạm tính bằng số nguyên để không mất độ chính xác ở giá trị lớn; thiếu giá hiển thị dấu gạch.
- Thay những nhãn cũ còn sót bằng thuật ngữ loại sản phẩm; giữ tên technical API/database.

## Giới hạn còn lại

- **Chưa tạo/ký APK và chưa chạy trên thiết bị/emulator Android.** Máy hiện thiếu Android SDK/JDK phù hợp; chưa có tài khoản/project EAS cho build cloud. `eas.json` đã có profile preview APK và production AAB; README ghi cách build và URL API theo môi trường. Bundle Hermes không thay thế nghiệm thu thiết bị.
- Workflow CI đã được thêm tại `.github/workflows/ci.yaml`; chưa chạy trên GitHub trong phiên này. Các lệnh kiểm chứng tương ứng đã chạy cục bộ.
- Vite có cảnh báo chunk JavaScript lớn khoảng 1,64 MB trước gzip; build thành công. Có thể tách tải từng trang khi tối ưu hiệu năng.
- Báo cáo theo bộ lọc sản phẩm trên chứng từ chọn chứng từ có dòng phù hợp và lấy tổng chứng từ; chưa phân bổ doanh thu/giá vốn cho riêng từng dòng. Quy ước được mô tả trong `docs/architecture/backend.md`.

Các tiến trình PostgreSQL/Mailpit native được tạo riêng để kiểm thử đã được dừng sau khi chuyển kiểm chứng sang Docker. Cấu hình test cục bộ dùng cổng development; trước lần chạy lại cần bật DB/Mailpit development theo README. Dữ liệu ứng dụng và volume Docker được giữ lại.

## Khuyến mãi/voucher — cập nhật 17/10/2026

- 27/27 test trong 3 suite đạt với PostgreSQL 18, Chrome thật và Mailpit; database kiểm thử có UUID riêng và đã được dọn.
- Kiểm tra đủ ba kiểu điều kiện, filter thời gian/sản phẩm, minQuantity=0, phần trăm/tiền sai, trần 0/null, giới hạn voucher 0/null, cạnh tranh lượt, idempotency, giữ/dùng/trả lượt, chỉnh mức giảm sau sử dụng nhưng bảo toàn snapshot, cấm xóa cấu hình từng dùng và chương trình kết thúc không bật lại.
- Chrome thực hiện sửa phần trăm và trần bằng 0 trên cả ba tab rồi reload đối chiếu SQL; ảnh `.local/promotion-management-integration.png` chỉ thuộc database thử.
- Migration 007 đã áp dụng trên Docker hiện có. DB/API/admin/Mailpit healthy; `/api/v1/health` trả 200; API quản trị đăng nhập và danh sách điều kiện có code/hasUsage. Giữ 13 tài khoản, 12 sản phẩm, 6 đơn hàng; VC01 có 3 lượt đã dùng và 1 lượt giữ theo chính sách xác nhận mới.
- Schema đã xuất từ database sạch đủ 7 migration và đối chiếu thành công; từ điển dữ liệu được tái tạo (43 bảng nghiệp vụ/hỗ trợ, 17 view; bảng lịch sử migration được công cụ loại riêng).
- Typecheck toàn workspace đạt. APK Android được kiểm chứng riêng; không suy ra trạng thái cài APK từ các kiểm tra web/API này.

## Android APK — nghiệm thu 17/10/2026

- `pnpm android:build:local` thành công: Gradle release hoàn tất 581 task, gồm lintVitalRelease và đóng gói Hermes; không tắt lint. APK tại `.local/android/halora-local-x86_64.apk`, package com.halora.mobile, version 1.0.0, min SDK 24/target 34/compile 35. Đây là bản local cho máy ảo x86_64, ký debug.
- `pnpm android:install:local` đã chạy thật: emulator-5554 online, adb install trả Success, MainActivity mở thành công, nối cổng 8081 qua adb reverse.
- App native tải được loại sản phẩm và sản phẩm thật từ Docker; đã quan sát giỏ hàng và màn thanh toán với địa chỉ khách hàng cùng tổng tiền từ API. Ảnh ghi nhận tại `.local/halora-android-home.png` và `.local/halora-android-current.png`. Số đơn trên database chính vẫn là 6.
- Plugin CNG đồng bộ classpath Kotlin với phiên bản Expo khai báo; XML cấu hình HTTP local có includeSubdomains=false và qua kiểm tra release. Metro xử lý entry Windows và workspace API client; tối đa 2 worker. SDK/JDK17/Gradle cache nằm ở ổ D.
- Khi dùng lại: mở Docker Desktop, tại thư mục gốc chạy `pnpm android:run:local`. Cập nhật app sau thay đổi mã bằng `pnpm android:build:local` rồi `pnpm android:install:local`.
