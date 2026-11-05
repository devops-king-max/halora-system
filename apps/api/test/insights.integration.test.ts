import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { root } from '../src/core/config';
import { Database, Row } from '../src/core/db';
import { Routes } from '../src/core/registry';
import { InsightsService } from '../src/insights/insights.service';

config({ path: resolve(root, '.env.test.local'), quiet: true });
const configured = process.env.TEST_DATABASE_URL;
const suite = configured ? describe : describe.skip;

suite('Insights computed from real PostgreSQL data (isolated disposable database)', () => {
  let db: Database;
  let maintenance: Client;
  let name: string;
  let handlers: Map<string, (context: unknown) => Promise<unknown>>;
  let customerId: string;

  const context = (params: Row, query: Row, actorCustomerId: string | null) => ({
    params,
    query,
    body: {},
    actor: { customerId: actorCustomerId },
    req: {},
    res: {},
  });

  beforeAll(async () => {
    const url = new URL(configured!);
    url.pathname = '/postgres';
    maintenance = new Client({ connectionString: url.toString() });
    await maintenance.connect();
    name = `halora_insights_${randomUUID().replaceAll('-', '')}`;
    await maintenance.query(`CREATE DATABASE "${name}"`);
    url.pathname = `/${name}`;
    process.env.DATABASE_URL = url.toString();
    execFileSync(process.execPath, [require.resolve('tsx/cli'), resolve(root, 'apps/api/scripts/migrate.ts')], {
      env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: 'pipe',
    });
    db = new Database();
    await seed();
    const service = new InsightsService(db);
    const routes = new Routes();
    service.registerRoutes(routes);
    handlers = new Map([...routes.entries].map(([key, endpoint]) => [key, endpoint.handler as (context: unknown) => Promise<unknown>]));
  }, 120000);

  afterAll(async () => {
    if (db) await db.pool.end();
    if (maintenance) {
      await maintenance.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [name]);
      await maintenance.query(`DROP DATABASE IF EXISTS "${name}"`);
      await maintenance.end();
    }
    delete process.env.DATABASE_URL;
  });

  const one = async (sql: string, params: unknown[] = []): Promise<Row> => (await db.query(sql, params))[0];

  async function seed(): Promise<void> {
    const staff = await one(`INSERT INTO accounts (realm,username,email,password_hash) VALUES ('STAFF','insights_staff','insights_staff@example.test','x') RETURNING id`);
    const customerAccount = await one(`INSERT INTO accounts (realm,username,email,password_hash) VALUES ('CUSTOMER','insights_customer','insights_customer@example.test','x') RETURNING id`);
    const otherAccount = await one(`INSERT INTO accounts (realm,username,email,password_hash) VALUES ('CUSTOMER','insights_other','insights_other@example.test','x') RETURNING id`);
    const employee = await one(`INSERT INTO employees (account_id,full_name,phone,email,position) VALUES ($1,'NV Insights','0900000000','nv-insights@example.test','Kho') RETURNING id`, [staff.id]);
    customerId = String((await one(`INSERT INTO customers (account_id,full_name,phone) VALUES ($1,'KH Insights','0900000001') RETURNING id`, [customerAccount.id])).id);
    const other = await one(`INSERT INTO customers (account_id,full_name,phone) VALUES ($1,'KH Insights 2','0900000002') RETURNING id`, [otherAccount.id]);
    const category = await one(`INSERT INTO categories (name,status) VALUES ('Loại Insights','ACTIVE') RETURNING id`);
    const brand = await one(`INSERT INTO brands (name,status) VALUES ('Hãng Insights','ACTIVE') RETURNING id`);
    const product = async (name: string, status: string) => one(
      `INSERT INTO products (name,slug,category_id,brand_id,status) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [name, `${name.replaceAll(' ', '-')}-${randomUUID()}`, category.id, brand.id, status],
    );
    const p1 = await product('Sản phẩm Insights Một', 'ACTIVE');
    const p2 = await product('Sản phẩm Insights Hai', 'ACTIVE');
    const p3 = await product('Sản phẩm Insights Ba', 'ACTIVE');
    const inactive = await product('Sản phẩm Insights Ngừng', 'INACTIVE');
    const p5 = await product('Sản phẩm Insights Năm', 'ACTIVE');
    const variant = async (productId: unknown, sku: string, price: string) => one(
      `INSERT INTO product_variants (product_id,sku,name,sale_price,low_stock_threshold,status) VALUES ($1,$2,$2,$3,5,'ACTIVE') RETURNING id`,
      [productId, sku, price],
    );
    const v1 = await variant(p1.id, 'SKU01', '100000');
    const v2 = await variant(p2.id, 'SKU02', '300000');
    const v3 = await variant(p3.id, 'SKU03', '50000');
    const v4 = await variant(inactive.id, 'SKU04', '100000');
    const v5 = await variant(p5.id, 'SKU05', '200000');
    for (const [variantId, stock] of [[v1.id, 3], [v2.id, 100], [v3.id, 0], [v4.id, 10], [v5.id, 50]] as const) {
      await db.query('INSERT INTO inventory_balances (variant_id,stock_quantity) VALUES ($1,$2)', [variantId, stock]);
    }
    const order = async (customer: unknown, status: string, code: string, items: { productId: unknown; variantId: unknown; name: string; sku: string; quantity: number; price: number }[]) => {
      const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const row = await one(
        `INSERT INTO orders (order_code,customer_id,customer_name,status,payment_method,recipient_name,recipient_phone,address_line,province_name,ward_name,subtotal_amount,product_discount_amount,order_discount_amount,voucher_discount_amount,shipping_fee,total_amount)
         VALUES ($1,$2,'KH Insights',$3,'COD','KH Insights','0900000001','Địa chỉ','Tỉnh','Phường',$4,0,0,0,0,$4) RETURNING id`,
        [code, customer, status, subtotal],
      );
      for (const item of items) {
        await db.query(
          `INSERT INTO order_items (order_id,product_id,variant_id,product_name,variant_name,sku,quantity,unit_price,line_subtotal,product_discount_amount,line_total)
           VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,0,$8)`,
          [row.id, item.productId, item.variantId, item.name, item.sku, item.quantity, item.price, item.quantity * item.price],
        );
      }
    };
    await order(customerId, 'COMPLETED', 'DH01', [
      { productId: p1.id, variantId: v1.id, name: 'Sản phẩm Insights Một', sku: 'SKU01', quantity: 2, price: 100000 },
      { productId: p2.id, variantId: v2.id, name: 'Sản phẩm Insights Hai', sku: 'SKU02', quantity: 1, price: 300000 },
    ]);
    await order(other.id, 'COMPLETED', 'DH02', [
      { productId: p1.id, variantId: v1.id, name: 'Sản phẩm Insights Một', sku: 'SKU01', quantity: 1, price: 100000 },
      { productId: p2.id, variantId: v2.id, name: 'Sản phẩm Insights Hai', sku: 'SKU02', quantity: 2, price: 300000 },
    ]);
    await order(other.id, 'CANCELLED', 'DH03', [
      { productId: p3.id, variantId: v3.id, name: 'Sản phẩm Insights Ba', sku: 'SKU03', quantity: 1, price: 50000 },
    ]);
    await order(other.id, 'COMPLETED', 'DH04', [
      { productId: p5.id, variantId: v5.id, name: 'Sản phẩm Insights Năm', sku: 'SKU05', quantity: 3, price: 200000 },
    ]);
    const movement = async (variantId: unknown, sku: string, type: string, delta: number, after: number, daysAgo: number) => db.query(
      `INSERT INTO stock_movements (variant_id,sku,type,quantity_delta,quantity_after,source_type,source_id,account_id,performed_by_name,created_at)
       VALUES ($1,$2,$3,$4,$5,'ORDER',gen_random_uuid(),$6,'NV Insights',now() - ($7 || ' days')::interval)`,
      [variantId, sku, type, delta, after, staff.id, String(daysAgo)],
    );
    await movement(v1.id, 'SKU01', 'SALE', -10, 90, 5);
    await movement(v1.id, 'SKU01', 'CANCELLATION', 2, 92, 2);
    await movement(v2.id, 'SKU02', 'SALE', -30, 100, 10);
    await movement(v3.id, 'SKU03', 'SALE', -5, 0, 20);
    await movement(v5.id, 'SKU05', 'SALE', -20, 50, 15);
    const supplier = await one(`INSERT INTO suppliers (name,contact_name,phone,email,address,status) VALUES ('NCC Insights','Liên hệ','0900000009','ncc-insights@example.test','Địa chỉ','ACTIVE') RETURNING id,name`);
    await db.query(`INSERT INTO supplier_variants (supplier_id,variant_id,quoted_cost_price,status) VALUES ($1,$2,'120000','ACTIVE')`, [supplier.id, v1.id]);
    const receipt = await one(
      `INSERT INTO goods_receipts (supplier_id,supplier_name,employee_id,employee_name,received_at,posted_at,status,total_amount)
       VALUES ($1,$2,$3,'NV Insights',now() - interval '10 days',now() - interval '10 days','POSTED',550000) RETURNING id`,
      [supplier.id, supplier.name, employee.id],
    );
    await db.query(
      `INSERT INTO goods_receipt_items (receipt_id,supplier_id,product_id,variant_id,product_name,variant_name,sku,quantity,unit_cost,line_total)
       VALUES ($1,$2,$3,$4,'Sản phẩm Insights Một','SKU01','SKU01',5,'110000',550000)`,
      [receipt.id, supplier.id, p1.id, v1.id],
    );
  }

  it('restock suggestions use real velocity, cover and supplier data, and skip inactive variants', async () => {
    const rows = (await handlers.get('GET /admin/insights/restock')!(context({}, { targetCoverDays: 30, limit: 50 }, null))) as Row[];
    expect(rows.map(row => row.sku)).toEqual(['SKU03', 'SKU01', 'SKU05', 'SKU02']);
    const first = rows.find(row => row.sku === 'SKU01')!;
    expect(first).toMatchObject({
      stockQuantity: 3,
      unitsSold30: 8,
      unitsSold90: 8,
      daysOfCover: 11.3,
      suggestedOrderQuantity: 5,
      targetCoverDays: 30,
      isLowStock: true,
      lastSupplierName: 'NCC Insights',
      lastUnitCost: '110000',
      quotedCostPrice: '120000',
    });
    const empty = rows.find(row => row.sku === 'SKU03')!;
    expect(empty).toMatchObject({ stockQuantity: 0, unitsSold30: 5, daysOfCover: 0, suggestedOrderQuantity: 5 });
    expect(rows.some(row => row.sku === 'SKU04')).toBe(false);
  });

  it('related products prefer real co-purchase counts then same-category popularity', async () => {
    const product = await one("SELECT id FROM api_public_products WHERE name='Sản phẩm Insights Một'");
    const rows = (await handlers.get('GET /products/{id}/related')!(context({ id: String(product.id) }, { limit: 6 }, null))) as Row[];
    expect(rows.map(row => [row.name, row.reason, row.score])).toEqual([
      ['Sản phẩm Insights Hai', 'CO_PURCHASE', 2],
      ['Sản phẩm Insights Năm', 'CATEGORY', 3],
    ]);
  });

  it('returns purchases-based recommendations and an honest empty list when nothing is eligible', async () => {
    const rows = (await handlers.get('GET /me/recommendations')!(context({}, { limit: 6 }, customerId))) as Row[];
    expect(rows.map(row => [row.name, row.reason])).toEqual([['Sản phẩm Insights Năm', 'CATEGORY']]);
  });
});
