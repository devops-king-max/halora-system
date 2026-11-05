-- Up Migration
-- Ghi nhận phiếu nhập là nguồn cập nhật giá vốn: đơn giá đã chốt của dòng hàng
-- ghi đè giá vốn báo giá của nhà cung cấp và giá vốn chính thức của biến thể.
-- Các chú thích dưới đây chỉ tài liệu hóa quy ước; không đổi cột hay dữ liệu.
COMMENT ON COLUMN supplier_variants.quoted_cost_price IS 'Giá vốn nhà cung cấp báo giá cho biến thể; ghi nhận phiếu nhập ghi đè bằng đơn giá đã chốt';
COMMENT ON COLUMN product_variants.reference_cost_price IS 'Giá vốn chính thức của biến thể; phiếu nhập ghi nhận gần nhất ghi đè bằng đơn giá đã chốt';

-- Down Migration
COMMENT ON COLUMN supplier_variants.quoted_cost_price IS NULL;
COMMENT ON COLUMN product_variants.reference_cost_price IS NULL;
