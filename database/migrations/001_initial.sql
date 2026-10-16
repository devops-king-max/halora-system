-- Up Migration
-- Halora: cấu trúc nghiệp vụ. Không chứa dữ liệu mẫu hoặc mật khẩu.
CREATE SEQUENCE business_code_sequence;
CREATE FUNCTION halora_code(prefix text) RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT prefix || '-' || lpad(nextval('business_code_sequence')::text, 10, '0')
$$;
CREATE DOMAIN money_vnd AS numeric(18,0) CHECK (VALUE >= 0);
CREATE DOMAIN discount_percent AS numeric(5,2) CHECK (VALUE BETWEEN 0 AND 100);
CREATE FUNCTION halora_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = clock_timestamp(); NEW.version = OLD.version + 1; RETURN NEW; END $$;

CREATE TABLE accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), realm text NOT NULL CHECK (realm IN ('STAFF','CUSTOMER')),
 username text NOT NULL CHECK (length(trim(username)) > 0), email text NOT NULL,
 password_hash text NOT NULL, status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LOCKED','INACTIVE')),
 auth_version integer NOT NULL DEFAULT 1, UNIQUE (id,realm),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX accounts_username_realm_uq ON accounts(realm,lower(username));
CREATE UNIQUE INDEX accounts_email_realm_uq ON accounts(realm,lower(email));
CREATE TABLE customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE DEFAULT halora_code('KH'),
 account_id uuid NOT NULL UNIQUE, account_realm text NOT NULL DEFAULT 'CUSTOMER' CHECK (account_realm='CUSTOMER'),
 full_name text NOT NULL, phone text NOT NULL, status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
 FOREIGN KEY (account_id,account_realm) REFERENCES accounts(id,realm) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE employees (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE DEFAULT halora_code('NV'),
 account_id uuid UNIQUE, account_realm text NOT NULL DEFAULT 'STAFF' CHECK (account_realm='STAFF'),
 full_name text NOT NULL, phone text NOT NULL, email text NOT NULL, position text NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
 FOREIGN KEY (account_id,account_realm) REFERENCES accounts(id,realm) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL);
CREATE TABLE role_permissions (role_id uuid REFERENCES roles(id) ON DELETE CASCADE, permission_id uuid REFERENCES permissions(id) ON DELETE RESTRICT, PRIMARY KEY(role_id,permission_id));
CREATE TABLE employee_roles (employee_id uuid REFERENCES employees(id) ON DELETE CASCADE, role_id uuid REFERENCES roles(id) ON DELETE RESTRICT, PRIMARY KEY(employee_id,role_id));
CREATE TABLE auth_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 refresh_token_hash text NOT NULL UNIQUE, previous_token_hash text, expires_at timestamptz NOT NULL,
 revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_account_idx ON auth_sessions(account_id);
CREATE INDEX auth_sessions_previous_idx ON auth_sessions(previous_token_hash) WHERE previous_token_hash IS NOT NULL;
CREATE TABLE password_reset_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE customer_addresses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
 recipient_name text NOT NULL, recipient_phone text NOT NULL, address_line text NOT NULL, province_name text NOT NULL, ward_name text NOT NULL,
 is_default boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX customer_addresses_default_uq ON customer_addresses(customer_id) WHERE is_default;
CREATE INDEX customer_addresses_customer_idx ON customer_addresses(customer_id);
CREATE TABLE categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE DEFAULT halora_code('LSP'), name text NOT NULL,
 description text, status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX categories_name_uq ON categories(lower(trim(name)));
COMMENT ON TABLE categories IS 'Loại sản phẩm';
CREATE TABLE brands (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE DEFAULT halora_code('TH'), name text NOT NULL,
 description text, status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX brands_name_uq ON brands(lower(trim(name)));
CREATE TABLE products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE DEFAULT halora_code('SP'), name text NOT NULL, slug text NOT NULL UNIQUE,
 category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT, brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
 description text, ingredients text, benefits text, is_featured boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE INDEX products_category_idx ON products(category_id);
CREATE INDEX products_brand_idx ON products(brand_id);
CREATE TABLE product_variants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 sku text NOT NULL, name text NOT NULL, color text, volume_ml double precision CHECK (volume_ml > 0), weight_grams double precision CHECK (weight_grams > 0),
 sale_price money_vnd NOT NULL, reference_cost_price money_vnd, low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')), UNIQUE (product_id,id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX product_variants_sku_uq ON product_variants(lower(trim(sku)));
CREATE TABLE media_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), url text NOT NULL, storage_name text NOT NULL UNIQUE,
 mime_type text NOT NULL, size integer NOT NULL CHECK (size > 0), original_name text NOT NULL,
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE product_images (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 variant_id uuid, media_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT, alt_text text, sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
 FOREIGN KEY(product_id,variant_id) REFERENCES product_variants(product_id,id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE INDEX product_images_product_idx ON product_images(product_id,sort_order);
CREATE TABLE inventory_balances (
 variant_id uuid PRIMARY KEY REFERENCES product_variants(id) ON DELETE RESTRICT,
 stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE carts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE cart_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
 product_id uuid NOT NULL, variant_id uuid NOT NULL, quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 1000000),
 UNIQUE(cart_id,variant_id), FOREIGN KEY(product_id,variant_id) REFERENCES product_variants(product_id,id) ON DELETE RESTRICT
);
CREATE TABLE suppliers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE DEFAULT halora_code('NCC'), name text NOT NULL,
 contact_name text NOT NULL, phone text NOT NULL, email text NOT NULL, address text NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE supplier_variants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
 variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT, quoted_cost_price money_vnd NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')), UNIQUE(supplier_id,variant_id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE promotions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE DEFAULT halora_code('KM'), name text NOT NULL, description text,
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, CHECK (starts_at <= ends_at),
 status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','PAUSED','ENDED')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE product_promotion_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
 product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT, variant_id uuid,
 discount_percent discount_percent NOT NULL, min_quantity integer NOT NULL CHECK (min_quantity > 0), max_discount_amount money_vnd,
 FOREIGN KEY(product_id,variant_id) REFERENCES product_variants(product_id,id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE order_promotion_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
 min_order_amount money_vnd NOT NULL, discount_percent discount_percent NOT NULL, max_discount_amount money_vnd,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE vouchers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
 code text NOT NULL, discount_percent discount_percent NOT NULL, min_order_amount money_vnd NOT NULL, max_discount_amount money_vnd,
 max_uses integer CHECK (max_uses > 0), per_customer_limit integer NOT NULL CHECK (per_customer_limit > 0),
 status text NOT NULL CHECK (status IN ('ACTIVE','INACTIVE')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX vouchers_code_uq ON vouchers(lower(trim(code)));
CREATE TABLE orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_code text NOT NULL UNIQUE DEFAULT halora_code('DH'),
 customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT, customer_name text NOT NULL,
 status text NOT NULL DEFAULT 'PENDING_CONFIRMATION' CHECK (status IN ('PENDING_CONFIRMATION','CONFIRMED','SHIPPING','COMPLETED','CANCELLED')),
 payment_method text NOT NULL CHECK (payment_method IN ('COD','BANK_TRANSFER')),
 recipient_name text NOT NULL, recipient_phone text NOT NULL, address_line text NOT NULL, province_name text NOT NULL, ward_name text NOT NULL, note text,
 subtotal_amount money_vnd NOT NULL, product_discount_amount money_vnd NOT NULL, order_discount_amount money_vnd NOT NULL,
 voucher_discount_amount money_vnd NOT NULL, shipping_fee money_vnd NOT NULL, total_amount money_vnd NOT NULL,
 CHECK (product_discount_amount+order_discount_amount+voucher_discount_amount <= subtotal_amount),
 CHECK (total_amount = subtotal_amount-product_discount_amount-order_discount_amount-voucher_discount_amount+shipping_fee),
 confirmed_at timestamptz, shipped_at timestamptz, completed_at timestamptz, cancelled_at timestamptz, cancellation_reason text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE INDEX orders_customer_idx ON orders(customer_id,created_at DESC);
CREATE INDEX orders_status_time_idx ON orders(status,created_at DESC);
CREATE TABLE order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 product_id uuid NOT NULL, variant_id uuid NOT NULL, product_name text NOT NULL, variant_name text NOT NULL, sku text NOT NULL, thumbnail_url text,
 quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 1000000), unit_price money_vnd NOT NULL,
 line_subtotal money_vnd NOT NULL, product_discount_amount money_vnd NOT NULL, line_total money_vnd NOT NULL,
 product_promotion_rule_id uuid REFERENCES product_promotion_rules(id) ON DELETE RESTRICT,
 CHECK (line_subtotal = quantity*unit_price), CHECK (line_total=line_subtotal-product_discount_amount),
 UNIQUE(order_id,variant_id), FOREIGN KEY(product_id,variant_id) REFERENCES product_variants(product_id,id) ON DELETE RESTRICT
);
CREATE TABLE order_discounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 scope text NOT NULL CHECK (scope IN ('PRODUCT','ORDER','VOUCHER')),
 promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT, promotion_name text NOT NULL,
 variant_id uuid, product_rule_id uuid REFERENCES product_promotion_rules(id) ON DELETE RESTRICT,
 order_rule_id uuid REFERENCES order_promotion_rules(id) ON DELETE RESTRICT, voucher_id uuid REFERENCES vouchers(id) ON DELETE RESTRICT,
 voucher_code text, amount money_vnd NOT NULL,
 FOREIGN KEY(order_id,variant_id) REFERENCES order_items(order_id,variant_id) ON DELETE CASCADE,
 CHECK ((scope='PRODUCT' AND product_rule_id IS NOT NULL AND variant_id IS NOT NULL AND order_rule_id IS NULL AND voucher_id IS NULL)
 OR (scope='ORDER' AND order_rule_id IS NOT NULL AND variant_id IS NULL AND product_rule_id IS NULL AND voucher_id IS NULL)
 OR (scope='VOUCHER' AND voucher_id IS NOT NULL AND variant_id IS NULL AND product_rule_id IS NULL AND order_rule_id IS NULL))
);
CREATE INDEX order_discounts_promotion_idx ON order_discounts(promotion_id);
CREATE TABLE voucher_redemptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
 order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT, customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
 status text NOT NULL CHECK (status IN ('HELD','USED','RELEASED')), UNIQUE(voucher_id,order_id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX voucher_redemptions_usage_idx ON voucher_redemptions(voucher_id,customer_id,status);
CREATE TABLE order_status_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 from_status text, to_status text NOT NULL, note text, account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 performed_by_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 method text NOT NULL CHECK (method IN ('COD','BANK_TRANSFER')), amount money_vnd NOT NULL CHECK (amount > 0),
 status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SUCCEEDED','FAILED','CANCELLED')),
 reference text, note text, paid_at timestamptz, created_by uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payments_reference_uq ON payments(method,reference) WHERE status='SUCCEEDED' AND reference IS NOT NULL;
CREATE INDEX payments_order_idx ON payments(order_id);
CREATE TABLE refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 payment_id uuid NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT, amount money_vnd NOT NULL CHECK (amount>0),
 status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SUCCEEDED','FAILED')), reference text, reason text, refunded_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refunds_order_idx ON refunds(order_id);
CREATE TABLE invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_code text NOT NULL UNIQUE DEFAULT halora_code('HD'),
 order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT, order_code text NOT NULL,
 employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT, employee_name text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','CANCELLED')), issued_at timestamptz, note text, total_amount money_vnd NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE invoice_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
 product_id uuid NOT NULL, variant_id uuid NOT NULL, product_name text NOT NULL, variant_name text NOT NULL, sku text NOT NULL,
 quantity integer NOT NULL CHECK (quantity>0), unit_price money_vnd NOT NULL, line_total money_vnd NOT NULL CHECK(line_total=quantity*unit_price),
 UNIQUE(invoice_id,variant_id), FOREIGN KEY(product_id,variant_id) REFERENCES product_variants(product_id,id) ON DELETE RESTRICT
);
CREATE TABLE goods_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), receipt_code text NOT NULL UNIQUE DEFAULT halora_code('PN'),
 supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT, supplier_name text NOT NULL,
 employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT, employee_name text NOT NULL,
 received_at timestamptz NOT NULL, posted_at timestamptz, status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED','CANCELLED')),
 note text, total_amount money_vnd NOT NULL DEFAULT 0, UNIQUE(id,supplier_id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE goods_receipt_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), receipt_id uuid NOT NULL, supplier_id uuid NOT NULL,
 product_id uuid NOT NULL, variant_id uuid NOT NULL, product_name text NOT NULL, variant_name text NOT NULL, sku text NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0 AND quantity<=1000000), unit_cost money_vnd NOT NULL, line_total money_vnd NOT NULL CHECK(line_total=quantity*unit_cost),
 UNIQUE(receipt_id,variant_id), FOREIGN KEY(receipt_id,supplier_id) REFERENCES goods_receipts(id,supplier_id) ON DELETE CASCADE,
 FOREIGN KEY(supplier_id,variant_id) REFERENCES supplier_variants(supplier_id,variant_id) ON DELETE RESTRICT,
 FOREIGN KEY(product_id,variant_id) REFERENCES product_variants(product_id,id) ON DELETE RESTRICT
);
CREATE TABLE inventory_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), adjustment_code text NOT NULL UNIQUE DEFAULT halora_code('DC'),
 employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT, employee_name text NOT NULL, reason text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED','CANCELLED')), posted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE inventory_adjustment_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), adjustment_id uuid NOT NULL REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
 variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT, product_name text NOT NULL, variant_name text NOT NULL, sku text NOT NULL,
 quantity_delta integer NOT NULL CHECK(quantity_delta<>0 AND quantity_delta BETWEEN -1000000 AND 1000000), UNIQUE(adjustment_id,variant_id)
);
CREATE TABLE stock_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT, sku text NOT NULL,
 type text NOT NULL CHECK(type IN ('RECEIPT','SALE','CANCELLATION','ADJUSTMENT')),
 quantity_delta integer NOT NULL CHECK(quantity_delta<>0), quantity_after integer NOT NULL CHECK(quantity_after>=0),
 source_type text NOT NULL, source_id uuid NOT NULL, account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 performed_by_name text NOT NULL, note text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(variant_id,source_type,source_id)
);
CREATE INDEX stock_movements_variant_time_idx ON stock_movements(variant_id,created_at);
CREATE TABLE audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
 employee_id uuid REFERENCES employees(id) ON DELETE RESTRICT, performed_by_name text, action text NOT NULL,
 entity_type text NOT NULL, entity_id uuid, request_id text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_time_idx ON audit_logs(created_at,employee_id);
CREATE TABLE idempotency_keys (
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, key uuid NOT NULL,
 fingerprint text NOT NULL, response_body jsonb NOT NULL, status_code integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(account_id,key)
);

-- DTO views exclude password hashes and internal authentication fields.
CREATE VIEW api_customers AS SELECT c.id,c.code,c.account_id,c.full_name,c.phone,a.email,c.status,a.status AS account_status,c.created_at,c.updated_at,c.version FROM customers c JOIN accounts a ON a.id=c.account_id;
CREATE VIEW api_employees AS SELECT e.id,e.code,e.account_id,e.full_name,e.phone,e.email,e.position,e.status,e.created_at,e.updated_at,e.version,
 COALESCE((SELECT array_agg(er.role_id ORDER BY er.role_id) FROM employee_roles er WHERE er.employee_id=e.id),'{}'::uuid[]) AS role_ids FROM employees e;
CREATE VIEW api_accounts AS SELECT a.id,a.realm,a.username,a.email,a.status,a.created_at,a.updated_at,a.version,c.id AS customer_id,e.id AS employee_id FROM accounts a LEFT JOIN customers c ON c.account_id=a.id LEFT JOIN employees e ON e.account_id=a.id;
CREATE VIEW api_roles AS SELECT r.*,COALESCE((SELECT array_agg(rp.permission_id ORDER BY rp.permission_id) FROM role_permissions rp WHERE rp.role_id=r.id),'{}'::uuid[]) AS permission_ids FROM roles r;
CREATE VIEW api_variants AS SELECT v.*,COALESCE(b.stock_quantity,0)::integer AS stock_quantity FROM product_variants v LEFT JOIN inventory_balances b ON b.variant_id=v.id;
CREATE VIEW api_images AS SELECT i.*,m.url FROM product_images i JOIN media_assets m ON m.id=i.media_id;
CREATE VIEW api_supplier_variants AS SELECT s.*,p.name AS product_name,v.name AS variant_name,v.sku FROM supplier_variants s JOIN product_variants v ON v.id=s.variant_id JOIN products p ON p.id=v.product_id;
CREATE VIEW api_promotions AS SELECT p.*,EXISTS(SELECT 1 FROM order_discounts d WHERE d.promotion_id=p.id) AS has_usage FROM promotions p;
CREATE VIEW api_vouchers AS SELECT v.*,
 (SELECT count(*)::integer FROM voucher_redemptions r WHERE r.voucher_id=v.id AND r.status='USED') AS used_count,
 (SELECT count(*)::integer FROM voucher_redemptions r WHERE r.voucher_id=v.id AND r.status='HELD') AS reserved_count FROM vouchers v;
CREATE VIEW api_orders AS SELECT o.*,
 COALESCE((SELECT sum(amount) FROM payments p WHERE p.order_id=o.id AND p.status='SUCCEEDED'),0)::numeric(18,0) AS paid_amount,
 COALESCE((SELECT sum(amount) FROM refunds r WHERE r.order_id=o.id AND r.status='SUCCEEDED'),0)::numeric(18,0) AS refunded_amount FROM orders o;
CREATE VIEW api_discounts AS SELECT scope,promotion_id,COALESCE(product_rule_id,order_rule_id,voucher_id) AS rule_id,variant_id,promotion_name,voucher_code,amount,order_id FROM order_discounts;
CREATE VIEW api_balances AS SELECT v.id AS variant_id,v.product_id,p.name AS product_name,v.name AS variant_name,v.sku,
 COALESCE(b.stock_quantity,0)::integer AS stock_quantity,v.low_stock_threshold,COALESCE(b.updated_at,v.updated_at) AS updated_at FROM product_variants v JOIN products p ON p.id=v.product_id LEFT JOIN inventory_balances b ON b.variant_id=v.id;
CREATE VIEW api_public_products AS SELECT p.id,p.code,p.name,p.slug,p.category_id,c.name AS category_name,p.brand_id,b.name AS brand_name,p.is_featured,p.created_at,
 (SELECT i.url FROM api_images i WHERE i.product_id=p.id ORDER BY i.sort_order,i.id LIMIT 1) AS thumbnail_url,
 (SELECT min(v.sale_price)::numeric(18,0) FROM product_variants v WHERE v.product_id=p.id AND v.status='ACTIVE') AS price_from
 FROM products p JOIN categories c ON c.id=p.category_id JOIN brands b ON b.id=p.brand_id
 WHERE p.status='ACTIVE' AND c.status='ACTIVE' AND b.status='ACTIVE';

DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='version' AND table_name IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP
 EXECUTE format('CREATE TRIGGER touch_version BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION halora_touch()', t.table_name);
 END LOOP;
END $$;
COMMENT ON TABLE stock_movements IS 'Bút toán kho ghi tại lúc xác nhận, không ghi lùi theo ngày chứng từ';
COMMENT ON TABLE invoices IS 'Tổng giá gốc dòng hàng; ưu đãi và phí giao hàng theo dõi tại đơn';
COMMENT ON TABLE idempotency_keys IS 'Kết quả thao tác đã commit, khóa duy nhất theo tài khoản và Idempotency-Key';

-- Down Migration
-- Intentionally irreversible: create a forward migration or restore an approved backup.
DO $$ BEGIN RAISE EXCEPTION 'Halora initial migration cannot be reverted automatically'; END $$;
