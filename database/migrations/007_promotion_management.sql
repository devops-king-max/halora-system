-- Up Migration
-- Four commercial tables remain promotions, product_promotion_rules,
-- order_promotion_rules and vouchers. This ledger only remembers whether a
-- condition was ever applied, even if a pending order is subsequently edited.
CREATE TABLE promotion_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
 product_rule_id uuid REFERENCES product_promotion_rules(id) ON DELETE RESTRICT,
 order_rule_id uuid REFERENCES order_promotion_rules(id) ON DELETE RESTRICT,
 voucher_id uuid REFERENCES vouchers(id) ON DELETE RESTRICT,
 first_order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 used_at timestamptz NOT NULL DEFAULT now(),
 CHECK (num_nonnulls(product_rule_id,order_rule_id,voucher_id)=1),
 UNIQUE NULLS NOT DISTINCT (product_rule_id,order_rule_id,voucher_id)
);
CREATE INDEX promotion_usage_promotion_idx ON promotion_usage(promotion_id);
INSERT INTO promotion_usage(promotion_id,product_rule_id,order_rule_id,voucher_id,first_order_id,used_at)
 SELECT DISTINCT ON(d.product_rule_id,d.order_rule_id,d.voucher_id)
 d.promotion_id,d.product_rule_id,d.order_rule_id,d.voucher_id,d.order_id,o.created_at
 FROM order_discounts d JOIN orders o ON o.id=d.order_id
 ORDER BY d.product_rule_id,d.order_rule_id,d.voucher_id,o.created_at,o.id;
INSERT INTO promotion_usage(promotion_id,voucher_id,first_order_id,used_at)
 SELECT DISTINCT ON(r.voucher_id) v.promotion_id,r.voucher_id,r.order_id,r.created_at
 FROM voucher_redemptions r JOIN vouchers v ON v.id=r.voucher_id ORDER BY r.voucher_id,r.created_at,r.id
 ON CONFLICT DO NOTHING;
CREATE FUNCTION halora_remember_promotion_usage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO promotion_usage(promotion_id,product_rule_id,order_rule_id,voucher_id,first_order_id)
 VALUES(NEW.promotion_id,NEW.product_rule_id,NEW.order_rule_id,NEW.voucher_id,NEW.order_id) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER remember_promotion_usage AFTER INSERT ON order_discounts FOR EACH ROW EXECUTE FUNCTION halora_remember_promotion_usage();

DO $$ DECLARE spec record; BEGIN
 FOR spec IN SELECT * FROM (VALUES ('product_promotion_rules','KMSP'),('order_promotion_rules','KMHD')) x(table_name,prefix) LOOP
  EXECUTE format('ALTER TABLE %I ADD COLUMN code text',spec.table_name);
  EXECUTE format('WITH numbered AS (SELECT id,row_number() OVER(ORDER BY created_at,id) AS n FROM %I) UPDATE %I t SET code=%L||lpad(n::text,greatest(2,length(n::text)),''0'') FROM numbered WHERE t.id=numbered.id',spec.table_name,spec.table_name,spec.prefix);
  EXECUTE format('INSERT INTO business_code_counters(prefix,last_value) SELECT %L,count(*) FROM %I',spec.prefix,spec.table_name);
  EXECUTE format('ALTER TABLE %I ALTER COLUMN code SET NOT NULL, ALTER COLUMN code SET DEFAULT halora_code(%L), ADD UNIQUE(code), ADD CHECK(code ~ %L)',spec.table_name,spec.prefix,'^'||spec.prefix||'[0-9]{2,}$');
  EXECUTE format('CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF code ON %I FOR EACH ROW EXECUTE FUNCTION halora_track_code(''code'',%L)',spec.table_name,spec.prefix);
 END LOOP;
END $$;
ALTER TABLE product_promotion_rules DROP CONSTRAINT product_promotion_rules_min_quantity_check;
ALTER TABLE product_promotion_rules ADD CHECK (min_quantity>=0);
ALTER TABLE vouchers DROP CONSTRAINT vouchers_max_uses_check, DROP CONSTRAINT vouchers_per_customer_limit_check;
ALTER TABLE vouchers ADD CHECK (max_uses>=0), ADD CHECK (per_customer_limit>=0);

CREATE OR REPLACE VIEW api_promotions AS SELECT p.*,EXISTS(SELECT 1 FROM promotion_usage u WHERE u.promotion_id=p.id) AS has_usage FROM promotions p;
CREATE VIEW api_product_promotion_rules AS SELECT r.*,EXISTS(SELECT 1 FROM promotion_usage u WHERE u.product_rule_id=r.id) AS has_usage FROM product_promotion_rules r;
CREATE VIEW api_order_promotion_rules AS SELECT r.*,EXISTS(SELECT 1 FROM promotion_usage u WHERE u.order_rule_id=r.id) AS has_usage FROM order_promotion_rules r;
CREATE OR REPLACE VIEW api_vouchers AS SELECT v.*,
 (SELECT count(*)::integer FROM voucher_redemptions r WHERE r.voucher_id=v.id AND r.status='USED') AS used_count,
 (SELECT count(*)::integer FROM voucher_redemptions r WHERE r.voucher_id=v.id AND r.status='HELD') AS reserved_count,
 EXISTS(SELECT 1 FROM promotion_usage u WHERE u.voucher_id=v.id) AS has_usage FROM vouchers v;
-- Held at placement, consumed at confirmation, released once on a valid cancel.
UPDATE voucher_redemptions r SET status='USED' FROM orders o WHERE r.order_id=o.id AND r.status='HELD' AND o.status IN ('CONFIRMED','SHIPPING','COMPLETED');

-- Down Migration
DO $$ BEGIN RAISE EXCEPTION 'Promotion management migration cannot be reverted automatically'; END $$;
