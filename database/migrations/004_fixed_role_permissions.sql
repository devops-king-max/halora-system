-- Up Migration
-- Role definitions are maintained by migrations; administrators assign roles to accounts.
DELETE FROM role_permissions;
DELETE FROM permissions WHERE code='roles.update';
INSERT INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='ADMIN';
INSERT INTO role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE
 (r.code='SALES' AND (p.code LIKE 'customers.%' OR p.code LIKE 'orders.%' OR p.code IN ('categories.read','brands.read','products.read','inventory.read','payments.create','invoices.read','invoices.create','invoices.update','invoices.post','invoices.export')))
 OR (r.code='WAREHOUSE' AND (split_part(p.code,'.',1) IN ('categories','brands','products','suppliers','goodsReceipts','inventory','inventoryAdjustments','media') OR p.code IN ('orders.read','orders.confirm','orders.dispatch')))
 OR (r.code='ACCOUNTANT' AND (split_part(p.code,'.',1) IN ('payments','refunds','invoices','reports') OR p.code IN ('orders.read','customers.read','employees.read','products.read','categories.read','brands.read','goodsReceipts.read','inventory.read')));
-- Re-evaluate existing staff sessions against the fixed matrix on next login.
UPDATE accounts SET auth_version=auth_version+1 WHERE realm='STAFF';
UPDATE auth_sessions s SET revoked_at=now() FROM accounts a WHERE a.id=s.account_id AND a.realm='STAFF' AND s.revoked_at IS NULL;

-- Down Migration
DO $$ BEGIN RAISE EXCEPTION 'Fixed roles cannot be reverted automatically'; END $$;
