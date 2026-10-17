-- Up Migration
-- User-requested display cleanup across master data and transaction snapshots.
-- Do not change identifiers, credentials, contact emails, money or quantities.
CREATE FUNCTION pg_temp.halora_clean_label(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $clean$
 SELECT btrim(regexp_replace(
   regexp_replace(
     regexp_replace(value,'[[:space:]]*(\([[:space:]]*mẫu[[:space:]]*\)|\[[[:space:]]*mẫu[[:space:]]*\])[[:space:]]*',' ','gi'),
     '\m(mẫu|demo)\M[[:blank:]]*','','gi'),
   ' {2,}',' ','g'))
$clean$;

DO $$ DECLARE field record; BEGIN
 FOR field IN
  SELECT c.table_name,c.column_name FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
  WHERE c.table_schema='public' AND t.table_type='BASE TABLE' AND c.data_type='text'
   AND c.column_name=ANY(ARRAY['name','full_name','contact_name','description','ingredients','benefits','color','position',
    'address','address_line','province_name','ward_name','recipient_name','note','cancellation_reason','reason','customer_name',
    'product_name','variant_name','promotion_name','employee_name','supplier_name','performed_by_name','alt_text'])
  ORDER BY c.table_name,c.ordinal_position
 LOOP
  EXECUTE format('UPDATE %I SET %I=pg_temp.halora_clean_label(%I) WHERE %I ~* %L AND %I IS DISTINCT FROM pg_temp.halora_clean_label(%I)',
   field.table_name,field.column_name,field.column_name,field.column_name,'\m(mẫu|demo)\M',field.column_name,field.column_name);
 END LOOP;
END $$;

-- Preserve idempotency responses while cleaning only user-visible text fields.
CREATE FUNCTION pg_temp.halora_clean_response(value jsonb, field_name text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $json$
BEGIN
 CASE jsonb_typeof(value)
 WHEN 'object' THEN RETURN COALESCE((SELECT jsonb_object_agg(key,pg_temp.halora_clean_response(v,key)) FROM jsonb_each(value) AS item(key,v)),'{}'::jsonb);
 WHEN 'array' THEN RETURN COALESCE((SELECT jsonb_agg(pg_temp.halora_clean_response(v,field_name) ORDER BY n) FROM jsonb_array_elements(value) WITH ORDINALITY AS item(v,n)),'[]'::jsonb);
 WHEN 'string' THEN
  IF field_name=ANY(ARRAY['name','fullName','contactName','description','ingredients','benefits','color','position','address','addressLine',
   'provinceName','wardName','recipientName','note','cancellationReason','reason','customerName','productName','variantName','promotionName',
   'employeeName','supplierName','performedByName','altText']) AND value#>>'{}' ~* '\m(mẫu|demo)\M' THEN
   RETURN to_jsonb(pg_temp.halora_clean_label(value#>>'{}'));
  END IF;
  RETURN value;
 ELSE RETURN value;
 END CASE;
END
$json$;
UPDATE idempotency_keys SET response_body=pg_temp.halora_clean_response(response_body)
 WHERE response_body::text ~* '\m(mẫu|demo)\M'
 AND response_body IS DISTINCT FROM pg_temp.halora_clean_response(response_body);

-- Down Migration
DO $$ BEGIN RAISE EXCEPTION 'Display label cleanup cannot be reverted automatically'; END $$;
