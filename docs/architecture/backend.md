# Backend và tích hợp Halora

API NestJS dùng PostgreSQL thật, theo `docs/api/openapi.yaml` và `packages/api-client`. Tên trường, endpoint và enum giữ đúng hợp đồng. Không có mock API hoặc dữ liệu nghiệp vụ tự tạo khi khởi động.

## Luồng xử lý

`api.controller.ts` ghép từng operation OpenAPI với handler đã đăng ký; thiếu hoặc thừa handler khiến startup thất bại. Adapter kiểm tra path/query/body/header bằng Ajv, xác thực, quyền, transaction và envelope. `VALIDATE_RESPONSES=true` bật kiểm tra response theo hợp đồng, được dùng trong bộ tích hợp.

| Phần | Trách nhiệm |
|---|---|
| `core` | Cấu hình, pg pool, transaction theo AsyncLocalStorage, lỗi, hợp đồng và registry |
| `auth` | STAFF/CUSTOMER, phiên, Argon2id, JWT, refresh/reset, quyền |
| `catalog` | Hồ sơ, loại sản phẩm, thương hiệu, SKU, cung ứng, ưu đãi, quyền |
| `commerce` | Hồ sơ khách, địa chỉ, giỏ, quote, đặt hàng, thu/hoàn tiền |
| `inventory` | Bút toán kho, phiếu nhập, điều chỉnh, hóa đơn |
| `reports` | SQL báo cáo và kỳ so sánh |
| `files` | Upload ảnh thật, PDF Unicode, Excel |

SQL luôn truyền tham số; tên bảng/cột sắp xếp chỉ lấy từ cấu hình cho phép. Mọi mutation nghiệp vụ chạy cùng một transaction; các service dùng lại client hiện hành. Quote/report dùng snapshot/khóa phù hợp. Request log ghi requestId, route template, HTTP status và thời gian; không ghi body chứa mật khẩu/token.

## Xác thực và phân quyền

- STAFF dùng refresh cookie HttpOnly, SameSite=Lax; CUSTOMER trả refresh token cho SecureStore. Access token sống 15 phút; refresh sống 30 ngày, server chỉ lưu SHA-256 hash.
- Refresh xoay vòng và nhận diện lần dùng lại token trước; thu hồi phiên phải commit kể cả response 401. Client chia sẻ một Promise refresh mỗi realm, gồm cả khôi phục phiên sau reload.
- Mỗi request kiểm tra trạng thái account, hồ sơ, authVersion, phiên chưa thu hồi và quyền hiện tại. Khóa tài khoản/đổi quyền/đổi mật khẩu thu hồi phiên liên quan. Bảo vệ quản trị viên hoạt động cuối cùng.
- Cookie refresh/logout kiểm tra Origin và Fetch Metadata. CORS chỉ cho origin cấu hình; mật khẩu Argon2id, auth/media rate limit, helmet và giới hạn body/file.
- Reset gửi SMTP thật; response forgot-password chung để không tiết lộ email có tài khoản. Token reset lưu hash, hạn 30 phút, chỉ dùng một lần; reset thu hồi các phiên cũ.
- Quyền có dạng `orders.confirm`, `goodsReceipts.post`, `reports.export`; xem migration 002. `/admin` chỉ STAFF; `/me` chỉ CUSTOMER và luôn lọc theo chủ thể đã xác thực.

## Hồ sơ cá nhân

`GET /auth/profile` và `PATCH /auth/profile` dành cho mọi tài khoản đã đăng nhập, gồm ADMIN, nhân viên không có quyền quản lý nhân sự và CUSTOMER. Backend lấy accountId từ phiên xác thực; không nhận ID người khác trong path/body. DTO dùng chung `AccountProfile` và `AccountProfileUpdateInput`: fullName, email, phone, version; response thêm accountId, realm, username.

PATCH khóa account và hồ sơ trong transaction, kiểm tra version rồi cập nhật các trường được phép. Email đồng bộ giữa account và hồ sơ nhân viên; hồ sơ khách đọc email từ account. Khi đổi email, token reset chưa sử dụng bị vô hiệu; phiên hiện tại tiếp tục hoạt động. Unique email theo realm bảo đảm xung đột rollback cả thay đổi tên/điện thoại. Không thay username, vai trò, trạng thái hay chức vụ qua endpoint này. Không cần migration vì dùng các cột đã có. Web/app dùng API client chung, hiển thị dữ liệu thật và cập nhật tên sau khi lưu; phần mã quyền được bỏ khỏi trang hồ sơ.

## Tiền, quote và ưu đãi

Tất cả tiền là chuỗi số nguyên VND, tối đa 18 chữ số. Không tính tiền giao dịch bằng JavaScript Number. Phí vận chuyển mặc định `SHIPPING_FEE=30000`.

1. Tính giá gốc từng dòng từ SKU hiện hành, chọn một ưu đãi sản phẩm tốt nhất.
2. Chọn một ưu đãi đơn tốt nhất trên số tiền còn lại.
3. Áp dụng tối đa một voucher trên số còn lại sau hai bước trên.
4. Cộng phí giao hàng; giảm giá không tác động phí giao hàng.

Ngưỡng xét trước bước giảm tương ứng; phần trăm tính theo điểm cơ bản và làm tròn xuống mỗi bước. Khi bằng tiền giảm chọn ID quy tắc theo thứ tự ổn định. `quoteToken` ký HMAC, hạn 5 phút, gắn khách hàng, input và fingerprint trạng thái giá/ưu đãi/địa chỉ. Đặt/sửa đơn tính lại và từ chối quote hết hạn/thay đổi.

Voucher HELD lúc tạo đơn, RELEASED lúc hủy, USED lúc hoàn tất. Khóa dòng voucher và tính HELD+USED để không vượt giới hạn tổng hoặc mỗi khách. Sửa đơn tính lượt đang giữ của chính đơn đó đúng một lần. Cấu hình ưu đãi đã phát sinh giao dịch được bảo vệ khỏi chỉnh nội dung làm đổi ý nghĩa lịch sử.

## Kho, chứng từ và thanh toán

```text
PENDING_CONFIRMATION → CONFIRMED → SHIPPING → COMPLETED
          ↓                 ↓
       CANCELLED         CANCELLED
```

Giỏ/đơn pending chưa giữ kho. Confirm khóa các SKU theo thứ tự cố định, kiểm tra số dư, xuất kho và ghi sổ cùng transaction. Cancel pending không đổi kho; cancel confirmed hoàn một lần. Khách chỉ sửa/hủy pending; nhân viên hủy trước giao. Đã confirmed khóa thông tin thương mại.

Receipt/adjustment DRAFT chưa đổi kho; POSTED mới áp dụng, không sửa/xóa sau đó. Lịch sử lấy thời điểm post thực tế, không dùng ngày chứng từ để ghi lùi kho. Số dư luôn khớp tổng ledger.

COD/chuyển khoản đối soát thủ công: tạo payment PENDING, confirm thành SUCCEEDED, không thu vượt tổng còn thiếu. Khóa đơn serialize thanh toán; reference unique chống đối soát trùng. Hoàn tất cần đã SHIPPING và thu đủ. Hủy đơn đã thu tạo refund PENDING; confirm refund ghi nhận hoàn thực tế, fail không tăng đã hoàn. Không hỗ trợ đổi trả sau hoàn tất trong phiên bản này.

Hóa đơn chỉ tạo từ đơn COMPLETED, một hóa đơn/đơn. Tổng hóa đơn là tổng dòng theo **giá gốc snapshot**. Giảm giá, phí giao hàng và số phải trả theo dõi ở đơn; không gọi giá trị hóa đơn là tiền thực thu. Invoice DRAFT có thể sửa note/lấy lại dòng nguồn; POSTED khóa. Invoice không tác động kho.

`Idempotency-Key` là UUID, duy nhất theo tài khoản; retry cùng thao tác dùng lại cùng khóa. Advisory lock và bảng `idempotency_keys` lưu response cùng transaction nghiệp vụ. Cùng khóa khác method/path/body trả `IDEMPOTENCY_CONFLICT`; cập nhật stale version trả `VERSION_CONFLICT`. Kết quả đã commit được giữ trong database; chưa có job tự xóa khóa theo TTL.

## Báo cáo và xuất file

Các báo cáo dùng một snapshot nhất quán, phân trang ở server, hỗ trợ khoảng `[from, to)` và cặp kỳ so sánh. Ngày biểu đồ theo `Asia/Ho_Chi_Minh`. Tổng không join trực tiếp nhiều tập dòng khiến bị nhân bản.

| Báo cáo | Cơ sở ghi nhận |
|---|---|
| Sales/dashboard | Hóa đơn POSTED theo issuedAt và giá gốc; đơn COMPLETED theo completedAt và tổng phải trả; trạng thái đơn theo createdAt |
| Payments | Tiền SUCCEEDED theo paidAt; hoàn SUCCEEDED theo refundedAt; khoản phải hoàn theo createdAt; không gộp hóa đơn với thực thu |
| Purchases | Phiếu nhập POSTED theo postedAt, tổng giá trị và số lượng dòng |
| Inventory | Đầu kỳ từ ledger trước from; nhập/xuất trong kỳ; cuối kỳ trước to; tồn hiện tại từ balances |
| Promotions | Snapshot ưu đãi và lượt HELD/USED theo thời gian đặt đơn; metric tiền giảm loại đơn đã hủy |
| Activity | Audit theo createdAt và nhân viên thực hiện |

Bộ lọc sản phẩm/biến thể/loại sản phẩm trên sales/payments/purchases chọn **chứng từ có dòng phù hợp**, tổng vẫn là tổng chứng từ đó; không phải doanh thu riêng của dòng được chọn. Bộ lọc cung ứng trên sales dựa quan hệ cung ứng hiện tại; không suy ra nguồn nhập của từng đơn. Tồn theo sản phẩm lọc trực tiếp SKU. Bộ lọc nhân viên áp dụng cho nguồn có nhân viên thực hiện; báo cáo tồn không phân bổ tồn theo nhân viên. Chưa tính lợi nhuận/giá vốn xuất kho do chưa chọn phương pháp FIFO/bình quân.

PDF dùng Noto Sans kèm giấy phép OFL để in tiếng Việt. Excel giữ tiền ở dạng chuỗi nhằm bảo toàn 18 chữ số. Export lấy toàn bộ tập lọc trong snapshot, tối đa 10.000 dòng; vượt giới hạn yêu cầu thu hẹp bộ lọc. Upload nhận JPEG/PNG/WebP theo signature, tối đa 8 MB, tên file UUID; file nằm volume ảnh.

## Kiểm tra và bàn giao

Nginx bản build dùng upstream có shared zone và `resolve`, truy vấn DNS nội bộ Docker `127.0.0.11` mỗi 5 giây để cập nhật địa chỉ container API. Các đường `/api/` và `/media/` giữ nguyên URI. Healthcheck web kiểm tra HTML lẫn `/api/v1/ready` qua proxy. pg pool có listener cho lỗi kết nối đang chờ; pg loại bỏ client hỏng và mở kết nối mới cho yêu cầu sau. Listener chỉ ghi thông báo cố định, không ghi đối tượng lỗi/client chứa thông tin kết nối. Không tự chạy lại transaction nghiệp vụ đang lỗi. Script `verify-docker.ts` khởi động lại riêng database, xác nhận API không bị khởi động lại, rồi tạo lại API mà giữ web đang chạy để kiểm tra phục hồi và volume.

Trên Windows, Docker Compose cần Docker Desktop với Linux Engine đang chạy. Lỗi thiếu pipe `dockerDesktopLinuxEngine` xảy ra trước khi Compose có thể truy cập container; khởi động Desktop bằng `docker desktop start` hoặc Start Menu, chờ `docker version` có phần Server rồi chạy lại Compose. Giữ nguyên named volume PostgreSQL và ảnh khi xử lý lỗi này; hướng dẫn thao tác nằm trong README.

`apps/api/test` kiểm tra trực tiếp PostgreSQL và HTTP, không thay thế bằng mock database. Có kiểm tra cạnh tranh, ledger, snapshot, quyền, bootstrap, SMTP, web, file và hợp đồng response. Các dữ liệu test chỉ trong database tên ngẫu nhiên tách riêng. README ghi lệnh chạy; `docs/handoff/verification.md` ghi phạm vi kiểm chứng thực tế và phần cần môi trường Android/Docker.
