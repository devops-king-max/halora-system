# Kết quả kiểm chứng bàn giao — 15/10/2026

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
