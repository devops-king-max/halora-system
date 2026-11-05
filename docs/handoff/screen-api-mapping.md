# Halora — Bản đồ Ánh xạ Màn hình và API (Screen to API Mapping)

Tài liệu này đặc tả chi tiết toàn bộ các màn hình trên **Web Quản trị (`apps/admin`)** và **App Khách hàng (`apps/mobile`)**, phương thức HTTP, endpoint API, dữ liệu gửi đi, dữ liệu phản hồi và hành vi giao diện tương ứng theo hợp đồng OpenAPI tại `docs/api/openapi.yaml`.

---

## 1. Web Quản trị (`apps/admin`)

Ảnh đại diện trên bảng Sản phẩm/Thương hiệu: `POST /api/v1/admin/media` (multipart `file`) trả MediaAsset; lưu bằng `PUT /api/v1/admin/products/:id/thumbnail` hoặc `PUT /api/v1/admin/brands/:id/thumbnail` với `{ mediaId, version }`. Response là Product/Brand, gồm `thumbnailMediaId`, `thumbnailUrl`; version thuộc bản ghi đích. Form tạo/sửa gửi `thumbnailMediaId` tùy chọn trong input hiện có. Không gửi URL tự nhập. Cột ảnh có preview và nút tải/thay; lưu thành công mới cập nhật danh sách, lỗi 409 yêu cầu đóng/mở để lấy version mới. Upload/lưu lỗi giữ thông báo và không báo thành công giả.

Tất cả các endpoint quản trị đều có tiền tố `/api/v1/admin` (trừ xác thực tại `/api/v1/auth/staff/*`). Refresh token quản trị được lưu trữ trong HttpOnly Cookie; Access token được lưu trong bộ nhớ (in-memory).

### 1.1. Xác thực & Hồ sơ cá nhân

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Đăng nhập** (`/login`) | Nhập tài khoản/email và mật khẩu, nhấn "Đăng nhập" | `POST /api/v1/auth/staff/login` | `{ identifier, password }` | `{ accessToken, expiresIn, principal }` | Loading spinner trên nút; báo lỗi nếu 401; chuyển hướng vào `/dashboard` khi thành công. Không có mock đăng nhập. |
| **Quên mật khẩu** (`/forgot-password`) | Nhập email nhận hướng dẫn đặt lại | `POST /api/v1/auth/staff/forgot-password` | `{ email }` | `{ message }` | Hiển thị thông báo kiểm tra email khi thành công; không tiết lộ email có tồn tại trong hệ thống. |
| **Đặt lại mật khẩu** (`/reset-password`) | Nhập mã token từ email và mật khẩu mới | `POST /api/v1/auth/staff/reset-password` | `{ token, newPassword }` | `{ message }` | Chuyển về màn đăng nhập khi thành công; báo lỗi nếu token hết hạn. |
| **Hồ sơ cá nhân** (`/profile`) | Tải hồ sơ của chính mình, gồm cả admin | `GET /api/v1/auth/profile` | Header `Authorization: Bearer <token>` | `{ data: AccountProfile }` gồm accountId, realm, username, fullName, email, phone, version | Form dữ liệu thật; không hiển thị danh sách mã quyền. |
| **Sửa thông tin cá nhân** (`/profile`) | Lưu họ tên, email, điện thoại | `PATCH /api/v1/auth/profile` | `{ fullName, email, phone, version }` | `{ data: AccountProfile }` | Cập nhật tên trên thanh đầu trang; lỗi version/trùng email cho phép tải lại. Không cần quyền quản lý nhân sự. |
| **Đổi mật khẩu** (`/profile`) | Nhập mật khẩu hiện tại và mật khẩu mới | `POST /api/v1/auth/change-password` | `{ currentPassword, newPassword }` | `{ message }` | Thành công thì yêu cầu đăng nhập lại; báo lỗi nếu sai mật khẩu cũ. |
| **Đăng xuất** (Header) | Nhấn "Đăng xuất" | `POST /api/v1/auth/staff/logout` | `credentials: "include"` | `{ message }` | Xóa token trong bộ nhớ, xóa cookie, chuyển về `/login`. |

---

### 1.2. Tổng quan Dashboard (`/dashboard`)

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Bảng điều khiển** (`/dashboard`) | Tải dữ liệu tổng quan kinh doanh | `GET /api/v1/admin/dashboard`<br/>`GET /api/v1/admin/reports/inventory`<br/>`GET /api/v1/admin/orders?limit=5` | Tham số lọc thời gian (`year`, mặc định năm hiện tại theo Asia/Ho_Chi_Minh; `from`, `to` nếu cần) | Báo cáo doanh thu, số đơn, tồn kho cảnh báo, danh sách đơn mới, chuỗi biểu đồ theo tháng | Hiển thị `ApiStateWrapper`: khi đang tải hiển thị Skeleton; lỗi kết nối hiển thị nút thử lại; **tuyệt đối không hiển thị 0 giả khi chưa gọi được API**. |

---

### 1.3. Loại sản phẩm (`/categories`)

*Thuật ngữ quy ước tiếng Việt: "Loại sản phẩm". Tên kỹ thuật API: `categories`.*

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Danh sách loại SP** (`/categories`) | Xem danh sách, phân trang, tìm kiếm | `GET /api/v1/admin/categories` | Params: `page, limit, search, status` | `{ data: Category[], meta: PaginationMeta }` | Table Ant Design; hiển thị empty khi `data.length === 0`; hiển thị error và nút thử lại khi mất kết nối. |
| **Thêm loại SP** (`/categories`) | Mở modal, nhập tên, mô tả, trạng thái | `POST /api/v1/admin/categories` | `{ name, description, status }` | `{ data: Category }` | Validate form bằng Zod; đóng modal và refetch bảng khi thành công. |
| **Sửa loại SP** (`/categories`) | Mở modal sửa, lưu thay đổi | `PATCH /api/v1/admin/categories/:id` | `{ name, description, status, version }` | `{ data: Category }` | Optimistic locking qua trường `version`; báo lỗi nếu xung đột phiên bản (409 Conflict). |
| **Xóa loại SP** (`/categories`) | Nhấn xóa trên dòng bảng | `DELETE /api/v1/admin/categories/:id` | Không có body | `204 No Content` | Popconfirm xác nhận; refetch danh sách sau khi xóa thành công. |

---

### 1.4. Thương hiệu (`/brands`)

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Danh sách thương hiệu** (`/brands`) | Xem danh sách, phân trang, lọc | `GET /api/v1/admin/brands` | Params: `page, limit, search, status` | `{ data: Brand[], meta: PaginationMeta }` | Bảng Ant Design với trạng thái kết nối rõ ràng. |
| **Thêm thương hiệu** (`/brands`) | Nhập form thêm mới | `POST /api/v1/admin/brands` | `{ name, description, status }` | `{ data: Brand }` | Đóng modal, thông báo thành công. |
| **Sửa thương hiệu** (`/brands`) | Chỉnh sửa tên, trạng thái | `PATCH /api/v1/admin/brands/:id` | `{ name, description, status, version }` | `{ data: Brand }` | Quản lý optimistic versioning. |
| **Xóa thương hiệu** (`/brands`) | Xác nhận xóa thương hiệu | `DELETE /api/v1/admin/brands/:id` | Không có body | `204 No Content` | Xóa và cập nhật lại danh sách. |

---

### 1.5. Quản lý Sản phẩm & Biến thể (`/products`, `/products/:id`)

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Danh sách sản phẩm** (`/products`) | Xem danh sách, lọc theo loại SP, thương hiệu, trạng thái, giá | `GET /api/v1/admin/products` | Params: `page, limit, search, categoryId, brandId, status, priceOperator, priceValue` (gửi cả hai hoặc không gửi) | `{ data: Product[], meta: PaginationMeta }` | Bảng dữ liệu; liên kết trực tiếp sang trang chi tiết. Lọc giá dùng thanh trượt với toán tử `GT/LT/GTE/LTE/EQ/NE` chọn ngay trên thanh; giá trị hiển thị tại núm, không có ô nhập số. |
| **Khoảng giá cho thanh trượt** (`/products`) | Xác định hai đầu thanh trượt | `GET /api/v1/admin/products/price-range` | Không có params | `{ data: { minPrice, maxPrice } }` (nullable khi chưa có sản phẩm) | Chỉ hiển thị thanh trượt khi API trả khoảng giá thật; không hardcode giá. |
| **Tạo mới sản phẩm** (`/products`) | Nhập form thông tin cơ bản SP | `POST /api/v1/admin/products` | `{ name, slug, categoryId, brandId, description, ingredients, benefits, isFeatured, status }` | `{ data: Product }` | Điều hướng sang `/products/:id` để tiếp tục quản lý biến thể và hình ảnh. |
| **Chi tiết sản phẩm** (`/products/:id`) | Xem toàn diện SP, danh sách SKU/biến thể và thư viện ảnh | `GET /api/v1/admin/products/:id`<br/>`GET /api/v1/admin/products/:id/variants`<br/>`GET /api/v1/admin/products/:id/images` | ID sản phẩm trên URL | Thông tin SP, danh sách biến thể với số lượng tồn kho, giá bán, SKU | Tabs chi tiết; không cho phép chỉnh sửa tồn kho trực tiếp trên form này. |
| **Cập nhật sản phẩm** (`/products/:id`) | Sửa thông tin mô tả, thành phần | `PATCH /api/v1/admin/products/:id` | `{ name, slug, categoryId, brandId, description, ingredients, benefits, isFeatured, status, version }` | `{ data: Product }` | Bảo toàn dữ liệu lịch sử và kiểm tra version. |
| **Thêm biến thể / SKU** (`/products/:id`) | Thêm màu sắc, dung tích, giá bán, ngưỡng cảnh báo tồn | `POST /api/v1/admin/products/:id/variants` | `{ sku, name, color, volumeMl, weightGrams, salePrice, referenceCostPrice, lowStockThreshold, status }` | `{ data: ProductVariant }` | Tồn kho ban đầu = 0; tồn kho chỉ tăng qua Phiếu nhập hàng hoặc Điều chỉnh kho. |
| **Sửa biến thể** (`/products/:id`) | Cập nhật giá bán, tên biến thể | `PATCH /api/v1/admin/products/:id/variants/:variantId` | `{ sku, name, color, volumeMl, weightGrams, salePrice, referenceCostPrice, lowStockThreshold, status, version }` | `{ data: ProductVariant }` | Cập nhật bảng biến thể. |
| **Tải lên hình ảnh** (`/products/:id`) | Upload file ảnh sản phẩm | `POST /api/v1/admin/media` (multipart/form-data) sau đó `POST /api/v1/admin/products/:id/images` | `formData: file` -> `{ mediaId, variantId, altText, sortOrder }` | `{ data: ProductImage }` | Hiển thị thumbnail thực từ URL; nếu chưa có ảnh hiển thị nhãn "Chưa có ảnh". |

---

### 1.6. Khách hàng (`/customers`, `/customers/:id`)

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Danh sách khách hàng** (`/customers`) | Tra cứu theo tên, email, sđt | `GET /api/v1/admin/customers` | Params: `page, limit, search, status` | `{ data: Customer[], meta: PaginationMeta }` | Bảng khách hàng với trạng thái hoạt động. |
| **Chi tiết khách hàng** (`/customers/:id`) | Xem thông tin liên hệ, sổ địa chỉ và lịch sử đơn hàng | `GET /api/v1/admin/customers/:id`<br/>`GET /api/v1/admin/customers/:id/addresses`<br/>`GET /api/v1/admin/customers/:id/orders` | ID khách hàng | Hồ sơ khách hàng, danh sách địa chỉ, bảng đơn hàng | Hiển thị hồ sơ và lịch sử mua sắm từ API. |
| **Khóa / Kích hoạt tài khoản** | Đổi trạng thái tài khoản khách | `PATCH /api/v1/admin/accounts/:accountId` | `{ status: "ACTIVE" \| "LOCKED" \| "INACTIVE", version }` | `{ data: Account }` | Cập nhật ngay trạng thái tài khoản. |

---

### 1.7. Nhân viên, Tài khoản & Phân quyền (`/employees`, `/accounts`, `/roles`)

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Danh sách nhân viên** (`/employees`) | Xem danh sách nhân sự | `GET /api/v1/admin/employees` | Params: `page, limit, search, status` | `{ data: Employee[], meta: PaginationMeta }` | Bảng quản lý nhân sự. |
| **Thêm nhân viên** (`/employees`) | Tạo hồ sơ nhân viên mới | `POST /api/v1/admin/employees` | `{ fullName, phone, email, position, status }` | `{ data: Employee }` | Chuyển đến chi tiết nhân viên để gán vai trò. |
| **Chi tiết nhân viên** (`/employees/:id`) | Xem hồ sơ và gán vai trò | `GET /api/v1/admin/employees/:id`<br/>`GET /api/v1/admin/roles` | ID nhân viên | Chi tiết nhân viên, vai trò đã gán, danh sách vai trò hệ thống | Quản lý vai trò nhân viên. |
| **Cấp tài khoản đăng nhập** (`/employees/:id`) | Tạo tài khoản đăng nhập cho nhân viên | `POST /api/v1/admin/employees/:id/account` | `{ username, email, password }` | `{ data: Account }` | Hiển thị thông tin tài khoản đã tạo. |
| **Gán vai trò** (`/employees/:id`) | Chọn một vai trò (`ADMIN`, `SALES`, `WAREHOUSE`, `ACCOUNTANT`) | `PUT /api/v1/admin/employees/:id/roles` | `{ roleIds: UUID[], version }`, tối đa một phần tử | `{ data: Employee }` | Mỗi nhân viên tối đa một vai trò; cập nhật tức thì trên giao diện. |
| **Phân quyền tài khoản** (`/roles`, `/accounts`) | Gán vai trò cho từng tài khoản nhân viên | `GET /api/v1/admin/accounts`<br/>`GET /api/v1/admin/roles`<br/>`GET /api/v1/admin/permissions`<br/>`PUT /api/v1/admin/accounts/:id/roles` | `{ roleIds: UUID[], version }`, tối đa một phần tử, version của Account | `{ data: Account }` gồm code, roleIds | Hiển thị TK01 và tên vai trò; mỗi tài khoản tối đa một vai trò. Trang Vai trò hiển thị số lượng và danh sách quyền cố định (chỉ đọc). CUSTOMER cố định; lưu xong tải lại danh sách, tài khoản đích đăng nhập lại. Không có API sửa quyền vai trò. |

---

### 1.8. Nhà cung cấp & Nhập hàng (`/suppliers`, `/goods-receipts`)

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Danh sách nhà cung cấp** (`/suppliers`) | Quản lý đối tác cung ứng mỹ phẩm | `GET /api/v1/admin/suppliers` | Params: `page, limit, search, status` | `{ data: Supplier[], meta: PaginationMeta }` | Bảng thông tin liên hệ NCC. |
| **Tạo phiếu nhập hàng** (`/goods-receipts`) | Lập phiếu nhập: chọn NCC, thêm dòng SKU, số lượng, giá vốn báo giá từng dòng | `POST /api/v1/admin/goods-receipts` | `{ supplierId, receivedAt, note, items: [{ variantId, quantity, unitCost }] }` | `{ data: GoodsReceiptDetail }` | Mỗi dòng có ô **giá vốn báo giá** sửa được, tự điền từ `GET /admin/suppliers/:supplierId/variants` khi có báo giá. Phiếu ở trạng thái `DRAFT` (chưa tăng kho, chưa đổi giá vốn). |
| **Chi tiết phiếu nhập** (`/goods-receipts/:id`) | Xem chi tiết mặt hàng nhập | `GET /api/v1/admin/goods-receipts/:id` | ID phiếu nhập | Chi tiết phiếu nhập và trạng thái | Hiển thị nút "Ghi nhận phiếu nhập" nếu đang ở `DRAFT`. |
| **Ghi nhận phiếu nhập** (`/goods-receipts/:id`) | Xác nhận nhập hàng vào kho | `POST /api/v1/admin/goods-receipts/:id/post` | Header: `Idempotency-Key`<br/>Body: `{ version }` | `{ data: GoodsReceiptDetail }` | **Cộng tồn kho, ghi sổ lịch sử và cập nhật giá vốn trong cùng transaction**: đơn giá đã chốt ghi đè `supplier_variants.quoted_cost_price` của NCC và `product_variants.reference_cost_price` của biến thể (phiếu ghi nhận gần nhất thắng). Gửi lặp cùng Idempotency-Key trả lại kết quả cũ, không cập nhật lần hai. Chuyển trạng thái sang `POSTED`; không thể sửa sau khi đã ghi nhận. |

---

### 1.9. Quản lý Tồn kho & Kiểm kê (`/inventory`, `/inventory-adjustments`)

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Danh sách số dư kho** (`/inventory`) | Xem tồn khả dụng, tồn cảnh báo của từng biến thể/SKU | `GET /api/v1/admin/inventory/balances` | Params: `page, limit, search, lowStockOnly` | `{ data: InventoryBalance[], meta: PaginationMeta }` | Bảng số lượng tồn theo SKU; đánh dấu màu đỏ nếu dưới ngưỡng an toàn. |
| **Lịch sử thẻ kho** (`/inventory`) | Tra cứu lịch sử biến động kho | `GET /api/v1/admin/inventory/movements` | Params: `variantId, from, to, type` | `{ data: StockMovement[], meta: PaginationMeta }` | Hiển thị số lượng trước/sau biến động và mã chứng từ tham chiếu. |
| **Tạo phiếu kiểm kê/điều chỉnh** (`/inventory-adjustments`) | Lập phiếu cân đối chênh lệch | `POST /api/v1/admin/inventory-adjustments` | `{ reason, items: [{ variantId, quantityDelta }] }` | `{ data: InventoryAdjustmentDetail }` | Trạng thái ban đầu `DRAFT`. |
| **Ghi nhận điều chỉnh kho** (`/inventory-adjustments/:id`) | Xác nhận cập nhật số dư kho thực tế | `POST /api/v1/admin/inventory-adjustments/:id/post` | Header: `Idempotency-Key`<br/>Body: `{ version }` | `{ data: InventoryAdjustmentDetail }` | Cập nhật số dư kho và tạo bút toán lịch sử thẻ kho. |

---

### 1.10. Khuyến mãi & Voucher (`/promotions`, `/promotions/:id`)

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Danh sách chương trình KM** (`/promotions`) | Quản lý ưu đãi | `GET /api/v1/admin/promotions` | Params: `page, limit, search, type, status, from, to, productId` | `{ data: Promotion[], meta: PaginationMeta }` | Tìm mã/tên; lọc loại PRODUCT/ORDER/VOUCHER, khoảng hiệu lực giao nhau, sản phẩm, trạng thái; phân biệt đã bật và đang trong thời hạn. |
| **Tạo chương trình KM** (`/promotions`) | Tạo ưu đãi mới, chọn đúng một loại | `POST /api/v1/admin/promotions` | `{ name, type, description, startsAt, endsAt, status }` | `{ data: Promotion }`, có `type, hasConditions, hasUsage, version` | Bắt buộc chọn loại; chi tiết chỉ hiện điều kiện tương ứng. PATCH có version; chỉ đổi type khi chưa có điều kiện, chưa từng dùng và chưa ENDED. |
| **Cấu hình giảm giá đơn / SP / Voucher** (`/promotions/:id`) | Thiết lập rule giảm giá và phát hành mã voucher | `POST /api/v1/admin/promotions/:id/product-rules`<br/>`POST /api/v1/admin/promotions/:id/order-rules`<br/>`POST /api/v1/admin/promotions/:id/vouchers` | Chi tiết quy tắc giảm giá (discountPercent, maxDiscountAmount, ngưỡng tối thiểu và giới hạn lượt) | Dữ liệu quy tắc/voucher được lưu | Cập nhật cấu hình ưu đãi. Backend quyết định tính toán giá cuối cùng. |
| **Tra cứu điều kiện** (`/promotions/:id`) | Một phần cấu hình theo type của chương trình | `GET /api/v1/admin/promotions/:id/{product-rules,order-rules,vouchers}` | `page, limit, search` | `{ data, meta }`; có `code, hasUsage, version`; voucher có `usedCount, reservedCount` | Chỉ tải/hiện đúng loại; hiển thị KMSP/KMHD/VC, tìm kiếm và phân trang từ server, lỗi có nút thử lại. Backend chặn ghi sai loại. |
| **Sửa điều kiện** (`/promotions/:id`) | Mở sửa và lưu phần trăm/ngưỡng/trần/giới hạn | `PATCH /api/v1/admin/promotions/:id/{product-rules,order-rules,vouchers}/:conditionId` | Các trường input tương ứng và `version` | Điều kiện sau cập nhật | Đã dùng vẫn sửa mức giảm cho đơn mới, giữ phạm vi sản phẩm/biến thể và mã voucher; ENDED khóa sửa. Trần 0 giảm 0; null không trần. |
| **Xóa điều kiện/chương trình** | Xóa cấu hình chưa từng dùng | `DELETE /api/v1/admin/promotions/:id` hoặc endpoint điều kiện ở trên | Query `version` của bản ghi | `204 No Content` | Ẩn/khóa nút khi `hasUsage`; backend kiểm tra lại. Cấu hình đã dùng chỉ ngừng/kết thúc, không xóa. |

---

### 1.11. Quản lý Đơn hàng (`/orders`, `/orders/:id`)

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Danh sách đơn hàng** (`/orders`) | Tìm kiếm mã đơn, lọc theo trạng thái, ngày đặt | `GET /api/v1/admin/orders` | Params: `page, limit, search, status, from, to` | `{ data: OrderSummary[], meta: PaginationMeta }` | Bảng đơn hàng với nhãn trạng thái và giá trị tiền tệ VND định dạng chuẩn. |
| **Chi tiết đơn hàng** (`/orders/:id`) | Xem toàn bộ snapshot dòng hàng, giá, khuyến mãi, địa chỉ, thanh toán | `GET /api/v1/admin/orders/:id` | ID đơn hàng | `OrderDetail` chứa đầy đủ dòng hàng, khoản giảm giá, thanh toán | Snapshot thương mại khóa sau xác nhận; các nút hành động tương ứng với trạng thái hiện tại. |
| **Xác nhận đơn hàng** (`/orders/:id`) | Nhân viên xác nhận đơn | `POST /api/v1/admin/orders/:id/confirm` | Header: `Idempotency-Key`<br/>Body: `{ version }` | `OrderDetail` | **Xuất kho** cho đơn hàng tại bước này; chuyển sang `CONFIRMED`. |
| **Bắt đầu giao hàng** (`/orders/:id`) | Cập nhật đang giao | `POST /api/v1/admin/orders/:id/dispatch` | `{ version }` | `OrderDetail` | Trạng thái `SHIPPING`. |
| **Hoàn tất giao hàng** (`/orders/:id`) | Xác nhận giao thành công | `POST /api/v1/admin/orders/:id/complete` | `{ version }` | `OrderDetail` | Trạng thái `COMPLETED`. |
| **Hủy đơn hàng** (`/orders/:id`) | Hủy đơn kèm lý do | `POST /api/v1/admin/orders/:id/cancel` | `{ version, reason }` | `OrderDetail` | **Hoàn kho đúng 1 lần duy nhất** nếu đơn đã được xác nhận trước đó. |
| **Xác nhận thanh toán** (`/orders/:id`) | Đối soát chuyển khoản hoặc thu tiền COD | `POST /api/v1/admin/payments/:paymentId/confirm` | Header: `Idempotency-Key`<br/>Body: `{ reference, note }` | `Payment` | Chống ghi nhận trùng lặp qua Idempotency-Key. |
| **Lập hóa đơn từ đơn hàng** (`/orders/:id`) | Tạo hóa đơn bán lẻ | `POST /api/v1/admin/orders/:id/invoice` | Header: `Idempotency-Key`<br/>Body: `{ note }` | `InvoiceDetail` | **Không tác động kho**. Tổng hóa đơn là tổng dòng hàng theo đơn giá gốc chốt trên đơn. |

---

### 1.12. Hóa đơn & Báo cáo (`/invoices`, `/reports`)

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Danh sách hóa đơn** (`/invoices`) | Quản lý hóa đơn lập từ đơn hàng | `GET /api/v1/admin/invoices` | Params: `page, limit, search, status` | `{ data: Invoice[], meta: PaginationMeta }` | Bảng danh sách hóa đơn bán hàng. |
| **Chi tiết hóa đơn** (`/invoices/:id`) | Xem hóa đơn và in ấn | `GET /api/v1/admin/invoices/:id` | ID hóa đơn | `InvoiceDetail` | Xem chi tiết dòng hàng, tổng tiền hàng theo đơn giá gốc. |
| **Báo cáo doanh thu & Kho** (`/reports`) | Chọn loại báo cáo, năm (mặc định năm hiện tại), quý cho thống kê sản phẩm, bộ lọc | `GET /api/v1/admin/reports/:type` | Params theo ReportFilterQuery: `year, quarter, from, to, categoryId, productId, variantId, supplierId, employeeId` | `ReportData` | Biểu đồ và bảng dữ liệu thống kê từ API; không tự vẽ số liệu giả. |
| **Thống kê sản phẩm** (`/reports`, tab Thống kê sản phẩm) | Xem số lượng và đơn giá theo biến thể trong năm/quý | `GET /api/v1/admin/reports/products` | Params theo ReportFilterQuery: `year` (bắt buộc theo giao diện, backend mặc định năm hiện tại), `quarter` 1-4 tùy chọn | `ReportData` với cột `sku, productName, variantName, quantity, unitPrice, amount` và chuỗi biểu đồ theo tháng | Bảng có số lượng và đơn giá gốc; biểu đồ cột theo tháng; lỗi API hiển thị thông báo và nút thử lại. |
| **Gợi ý nhập hàng** (`/insights/restock`) | Xem tốc độ bán 30/90 ngày, số ngày còn đủ hàng, lượng cần nhập, điều chỉnh số ngày mục tiêu | `GET /api/v1/admin/insights/restock` | Params: `targetCoverDays` (mặc định 30, 1-365), `limit` (mặc định 50, tối đa 200) | `{ data: RestockInsight[] }` gồm `sku, productName, variantName, stockQuantity, unitsSold30/90, averageDailySales30/90, daysOfCover, suggestedOrderQuantity, isLowStock, lastSupplierName, lastUnitCost, quotedCostPrice, lastReceivedAt` | Quyền `inventory.read`; bảng sắp xếp SKU dưới ngưỡng trước; dữ liệu chỉ từ lịch sử xuất kho thật; chưa đủ dữ liệu bán thì `daysOfCover = null` và không đề xuất; lỗi/đang tải/empty có thông báo và nút thử lại. |

---

## 2. App Khách hàng (`apps/mobile`)

Tất cả các endpoint công khai dùng tiền tố `/api/v1/products`, `/api/v1/categories`, `/api/v1/brands`. Endpoint cá nhân hóa dùng `/api/v1/me/*`. Refresh token khách hàng lưu trong `Expo SecureStore`; Access token lưu trong bộ nhớ (in-memory).

### 2.1. Xác thực & Tài khoản Khách hàng

Màn **Chỉnh sửa thông tin cá nhân** (`app/profile.tsx`) gọi `GET/PATCH /api/v1/auth/profile` qua `apiClient.auth.getProfile/updateProfile`. Input và response giống form web ở trên. Màn hình nằm trong tab Tài khoản; lưu thành công cập nhật hồ sơ khách trên app, chỉ sửa chủ thể của phiên.

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Đăng nhập** (`app/login.tsx`) | Nhập tên đăng nhập hoặc email, mật khẩu | `POST /api/v1/auth/customer/login` | `{ identifier, password }` | `{ accessToken, refreshToken, principal }` | Lưu refreshToken vào SecureStore; lấy hồ sơ từ `/me/profile`; quay lại màn hình trước hoặc trang tài khoản nếu mở từ deep link. |
| **Đăng ký** (`app/register.tsx`) | Nhập tên đăng nhập, họ tên, email, sđt, mật khẩu | `POST /api/v1/auth/customer/register` sau đó tự động login | `{ fullName, username, email, phone, password }` | `{ customerId, accountId }` | Tự động đăng nhập và lưu token vào SecureStore. |
| **Quên mật khẩu** (`app/forgot-password.tsx`) | Nhập email yêu cầu đặt lại | `POST /api/v1/auth/customer/forgot-password` | `{ email }` | `{ message }` | Hiển thị thông báo kiểm tra hòm thư và liên kết sang màn reset mật khẩu. |
| **Đặt lại mật khẩu** (`app/reset-password.tsx`) | Nhập token từ email và mật khẩu mới | `POST /api/v1/auth/customer/reset-password` | `{ token, newPassword }` | `{ message }` | Thông báo thành công và chuyển về màn đăng nhập. |
| **Hồ sơ tài khoản** (`app/(tabs)/account.tsx`) | Tải thông tin tài khoản | `GET /api/v1/me/profile` | Header `Authorization: Bearer <token>` | `Customer` (fullName, phone, email, code) | Hiển thị avatar, tên, email, các mục quản lý; nếu chưa đăng nhập hiển thị giao diện khách (Guest). |
| **Đổi mật khẩu** (`app/change-password.tsx`) | Đổi mật khẩu cá nhân | `POST /api/v1/auth/change-password` | `{ currentPassword, newPassword }` | `{ message }` | Thông báo thành công và yêu cầu đăng nhập lại. |
| **Đăng xuất** (`app/(tabs)/account.tsx`) | Nhấn "Đăng xuất" | `POST /api/v1/auth/customer/logout` | `{ refreshToken }` | `{ message }` | Xóa SecureStore, xóa bộ nhớ cache TanStack Query, đưa về trạng thái khách. |

---

### 2.2. Mua sắm & Khám phá Sản phẩm

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Trang chủ** (`app/(tabs)/index.tsx`) | Xem banner, loại sản phẩm, sản phẩm nổi bật, "Gợi ý cho bạn", kéo để làm mới (Pull-to-refresh) | `GET /api/v1/categories?limit=10`<br/>`GET /api/v1/products?limit=10&isFeatured=true`<br/>`GET /api/v1/me/recommendations?limit=6` (chỉ khi đã đăng nhập) | Params phân trang; recommendations dựa trên đơn không hủy của khách | `{ data: Category[] }`<br/>`{ data: PublicProductSummary[] }`<br/>`{ data: RecommendationItem[] }` | Hiển thị lưới sản phẩm với giá VND; ảnh thật từ API hoặc khung "Chưa có ảnh"; dải gợi ý ngang chỉ hiện khi API trả dữ liệu thật (ẩn hoàn toàn khi rỗng), có thử lại khi lỗi; nút "Thử lại" khi mất kết nối. |
| **Loại sản phẩm** (`app/(tabs)/categories.tsx`) | Xem toàn bộ danh sách loại sản phẩm | `GET /api/v1/categories?limit=100` | Không có params | `{ data: Category[] }` | Danh sách loại sản phẩm tiếng Việt; nhấn vào mục để xem sản phẩm theo loại. |
| **Danh sách sản phẩm** (`app/products/index.tsx`) | Tìm kiếm từ khóa, chọn chip loại sản phẩm, lọc giá bằng thanh trượt | `GET /api/v1/products`<br/>`GET /api/v1/products/price-range` (lấy hai đầu thanh trượt) | Params: `search, categoryId, brandId, limit=50, priceOperator, priceValue` (gửi cả hai hoặc không gửi); price-range không params | `{ data: PublicProductSummary[], meta }`; `{ data: { minPrice, maxPrice } }` | Lưới 2 cột; chip lọc loại sản phẩm ngang; thanh trượt giá với toán tử chọn trên thanh và giá trị hiện tại tại núm, không có ô nhập số; empty state "Không tìm thấy sản phẩm nào". |
| **Chi tiết sản phẩm** (`app/products/[id].tsx`) | Xem chi tiết, chọn phân loại (variant), chọn số lượng, xem "Thường được mua cùng" | `GET /api/v1/products/:id`<br/>`GET /api/v1/products/:id/related?limit=6` | ID sản phẩm; tham số `limit` cho related | `PublicProductDetail` (variants, images, description, ingredients, benefits)<br/>`{ data: RecommendationItem[] }` | Slider ảnh; hộp chọn phân loại cập nhật giá và tồn khả dụng; nhãn "Hết hàng" nếu tồn <= 0; dải sản phẩm mua cùng ẩn khi API rỗng, có thử lại khi lỗi. |
| **Thêm vào giỏ hàng** (`app/products/[id].tsx`) | Nhấn "Thêm vào giỏ" | `POST /api/v1/me/cart/items` | `{ variantId, quantity }` | `Cart` | Yêu cầu đăng nhập nếu là khách; hiển thị thông báo đã thêm vào giỏ. |
| **Trợ lý tư vấn sản phẩm** (`app/assistant.tsx`) | Nhập câu hỏi tư vấn, gửi tin nhắn, nhấn thẻ sản phẩm để xem chi tiết | `POST /api/v1/me/assistant/chat` | `{ messages: [{ role, content }] }` (tối đa 20 tin nhắn, 2000 ký tự mỗi tin) | `{ data: { reply, products: [{ id, code, name, thumbnailUrl, priceFrom }] } }` | Lịch sử hội thoại chỉ giữ trong bộ nhớ màn hình, không lưu AsyncStorage; nút gửi bị khóa khi đang chờ; bong bóng lỗi có "Thử lại"; hiển thị lỗi 503 khi trợ lý chưa cấu hình, không tạo câu trả lời giả. |

---

### 2.3. Giỏ hàng & Thanh toán

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Giỏ hàng** (`app/(tabs)/cart.tsx`) | Xem danh sách mặt hàng, tích chọn mua hàng | `GET /api/v1/me/cart` | Header auth | `Cart` (items, version, subtotalAmount) | Checkbox từng món / tất cả; tổng tạm tính; nút "Mua hàng". |
| **Tăng/giảm số lượng trong giỏ** | Nhấn nút `+` hoặc `-` | `PATCH /api/v1/me/cart/items/:id` | `{ quantity, version }` | `Cart` | Cập nhật số lượng tức thời; vô hiệu hóa nút khi đang gửi yêu cầu. |
| **Xóa món khỏi giỏ** | Nhấn icon xóa hoặc giảm về 0 | `DELETE /api/v1/me/cart/items/:id?version=:version` | Params version | `204 No Content` | Hộp thoại xác nhận trước khi xóa. |
| **Tính toán báo giá thanh toán** (`app/checkout.tsx`) | Chọn địa chỉ nhận, phương thức thanh toán, nhập mã voucher | `POST /api/v1/me/checkout/quote` | `{ items: [{ variantId, quantity }], addressId, paymentMethod, voucherCode }` | `CheckoutQuote` (quoteToken, amounts: { subtotalAmount, productDiscountAmount, orderDiscountAmount, voucherDiscountAmount, shippingFee, totalAmount }) | **Backend tính toán toàn bộ phí, ưu đãi và tổng tiền**; frontend chỉ hiển thị bảng bóc tách minh bạch. |
| **Xác nhận đặt hàng** (`app/checkout.tsx`) | Nhấn nút "Đặt hàng" | `POST /api/v1/me/orders` | Header: `Idempotency-Key`<br/>Body: `{ items, addressId, paymentMethod, voucherCode, note, quoteToken }` | `OrderDetail` | Đặt hàng thành công; bỏ số lượng đã mua khỏi giỏ, giữ các dòng khác; chuyển thẳng sang màn chi tiết đơn hàng `#orderCode`. |

---

### 2.4. Đơn hàng của tôi & Sổ địa chỉ

| Màn hình | Thao tác người dùng | Phương thức & Endpoint | Dữ liệu gửi (Request) | Dữ liệu trả về (Response) | Trạng thái giao diện |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Danh sách đơn của tôi** (`app/orders/index.tsx`) | Xem lịch sử đơn, lọc theo trạng thái | `GET /api/v1/me/orders` | Params: `status, limit=50` | `{ data: OrderSummary[], meta }` | Thẻ đơn hàng: mã đơn, ngày đặt, trạng thái, tổng tiền VND. |
| **Chi tiết đơn hàng** (`app/orders/[id].tsx`) | Xem địa chỉ nhận, dòng hàng, bảng tiền, trạng thái thanh toán | `GET /api/v1/me/orders/:id` | ID đơn hàng | `OrderDetail` | Hiển thị nút "Hủy đơn hàng" nếu đơn đang ở trạng thái `PENDING_CONFIRMATION`. |
| **Hủy đơn hàng** (`app/orders/[id].tsx`) | Mở modal nhập lý do và xác nhận hủy | `POST /api/v1/me/orders/:id/cancel` | `{ version, reason }` | `OrderDetail` | Cập nhật trạng thái sang `CANCELLED`. |
| **Sổ địa chỉ nhận hàng** (`app/addresses/index.tsx`) | Xem danh sách địa chỉ nhận hàng | `GET /api/v1/me/addresses` | Không có params | `{ data: CustomerAddress[] }` | Thẻ địa chỉ với badge "Mặc định", nút sửa, xóa, đặt làm mặc định. |
| **Thêm địa chỉ** (`app/addresses/new.tsx`) | Nhập form tên, sđt, địa chỉ, tỉnh/thành, quận/huyện | `POST /api/v1/me/addresses` | `{ recipientName, recipientPhone, provinceName, wardName, addressLine, isDefault }` | `{ data: CustomerAddress }` | Validate bằng Zod; lưu và quay lại danh sách địa chỉ. |
| **Sửa địa chỉ** (`app/addresses/[id].tsx`) | Cập nhật thông tin địa chỉ | `PATCH /api/v1/me/addresses/:id` | `{ recipientName, recipientPhone, provinceName, wardName, addressLine, isDefault, version }` | `{ data: CustomerAddress }` | Cập nhật và quay lại màn hình trước. |
| **Xóa địa chỉ** (`app/addresses/index.tsx`) | Nhấn xóa địa chỉ | `DELETE /api/v1/me/addresses/:id` | Không có body | `204 No Content` | Xác nhận Alert và xóa khỏi sổ địa chỉ. |
