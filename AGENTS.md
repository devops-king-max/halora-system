# Halora — hướng dẫn phát triển

## Bối cảnh và phạm vi

Halora là hệ thống bán mỹ phẩm gồm web quản trị, app khách hàng và một backend dùng chung. Hệ thống có 12 nhóm chức năng: tài khoản và phân quyền, khách hàng, loại sản phẩm, sản phẩm và biến thể, giỏ hàng, đơn hàng, khuyến mãi, hóa đơn, nhân viên, nhập hàng, nhà cung cấp và báo cáo.

Phiên bản đầu quản lý một kho theo biến thể/SKU; thanh toán COD hoặc chuyển khoản được nhân viên đối soát; giao hàng cập nhật thủ công. Hóa đơn chỉ lập từ đơn hàng. Android là nền tảng app nghiệm thu trước.

Hiện repository đã hoàn thành triển khai:
- Web quản trị (`apps/admin`): React 18, Vite 6, Ant Design 5, React Router 6, TanStack Query, React Hook Form, Zod.
- App khách hàng (`apps/mobile`): React Native, Expo, Expo Router, React Native Paper, TanStack Query, React Hook Form, Zod, SecureStore.
- Package API client dùng chung (`packages/api-client`): TypeScript, native ESM, xử lý token refresh và Idempotency-Key.
- Hợp đồng OpenAPI 3.0.3 (`docs/api/openapi.yaml`) và tài liệu bàn giao (`docs/handoff/`).
- Backend NestJS 11, Node.js 24, PostgreSQL 18; migration và bản xuất schema; Docker cho database, migration, API, web và Mailpit.

Backend đã triển khai theo hợp đồng OpenAPI. Giữ cấu trúc giao diện Antigravity và điều chỉnh tích hợp cùng API client khi cần.

## Công nghệ và cấu trúc workspace

- TypeScript cho toàn bộ mã nguồn ứng dụng; pnpm workspace và lockfile được commit vào repository.
- `apps/admin`: React, Vite, Ant Design, React Router, TanStack Query, React Hook Form và Zod.
- `apps/mobile`: React Native, Expo, Expo Router, React Native Paper, TanStack Query và SecureStore.
- `apps/api`: NestJS trên Node.js 24; controller xử lý HTTP, service xử lý nghiệp vụ, lớp `core/db.ts` truy cập SQL bằng `pg`, tham số hóa và quản lý transaction.
- `packages/api-client`: kiểu dữ liệu và API client dùng chung cho web/app.
- `database/migrations`: migration SQL có phiên bản, chạy bằng `node-pg-migrate`.
- `database/schema.sql`: bản xuất cấu trúc đầy đủ từ database đã chạy migration, dùng cho cài mới.
- `docs/api/openapi.yaml`: hợp đồng tích hợp chính thức.
- `docs/handoff`: mapping màn hình/API và tài liệu bàn giao frontend.
- `infra`: Dockerfile, Nginx và script chuẩn bị cấu hình cục bộ.

## Thuật ngữ và giao diện

- Dùng cụm **loại sản phẩm** cho nội dung tiếng Việt. Tên kỹ thuật `categories` và `categoryId` được giữ trong API/database.
- Giao diện, nhãn trạng thái và thông báo người dùng bằng tiếng Việt.
- Hiển thị tiền VND, ngày giờ theo `Asia/Ho_Chi_Minh`. API truyền ngày giờ ISO 8601.

## Không sử dụng dữ liệu nghiệp vụ giả

- Không tạo mock API, Faker, fixture, mảng nghiệp vụ hardcode hoặc kết quả thao tác thành công giả để lấp giao diện.
- Không dùng localStorage, AsyncStorage hoặc file JSON làm database nghiệp vụ.
- Chỉ hiển thị danh sách rỗng khi API trả thành công với dữ liệu rỗng. Khi chưa kết nối được API, hiển thị lỗi kết nối và hành động thử lại.
- Không thay số liệu chưa tải được bằng 0, ảnh sản phẩm giả hoặc biểu đồ mẫu.
- Có thể khai báo tĩnh menu, nhãn enum, cấu hình giao diện và các giá trị quy ước.
- Không tự thêm seed nghiệp vụ khi khởi động. Migration chỉ tạo quyền/vai trò hệ thống. Dữ liệu kiểm thử chỉ tồn tại trong database tách biệt có tên ngẫu nhiên và bị xóa sau kiểm thử; không dùng để lấp giao diện.

## Hợp đồng API và tích hợp frontend

- Web/app dùng chung API client; component không truy cập PostgreSQL hoặc tự gọi HTTP ngoài lớp client.
- Prefix API là `/api/v1`. Endpoint khách hàng dùng `/me`, endpoint quản trị dùng `/admin`; xác thực khách hàng và nhân viên tách riêng.
- JSON dùng `camelCase`; ID là UUID string; tiền là chuỗi số nguyên VND; số lượng là số nguyên; enum trạng thái dùng chữ hoa.
- Giữ đúng tên endpoint, biến và trường đã được thống nhất. Các trường tiền gồm `subtotalAmount`, `productDiscountAmount`, `orderDiscountAmount`, `voucherDiscountAmount`, `shippingFee`, `totalAmount`.
- Hợp đồng đã thống nhất được ghi trong OpenAPI; types của API client được duy trì đồng bộ. Backend kiểm tra đủ handler cho mọi operation khi khởi động.
- Mọi thay đổi hợp đồng phải cập nhật OpenAPI, API client, các bên sử dụng và tài liệu mapping màn hình/API trong cùng thay đổi.
- Backend quyết định quyền truy cập, quyền sở hữu dữ liệu, giá, khuyến mãi, phí giao hàng, tiền thu/hoàn và tồn kho. Frontend gửi yêu cầu và hiển thị kết quả.
- Refresh token web dùng cookie HttpOnly; app dùng SecureStore. Không lưu refresh token trong localStorage.
- Chỉ cập nhật trạng thái thành công sau phản hồi API thành công. Xử lý lỗi validation, thiếu quyền, xung đột version và lỗi mạng rõ ràng.

## Quy tắc nghiệp vụ phải bảo toàn

- Giỏ hàng và đơn chờ xác nhận chưa giữ kho. Xác nhận đơn mới xuất kho; hủy hợp lệ hoàn kho đúng một lần.
- Phiếu nhập chỉ cộng kho khi ghi nhận. Không chỉnh tồn qua form/API cập nhật sản phẩm hoặc biến thể.
- Cập nhật số dư kho và bút toán lịch sử trong cùng transaction. Chống ghi nhận lặp khi xác nhận chứng từ, thanh toán và hoàn tiền bằng `Idempotency-Key`.
- Lập hóa đơn không tác động kho. Tổng hóa đơn là tổng dòng hàng theo đơn giá gốc đã chốt; giảm giá cấp đơn, phí giao hàng và tổng phải trả được theo dõi tại đơn hàng.
- Lưu snapshot tên hàng, biến thể, giá, ưu đãi và địa chỉ trên giao dịch; sửa hồ sơ hay sản phẩm không được làm đổi lịch sử.
- Không sửa/xóa trực tiếp chứng từ đã ghi nhận. Dữ liệu đã được tham chiếu cần ngừng hoạt động, hủy hoặc điều chỉnh theo quy trình.
- Vai trò mặc định: quản trị viên, bán hàng, kho, kế toán và khách hàng. Backend kiểm tra cả quyền thao tác và quyền sở hữu.

## Database và bảo mật

- Migration là nguồn thay đổi cấu trúc chính thức. Không sửa migration đã áp dụng; thêm migration mới và cập nhật bản xuất schema.
- Dùng khóa ngoại, unique và check phù hợp; không dùng CHECK liên bảng để tính tổng chứng từ.
- Không lưu mật khẩu dạng rõ; backend dùng băm mật khẩu và hash refresh token theo đặc tả.
- Không commit `.env`, mật khẩu, token, dump database hoặc thông tin nhạy cảm. `.env.example` chỉ chứa giá trị mẫu.
- Không in cấu hình Compose đã nội suy hoặc biến môi trường chứa secret vào log/báo cáo. Dùng `docker compose config --quiet` để kiểm tra.
- `.local/bootstrap-admin.env` là thông tin quản trị cục bộ, được Git và Docker build context bỏ qua. Bootstrap là lệnh riêng; không tự đổi mật khẩu tài khoản đã tồn tại.
- Không reset database, chạy migration hủy dữ liệu hoặc xóa volume trong quy trình khởi động thông thường. Không dùng `docker compose down --volumes` như bước xử lý lỗi mặc định.

## Lệnh kiểm chứng và vận hành hiện tại

- Cài đặt monorepo: `pnpm install`
- Build package API client: `pnpm --filter @halora/api-client run build`
- Typecheck và build Web Quản trị: `pnpm --filter @halora/admin run build`
- Typecheck App Khách hàng: `pnpm --filter @halora/mobile run typecheck`
- Khởi động Web Quản trị: `pnpm --filter @halora/admin run dev`
- Khởi động App Khách hàng: `pnpm --filter @halora/mobile run start`
- Chuẩn bị cấu hình và thông tin quản trị ngẫu nhiên nếu chưa có: `pnpm setup:local` (không ghi đè file đã có).
- Khởi động bản build: `docker compose up --build -d`; development: `docker compose -f compose.yaml -f compose.dev.yaml up --build -d`.
- Chỉ chạy hạ tầng cho code chạy host: `docker compose -f compose.yaml -f compose.dev.yaml up -d db mailpit`.
- Migration: `pnpm db:migrate`; tạo quản trị: `pnpm db:bootstrap` hoặc `pnpm db:bootstrap:docker`.
- Build server/web/client: `pnpm build`; kiểm tra kiểu: `pnpm typecheck`; lint hiện là TypeScript: `pnpm lint`.
- Kiểm thử: `pnpm test`; tích hợp cần `TEST_DATABASE_URL` trên PostgreSQL 18 cho phép tạo database riêng. `HALORA_BROWSER_TEST=true` bật trình duyệt thật; `MAILPIT_TEST_URL` bật kiểm tra SMTP thật.
- Đối chiếu schema: `pnpm db:verify-schema`; xuất schema: `pnpm db:export-schema` trên database sạch đã migrate.
- Đóng gói JS Android: `pnpm --filter @halora/mobile exec expo export --platform android --output-dir ../../.local/mobile-export`.
- Backup: `pnpm db:backup:docker`; thử restore riêng: `pnpm db:restore-check:docker <đường-dẫn-tuyệt-đối-file.dump>`.
- Kiểm tra cấu hình Docker: `docker compose config --quiet`
- Dừng Docker: `docker compose stop`

Khi bàn giao, cập nhật README và tài liệu kiến trúc; ghi rõ kiểm tra đã chạy, trạng thái Docker, Android bundle/APK và giới hạn môi trường. Không tuyên bố APK hay container đã chạy nếu chỉ kiểm tra TypeScript/cấu hình.
