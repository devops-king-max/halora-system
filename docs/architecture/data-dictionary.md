# Từ điển dữ liệu Halora

Xuất từ `database/schema.sql` trên PostgreSQL 18. Cột tiền dùng domain `money_vnd = numeric(18,0) >= 0`; tỷ lệ dùng `discount_percent = numeric(5,2)` trong 0–100. Các tên dưới đây là tên SQL; API dùng camelCase. Không có dữ liệu kinh doanh trong bản xuất.

Tái tạo tài liệu: `pnpm --filter @halora/api exec tsx scripts/document-schema.ts` với `TEST_DATABASE_URL` cho phép tạo database thử riêng.

## Bảng nghiệp vụ và hỗ trợ

### accounts

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `realm` | `text` | Có | — |
| `username` | `text` | Có | — |
| `email` | `text` | Có | — |
| `password_hash` | `text` | Có | — |
| `status` | `text` | Có | 'ACTIVE'::text |
| `auth_version` | `integer` | Có | 1 |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |
| `code` | `text` | Có | halora_code('TK'::text) |

Ràng buộc:

- `accounts_business_code_format`: `CHECK ((code ~ '^TK[0-9]{2,}$'::text))`
- `accounts_realm_check`: `CHECK ((realm = ANY (ARRAY['STAFF'::text, 'CUSTOMER'::text])))`
- `accounts_status_check`: `CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'LOCKED'::text, 'INACTIVE'::text])))`
- `accounts_username_check`: `CHECK ((length(TRIM(BOTH FROM username)) > 0))`
- `accounts_auth_version_not_null`: `NOT NULL auth_version`
- `accounts_code_not_null`: `NOT NULL code`
- `accounts_created_at_not_null`: `NOT NULL created_at`
- `accounts_email_not_null`: `NOT NULL email`
- `accounts_id_not_null`: `NOT NULL id`
- `accounts_password_hash_not_null`: `NOT NULL password_hash`
- `accounts_realm_not_null`: `NOT NULL realm`
- `accounts_status_not_null`: `NOT NULL status`
- `accounts_updated_at_not_null`: `NOT NULL updated_at`
- `accounts_username_not_null`: `NOT NULL username`
- `accounts_version_not_null`: `NOT NULL version`
- `accounts_pkey`: `PRIMARY KEY (id)`
- `accounts_code_key`: `UNIQUE (code)`
- `accounts_id_realm_key`: `UNIQUE (id, realm)`

Chỉ mục:

- `CREATE UNIQUE INDEX accounts_code_key ON public.accounts USING btree (code)`
- `CREATE UNIQUE INDEX accounts_email_realm_uq ON public.accounts USING btree (realm, lower(email))`
- `CREATE UNIQUE INDEX accounts_id_realm_key ON public.accounts USING btree (id, realm)`
- `CREATE UNIQUE INDEX accounts_pkey ON public.accounts USING btree (id)`
- `CREATE UNIQUE INDEX accounts_username_realm_uq ON public.accounts USING btree (realm, lower(username))`

### audit_logs

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `account_id` | `uuid` | Không | — |
| `employee_id` | `uuid` | Không | — |
| `performed_by_name` | `text` | Không | — |
| `action` | `text` | Có | — |
| `entity_type` | `text` | Có | — |
| `entity_id` | `uuid` | Không | — |
| `request_id` | `text` | Không | — |
| `created_at` | `timestamp with time zone` | Có | now() |

Ràng buộc:

- `audit_logs_account_id_fkey`: `FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT`
- `audit_logs_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT`
- `audit_logs_action_not_null`: `NOT NULL action`
- `audit_logs_created_at_not_null`: `NOT NULL created_at`
- `audit_logs_entity_type_not_null`: `NOT NULL entity_type`
- `audit_logs_id_not_null`: `NOT NULL id`
- `audit_logs_pkey`: `PRIMARY KEY (id)`

Chỉ mục:

- `CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id)`
- `CREATE INDEX audit_logs_time_idx ON public.audit_logs USING btree (created_at, employee_id)`

### auth_sessions

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `account_id` | `uuid` | Có | — |
| `refresh_token_hash` | `text` | Có | — |
| `previous_token_hash` | `text` | Không | — |
| `expires_at` | `timestamp with time zone` | Có | — |
| `revoked_at` | `timestamp with time zone` | Không | — |
| `created_at` | `timestamp with time zone` | Có | now() |

Ràng buộc:

- `auth_sessions_account_id_fkey`: `FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE`
- `auth_sessions_account_id_not_null`: `NOT NULL account_id`
- `auth_sessions_created_at_not_null`: `NOT NULL created_at`
- `auth_sessions_expires_at_not_null`: `NOT NULL expires_at`
- `auth_sessions_id_not_null`: `NOT NULL id`
- `auth_sessions_refresh_token_hash_not_null`: `NOT NULL refresh_token_hash`
- `auth_sessions_pkey`: `PRIMARY KEY (id)`
- `auth_sessions_refresh_token_hash_key`: `UNIQUE (refresh_token_hash)`

Chỉ mục:

- `CREATE INDEX auth_sessions_account_idx ON public.auth_sessions USING btree (account_id)`
- `CREATE UNIQUE INDEX auth_sessions_pkey ON public.auth_sessions USING btree (id)`
- `CREATE INDEX auth_sessions_previous_idx ON public.auth_sessions USING btree (previous_token_hash) WHERE (previous_token_hash IS NOT NULL)`
- `CREATE UNIQUE INDEX auth_sessions_refresh_token_hash_key ON public.auth_sessions USING btree (refresh_token_hash)`

### brands

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `code` | `text` | Có | halora_code('TH'::text) |
| `name` | `text` | Có | — |
| `description` | `text` | Không | — |
| `status` | `text` | Có | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |
| `thumbnail_media_id` | `uuid` | Không | — |

Ràng buộc:

- `brands_business_code_format`: `CHECK ((code ~ '^TH[0-9]{2,}$'::text))`
- `brands_status_check`: `CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))`
- `brands_thumbnail_media_id_fkey`: `FOREIGN KEY (thumbnail_media_id) REFERENCES media_assets(id) ON DELETE RESTRICT`
- `brands_code_not_null`: `NOT NULL code`
- `brands_created_at_not_null`: `NOT NULL created_at`
- `brands_id_not_null`: `NOT NULL id`
- `brands_name_not_null`: `NOT NULL name`
- `brands_status_not_null`: `NOT NULL status`
- `brands_updated_at_not_null`: `NOT NULL updated_at`
- `brands_version_not_null`: `NOT NULL version`
- `brands_pkey`: `PRIMARY KEY (id)`
- `brands_code_key`: `UNIQUE (code)`

Chỉ mục:

- `CREATE UNIQUE INDEX brands_code_key ON public.brands USING btree (code)`
- `CREATE UNIQUE INDEX brands_name_uq ON public.brands USING btree (lower(TRIM(BOTH FROM name)))`
- `CREATE UNIQUE INDEX brands_pkey ON public.brands USING btree (id)`
- `CREATE INDEX brands_thumbnail_media_idx ON public.brands USING btree (thumbnail_media_id) WHERE (thumbnail_media_id IS NOT NULL)`

### business_code_counters

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `prefix` | `text` | Có | — |
| `last_value` | `bigint` | Có | — |

Ràng buộc:

- `business_code_counters_last_value_check`: `CHECK ((last_value >= 0))`
- `business_code_counters_prefix_check`: `CHECK ((prefix ~ '^[A-Z]{2,6}$'::text))`
- `business_code_counters_last_value_not_null`: `NOT NULL last_value`
- `business_code_counters_prefix_not_null`: `NOT NULL prefix`
- `business_code_counters_pkey`: `PRIMARY KEY (prefix)`

Chỉ mục:

- `CREATE UNIQUE INDEX business_code_counters_pkey ON public.business_code_counters USING btree (prefix)`

### cart_items

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `cart_id` | `uuid` | Có | — |
| `product_id` | `uuid` | Có | — |
| `variant_id` | `uuid` | Có | — |
| `quantity` | `integer` | Có | — |

Ràng buộc:

- `cart_items_quantity_check`: `CHECK (((quantity > 0) AND (quantity <= 1000000)))`
- `cart_items_cart_id_fkey`: `FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE`
- `cart_items_product_id_variant_id_fkey`: `FOREIGN KEY (product_id, variant_id) REFERENCES product_variants(product_id, id) ON DELETE RESTRICT`
- `cart_items_cart_id_not_null`: `NOT NULL cart_id`
- `cart_items_id_not_null`: `NOT NULL id`
- `cart_items_product_id_not_null`: `NOT NULL product_id`
- `cart_items_quantity_not_null`: `NOT NULL quantity`
- `cart_items_variant_id_not_null`: `NOT NULL variant_id`
- `cart_items_pkey`: `PRIMARY KEY (id)`
- `cart_items_cart_id_variant_id_key`: `UNIQUE (cart_id, variant_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX cart_items_cart_id_variant_id_key ON public.cart_items USING btree (cart_id, variant_id)`
- `CREATE UNIQUE INDEX cart_items_pkey ON public.cart_items USING btree (id)`

### carts

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `customer_id` | `uuid` | Có | — |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `carts_customer_id_fkey`: `FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE`
- `carts_created_at_not_null`: `NOT NULL created_at`
- `carts_customer_id_not_null`: `NOT NULL customer_id`
- `carts_id_not_null`: `NOT NULL id`
- `carts_updated_at_not_null`: `NOT NULL updated_at`
- `carts_version_not_null`: `NOT NULL version`
- `carts_pkey`: `PRIMARY KEY (id)`
- `carts_customer_id_key`: `UNIQUE (customer_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX carts_customer_id_key ON public.carts USING btree (customer_id)`
- `CREATE UNIQUE INDEX carts_pkey ON public.carts USING btree (id)`

### categories

Loại sản phẩm

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `code` | `text` | Có | halora_code('LSP'::text) |
| `name` | `text` | Có | — |
| `description` | `text` | Không | — |
| `status` | `text` | Có | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `categories_business_code_format`: `CHECK ((code ~ '^LSP[0-9]{2,}$'::text))`
- `categories_status_check`: `CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))`
- `categories_code_not_null`: `NOT NULL code`
- `categories_created_at_not_null`: `NOT NULL created_at`
- `categories_id_not_null`: `NOT NULL id`
- `categories_name_not_null`: `NOT NULL name`
- `categories_status_not_null`: `NOT NULL status`
- `categories_updated_at_not_null`: `NOT NULL updated_at`
- `categories_version_not_null`: `NOT NULL version`
- `categories_pkey`: `PRIMARY KEY (id)`
- `categories_code_key`: `UNIQUE (code)`

Chỉ mục:

- `CREATE UNIQUE INDEX categories_code_key ON public.categories USING btree (code)`
- `CREATE UNIQUE INDEX categories_name_uq ON public.categories USING btree (lower(TRIM(BOTH FROM name)))`
- `CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id)`

### customer_addresses

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `customer_id` | `uuid` | Có | — |
| `recipient_name` | `text` | Có | — |
| `recipient_phone` | `text` | Có | — |
| `address_line` | `text` | Có | — |
| `province_name` | `text` | Có | — |
| `ward_name` | `text` | Có | — |
| `is_default` | `boolean` | Có | false |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `customer_addresses_customer_id_fkey`: `FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE`
- `customer_addresses_address_line_not_null`: `NOT NULL address_line`
- `customer_addresses_created_at_not_null`: `NOT NULL created_at`
- `customer_addresses_customer_id_not_null`: `NOT NULL customer_id`
- `customer_addresses_id_not_null`: `NOT NULL id`
- `customer_addresses_is_default_not_null`: `NOT NULL is_default`
- `customer_addresses_province_name_not_null`: `NOT NULL province_name`
- `customer_addresses_recipient_name_not_null`: `NOT NULL recipient_name`
- `customer_addresses_recipient_phone_not_null`: `NOT NULL recipient_phone`
- `customer_addresses_updated_at_not_null`: `NOT NULL updated_at`
- `customer_addresses_version_not_null`: `NOT NULL version`
- `customer_addresses_ward_name_not_null`: `NOT NULL ward_name`
- `customer_addresses_pkey`: `PRIMARY KEY (id)`

Chỉ mục:

- `CREATE INDEX customer_addresses_customer_idx ON public.customer_addresses USING btree (customer_id)`
- `CREATE UNIQUE INDEX customer_addresses_default_uq ON public.customer_addresses USING btree (customer_id) WHERE is_default`
- `CREATE UNIQUE INDEX customer_addresses_pkey ON public.customer_addresses USING btree (id)`

### customers

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `code` | `text` | Có | halora_code('KH'::text) |
| `account_id` | `uuid` | Có | — |
| `account_realm` | `text` | Có | 'CUSTOMER'::text |
| `full_name` | `text` | Có | — |
| `phone` | `text` | Có | — |
| `status` | `text` | Có | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `customers_account_realm_check`: `CHECK ((account_realm = 'CUSTOMER'::text))`
- `customers_business_code_format`: `CHECK ((code ~ '^KH[0-9]{2,}$'::text))`
- `customers_status_check`: `CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))`
- `customers_account_id_account_realm_fkey`: `FOREIGN KEY (account_id, account_realm) REFERENCES accounts(id, realm) ON DELETE RESTRICT`
- `customers_account_id_not_null`: `NOT NULL account_id`
- `customers_account_realm_not_null`: `NOT NULL account_realm`
- `customers_code_not_null`: `NOT NULL code`
- `customers_created_at_not_null`: `NOT NULL created_at`
- `customers_full_name_not_null`: `NOT NULL full_name`
- `customers_id_not_null`: `NOT NULL id`
- `customers_phone_not_null`: `NOT NULL phone`
- `customers_status_not_null`: `NOT NULL status`
- `customers_updated_at_not_null`: `NOT NULL updated_at`
- `customers_version_not_null`: `NOT NULL version`
- `customers_pkey`: `PRIMARY KEY (id)`
- `customers_account_id_key`: `UNIQUE (account_id)`
- `customers_code_key`: `UNIQUE (code)`

Chỉ mục:

- `CREATE UNIQUE INDEX customers_account_id_key ON public.customers USING btree (account_id)`
- `CREATE UNIQUE INDEX customers_code_key ON public.customers USING btree (code)`
- `CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id)`

### employee_roles

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `employee_id` | `uuid` | Có | — |
| `role_id` | `uuid` | Có | — |

Ràng buộc:

- `employee_roles_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE`
- `employee_roles_role_id_fkey`: `FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT`
- `employee_roles_employee_id_not_null`: `NOT NULL employee_id`
- `employee_roles_role_id_not_null`: `NOT NULL role_id`
- `employee_roles_pkey`: `PRIMARY KEY (employee_id, role_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX employee_roles_pkey ON public.employee_roles USING btree (employee_id, role_id)`

### employees

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `code` | `text` | Có | halora_code('NV'::text) |
| `account_id` | `uuid` | Không | — |
| `account_realm` | `text` | Có | 'STAFF'::text |
| `full_name` | `text` | Có | — |
| `phone` | `text` | Có | — |
| `email` | `text` | Có | — |
| `position` | `text` | Có | — |
| `status` | `text` | Có | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `employees_account_realm_check`: `CHECK ((account_realm = 'STAFF'::text))`
- `employees_business_code_format`: `CHECK ((code ~ '^NV[0-9]{2,}$'::text))`
- `employees_status_check`: `CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))`
- `employees_account_id_account_realm_fkey`: `FOREIGN KEY (account_id, account_realm) REFERENCES accounts(id, realm) ON DELETE RESTRICT`
- `employees_account_realm_not_null`: `NOT NULL account_realm`
- `employees_code_not_null`: `NOT NULL code`
- `employees_created_at_not_null`: `NOT NULL created_at`
- `employees_email_not_null`: `NOT NULL email`
- `employees_full_name_not_null`: `NOT NULL full_name`
- `employees_id_not_null`: `NOT NULL id`
- `employees_phone_not_null`: `NOT NULL phone`
- `employees_position_not_null`: `NOT NULL "position"`
- `employees_status_not_null`: `NOT NULL status`
- `employees_updated_at_not_null`: `NOT NULL updated_at`
- `employees_version_not_null`: `NOT NULL version`
- `employees_pkey`: `PRIMARY KEY (id)`
- `employees_account_id_key`: `UNIQUE (account_id)`
- `employees_code_key`: `UNIQUE (code)`

Chỉ mục:

- `CREATE UNIQUE INDEX employees_account_id_key ON public.employees USING btree (account_id)`
- `CREATE UNIQUE INDEX employees_code_key ON public.employees USING btree (code)`
- `CREATE UNIQUE INDEX employees_pkey ON public.employees USING btree (id)`

### goods_receipt_items

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `receipt_id` | `uuid` | Có | — |
| `supplier_id` | `uuid` | Có | — |
| `product_id` | `uuid` | Có | — |
| `variant_id` | `uuid` | Có | — |
| `product_name` | `text` | Có | — |
| `variant_name` | `text` | Có | — |
| `sku` | `text` | Có | — |
| `quantity` | `integer` | Có | — |
| `unit_cost` | `money_vnd` | Có | — |
| `line_total` | `money_vnd` | Có | — |

Ràng buộc:

- `goods_receipt_items_check`: `CHECK (((line_total)::numeric = ((quantity)::numeric * (unit_cost)::numeric)))`
- `goods_receipt_items_quantity_check`: `CHECK (((quantity > 0) AND (quantity <= 1000000)))`
- `goods_receipt_items_product_id_variant_id_fkey`: `FOREIGN KEY (product_id, variant_id) REFERENCES product_variants(product_id, id) ON DELETE RESTRICT`
- `goods_receipt_items_receipt_id_supplier_id_fkey`: `FOREIGN KEY (receipt_id, supplier_id) REFERENCES goods_receipts(id, supplier_id) ON DELETE CASCADE`
- `goods_receipt_items_supplier_id_variant_id_fkey`: `FOREIGN KEY (supplier_id, variant_id) REFERENCES supplier_variants(supplier_id, variant_id) ON DELETE RESTRICT`
- `goods_receipt_items_id_not_null`: `NOT NULL id`
- `goods_receipt_items_line_total_not_null`: `NOT NULL line_total`
- `goods_receipt_items_product_id_not_null`: `NOT NULL product_id`
- `goods_receipt_items_product_name_not_null`: `NOT NULL product_name`
- `goods_receipt_items_quantity_not_null`: `NOT NULL quantity`
- `goods_receipt_items_receipt_id_not_null`: `NOT NULL receipt_id`
- `goods_receipt_items_sku_not_null`: `NOT NULL sku`
- `goods_receipt_items_supplier_id_not_null`: `NOT NULL supplier_id`
- `goods_receipt_items_unit_cost_not_null`: `NOT NULL unit_cost`
- `goods_receipt_items_variant_id_not_null`: `NOT NULL variant_id`
- `goods_receipt_items_variant_name_not_null`: `NOT NULL variant_name`
- `goods_receipt_items_pkey`: `PRIMARY KEY (id)`
- `goods_receipt_items_receipt_id_variant_id_key`: `UNIQUE (receipt_id, variant_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX goods_receipt_items_pkey ON public.goods_receipt_items USING btree (id)`
- `CREATE UNIQUE INDEX goods_receipt_items_receipt_id_variant_id_key ON public.goods_receipt_items USING btree (receipt_id, variant_id)`

### goods_receipts

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `receipt_code` | `text` | Có | halora_code('PN'::text) |
| `supplier_id` | `uuid` | Có | — |
| `supplier_name` | `text` | Có | — |
| `employee_id` | `uuid` | Có | — |
| `employee_name` | `text` | Có | — |
| `received_at` | `timestamp with time zone` | Có | — |
| `posted_at` | `timestamp with time zone` | Không | — |
| `status` | `text` | Có | 'DRAFT'::text |
| `note` | `text` | Không | — |
| `total_amount` | `money_vnd` | Có | 0 |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `goods_receipts_business_code_format`: `CHECK ((receipt_code ~ '^PN[0-9]{2,}$'::text))`
- `goods_receipts_status_check`: `CHECK ((status = ANY (ARRAY['DRAFT'::text, 'POSTED'::text, 'CANCELLED'::text])))`
- `goods_receipts_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT`
- `goods_receipts_supplier_id_fkey`: `FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT`
- `goods_receipts_created_at_not_null`: `NOT NULL created_at`
- `goods_receipts_employee_id_not_null`: `NOT NULL employee_id`
- `goods_receipts_employee_name_not_null`: `NOT NULL employee_name`
- `goods_receipts_id_not_null`: `NOT NULL id`
- `goods_receipts_receipt_code_not_null`: `NOT NULL receipt_code`
- `goods_receipts_received_at_not_null`: `NOT NULL received_at`
- `goods_receipts_status_not_null`: `NOT NULL status`
- `goods_receipts_supplier_id_not_null`: `NOT NULL supplier_id`
- `goods_receipts_supplier_name_not_null`: `NOT NULL supplier_name`
- `goods_receipts_total_amount_not_null`: `NOT NULL total_amount`
- `goods_receipts_updated_at_not_null`: `NOT NULL updated_at`
- `goods_receipts_version_not_null`: `NOT NULL version`
- `goods_receipts_pkey`: `PRIMARY KEY (id)`
- `goods_receipts_id_supplier_id_key`: `UNIQUE (id, supplier_id)`
- `goods_receipts_receipt_code_key`: `UNIQUE (receipt_code)`

Chỉ mục:

- `CREATE UNIQUE INDEX goods_receipts_id_supplier_id_key ON public.goods_receipts USING btree (id, supplier_id)`
- `CREATE UNIQUE INDEX goods_receipts_pkey ON public.goods_receipts USING btree (id)`
- `CREATE UNIQUE INDEX goods_receipts_receipt_code_key ON public.goods_receipts USING btree (receipt_code)`

### idempotency_keys

Kết quả thao tác đã commit, khóa duy nhất theo tài khoản và Idempotency-Key

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `account_id` | `uuid` | Có | — |
| `key` | `uuid` | Có | — |
| `fingerprint` | `text` | Có | — |
| `response_body` | `jsonb` | Có | — |
| `status_code` | `integer` | Có | — |
| `created_at` | `timestamp with time zone` | Có | now() |

Ràng buộc:

- `idempotency_keys_account_id_fkey`: `FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT`
- `idempotency_keys_account_id_not_null`: `NOT NULL account_id`
- `idempotency_keys_created_at_not_null`: `NOT NULL created_at`
- `idempotency_keys_fingerprint_not_null`: `NOT NULL fingerprint`
- `idempotency_keys_key_not_null`: `NOT NULL key`
- `idempotency_keys_response_body_not_null`: `NOT NULL response_body`
- `idempotency_keys_status_code_not_null`: `NOT NULL status_code`
- `idempotency_keys_pkey`: `PRIMARY KEY (account_id, key)`

Chỉ mục:

- `CREATE UNIQUE INDEX idempotency_keys_pkey ON public.idempotency_keys USING btree (account_id, key)`

### inventory_adjustment_items

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `adjustment_id` | `uuid` | Có | — |
| `variant_id` | `uuid` | Có | — |
| `product_name` | `text` | Có | — |
| `variant_name` | `text` | Có | — |
| `sku` | `text` | Có | — |
| `quantity_delta` | `integer` | Có | — |

Ràng buộc:

- `inventory_adjustment_items_quantity_delta_check`: `CHECK (((quantity_delta <> 0) AND ((quantity_delta >= '-1000000'::integer) AND (quantity_delta <= 1000000))))`
- `inventory_adjustment_items_adjustment_id_fkey`: `FOREIGN KEY (adjustment_id) REFERENCES inventory_adjustments(id) ON DELETE CASCADE`
- `inventory_adjustment_items_variant_id_fkey`: `FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT`
- `inventory_adjustment_items_adjustment_id_not_null`: `NOT NULL adjustment_id`
- `inventory_adjustment_items_id_not_null`: `NOT NULL id`
- `inventory_adjustment_items_product_name_not_null`: `NOT NULL product_name`
- `inventory_adjustment_items_quantity_delta_not_null`: `NOT NULL quantity_delta`
- `inventory_adjustment_items_sku_not_null`: `NOT NULL sku`
- `inventory_adjustment_items_variant_id_not_null`: `NOT NULL variant_id`
- `inventory_adjustment_items_variant_name_not_null`: `NOT NULL variant_name`
- `inventory_adjustment_items_pkey`: `PRIMARY KEY (id)`
- `inventory_adjustment_items_adjustment_id_variant_id_key`: `UNIQUE (adjustment_id, variant_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX inventory_adjustment_items_adjustment_id_variant_id_key ON public.inventory_adjustment_items USING btree (adjustment_id, variant_id)`
- `CREATE UNIQUE INDEX inventory_adjustment_items_pkey ON public.inventory_adjustment_items USING btree (id)`

### inventory_adjustments

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `adjustment_code` | `text` | Có | halora_code('DC'::text) |
| `employee_id` | `uuid` | Có | — |
| `employee_name` | `text` | Có | — |
| `reason` | `text` | Có | — |
| `status` | `text` | Có | 'DRAFT'::text |
| `posted_at` | `timestamp with time zone` | Không | — |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `inventory_adjustments_business_code_format`: `CHECK ((adjustment_code ~ '^DC[0-9]{2,}$'::text))`
- `inventory_adjustments_status_check`: `CHECK ((status = ANY (ARRAY['DRAFT'::text, 'POSTED'::text, 'CANCELLED'::text])))`
- `inventory_adjustments_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT`
- `inventory_adjustments_adjustment_code_not_null`: `NOT NULL adjustment_code`
- `inventory_adjustments_created_at_not_null`: `NOT NULL created_at`
- `inventory_adjustments_employee_id_not_null`: `NOT NULL employee_id`
- `inventory_adjustments_employee_name_not_null`: `NOT NULL employee_name`
- `inventory_adjustments_id_not_null`: `NOT NULL id`
- `inventory_adjustments_reason_not_null`: `NOT NULL reason`
- `inventory_adjustments_status_not_null`: `NOT NULL status`
- `inventory_adjustments_updated_at_not_null`: `NOT NULL updated_at`
- `inventory_adjustments_version_not_null`: `NOT NULL version`
- `inventory_adjustments_pkey`: `PRIMARY KEY (id)`
- `inventory_adjustments_adjustment_code_key`: `UNIQUE (adjustment_code)`

Chỉ mục:

- `CREATE UNIQUE INDEX inventory_adjustments_adjustment_code_key ON public.inventory_adjustments USING btree (adjustment_code)`
- `CREATE UNIQUE INDEX inventory_adjustments_pkey ON public.inventory_adjustments USING btree (id)`

### inventory_balances

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `variant_id` | `uuid` | Có | — |
| `stock_quantity` | `integer` | Có | 0 |
| `updated_at` | `timestamp with time zone` | Có | now() |

Ràng buộc:

- `inventory_balances_stock_quantity_check`: `CHECK ((stock_quantity >= 0))`
- `inventory_balances_variant_id_fkey`: `FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT`
- `inventory_balances_stock_quantity_not_null`: `NOT NULL stock_quantity`
- `inventory_balances_updated_at_not_null`: `NOT NULL updated_at`
- `inventory_balances_variant_id_not_null`: `NOT NULL variant_id`
- `inventory_balances_pkey`: `PRIMARY KEY (variant_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX inventory_balances_pkey ON public.inventory_balances USING btree (variant_id)`

### invoice_items

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `invoice_id` | `uuid` | Có | — |
| `product_id` | `uuid` | Có | — |
| `variant_id` | `uuid` | Có | — |
| `product_name` | `text` | Có | — |
| `variant_name` | `text` | Có | — |
| `sku` | `text` | Có | — |
| `quantity` | `integer` | Có | — |
| `unit_price` | `money_vnd` | Có | — |
| `line_total` | `money_vnd` | Có | — |

Ràng buộc:

- `invoice_items_check`: `CHECK (((line_total)::numeric = ((quantity)::numeric * (unit_price)::numeric)))`
- `invoice_items_quantity_check`: `CHECK ((quantity > 0))`
- `invoice_items_invoice_id_fkey`: `FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE`
- `invoice_items_product_id_variant_id_fkey`: `FOREIGN KEY (product_id, variant_id) REFERENCES product_variants(product_id, id) ON DELETE RESTRICT`
- `invoice_items_id_not_null`: `NOT NULL id`
- `invoice_items_invoice_id_not_null`: `NOT NULL invoice_id`
- `invoice_items_line_total_not_null`: `NOT NULL line_total`
- `invoice_items_product_id_not_null`: `NOT NULL product_id`
- `invoice_items_product_name_not_null`: `NOT NULL product_name`
- `invoice_items_quantity_not_null`: `NOT NULL quantity`
- `invoice_items_sku_not_null`: `NOT NULL sku`
- `invoice_items_unit_price_not_null`: `NOT NULL unit_price`
- `invoice_items_variant_id_not_null`: `NOT NULL variant_id`
- `invoice_items_variant_name_not_null`: `NOT NULL variant_name`
- `invoice_items_pkey`: `PRIMARY KEY (id)`
- `invoice_items_invoice_id_variant_id_key`: `UNIQUE (invoice_id, variant_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX invoice_items_invoice_id_variant_id_key ON public.invoice_items USING btree (invoice_id, variant_id)`
- `CREATE UNIQUE INDEX invoice_items_pkey ON public.invoice_items USING btree (id)`

### invoices

Tổng giá gốc dòng hàng; ưu đãi và phí giao hàng theo dõi tại đơn

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `invoice_code` | `text` | Có | halora_code('HD'::text) |
| `order_id` | `uuid` | Có | — |
| `order_code` | `text` | Có | — |
| `employee_id` | `uuid` | Có | — |
| `employee_name` | `text` | Có | — |
| `status` | `text` | Có | 'DRAFT'::text |
| `issued_at` | `timestamp with time zone` | Không | — |
| `note` | `text` | Không | — |
| `total_amount` | `money_vnd` | Có | 0 |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `invoices_business_code_format`: `CHECK ((invoice_code ~ '^HD[0-9]{2,}$'::text))`
- `invoices_status_check`: `CHECK ((status = ANY (ARRAY['DRAFT'::text, 'POSTED'::text, 'CANCELLED'::text])))`
- `invoices_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT`
- `invoices_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT`
- `invoices_created_at_not_null`: `NOT NULL created_at`
- `invoices_employee_id_not_null`: `NOT NULL employee_id`
- `invoices_employee_name_not_null`: `NOT NULL employee_name`
- `invoices_id_not_null`: `NOT NULL id`
- `invoices_invoice_code_not_null`: `NOT NULL invoice_code`
- `invoices_order_code_not_null`: `NOT NULL order_code`
- `invoices_order_id_not_null`: `NOT NULL order_id`
- `invoices_status_not_null`: `NOT NULL status`
- `invoices_total_amount_not_null`: `NOT NULL total_amount`
- `invoices_updated_at_not_null`: `NOT NULL updated_at`
- `invoices_version_not_null`: `NOT NULL version`
- `invoices_pkey`: `PRIMARY KEY (id)`
- `invoices_invoice_code_key`: `UNIQUE (invoice_code)`
- `invoices_order_id_key`: `UNIQUE (order_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX invoices_invoice_code_key ON public.invoices USING btree (invoice_code)`
- `CREATE UNIQUE INDEX invoices_order_id_key ON public.invoices USING btree (order_id)`
- `CREATE UNIQUE INDEX invoices_pkey ON public.invoices USING btree (id)`

### media_assets

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `url` | `text` | Có | — |
| `storage_name` | `text` | Có | — |
| `mime_type` | `text` | Có | — |
| `size` | `integer` | Có | — |
| `original_name` | `text` | Có | — |
| `account_id` | `uuid` | Có | — |
| `created_at` | `timestamp with time zone` | Có | now() |

Ràng buộc:

- `media_assets_size_check`: `CHECK ((size > 0))`
- `media_assets_account_id_fkey`: `FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT`
- `media_assets_account_id_not_null`: `NOT NULL account_id`
- `media_assets_created_at_not_null`: `NOT NULL created_at`
- `media_assets_id_not_null`: `NOT NULL id`
- `media_assets_mime_type_not_null`: `NOT NULL mime_type`
- `media_assets_original_name_not_null`: `NOT NULL original_name`
- `media_assets_size_not_null`: `NOT NULL size`
- `media_assets_storage_name_not_null`: `NOT NULL storage_name`
- `media_assets_url_not_null`: `NOT NULL url`
- `media_assets_pkey`: `PRIMARY KEY (id)`
- `media_assets_storage_name_key`: `UNIQUE (storage_name)`

Chỉ mục:

- `CREATE UNIQUE INDEX media_assets_pkey ON public.media_assets USING btree (id)`
- `CREATE UNIQUE INDEX media_assets_storage_name_key ON public.media_assets USING btree (storage_name)`

### order_discounts

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `order_id` | `uuid` | Có | — |
| `scope` | `text` | Có | — |
| `promotion_id` | `uuid` | Có | — |
| `promotion_name` | `text` | Có | — |
| `variant_id` | `uuid` | Không | — |
| `product_rule_id` | `uuid` | Không | — |
| `order_rule_id` | `uuid` | Không | — |
| `voucher_id` | `uuid` | Không | — |
| `voucher_code` | `text` | Không | — |
| `amount` | `money_vnd` | Có | — |

Ràng buộc:

- `order_discounts_check`: `CHECK ((((scope = 'PRODUCT'::text) AND (product_rule_id IS NOT NULL) AND (variant_id IS NOT NULL) AND (order_rule_id IS NULL) AND (voucher_id IS NULL)) OR ((scope = 'ORDER'::text) AND (order_rule_id IS NOT NULL) AND (variant_id IS NULL) AND (product_rule_id IS NULL) AND (voucher_id IS NULL)) OR ((scope = 'VOUCHER'::text) AND (voucher_id IS NOT NULL) AND (variant_id IS NULL) AND (product_rule_id IS NULL) AND (order_rule_id IS NULL))))`
- `order_discounts_scope_check`: `CHECK ((scope = ANY (ARRAY['PRODUCT'::text, 'ORDER'::text, 'VOUCHER'::text])))`
- `order_discounts_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE`
- `order_discounts_order_id_variant_id_fkey`: `FOREIGN KEY (order_id, variant_id) REFERENCES order_items(order_id, variant_id) ON DELETE CASCADE`
- `order_discounts_order_rule_id_fkey`: `FOREIGN KEY (order_rule_id) REFERENCES order_promotion_rules(id) ON DELETE RESTRICT`
- `order_discounts_product_rule_id_fkey`: `FOREIGN KEY (product_rule_id) REFERENCES product_promotion_rules(id) ON DELETE RESTRICT`
- `order_discounts_promotion_id_fkey`: `FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE RESTRICT`
- `order_discounts_voucher_id_fkey`: `FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE RESTRICT`
- `order_discounts_amount_not_null`: `NOT NULL amount`
- `order_discounts_id_not_null`: `NOT NULL id`
- `order_discounts_order_id_not_null`: `NOT NULL order_id`
- `order_discounts_promotion_id_not_null`: `NOT NULL promotion_id`
- `order_discounts_promotion_name_not_null`: `NOT NULL promotion_name`
- `order_discounts_scope_not_null`: `NOT NULL scope`
- `order_discounts_pkey`: `PRIMARY KEY (id)`

Chỉ mục:

- `CREATE UNIQUE INDEX order_discounts_pkey ON public.order_discounts USING btree (id)`
- `CREATE INDEX order_discounts_promotion_idx ON public.order_discounts USING btree (promotion_id)`

### order_items

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `order_id` | `uuid` | Có | — |
| `product_id` | `uuid` | Có | — |
| `variant_id` | `uuid` | Có | — |
| `product_name` | `text` | Có | — |
| `variant_name` | `text` | Có | — |
| `sku` | `text` | Có | — |
| `thumbnail_url` | `text` | Không | — |
| `quantity` | `integer` | Có | — |
| `unit_price` | `money_vnd` | Có | — |
| `line_subtotal` | `money_vnd` | Có | — |
| `product_discount_amount` | `money_vnd` | Có | — |
| `line_total` | `money_vnd` | Có | — |
| `product_promotion_rule_id` | `uuid` | Không | — |

Ràng buộc:

- `order_items_check`: `CHECK (((line_subtotal)::numeric = ((quantity)::numeric * (unit_price)::numeric)))`
- `order_items_check1`: `CHECK (((line_total)::numeric = ((line_subtotal)::numeric - (product_discount_amount)::numeric)))`
- `order_items_quantity_check`: `CHECK (((quantity > 0) AND (quantity <= 1000000)))`
- `order_items_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE`
- `order_items_product_id_variant_id_fkey`: `FOREIGN KEY (product_id, variant_id) REFERENCES product_variants(product_id, id) ON DELETE RESTRICT`
- `order_items_product_promotion_rule_id_fkey`: `FOREIGN KEY (product_promotion_rule_id) REFERENCES product_promotion_rules(id) ON DELETE RESTRICT`
- `order_items_id_not_null`: `NOT NULL id`
- `order_items_line_subtotal_not_null`: `NOT NULL line_subtotal`
- `order_items_line_total_not_null`: `NOT NULL line_total`
- `order_items_order_id_not_null`: `NOT NULL order_id`
- `order_items_product_discount_amount_not_null`: `NOT NULL product_discount_amount`
- `order_items_product_id_not_null`: `NOT NULL product_id`
- `order_items_product_name_not_null`: `NOT NULL product_name`
- `order_items_quantity_not_null`: `NOT NULL quantity`
- `order_items_sku_not_null`: `NOT NULL sku`
- `order_items_unit_price_not_null`: `NOT NULL unit_price`
- `order_items_variant_id_not_null`: `NOT NULL variant_id`
- `order_items_variant_name_not_null`: `NOT NULL variant_name`
- `order_items_pkey`: `PRIMARY KEY (id)`
- `order_items_order_id_variant_id_key`: `UNIQUE (order_id, variant_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX order_items_order_id_variant_id_key ON public.order_items USING btree (order_id, variant_id)`
- `CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (id)`

### order_promotion_rules

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `promotion_id` | `uuid` | Có | — |
| `min_order_amount` | `money_vnd` | Có | — |
| `discount_percent` | `discount_percent` | Có | — |
| `max_discount_amount` | `money_vnd` | Không | — |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |
| `code` | `text` | Có | halora_code('KMHD'::text) |

Ràng buộc:

- `order_promotion_rules_code_check`: `CHECK ((code ~ '^KMHD[0-9]{2,}$'::text))`
- `order_promotion_rules_promotion_id_fkey`: `FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE RESTRICT`
- `order_promotion_rules_code_not_null`: `NOT NULL code`
- `order_promotion_rules_created_at_not_null`: `NOT NULL created_at`
- `order_promotion_rules_discount_percent_not_null`: `NOT NULL discount_percent`
- `order_promotion_rules_id_not_null`: `NOT NULL id`
- `order_promotion_rules_min_order_amount_not_null`: `NOT NULL min_order_amount`
- `order_promotion_rules_promotion_id_not_null`: `NOT NULL promotion_id`
- `order_promotion_rules_updated_at_not_null`: `NOT NULL updated_at`
- `order_promotion_rules_version_not_null`: `NOT NULL version`
- `order_promotion_rules_pkey`: `PRIMARY KEY (id)`
- `order_promotion_rules_code_key`: `UNIQUE (code)`

Chỉ mục:

- `CREATE UNIQUE INDEX order_promotion_rules_code_key ON public.order_promotion_rules USING btree (code)`
- `CREATE UNIQUE INDEX order_promotion_rules_pkey ON public.order_promotion_rules USING btree (id)`

### order_status_history

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `order_id` | `uuid` | Có | — |
| `from_status` | `text` | Không | — |
| `to_status` | `text` | Có | — |
| `note` | `text` | Không | — |
| `account_id` | `uuid` | Có | — |
| `performed_by_name` | `text` | Có | — |
| `created_at` | `timestamp with time zone` | Có | now() |

Ràng buộc:

- `order_status_history_account_id_fkey`: `FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT`
- `order_status_history_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE`
- `order_status_history_account_id_not_null`: `NOT NULL account_id`
- `order_status_history_created_at_not_null`: `NOT NULL created_at`
- `order_status_history_id_not_null`: `NOT NULL id`
- `order_status_history_order_id_not_null`: `NOT NULL order_id`
- `order_status_history_performed_by_name_not_null`: `NOT NULL performed_by_name`
- `order_status_history_to_status_not_null`: `NOT NULL to_status`
- `order_status_history_pkey`: `PRIMARY KEY (id)`

Chỉ mục:

- `CREATE UNIQUE INDEX order_status_history_pkey ON public.order_status_history USING btree (id)`

### orders

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `order_code` | `text` | Có | halora_code('DH'::text) |
| `customer_id` | `uuid` | Có | — |
| `customer_name` | `text` | Có | — |
| `status` | `text` | Có | 'PENDING_CONFIRMATION'::text |
| `payment_method` | `text` | Có | — |
| `recipient_name` | `text` | Có | — |
| `recipient_phone` | `text` | Có | — |
| `address_line` | `text` | Có | — |
| `province_name` | `text` | Có | — |
| `ward_name` | `text` | Có | — |
| `note` | `text` | Không | — |
| `subtotal_amount` | `money_vnd` | Có | — |
| `product_discount_amount` | `money_vnd` | Có | — |
| `order_discount_amount` | `money_vnd` | Có | — |
| `voucher_discount_amount` | `money_vnd` | Có | — |
| `shipping_fee` | `money_vnd` | Có | — |
| `total_amount` | `money_vnd` | Có | — |
| `confirmed_at` | `timestamp with time zone` | Không | — |
| `shipped_at` | `timestamp with time zone` | Không | — |
| `completed_at` | `timestamp with time zone` | Không | — |
| `cancelled_at` | `timestamp with time zone` | Không | — |
| `cancellation_reason` | `text` | Không | — |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `orders_business_code_format`: `CHECK ((order_code ~ '^DH[0-9]{2,}$'::text))`
- `orders_check`: `CHECK (((((product_discount_amount)::numeric + (order_discount_amount)::numeric) + (voucher_discount_amount)::numeric) <= (subtotal_amount)::numeric))`
- `orders_check1`: `CHECK (((total_amount)::numeric = (((((subtotal_amount)::numeric - (product_discount_amount)::numeric) - (order_discount_amount)::numeric) - (voucher_discount_amount)::numeric) + (shipping_fee)::numeric)))`
- `orders_payment_method_check`: `CHECK ((payment_method = ANY (ARRAY['COD'::text, 'BANK_TRANSFER'::text])))`
- `orders_status_check`: `CHECK ((status = ANY (ARRAY['PENDING_CONFIRMATION'::text, 'CONFIRMED'::text, 'SHIPPING'::text, 'COMPLETED'::text, 'CANCELLED'::text])))`
- `orders_customer_id_fkey`: `FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT`
- `orders_address_line_not_null`: `NOT NULL address_line`
- `orders_created_at_not_null`: `NOT NULL created_at`
- `orders_customer_id_not_null`: `NOT NULL customer_id`
- `orders_customer_name_not_null`: `NOT NULL customer_name`
- `orders_id_not_null`: `NOT NULL id`
- `orders_order_code_not_null`: `NOT NULL order_code`
- `orders_order_discount_amount_not_null`: `NOT NULL order_discount_amount`
- `orders_payment_method_not_null`: `NOT NULL payment_method`
- `orders_product_discount_amount_not_null`: `NOT NULL product_discount_amount`
- `orders_province_name_not_null`: `NOT NULL province_name`
- `orders_recipient_name_not_null`: `NOT NULL recipient_name`
- `orders_recipient_phone_not_null`: `NOT NULL recipient_phone`
- `orders_shipping_fee_not_null`: `NOT NULL shipping_fee`
- `orders_status_not_null`: `NOT NULL status`
- `orders_subtotal_amount_not_null`: `NOT NULL subtotal_amount`
- `orders_total_amount_not_null`: `NOT NULL total_amount`
- `orders_updated_at_not_null`: `NOT NULL updated_at`
- `orders_version_not_null`: `NOT NULL version`
- `orders_voucher_discount_amount_not_null`: `NOT NULL voucher_discount_amount`
- `orders_ward_name_not_null`: `NOT NULL ward_name`
- `orders_pkey`: `PRIMARY KEY (id)`
- `orders_order_code_key`: `UNIQUE (order_code)`

Chỉ mục:

- `CREATE INDEX orders_customer_idx ON public.orders USING btree (customer_id, created_at DESC)`
- `CREATE UNIQUE INDEX orders_order_code_key ON public.orders USING btree (order_code)`
- `CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)`
- `CREATE INDEX orders_status_time_idx ON public.orders USING btree (status, created_at DESC)`

### password_reset_tokens

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `account_id` | `uuid` | Có | — |
| `token_hash` | `text` | Có | — |
| `expires_at` | `timestamp with time zone` | Có | — |
| `used_at` | `timestamp with time zone` | Không | — |
| `created_at` | `timestamp with time zone` | Có | now() |

Ràng buộc:

- `password_reset_tokens_account_id_fkey`: `FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE`
- `password_reset_tokens_account_id_not_null`: `NOT NULL account_id`
- `password_reset_tokens_created_at_not_null`: `NOT NULL created_at`
- `password_reset_tokens_expires_at_not_null`: `NOT NULL expires_at`
- `password_reset_tokens_id_not_null`: `NOT NULL id`
- `password_reset_tokens_token_hash_not_null`: `NOT NULL token_hash`
- `password_reset_tokens_pkey`: `PRIMARY KEY (id)`
- `password_reset_tokens_token_hash_key`: `UNIQUE (token_hash)`

Chỉ mục:

- `CREATE UNIQUE INDEX password_reset_tokens_pkey ON public.password_reset_tokens USING btree (id)`
- `CREATE UNIQUE INDEX password_reset_tokens_token_hash_key ON public.password_reset_tokens USING btree (token_hash)`

### payments

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `order_id` | `uuid` | Có | — |
| `method` | `text` | Có | — |
| `amount` | `money_vnd` | Có | — |
| `status` | `text` | Có | 'PENDING'::text |
| `reference` | `text` | Không | — |
| `note` | `text` | Không | — |
| `paid_at` | `timestamp with time zone` | Không | — |
| `created_by` | `uuid` | Có | — |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |

Ràng buộc:

- `payments_amount_check`: `CHECK (((amount)::numeric > (0)::numeric))`
- `payments_method_check`: `CHECK ((method = ANY (ARRAY['COD'::text, 'BANK_TRANSFER'::text])))`
- `payments_status_check`: `CHECK ((status = ANY (ARRAY['PENDING'::text, 'SUCCEEDED'::text, 'FAILED'::text, 'CANCELLED'::text])))`
- `payments_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES accounts(id) ON DELETE RESTRICT`
- `payments_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT`
- `payments_amount_not_null`: `NOT NULL amount`
- `payments_created_at_not_null`: `NOT NULL created_at`
- `payments_created_by_not_null`: `NOT NULL created_by`
- `payments_id_not_null`: `NOT NULL id`
- `payments_method_not_null`: `NOT NULL method`
- `payments_order_id_not_null`: `NOT NULL order_id`
- `payments_status_not_null`: `NOT NULL status`
- `payments_updated_at_not_null`: `NOT NULL updated_at`
- `payments_pkey`: `PRIMARY KEY (id)`

Chỉ mục:

- `CREATE INDEX payments_order_idx ON public.payments USING btree (order_id)`
- `CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id)`
- `CREATE UNIQUE INDEX payments_reference_uq ON public.payments USING btree (method, reference) WHERE ((status = 'SUCCEEDED'::text) AND (reference IS NOT NULL))`

### permissions

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `code` | `text` | Có | — |
| `name` | `text` | Có | — |
| `description` | `text` | Có | — |

Ràng buộc:

- `permissions_code_not_null`: `NOT NULL code`
- `permissions_description_not_null`: `NOT NULL description`
- `permissions_id_not_null`: `NOT NULL id`
- `permissions_name_not_null`: `NOT NULL name`
- `permissions_pkey`: `PRIMARY KEY (id)`
- `permissions_code_key`: `UNIQUE (code)`

Chỉ mục:

- `CREATE UNIQUE INDEX permissions_code_key ON public.permissions USING btree (code)`
- `CREATE UNIQUE INDEX permissions_pkey ON public.permissions USING btree (id)`

### product_images

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `product_id` | `uuid` | Có | — |
| `variant_id` | `uuid` | Không | — |
| `media_id` | `uuid` | Có | — |
| `alt_text` | `text` | Không | — |
| `sort_order` | `integer` | Có | 0 |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `product_images_sort_order_check`: `CHECK ((sort_order >= 0))`
- `product_images_media_id_fkey`: `FOREIGN KEY (media_id) REFERENCES media_assets(id) ON DELETE RESTRICT`
- `product_images_product_id_fkey`: `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT`
- `product_images_product_id_variant_id_fkey`: `FOREIGN KEY (product_id, variant_id) REFERENCES product_variants(product_id, id) ON DELETE RESTRICT`
- `product_images_created_at_not_null`: `NOT NULL created_at`
- `product_images_id_not_null`: `NOT NULL id`
- `product_images_media_id_not_null`: `NOT NULL media_id`
- `product_images_product_id_not_null`: `NOT NULL product_id`
- `product_images_sort_order_not_null`: `NOT NULL sort_order`
- `product_images_updated_at_not_null`: `NOT NULL updated_at`
- `product_images_version_not_null`: `NOT NULL version`
- `product_images_pkey`: `PRIMARY KEY (id)`

Chỉ mục:

- `CREATE UNIQUE INDEX product_images_pkey ON public.product_images USING btree (id)`
- `CREATE INDEX product_images_product_idx ON public.product_images USING btree (product_id, sort_order)`

### product_promotion_rules

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `promotion_id` | `uuid` | Có | — |
| `product_id` | `uuid` | Có | — |
| `variant_id` | `uuid` | Không | — |
| `discount_percent` | `discount_percent` | Có | — |
| `min_quantity` | `integer` | Có | — |
| `max_discount_amount` | `money_vnd` | Không | — |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |
| `code` | `text` | Có | halora_code('KMSP'::text) |

Ràng buộc:

- `product_promotion_rules_code_check`: `CHECK ((code ~ '^KMSP[0-9]{2,}$'::text))`
- `product_promotion_rules_min_quantity_check`: `CHECK ((min_quantity >= 0))`
- `product_promotion_rules_product_id_fkey`: `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT`
- `product_promotion_rules_product_id_variant_id_fkey`: `FOREIGN KEY (product_id, variant_id) REFERENCES product_variants(product_id, id) ON DELETE RESTRICT`
- `product_promotion_rules_promotion_id_fkey`: `FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE RESTRICT`
- `product_promotion_rules_code_not_null`: `NOT NULL code`
- `product_promotion_rules_created_at_not_null`: `NOT NULL created_at`
- `product_promotion_rules_discount_percent_not_null`: `NOT NULL discount_percent`
- `product_promotion_rules_id_not_null`: `NOT NULL id`
- `product_promotion_rules_min_quantity_not_null`: `NOT NULL min_quantity`
- `product_promotion_rules_product_id_not_null`: `NOT NULL product_id`
- `product_promotion_rules_promotion_id_not_null`: `NOT NULL promotion_id`
- `product_promotion_rules_updated_at_not_null`: `NOT NULL updated_at`
- `product_promotion_rules_version_not_null`: `NOT NULL version`
- `product_promotion_rules_pkey`: `PRIMARY KEY (id)`
- `product_promotion_rules_code_key`: `UNIQUE (code)`

Chỉ mục:

- `CREATE UNIQUE INDEX product_promotion_rules_code_key ON public.product_promotion_rules USING btree (code)`
- `CREATE UNIQUE INDEX product_promotion_rules_pkey ON public.product_promotion_rules USING btree (id)`

### product_variants

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `product_id` | `uuid` | Có | — |
| `sku` | `text` | Có | halora_code('SKU'::text) |
| `name` | `text` | Có | — |
| `color` | `text` | Không | — |
| `volume_ml` | `double precision` | Không | — |
| `weight_grams` | `double precision` | Không | — |
| `sale_price` | `money_vnd` | Có | — |
| `reference_cost_price` | `money_vnd` | Không | — |
| `low_stock_threshold` | `integer` | Có | 5 |
| `status` | `text` | Có | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `product_variants_business_code_format`: `CHECK ((sku ~ '^SKU[0-9]{2,}$'::text))`
- `product_variants_low_stock_threshold_check`: `CHECK ((low_stock_threshold >= 0))`
- `product_variants_status_check`: `CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))`
- `product_variants_volume_ml_check`: `CHECK ((volume_ml > (0)::double precision))`
- `product_variants_weight_grams_check`: `CHECK ((weight_grams > (0)::double precision))`
- `product_variants_product_id_fkey`: `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT`
- `product_variants_created_at_not_null`: `NOT NULL created_at`
- `product_variants_id_not_null`: `NOT NULL id`
- `product_variants_low_stock_threshold_not_null`: `NOT NULL low_stock_threshold`
- `product_variants_name_not_null`: `NOT NULL name`
- `product_variants_product_id_not_null`: `NOT NULL product_id`
- `product_variants_sale_price_not_null`: `NOT NULL sale_price`
- `product_variants_sku_not_null`: `NOT NULL sku`
- `product_variants_status_not_null`: `NOT NULL status`
- `product_variants_updated_at_not_null`: `NOT NULL updated_at`
- `product_variants_version_not_null`: `NOT NULL version`
- `product_variants_pkey`: `PRIMARY KEY (id)`
- `product_variants_product_id_id_key`: `UNIQUE (product_id, id)`

Chỉ mục:

- `CREATE UNIQUE INDEX product_variants_pkey ON public.product_variants USING btree (id)`
- `CREATE UNIQUE INDEX product_variants_product_id_id_key ON public.product_variants USING btree (product_id, id)`
- `CREATE UNIQUE INDEX product_variants_sku_uq ON public.product_variants USING btree (lower(TRIM(BOTH FROM sku)))`

### products

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `code` | `text` | Có | halora_code('SP'::text) |
| `name` | `text` | Có | — |
| `slug` | `text` | Có | — |
| `category_id` | `uuid` | Có | — |
| `brand_id` | `uuid` | Có | — |
| `description` | `text` | Không | — |
| `ingredients` | `text` | Không | — |
| `benefits` | `text` | Không | — |
| `is_featured` | `boolean` | Có | false |
| `status` | `text` | Có | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |
| `thumbnail_media_id` | `uuid` | Không | — |

Ràng buộc:

- `products_business_code_format`: `CHECK ((code ~ '^SP[0-9]{2,}$'::text))`
- `products_status_check`: `CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))`
- `products_brand_id_fkey`: `FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE RESTRICT`
- `products_category_id_fkey`: `FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT`
- `products_thumbnail_media_id_fkey`: `FOREIGN KEY (thumbnail_media_id) REFERENCES media_assets(id) ON DELETE RESTRICT`
- `products_brand_id_not_null`: `NOT NULL brand_id`
- `products_category_id_not_null`: `NOT NULL category_id`
- `products_code_not_null`: `NOT NULL code`
- `products_created_at_not_null`: `NOT NULL created_at`
- `products_id_not_null`: `NOT NULL id`
- `products_is_featured_not_null`: `NOT NULL is_featured`
- `products_name_not_null`: `NOT NULL name`
- `products_slug_not_null`: `NOT NULL slug`
- `products_status_not_null`: `NOT NULL status`
- `products_updated_at_not_null`: `NOT NULL updated_at`
- `products_version_not_null`: `NOT NULL version`
- `products_pkey`: `PRIMARY KEY (id)`
- `products_code_key`: `UNIQUE (code)`
- `products_slug_key`: `UNIQUE (slug)`

Chỉ mục:

- `CREATE INDEX products_brand_idx ON public.products USING btree (brand_id)`
- `CREATE INDEX products_category_idx ON public.products USING btree (category_id)`
- `CREATE UNIQUE INDEX products_code_key ON public.products USING btree (code)`
- `CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id)`
- `CREATE UNIQUE INDEX products_slug_key ON public.products USING btree (slug)`
- `CREATE INDEX products_thumbnail_media_idx ON public.products USING btree (thumbnail_media_id) WHERE (thumbnail_media_id IS NOT NULL)`

### promotion_usage

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `promotion_id` | `uuid` | Có | — |
| `product_rule_id` | `uuid` | Không | — |
| `order_rule_id` | `uuid` | Không | — |
| `voucher_id` | `uuid` | Không | — |
| `first_order_id` | `uuid` | Có | — |
| `used_at` | `timestamp with time zone` | Có | now() |

Ràng buộc:

- `promotion_usage_check`: `CHECK ((num_nonnulls(product_rule_id, order_rule_id, voucher_id) = 1))`
- `promotion_usage_first_order_id_fkey`: `FOREIGN KEY (first_order_id) REFERENCES orders(id) ON DELETE RESTRICT`
- `promotion_usage_order_rule_id_fkey`: `FOREIGN KEY (order_rule_id) REFERENCES order_promotion_rules(id) ON DELETE RESTRICT`
- `promotion_usage_product_rule_id_fkey`: `FOREIGN KEY (product_rule_id) REFERENCES product_promotion_rules(id) ON DELETE RESTRICT`
- `promotion_usage_promotion_id_fkey`: `FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE RESTRICT`
- `promotion_usage_voucher_id_fkey`: `FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE RESTRICT`
- `promotion_usage_first_order_id_not_null`: `NOT NULL first_order_id`
- `promotion_usage_id_not_null`: `NOT NULL id`
- `promotion_usage_promotion_id_not_null`: `NOT NULL promotion_id`
- `promotion_usage_used_at_not_null`: `NOT NULL used_at`
- `promotion_usage_pkey`: `PRIMARY KEY (id)`
- `promotion_usage_product_rule_id_order_rule_id_voucher_id_key`: `UNIQUE NULLS NOT DISTINCT (product_rule_id, order_rule_id, voucher_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX promotion_usage_pkey ON public.promotion_usage USING btree (id)`
- `CREATE UNIQUE INDEX promotion_usage_product_rule_id_order_rule_id_voucher_id_key ON public.promotion_usage USING btree (product_rule_id, order_rule_id, voucher_id) NULLS NOT DISTINCT`
- `CREATE INDEX promotion_usage_promotion_idx ON public.promotion_usage USING btree (promotion_id)`

### promotions

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `code` | `text` | Có | halora_code('KM'::text) |
| `name` | `text` | Có | — |
| `description` | `text` | Không | — |
| `starts_at` | `timestamp with time zone` | Có | — |
| `ends_at` | `timestamp with time zone` | Có | — |
| `status` | `text` | Có | — |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `promotions_business_code_format`: `CHECK ((code ~ '^KM[0-9]{2,}$'::text))`
- `promotions_check`: `CHECK ((starts_at <= ends_at))`
- `promotions_status_check`: `CHECK ((status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'PAUSED'::text, 'ENDED'::text])))`
- `promotions_code_not_null`: `NOT NULL code`
- `promotions_created_at_not_null`: `NOT NULL created_at`
- `promotions_ends_at_not_null`: `NOT NULL ends_at`
- `promotions_id_not_null`: `NOT NULL id`
- `promotions_name_not_null`: `NOT NULL name`
- `promotions_starts_at_not_null`: `NOT NULL starts_at`
- `promotions_status_not_null`: `NOT NULL status`
- `promotions_updated_at_not_null`: `NOT NULL updated_at`
- `promotions_version_not_null`: `NOT NULL version`
- `promotions_pkey`: `PRIMARY KEY (id)`
- `promotions_code_key`: `UNIQUE (code)`

Chỉ mục:

- `CREATE UNIQUE INDEX promotions_code_key ON public.promotions USING btree (code)`
- `CREATE UNIQUE INDEX promotions_pkey ON public.promotions USING btree (id)`

### refunds

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `order_id` | `uuid` | Có | — |
| `payment_id` | `uuid` | Có | — |
| `amount` | `money_vnd` | Có | — |
| `status` | `text` | Có | 'PENDING'::text |
| `reference` | `text` | Không | — |
| `reason` | `text` | Không | — |
| `refunded_at` | `timestamp with time zone` | Không | — |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |

Ràng buộc:

- `refunds_amount_check`: `CHECK (((amount)::numeric > (0)::numeric))`
- `refunds_status_check`: `CHECK ((status = ANY (ARRAY['PENDING'::text, 'SUCCEEDED'::text, 'FAILED'::text])))`
- `refunds_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT`
- `refunds_payment_id_fkey`: `FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT`
- `refunds_amount_not_null`: `NOT NULL amount`
- `refunds_created_at_not_null`: `NOT NULL created_at`
- `refunds_id_not_null`: `NOT NULL id`
- `refunds_order_id_not_null`: `NOT NULL order_id`
- `refunds_payment_id_not_null`: `NOT NULL payment_id`
- `refunds_status_not_null`: `NOT NULL status`
- `refunds_updated_at_not_null`: `NOT NULL updated_at`
- `refunds_pkey`: `PRIMARY KEY (id)`
- `refunds_payment_id_key`: `UNIQUE (payment_id)`

Chỉ mục:

- `CREATE INDEX refunds_order_idx ON public.refunds USING btree (order_id)`
- `CREATE UNIQUE INDEX refunds_payment_id_key ON public.refunds USING btree (payment_id)`
- `CREATE UNIQUE INDEX refunds_pkey ON public.refunds USING btree (id)`

### role_permissions

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `role_id` | `uuid` | Có | — |
| `permission_id` | `uuid` | Có | — |

Ràng buộc:

- `role_permissions_permission_id_fkey`: `FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE RESTRICT`
- `role_permissions_role_id_fkey`: `FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE`
- `role_permissions_permission_id_not_null`: `NOT NULL permission_id`
- `role_permissions_role_id_not_null`: `NOT NULL role_id`
- `role_permissions_pkey`: `PRIMARY KEY (role_id, permission_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX role_permissions_pkey ON public.role_permissions USING btree (role_id, permission_id)`

### roles

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `code` | `text` | Có | — |
| `name` | `text` | Có | — |
| `description` | `text` | Có | — |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `roles_code_not_null`: `NOT NULL code`
- `roles_created_at_not_null`: `NOT NULL created_at`
- `roles_description_not_null`: `NOT NULL description`
- `roles_id_not_null`: `NOT NULL id`
- `roles_name_not_null`: `NOT NULL name`
- `roles_updated_at_not_null`: `NOT NULL updated_at`
- `roles_version_not_null`: `NOT NULL version`
- `roles_pkey`: `PRIMARY KEY (id)`
- `roles_code_key`: `UNIQUE (code)`

Chỉ mục:

- `CREATE UNIQUE INDEX roles_code_key ON public.roles USING btree (code)`
- `CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id)`

### stock_movements

Bút toán kho ghi tại lúc xác nhận, không ghi lùi theo ngày chứng từ

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `variant_id` | `uuid` | Có | — |
| `sku` | `text` | Có | — |
| `type` | `text` | Có | — |
| `quantity_delta` | `integer` | Có | — |
| `quantity_after` | `integer` | Có | — |
| `source_type` | `text` | Có | — |
| `source_id` | `uuid` | Có | — |
| `account_id` | `uuid` | Có | — |
| `performed_by_name` | `text` | Có | — |
| `note` | `text` | Không | — |
| `created_at` | `timestamp with time zone` | Có | now() |

Ràng buộc:

- `stock_movements_quantity_after_check`: `CHECK ((quantity_after >= 0))`
- `stock_movements_quantity_delta_check`: `CHECK ((quantity_delta <> 0))`
- `stock_movements_type_check`: `CHECK ((type = ANY (ARRAY['RECEIPT'::text, 'SALE'::text, 'CANCELLATION'::text, 'ADJUSTMENT'::text])))`
- `stock_movements_account_id_fkey`: `FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT`
- `stock_movements_variant_id_fkey`: `FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT`
- `stock_movements_account_id_not_null`: `NOT NULL account_id`
- `stock_movements_created_at_not_null`: `NOT NULL created_at`
- `stock_movements_id_not_null`: `NOT NULL id`
- `stock_movements_performed_by_name_not_null`: `NOT NULL performed_by_name`
- `stock_movements_quantity_after_not_null`: `NOT NULL quantity_after`
- `stock_movements_quantity_delta_not_null`: `NOT NULL quantity_delta`
- `stock_movements_sku_not_null`: `NOT NULL sku`
- `stock_movements_source_id_not_null`: `NOT NULL source_id`
- `stock_movements_source_type_not_null`: `NOT NULL source_type`
- `stock_movements_type_not_null`: `NOT NULL type`
- `stock_movements_variant_id_not_null`: `NOT NULL variant_id`
- `stock_movements_pkey`: `PRIMARY KEY (id)`
- `stock_movements_variant_id_source_type_source_id_key`: `UNIQUE (variant_id, source_type, source_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX stock_movements_pkey ON public.stock_movements USING btree (id)`
- `CREATE UNIQUE INDEX stock_movements_variant_id_source_type_source_id_key ON public.stock_movements USING btree (variant_id, source_type, source_id)`
- `CREATE INDEX stock_movements_variant_time_idx ON public.stock_movements USING btree (variant_id, created_at)`

### supplier_variants

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `supplier_id` | `uuid` | Có | — |
| `variant_id` | `uuid` | Có | — |
| `quoted_cost_price` | `money_vnd` | Có | — |
| `status` | `text` | Có | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `supplier_variants_status_check`: `CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))`
- `supplier_variants_supplier_id_fkey`: `FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT`
- `supplier_variants_variant_id_fkey`: `FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT`
- `supplier_variants_created_at_not_null`: `NOT NULL created_at`
- `supplier_variants_id_not_null`: `NOT NULL id`
- `supplier_variants_quoted_cost_price_not_null`: `NOT NULL quoted_cost_price`
- `supplier_variants_status_not_null`: `NOT NULL status`
- `supplier_variants_supplier_id_not_null`: `NOT NULL supplier_id`
- `supplier_variants_updated_at_not_null`: `NOT NULL updated_at`
- `supplier_variants_variant_id_not_null`: `NOT NULL variant_id`
- `supplier_variants_version_not_null`: `NOT NULL version`
- `supplier_variants_pkey`: `PRIMARY KEY (id)`
- `supplier_variants_supplier_id_variant_id_key`: `UNIQUE (supplier_id, variant_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX supplier_variants_pkey ON public.supplier_variants USING btree (id)`
- `CREATE UNIQUE INDEX supplier_variants_supplier_id_variant_id_key ON public.supplier_variants USING btree (supplier_id, variant_id)`

### suppliers

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `code` | `text` | Có | halora_code('NCC'::text) |
| `name` | `text` | Có | — |
| `contact_name` | `text` | Có | — |
| `phone` | `text` | Có | — |
| `email` | `text` | Có | — |
| `address` | `text` | Có | — |
| `status` | `text` | Có | 'ACTIVE'::text |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `suppliers_business_code_format`: `CHECK ((code ~ '^NCC[0-9]{2,}$'::text))`
- `suppliers_status_check`: `CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))`
- `suppliers_address_not_null`: `NOT NULL address`
- `suppliers_code_not_null`: `NOT NULL code`
- `suppliers_contact_name_not_null`: `NOT NULL contact_name`
- `suppliers_created_at_not_null`: `NOT NULL created_at`
- `suppliers_email_not_null`: `NOT NULL email`
- `suppliers_id_not_null`: `NOT NULL id`
- `suppliers_name_not_null`: `NOT NULL name`
- `suppliers_phone_not_null`: `NOT NULL phone`
- `suppliers_status_not_null`: `NOT NULL status`
- `suppliers_updated_at_not_null`: `NOT NULL updated_at`
- `suppliers_version_not_null`: `NOT NULL version`
- `suppliers_pkey`: `PRIMARY KEY (id)`
- `suppliers_code_key`: `UNIQUE (code)`

Chỉ mục:

- `CREATE UNIQUE INDEX suppliers_code_key ON public.suppliers USING btree (code)`
- `CREATE UNIQUE INDEX suppliers_pkey ON public.suppliers USING btree (id)`

### voucher_redemptions

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `voucher_id` | `uuid` | Có | — |
| `order_id` | `uuid` | Có | — |
| `customer_id` | `uuid` | Có | — |
| `status` | `text` | Có | — |
| `created_at` | `timestamp with time zone` | Có | now() |

Ràng buộc:

- `voucher_redemptions_status_check`: `CHECK ((status = ANY (ARRAY['HELD'::text, 'USED'::text, 'RELEASED'::text])))`
- `voucher_redemptions_customer_id_fkey`: `FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT`
- `voucher_redemptions_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT`
- `voucher_redemptions_voucher_id_fkey`: `FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE RESTRICT`
- `voucher_redemptions_created_at_not_null`: `NOT NULL created_at`
- `voucher_redemptions_customer_id_not_null`: `NOT NULL customer_id`
- `voucher_redemptions_id_not_null`: `NOT NULL id`
- `voucher_redemptions_order_id_not_null`: `NOT NULL order_id`
- `voucher_redemptions_status_not_null`: `NOT NULL status`
- `voucher_redemptions_voucher_id_not_null`: `NOT NULL voucher_id`
- `voucher_redemptions_pkey`: `PRIMARY KEY (id)`
- `voucher_redemptions_voucher_id_order_id_key`: `UNIQUE (voucher_id, order_id)`

Chỉ mục:

- `CREATE UNIQUE INDEX voucher_redemptions_pkey ON public.voucher_redemptions USING btree (id)`
- `CREATE INDEX voucher_redemptions_usage_idx ON public.voucher_redemptions USING btree (voucher_id, customer_id, status)`
- `CREATE UNIQUE INDEX voucher_redemptions_voucher_id_order_id_key ON public.voucher_redemptions USING btree (voucher_id, order_id)`

### vouchers

| Cột | Kiểu PostgreSQL | Bắt buộc | Mặc định |
|---|---|---|---|
| `id` | `uuid` | Có | gen_random_uuid() |
| `promotion_id` | `uuid` | Có | — |
| `code` | `text` | Có | halora_code('VC'::text) |
| `discount_percent` | `discount_percent` | Có | — |
| `min_order_amount` | `money_vnd` | Có | — |
| `max_discount_amount` | `money_vnd` | Không | — |
| `max_uses` | `integer` | Không | — |
| `per_customer_limit` | `integer` | Có | — |
| `status` | `text` | Có | — |
| `created_at` | `timestamp with time zone` | Có | now() |
| `updated_at` | `timestamp with time zone` | Có | now() |
| `version` | `integer` | Có | 1 |

Ràng buộc:

- `vouchers_business_code_format`: `CHECK ((code ~ '^VC[0-9]{2,}$'::text))`
- `vouchers_max_uses_check`: `CHECK ((max_uses >= 0))`
- `vouchers_per_customer_limit_check`: `CHECK ((per_customer_limit >= 0))`
- `vouchers_status_check`: `CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))`
- `vouchers_promotion_id_fkey`: `FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE RESTRICT`
- `vouchers_code_not_null`: `NOT NULL code`
- `vouchers_created_at_not_null`: `NOT NULL created_at`
- `vouchers_discount_percent_not_null`: `NOT NULL discount_percent`
- `vouchers_id_not_null`: `NOT NULL id`
- `vouchers_min_order_amount_not_null`: `NOT NULL min_order_amount`
- `vouchers_per_customer_limit_not_null`: `NOT NULL per_customer_limit`
- `vouchers_promotion_id_not_null`: `NOT NULL promotion_id`
- `vouchers_status_not_null`: `NOT NULL status`
- `vouchers_updated_at_not_null`: `NOT NULL updated_at`
- `vouchers_version_not_null`: `NOT NULL version`
- `vouchers_pkey`: `PRIMARY KEY (id)`

Chỉ mục:

- `CREATE UNIQUE INDEX vouchers_code_uq ON public.vouchers USING btree (lower(TRIM(BOTH FROM code)))`
- `CREATE UNIQUE INDEX vouchers_pkey ON public.vouchers USING btree (id)`

## View API

Các view ánh xạ dữ liệu sang DTO; SQL đầy đủ có trong schema.

- `api_accounts`
- `api_balances`
- `api_brands`
- `api_customers`
- `api_discounts`
- `api_employees`
- `api_images`
- `api_order_promotion_rules`
- `api_orders`
- `api_product_promotion_rules`
- `api_products`
- `api_promotions`
- `api_public_products`
- `api_roles`
- `api_supplier_variants`
- `api_variants`
- `api_vouchers`

`pgmigrations` lưu baseline migration; không phải dữ liệu kinh doanh. `business_code_sequence` cấp mã chứng từ và hồ sơ. Trigger version tăng trên những bảng chỉnh sửa có cột version.
