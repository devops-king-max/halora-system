-- Up Migration
CREATE TABLE business_code_counters (
 prefix text PRIMARY KEY CHECK(prefix ~ '^[A-Z]{2,6}$'),
 last_value bigint NOT NULL CHECK(last_value>=0)
);
CREATE OR REPLACE FUNCTION halora_code(prefix text) RETURNS text LANGUAGE plpgsql VOLATILE AS $$
DECLARE number bigint;
BEGIN
 INSERT INTO business_code_counters AS counters(prefix,last_value) VALUES(prefix,1)
 ON CONFLICT ON CONSTRAINT business_code_counters_pkey DO UPDATE SET last_value=counters.last_value+1
 RETURNING last_value INTO number;
 RETURN prefix || lpad(number::text,greatest(2,length(number::text)),'0');
END $$;
ALTER TABLE accounts ADD COLUMN code text;
ALTER TABLE accounts ALTER COLUMN code SET DEFAULT halora_code('TK');

-- Only identifiers and identifier snapshots change, never money, quantity or UUIDs.
CREATE TEMP TABLE halora_code_mapping(table_name text,column_name text,id uuid,old_code text,new_code text,prefix text) ON COMMIT DROP;
DO $$ DECLARE spec record; maximum bigint; BEGIN
 FOR spec IN SELECT * FROM (VALUES
  ('accounts','code','TK'),('customers','code','KH'),('employees','code','NV'),
  ('categories','code','LSP'),('brands','code','TH'),('products','code','SP'),
  ('product_variants','sku','SKU'),('suppliers','code','NCC'),('promotions','code','KM'),
  ('vouchers','code','VC'),('orders','order_code','DH'),('invoices','invoice_code','HD'),
  ('goods_receipts','receipt_code','PN'),('inventory_adjustments','adjustment_code','DC')
 ) AS x(table_name,column_name,prefix) LOOP
  EXECUTE format('INSERT INTO halora_code_mapping SELECT %L,%L,id,%I,%L||lpad(n::text,greatest(2,length(n::text)),''0''),%L FROM (SELECT id,%I,row_number() OVER(ORDER BY created_at,COALESCE(substring(%I from ''([0-9]+)$'')::numeric,0),id) AS n FROM %I) rows',
   spec.table_name,spec.column_name,spec.column_name,spec.prefix,spec.prefix,spec.column_name,spec.column_name,spec.table_name);
  EXECUTE format('UPDATE %I SET %I=''__HALORA_RENUMBER_''||id::text',spec.table_name,spec.column_name);
  EXECUTE format('UPDATE %I AS t SET %I=m.new_code FROM halora_code_mapping m WHERE m.table_name=%L AND t.id=m.id',spec.table_name,spec.column_name,spec.table_name);
  EXECUTE format('SELECT count(*) FROM %I',spec.table_name) INTO maximum;
  INSERT INTO business_code_counters(prefix,last_value) VALUES(spec.prefix,maximum);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK(%I ~ %L)',spec.table_name,spec.table_name||'_business_code_format',spec.column_name,'^'||spec.prefix||'[0-9]{2,}$');
 END LOOP;
END $$;
ALTER TABLE accounts ALTER COLUMN code SET NOT NULL;
ALTER TABLE accounts ADD CONSTRAINT accounts_code_key UNIQUE(code);
ALTER TABLE product_variants ALTER COLUMN sku SET DEFAULT halora_code('SKU');
ALTER TABLE vouchers ALTER COLUMN code SET DEFAULT halora_code('VC');

UPDATE order_items i SET sku=v.sku FROM product_variants v WHERE v.id=i.variant_id;
UPDATE invoice_items i SET sku=v.sku FROM product_variants v WHERE v.id=i.variant_id;
UPDATE goods_receipt_items i SET sku=v.sku FROM product_variants v WHERE v.id=i.variant_id;
UPDATE inventory_adjustment_items i SET sku=v.sku FROM product_variants v WHERE v.id=i.variant_id;
UPDATE stock_movements i SET sku=v.sku FROM product_variants v WHERE v.id=i.variant_id;
UPDATE invoices i SET order_code=o.order_code FROM orders o WHERE o.id=i.order_id;
UPDATE order_discounts d SET voucher_code=v.code FROM vouchers v WHERE v.id=d.voucher_id;
UPDATE payments SET reference='TT'||lpad(substring(reference from '([0-9]+)$'),greatest(2,length(substring(reference from '([0-9]+)$'))),'0') WHERE reference ~ '^DEMO-TT-[0-9]+$';
UPDATE refunds SET reference='HT'||lpad(substring(reference from '([0-9]+)$'),greatest(2,length(substring(reference from '([0-9]+)$'))),'0') WHERE reference ~ '^DEMO-HT-[0-9]+$';
UPDATE products SET slug=regexp_replace(slug,'^demo-san-pham-','san-pham-mau-') WHERE slug ~ '^demo-san-pham-[0-9]+$';

-- Explicitly entered valid codes also reserve their number for later automatic codes.
CREATE FUNCTION halora_track_code() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE number bigint;
BEGIN
 number:=substring(to_jsonb(NEW)->>TG_ARGV[0] from '([0-9]+)$')::bigint;
 INSERT INTO business_code_counters AS counters(prefix,last_value) VALUES(TG_ARGV[1],number)
 ON CONFLICT ON CONSTRAINT business_code_counters_pkey DO UPDATE SET last_value=greatest(counters.last_value,excluded.last_value);
 RETURN NEW;
END $$;
DO $$ DECLARE spec record; BEGIN
 FOR spec IN SELECT DISTINCT table_name,column_name,prefix FROM halora_code_mapping
 UNION SELECT * FROM (VALUES
  ('accounts','code','TK'),('customers','code','KH'),('employees','code','NV'),('categories','code','LSP'),('brands','code','TH'),('products','code','SP'),
  ('product_variants','sku','SKU'),('suppliers','code','NCC'),('promotions','code','KM'),('vouchers','code','VC'),('orders','order_code','DH'),
  ('invoices','invoice_code','HD'),('goods_receipts','receipt_code','PN'),('inventory_adjustments','adjustment_code','DC')) x(table_name,column_name,prefix)
 LOOP
  EXECUTE format('CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF %I ON %I FOR EACH ROW EXECUTE FUNCTION halora_track_code(%L,%L)',spec.column_name,spec.table_name,spec.column_name,spec.prefix);
 END LOOP;
END $$;
DROP VIEW api_accounts;
CREATE VIEW api_accounts AS SELECT a.id,a.code,a.realm,a.username,a.email,a.status,a.created_at,a.updated_at,a.version,
 c.id AS customer_id,e.id AS employee_id,
 CASE WHEN a.realm='CUSTOMER' THEN ARRAY[(SELECT id FROM roles WHERE code='CUSTOMER')]
 ELSE COALESCE((SELECT array_agg(er.role_id ORDER BY er.role_id) FROM employee_roles er WHERE er.employee_id=e.id),'{}'::uuid[]) END AS role_ids
 FROM accounts a LEFT JOIN customers c ON c.account_id=a.id LEFT JOIN employees e ON e.account_id=a.id;

-- Down Migration
DO $$ BEGIN RAISE EXCEPTION 'Business code migration cannot be reverted automatically'; END $$;
