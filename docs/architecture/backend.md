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

Vai trò ADMIN/SALES/WAREHOUSE/ACCOUNTANT/CUSTOMER có bộ quyền cố định theo migration 004; không còn operation PATCH `/admin/roles/{id}/permissions` hoặc permission `roles.update`. GET vai trò chỉ đọc. PUT `/admin/accounts/{id}/roles` dùng version tài khoản, xác thực ADMIN, khóa account rồi employee theo thứ tự thống nhất, cập nhật employee_roles (tối đa một vai trò mỗi nhân viên) và thu hồi phiên trong cùng transaction. Endpoint gán vai trò qua employee vẫn được hỗ trợ với version nhân viên. CUSTOMER không được đổi sang vai trò STAFF và nhân viên không nhận CUSTOMER; chặn loại bỏ admin hoạt động cuối cùng. Account DTO có `code`, `roleIds`; Principal có `accountCode`.

Mã nghiệp vụ dùng bảng `business_code_counters`, hàm `halora_code` cấp số theo tiền tố trong transaction và trigger theo dõi mã nhập hợp lệ để tránh trùng lần cấp sau. Lpad tối thiểu hai chữ số, không cắt phần số khi vượt 99. Migration 003 đổi mã hiện có bằng bảng ánh xạ tạm, cập nhật snapshot SKU/mã đơn/voucher theo UUID và tạo check format. Khóa UUID, số tiền, số lượng, mật khẩu và bút toán kho giữ nguyên. Account hiển thị TK01; các tiền tố còn lại ghi trong README. SKU/voucher mới có thể bỏ trống để database cấp mã, mã đã cấp không sửa qua API.

- STAFF dùng refresh cookie HttpOnly, SameSite=Lax; CUSTOMER trả refresh token cho SecureStore. Access token sống 15 phút; refresh sống 30 ngày, server chỉ lưu SHA-256 hash.
- Refresh xoay vòng và nhận diện lần dùng lại token trước; thu hồi phiên phải commit kể cả response 401. Client chia sẻ một Promise refresh mỗi realm, gồm cả khôi phục phiên sau reload.
- Mỗi request kiểm tra trạng thái account, hồ sơ, authVersion, phiên chưa thu hồi và quyền hiện tại. Khóa tài khoản/đổi quyền/đổi mật khẩu thu hồi phiên liên quan. Bảo vệ quản trị viên hoạt động cuối cùng.
- Cookie refresh/logout kiểm tra Origin và Fetch Metadata. CORS chỉ cho origin cấu hình; mật khẩu Argon2id, auth/media rate limit, helmet và giới hạn body/file.
- Reset gửi SMTP thật; response forgot-password chung để không tiết lộ email có tài khoản. Token reset lưu hash, hạn 30 phút, chỉ dùng một lần; reset thu hồi các phiên cũ.
- Quyền có dạng `orders.confirm`, `goodsReceipts.post`, `reports.export`; xem migration 002. `/admin` chỉ STAFF; `/me` chỉ CUSTOMER và luôn lọc theo chủ thể đã xác thực.

## Hồ sơ cá nhân

`GET /auth/profile` và `PATCH /auth/profile` dành cho mọi tài khoản đã đăng nhập, gồm ADMIN, nhân viên không có quyền quản lý nhân sự và CUSTOMER. Backend lấy accountId từ phiên xác thực; không nhận ID người khác trong path/body. DTO dùng chung `AccountProfile` và `AccountProfileUpdateInput`: fullName, email, phone, version; response thêm accountId, realm, username.

PATCH khóa account và hồ sơ trong transaction, kiểm tra version rồi cập nhật các trường được phép. Email đồng bộ giữa account và hồ sơ nhân viên; hồ sơ khách đọc email từ account. Khi đổi email, token reset chưa sử dụng bị vô hiệu; phiên hiện tại tiếp tục hoạt động. Unique email theo realm bảo đảm xung đột rollback cả thay đổi tên/điện thoại. Không thay username, vai trò, trạng thái hay chức vụ qua endpoint này. Không cần migration vì dùng các cột đã có. Web/app dùng API client chung, hiển thị dữ liệu thật và cập nhật tên sau khi lưu; phần mã quyền được bỏ khỏi trang hồ sơ.

## Trợ lý tư vấn sản phẩm (AI)

`POST /me/assistant/chat` (chỉ CUSTOMER) nhận `messages` tối đa 20 tin, mỗi tin 2000 ký tự, và trả `{ reply, products }`. Trợ lý gọi API chat-completions tương thích OpenAI (mặc định opencode Go, mô hình `deepseek-v4.1-flash`) bằng `fetch`, với hai công cụ (function calling) chỉ đọc chạy SQL tham số hóa trên `api_public_products`, `product_variants` và `inventory_balances`: `search_products` (từ khóa, loại, khoảng giá; chỉ sản phẩm ACTIVE còn tồn) và `get_product` (biến thể, giá, tồn). System prompt buộc trả lời tiếng Việt chỉ từ kết quả công cụ; sản phẩm trong response lấy từ DB, không bịa giá.

Cấu hình qua `ASSISTANT_API_KEY` (bắt buộc để bật), `ASSISTANT_BASE_URL` (mặc định `https://opencode.ai/inference/go/openai/v1`) và `ASSISTANT_MODEL` (mặc định `deepseek-v4.1-flash`); có thể đổi sang nhà cung cấp OpenAI-compatible khác chỉ bằng cấu hình. Client gửi `x-opencode-session` ổn định và user-agent `halora-assistant/1.0` theo hướng dẫn của opencode Go. Thiếu khóa trả 503 `ASSISTANT_UNAVAILABLE`; lỗi rate limit/timeout/5xx được ánh xạ thành 429/504/503 với thông báo tiếng Việt, không lộ chi tiết nội bộ và không ghi nội dung tin nhắn/khóa vào log. Vòng gọi công cụ tối đa 4 lượt, mỗi request có timeout. Giới hạn 10 câu hỏi/phút mỗi tài khoản bằng bộ đếm trong bộ nhớ tiến trình (reset khi khởi động, không chia sẻ giữa nhiều replica). Hội thoại chỉ nằm trong bộ nhớ màn hình app, không lưu AsyncStorage/localStorage.

## Tiền, quote và ưu đãi

Tất cả tiền là chuỗi số nguyên VND, tối đa 18 chữ số. Không tính tiền giao dịch bằng JavaScript Number. Phí vận chuyển mặc định `SHIPPING_FEE=30000`.

1. Tính giá gốc từng dòng từ SKU hiện hành, chọn một ưu đãi sản phẩm tốt nhất.
2. Chọn một ưu đãi đơn tốt nhất trên số tiền còn lại.
3. Áp dụng tối đa một voucher trên số còn lại sau hai bước trên.
4. Cộng phí giao hàng; giảm giá không tác động phí giao hàng.

Ngưỡng xét trước bước giảm tương ứng; phần trăm tính theo điểm cơ bản và làm tròn xuống mỗi bước. Khi bằng tiền giảm chọn ID quy tắc theo thứ tự ổn định. `quoteToken` ký HMAC, hạn 5 phút, gắn khách hàng, input và fingerprint trạng thái giá/ưu đãi/địa chỉ. Đặt/sửa đơn tính lại và từ chối quote hết hạn/thay đổi.

Voucher HELD lúc tạo đơn, USED lúc xác nhận đơn, RELEASED lúc hủy hợp lệ (kể cả đơn đã xác nhận). Khóa dòng voucher và tính HELD+USED để không vượt giới hạn tổng hoặc mỗi khách; lặp xác nhận/hủy không cộng/trả lượt lần nữa. Sửa đơn tính lượt đang giữ của chính đơn đó đúng một lần. Giới hạn tổng null là không giới hạn; giới hạn bằng 0 không cho dùng. Không được giảm giới hạn xuống dưới số lượt đang giữ/đã dùng.

Migration 007 giữ bốn bảng cấu hình `promotions`, `product_promotion_rules`, `order_promotion_rules`, `vouchers`; thêm sổ `promotion_usage` ghi nhận điều kiện từng được áp dụng, kể cả sau khi đơn chờ xác nhận được sửa bỏ ưu đãi. Điều kiện sản phẩm/hóa đơn có mã KMSP01/KMHD01, UUID vẫn là khóa liên kết. Chương trình và điều kiện chưa dùng được sửa/xóa; chương trình đã dùng được sửa tên, mô tả, tạm ngừng/kết thúc, giữ thời hạn. Điều kiện đã dùng vẫn cho sửa phần trăm/ngưỡng/trần cho đơn mới, giữ sản phẩm/biến thể và mã voucher; các snapshot trên đơn cũ giữ nguyên. Không xóa cấu hình từng được áp dụng. ENDED không được bật lại hoặc sửa/thêm điều kiện.

Migration 008 bổ sung `promotions.type` bắt buộc PRODUCT/ORDER/VOUCHER. Mỗi chương trình chỉ chứa một loại; generated constant và khóa ngoại ghép `(promotion_id, promotion_type)` bảo vệ cả SQL trực tiếp và cập nhật đồng thời. API chỉ cho đổi loại khi chưa có điều kiện, chưa từng áp dụng và chưa ENDED. Chương trình cũ có nhiều loại được tách, giữ UUID điều kiện/voucher, mã voucher và toàn bộ lịch sử tài chính. `promotion_usage` giữ nguyên liên kết lịch sử; view `api_promotions.has_usage` đồng thời xét cha hiện tại của điều kiện để bảo vệ chương trình được tách. Đơn mới vẫn kết hợp ưu đãi từ các chương trình khác nhau theo thứ tự sản phẩm → hóa đơn → voucher.

Danh sách chương trình hỗ trợ mã/tên, loại (`type`), trạng thái, sản phẩm và khoảng hiệu lực giao nhau với `from`/`to` (ISO 8601, gồm hai đầu). Output chương trình có `type, hasConditions, hasUsage, version`. Trang chi tiết chỉ hiện danh sách điều kiện tương ứng loại đã chọn; danh sách phân trang/tìm mã ở server; output điều kiện có `hasUsage` và version. Phần trăm 0–100, ngưỡng/trần không âm; trần null không giới hạn, trần 0 giảm 0 đồng. UI gọi PATCH có version và hiển thị lỗi 409 để tải lại, không tự tính số tiền giảm.

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

Migration 006 thêm `thumbnail_media_id` cho brands/products, FK RESTRICT tới media_assets, index và các view api_brands/api_products; api_public_products ưu tiên ảnh đã chọn rồi fallback thư viện ảnh. CRUD input chấp nhận ID media tùy chọn, output có ID và URL. PUT `/{products|brands}/{id}/thumbnail` kiểm tra quyền cập nhật, khóa bản ghi, kiểm tra version/media tồn tại và audit cùng transaction. Upload vẫn qua `/admin/media` (PNG/JPEG/WebP <=8MB); URL do backend tạo, file trong volume uploads. Cart/quote ưu tiên ảnh biến thể, ảnh đại diện, rồi ảnh chung. Ảnh trên giao dịch đã ghi nhận không bị sửa theo hồ sơ sản phẩm. Web dùng chung ThumbnailUpload/ThumbnailModal cho form và bảng; app ưu tiên ảnh đại diện đầu thư viện hiển thị. Không thêm ảnh hay dữ liệu placeholder.

Migration 005 xử lý yêu cầu bỏ nhãn dữ liệu: làm sạch các cột nội dung hiển thị trên toàn bộ bảng nghiệp vụ, gồm tên/mô tả/địa chỉ/ghi chú và snapshot tên khách, sản phẩm, nhân viên, nhà cung cấp, ưu đãi trên giao dịch. Chỉ cập nhật giá trị có nhãn; giữ nguyên UUID/mã, credentials/email, số tiền và tồn kho. Response idempotency được làm sạch theo tên trường hiển thị, không sửa fingerprint hoặc các trường kỹ thuật. File seed tạo nội dung sạch ngay từ đầu; marker seed được giữ để lần chạy lại không ghi đè dữ liệu.

Bộ dữ liệu mẫu được người dùng yêu cầu trực tiếp nằm tại `database/seed-demo.sql`, tách khỏi migration và schema. Service Compose `seed-demo` thuộc profile `tools`, chỉ chạy bằng lệnh thủ công. `pnpm db:seed:demo:docker` backup trước khi import, đồng bộ file quản trị cục bộ sau khi import thành công. SQL khóa advisory, kiểm tra đúng một admin hoạt động, thêm 3 tài khoản cho từng vai trò SALES/WAREHOUSE/ACCOUNTANT/CUSTOMER, đổi mật khẩu admin hiện có thành hash Argon2id của `123456` và thu hồi phiên/reset cũ. Marker trong audit bảo vệ lần chạy lại; toàn bộ snapshot, thanh toán, chứng từ và số dư/sổ kho cùng transaction. Không hạ validation mật khẩu mới hoặc thay hành vi frontend. Đây là bộ mẫu tĩnh được nạp vào database khi có yêu cầu, không phải mock API hay dữ liệu tự sinh khi khởi động.

Nginx bản build dùng upstream có shared zone và `resolve`, truy vấn DNS nội bộ Docker `127.0.0.11` mỗi 5 giây để cập nhật địa chỉ container API. Các đường `/api/` và `/media/` giữ nguyên URI. Healthcheck web kiểm tra HTML lẫn `/api/v1/ready` qua proxy. pg pool có listener cho lỗi kết nối đang chờ; pg loại bỏ client hỏng và mở kết nối mới cho yêu cầu sau. Listener chỉ ghi thông báo cố định, không ghi đối tượng lỗi/client chứa thông tin kết nối. Không tự chạy lại transaction nghiệp vụ đang lỗi. Script `verify-docker.ts` khởi động lại riêng database, xác nhận API không bị khởi động lại, rồi tạo lại API mà giữ web đang chạy để kiểm tra phục hồi và volume.

Trên Windows, Docker Compose cần Docker Desktop với Linux Engine đang chạy. Lỗi thiếu pipe `dockerDesktopLinuxEngine` xảy ra trước khi Compose có thể truy cập container; khởi động Desktop bằng `docker desktop start` hoặc Start Menu, chờ `docker version` có phần Server rồi chạy lại Compose. Giữ nguyên named volume PostgreSQL và ảnh khi xử lý lỗi này; hướng dẫn thao tác nằm trong README.

Môi trường Android trên máy phát triển hiện tại đặt Android Studio/SDK/AVD trong `D:\Android`; vị trí cũ trên ổ C được giữ bằng NTFS junction để các cấu hình SDK và shortcut hiện có tiếp tục hoạt động. Đây là cấu hình công cụ trên host, tách khỏi dữ liệu PostgreSQL và volume Docker của Halora. Khi chuẩn bị máy khác, chọn SDK/AVD tại ổ đủ dung lượng và đặt ANDROID_HOME theo vị trí thực tế; app tiếp tục kết nối API qua adb reverse theo README.

Máy ảo API 37 trên host 16 GB có thể chạy riêng từ emulator CLI, tránh IDE index cả monorepo trong lúc khởi động. Image hiện tại tự yêu cầu 4 GB RAM; cấu hình chạy thử thành công dùng 2 vCPU, WHPX và tắt Vulkan. Sau khi đóng IDE đang chiếm khoảng 2.3 GB RAM, cold boot hoàn tất khoảng 100 giây, xác minh bằng adb online và sys.boot_completed=1. Đây là kiểm chứng Android OS, chưa phải nghiệm thu app Halora hoặc APK.

`apps/api/test` kiểm tra trực tiếp PostgreSQL và HTTP, không thay thế bằng mock database. Có kiểm tra cạnh tranh, ledger, snapshot, quyền, bootstrap, SMTP, web, file và hợp đồng response. Các dữ liệu test chỉ trong database tên ngẫu nhiên tách riêng. README ghi lệnh chạy; `docs/handoff/verification.md` ghi phạm vi kiểm chứng thực tế và phần cần môi trường Android/Docker.
