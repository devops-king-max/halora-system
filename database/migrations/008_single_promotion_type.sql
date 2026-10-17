-- Up Migration
ALTER TABLE promotions ADD COLUMN type text;

-- Split existing mixed configurations. Keep all rule/voucher IDs, redemptions,
-- financial snapshots and the append-only first-usage ledger unchanged.
DO $$
DECLARE p record; kinds text[]; kind text; destination uuid;
BEGIN
 FOR p IN SELECT * FROM promotions ORDER BY created_at,id LOOP
  kinds:=ARRAY[]::text[];
  IF EXISTS(SELECT 1 FROM product_promotion_rules WHERE promotion_id=p.id) THEN kinds:=array_append(kinds,'PRODUCT'); END IF;
  IF EXISTS(SELECT 1 FROM order_promotion_rules WHERE promotion_id=p.id) THEN kinds:=array_append(kinds,'ORDER'); END IF;
  IF EXISTS(SELECT 1 FROM vouchers WHERE promotion_id=p.id) THEN kinds:=array_append(kinds,'VOUCHER'); END IF;
  UPDATE promotions SET type=COALESCE(kinds[1],'PRODUCT') WHERE id=p.id;
  FOREACH kind IN ARRAY kinds LOOP
   IF kind=kinds[1] THEN CONTINUE; END IF;
   INSERT INTO promotions(name,description,starts_at,ends_at,status,type)
    VALUES(left(p.name,200)||CASE kind WHEN 'ORDER' THEN ' — theo hóa đơn' ELSE ' — theo voucher' END,
     concat_ws(E'\n',p.description,'Tách từ chương trình '||p.code||' để mỗi chương trình chỉ có một loại.'),p.starts_at,p.ends_at,p.status,kind)
    RETURNING id INTO destination;
   IF kind='ORDER' THEN UPDATE order_promotion_rules SET promotion_id=destination WHERE promotion_id=p.id;
   ELSE UPDATE vouchers SET promotion_id=destination WHERE promotion_id=p.id; END IF;
   INSERT INTO audit_logs(performed_by_name,action,entity_type,entity_id,request_id)
    VALUES('Hệ thống','SPLIT_PROMOTION_TYPE','promotions',destination,p.code||':'||kind);
  END LOOP;
 END LOOP;
END $$;

ALTER TABLE promotions ALTER COLUMN type SET NOT NULL;
ALTER TABLE promotions ADD CONSTRAINT promotions_type_check CHECK(type IN ('PRODUCT','ORDER','VOUCHER'));
ALTER TABLE promotions ADD CONSTRAINT promotions_id_type_unique UNIQUE(id,type);

-- Composite foreign keys enforce the same rule for direct SQL and concurrent
-- requests. Generated constants are internal and absent from existing API views.
ALTER TABLE product_promotion_rules ADD COLUMN promotion_type text GENERATED ALWAYS AS ('PRODUCT'::text) STORED;
ALTER TABLE order_promotion_rules ADD COLUMN promotion_type text GENERATED ALWAYS AS ('ORDER'::text) STORED;
ALTER TABLE vouchers ADD COLUMN promotion_type text GENERATED ALWAYS AS ('VOUCHER'::text) STORED;
ALTER TABLE product_promotion_rules ADD CONSTRAINT product_rules_promotion_type_fk FOREIGN KEY(promotion_id,promotion_type) REFERENCES promotions(id,type) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE order_promotion_rules ADD CONSTRAINT order_rules_promotion_type_fk FOREIGN KEY(promotion_id,promotion_type) REFERENCES promotions(id,type) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE vouchers ADD CONSTRAINT vouchers_promotion_type_fk FOREIGN KEY(promotion_id,promotion_type) REFERENCES promotions(id,type) ON UPDATE RESTRICT ON DELETE RESTRICT;

-- Original ledger identities remain historical. Moved conditions also protect
-- their new parent against deletion or changes reserved for unused programs.
CREATE OR REPLACE VIEW api_promotions AS
 SELECT p.id,p.code,p.name,p.description,p.starts_at,p.ends_at,p.status,p.created_at,p.updated_at,p.version,
 EXISTS(SELECT 1 FROM promotion_usage u
  LEFT JOIN product_promotion_rules pr ON pr.id=u.product_rule_id
  LEFT JOIN order_promotion_rules r ON r.id=u.order_rule_id
  LEFT JOIN vouchers v ON v.id=u.voucher_id
  WHERE u.promotion_id=p.id OR pr.promotion_id=p.id OR r.promotion_id=p.id OR v.promotion_id=p.id) AS has_usage,
 p.type,
 EXISTS(SELECT 1 FROM product_promotion_rules WHERE promotion_id=p.id UNION ALL SELECT 1 FROM order_promotion_rules WHERE promotion_id=p.id UNION ALL SELECT 1 FROM vouchers WHERE promotion_id=p.id) AS has_conditions
 FROM promotions p;

-- Down Migration
DO $$ BEGIN RAISE EXCEPTION 'Promotion type migration preserves history and cannot be reverted automatically'; END $$;
