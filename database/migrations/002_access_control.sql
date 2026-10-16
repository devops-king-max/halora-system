-- Up Migration
-- Chỉ khởi tạo vai trò/quyền hệ thống; không tạo tài khoản hay dữ liệu kinh doanh.
INSERT INTO roles(code,name,description) VALUES
 ('ADMIN','Quản trị viên','Quản trị toàn bộ hệ thống'),
 ('SALES','Bán hàng','Quản lý khách hàng và xử lý đơn hàng'),
 ('WAREHOUSE','Kho','Quản lý sản phẩm, cung ứng và kho'),
 ('ACCOUNTANT','Kế toán','Đối soát thanh toán, hóa đơn và báo cáo'),
 ('CUSTOMER','Khách hàng','Truy cập dữ liệu cá nhân qua /me');
INSERT INTO permissions(code,name,description)
 SELECT resource||'.'||action,resource||'.'||action,'Quyền hệ thống Halora: '||resource||'.'||action
 FROM (VALUES
 ('categories',ARRAY['read','create','update','delete']),('brands',ARRAY['read','create','update','delete']),
 ('products',ARRAY['read','create','update','delete']),('customers',ARRAY['read','update','delete']),
 ('employees',ARRAY['read','create','update','delete','createAccount','assignRoles']),('accounts',ARRAY['read','update']),
 ('roles',ARRAY['read','update']),('permissions',ARRAY['read']),('suppliers',ARRAY['read','create','update','delete']),
 ('promotions',ARRAY['read','create','update','delete']),('orders',ARRAY['read','confirm','dispatch','complete','cancel']),
 ('payments',ARRAY['create','confirm','fail']),('refunds',ARRAY['confirm','fail']),
 ('invoices',ARRAY['read','create','update','delete','post','export']),
 ('goodsReceipts',ARRAY['read','create','update','delete','post','export']),('inventory',ARRAY['read']),
 ('inventoryAdjustments',ARRAY['read','create','update','delete','post']),('reports',ARRAY['read','export']),('media',ARRAY['create'])
 ) AS modules(resource,actions) CROSS JOIN LATERAL unnest(actions) AS action;
INSERT INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='ADMIN';
INSERT INTO role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE
 (r.code='SALES' AND (p.code LIKE 'customers.%' OR p.code LIKE 'orders.%' OR p.code IN ('categories.read','brands.read','products.read','inventory.read','payments.create','invoices.read','invoices.create','invoices.update','invoices.post','invoices.export')))
 OR (r.code='WAREHOUSE' AND (split_part(p.code,'.',1) IN ('categories','brands','products','suppliers','goodsReceipts','inventory','inventoryAdjustments','media') OR p.code IN ('orders.read','orders.confirm','orders.dispatch')))
 OR (r.code='ACCOUNTANT' AND (split_part(p.code,'.',1) IN ('payments','refunds','invoices','reports') OR p.code IN ('orders.read','customers.read','employees.read','products.read','categories.read','brands.read','goodsReceipts.read','inventory.read')));

-- Down Migration
DO $$ BEGIN RAISE EXCEPTION 'Access-control data cannot be reverted automatically'; END $$;
