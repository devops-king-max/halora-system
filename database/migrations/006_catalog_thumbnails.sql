-- Up Migration
ALTER TABLE brands ADD COLUMN thumbnail_media_id uuid REFERENCES media_assets(id) ON DELETE RESTRICT;
ALTER TABLE products ADD COLUMN thumbnail_media_id uuid REFERENCES media_assets(id) ON DELETE RESTRICT;
CREATE INDEX brands_thumbnail_media_idx ON brands(thumbnail_media_id) WHERE thumbnail_media_id IS NOT NULL;
CREATE INDEX products_thumbnail_media_idx ON products(thumbnail_media_id) WHERE thumbnail_media_id IS NOT NULL;
CREATE VIEW api_brands AS SELECT b.*,m.url AS thumbnail_url FROM brands b LEFT JOIN media_assets m ON m.id=b.thumbnail_media_id;
CREATE VIEW api_products AS SELECT p.*,COALESCE(m.url,(SELECT i.url FROM api_images i WHERE i.product_id=p.id ORDER BY i.sort_order,i.id LIMIT 1)) AS thumbnail_url
 FROM products p LEFT JOIN media_assets m ON m.id=p.thumbnail_media_id;
CREATE OR REPLACE VIEW api_public_products AS SELECT p.id,p.code,p.name,p.slug,p.category_id,c.name AS category_name,p.brand_id,b.name AS brand_name,p.is_featured,p.created_at,
 COALESCE((SELECT m.url FROM media_assets m WHERE m.id=p.thumbnail_media_id),
  (SELECT i.url FROM api_images i WHERE i.product_id=p.id ORDER BY i.sort_order,i.id LIMIT 1)) AS thumbnail_url,
 (SELECT min(v.sale_price)::numeric(18,0) FROM product_variants v WHERE v.product_id=p.id AND v.status='ACTIVE') AS price_from
 FROM products p JOIN categories c ON c.id=p.category_id JOIN brands b ON b.id=p.brand_id
 WHERE p.status='ACTIVE' AND c.status='ACTIVE' AND b.status='ACTIVE';

-- Down Migration
DO $$ BEGIN RAISE EXCEPTION 'Catalog thumbnails cannot be reverted automatically'; END $$;
