import { Inject, Injectable } from '@nestjs/common';
import { Database, Row } from '../core/db';
import { Context, Routes } from '../core/registry';
import {
  DEFAULT_RECOMMENDATIONS,
  DEFAULT_RESTOCK_ROWS,
  DEFAULT_TARGET_COVER_DAYS,
  MAX_RECOMMENDATIONS,
  MAX_RESTOCK_ROWS,
  SALES_WINDOW_DAYS,
  RecommendationReason,
  clampInteger,
  dailySalesRate,
  daysOfCover,
  isLowStock,
  roundTo,
  suggestedOrderQuantity,
} from './insights.math';

/**
 * Insights computed only from existing project data (orders, order_items,
 * stock_movements, inventory_balances, supplier_variants, goods receipts).
 * No external AI service and no synthetic figures.
 */
@Injectable()
export class InsightsService {
  constructor(@Inject(Database) private readonly db: Database) {}

  registerRoutes(routes: Routes): void {
    routes.add('GET', '/me/recommendations', { customer: true }, c => this.customerRecommendations(c));
    routes.add('GET', '/products/{id}/related', { public: true }, c => this.relatedProducts(c));
    routes.add('GET', '/admin/insights/restock', { permission: 'inventory.read' }, c => this.restock(c));
  }

  /** "Gợi ý cho bạn": products bought together with what this customer already ordered. */
  private async customerRecommendations(c: Context): Promise<Row[]> {
    const limit = clampInteger(c.query.limit, DEFAULT_RECOMMENDATIONS, 1, MAX_RECOMMENDATIONS);
    const purchased = (await this.db.query(
      "SELECT DISTINCT oi.product_id AS id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.customer_id=$1 AND o.status<>'CANCELLED'",
      [c.actor.customerId],
    )).map(row => String(row.id));
    return this.recommend(purchased, purchased, limit);
  }

  /** "Thường được mua cùng": co-purchase for a single public product. */
  private async relatedProducts(c: Context): Promise<Row[]> {
    const limit = clampInteger(c.query.limit, DEFAULT_RECOMMENDATIONS, 1, MAX_RECOMMENDATIONS);
    const product = await this.db.one('SELECT id FROM api_public_products WHERE id=$1', [c.params.id]);
    const id = String(product.id);
    return this.recommend([id], [id], limit);
  }

  /**
   * Priority: co-purchase counts, then popular items in the same category, then
   * overall popularity. Only ACTIVE products that are publicly visible and have
   * stock are eligible. Returns an empty list when there is no real data.
   */
  private async recommend(seedIds: string[], excludeIds: string[], limit: number): Promise<Row[]> {
    const picked: Row[] = [];
    const seen = new Set(excludeIds);
    const collect = (rows: Row[], reason: RecommendationReason) => {
      for (const row of rows) {
        if (picked.length >= limit) return;
        const id = String(row.id);
        if (seen.has(id)) continue;
        seen.add(id);
        picked.push(this.present(row, reason));
      }
    };
    const remaining = () => limit - picked.length;
    if (seedIds.length && remaining() > 0) collect(await this.coPurchased(seedIds, [...seen], remaining()), 'CO_PURCHASE');
    if (seedIds.length && remaining() > 0) {
      const categories = (await this.db.query('SELECT DISTINCT category_id AS id FROM api_public_products WHERE id=ANY($1::uuid[])', [seedIds]))
        .map(row => String(row.id));
      if (categories.length) collect(await this.popular([...seen], remaining(), categories), 'CATEGORY');
    }
    if (remaining() > 0) collect(await this.popular([...seen], remaining()), 'POPULAR');
    return picked;
  }

  private coPurchased(seedIds: string[], excludeIds: string[], limit: number): Promise<Row[]> {
    if (limit <= 0) return Promise.resolve([]);
    return this.db.query(
      `SELECT p.*, pairs.score
         FROM api_public_products p
         JOIN (SELECT oi2.product_id AS id, count(DISTINCT oi1.order_id)::integer AS score
                 FROM order_items oi1
                 JOIN orders o ON o.id=oi1.order_id AND o.status<>'CANCELLED'
                 JOIN order_items oi2 ON oi2.order_id=oi1.order_id AND oi2.product_id<>oi1.product_id
                WHERE oi1.product_id=ANY($1::uuid[]) AND NOT (oi2.product_id=ANY($2::uuid[]))
                GROUP BY oi2.product_id) pairs ON pairs.id=p.id
        WHERE EXISTS(SELECT 1 FROM product_variants v JOIN inventory_balances b ON b.variant_id=v.id
                      WHERE v.product_id=p.id AND v.status='ACTIVE' AND b.stock_quantity>0)
        ORDER BY pairs.score DESC, p.id
        LIMIT $3`,
      [seedIds, excludeIds, limit],
    );
  }

  private popular(excludeIds: string[], limit: number, categoryIds?: string[]): Promise<Row[]> {
    if (limit <= 0) return Promise.resolve([]);
    const params: unknown[] = [excludeIds];
    let categoryFilter = '';
    if (categoryIds?.length) {
      params.push(categoryIds);
      categoryFilter = `AND p.category_id=ANY($${params.length}::uuid[])`;
    }
    params.push(limit);
    return this.db.query(
      `SELECT p.*, sales.score
         FROM api_public_products p
         JOIN (SELECT oi.product_id AS id, sum(oi.quantity)::bigint AS score
                 FROM order_items oi
                 JOIN orders o ON o.id=oi.order_id AND o.status<>'CANCELLED'
                GROUP BY oi.product_id) sales ON sales.id=p.id
        WHERE NOT (p.id=ANY($1::uuid[])) ${categoryFilter}
          AND EXISTS(SELECT 1 FROM product_variants v JOIN inventory_balances b ON b.variant_id=v.id
                      WHERE v.product_id=p.id AND v.status='ACTIVE' AND b.stock_quantity>0)
        ORDER BY sales.score DESC, p.id
        LIMIT $${params.length}`,
      params,
    );
  }

  private present(row: Row, reason: RecommendationReason): Row {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      slug: row.slug,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      brandId: row.brandId,
      brandName: row.brandName,
      thumbnailUrl: row.thumbnailUrl ?? null,
      priceFrom: row.priceFrom ?? null,
      isFeatured: row.isFeatured,
      reason,
      score: Number(row.score ?? 0),
    };
  }

  /**
   * "Gợi ý nhập hàng": sales velocity, days of cover and suggested purchase
   * quantity per ACTIVE variant, plus the last supplier and quoted cost.
   */
  private async restock(c: Context): Promise<Row[]> {
    const targetCoverDays = clampInteger(c.query.targetCoverDays, DEFAULT_TARGET_COVER_DAYS, 1, 365);
    const limit = clampInteger(c.query.limit, DEFAULT_RESTOCK_ROWS, 1, MAX_RESTOCK_ROWS);
    const rows = await this.db.query(
      `WITH sales AS (
         SELECT m.variant_id,
                -COALESCE(sum(m.quantity_delta) FILTER (WHERE m.type IN ('SALE','CANCELLATION') AND m.created_at >= now() - interval '30 days'),0)::bigint AS units_30,
                -COALESCE(sum(m.quantity_delta) FILTER (WHERE m.type IN ('SALE','CANCELLATION') AND m.created_at >= now() - interval '90 days'),0)::bigint AS units_90
           FROM stock_movements m
          WHERE m.created_at >= now() - interval '90 days'
          GROUP BY m.variant_id
       )
       SELECT v.id AS variant_id, v.product_id, v.sku, v.name AS variant_name, p.name AS product_name,
              v.low_stock_threshold, COALESCE(b.stock_quantity,0) AS stock_quantity,
              COALESCE(s.units_30,0) AS units_sold30, COALESCE(s.units_90,0) AS units_sold90,
              last.supplier_id AS last_supplier_id, last.supplier_name AS last_supplier_name,
              last.unit_cost AS last_unit_cost, last.posted_at AS last_received_at,
              quote.quoted_cost_price AS quoted_cost_price
         FROM product_variants v
         JOIN products p ON p.id=v.product_id AND p.status='ACTIVE'
         LEFT JOIN inventory_balances b ON b.variant_id=v.id
         LEFT JOIN sales s ON s.variant_id=v.id
         LEFT JOIN LATERAL (
           SELECT gr.supplier_id, gr.supplier_name, gri.unit_cost, gr.posted_at
             FROM goods_receipt_items gri
             JOIN goods_receipts gr ON gr.id=gri.receipt_id AND gr.status='POSTED'
            WHERE gri.variant_id=v.id
            ORDER BY gr.posted_at DESC NULLS LAST, gr.created_at DESC
            LIMIT 1
         ) last ON true
         LEFT JOIN LATERAL (
           SELECT sv.quoted_cost_price
             FROM supplier_variants sv
            WHERE sv.variant_id=v.id AND sv.status='ACTIVE'
              AND (last.supplier_id IS NULL OR sv.supplier_id=last.supplier_id)
            ORDER BY sv.updated_at DESC
            LIMIT 1
         ) quote ON true
        WHERE v.status='ACTIVE'`,
      [],
    );
    const items = rows.map(row => this.restockRow(row, targetCoverDays));
    items.sort((a, b) =>
      Number(b.isLowStock) - Number(a.isLowStock) ||
      Number(a.daysOfCover ?? Number.POSITIVE_INFINITY) - Number(b.daysOfCover ?? Number.POSITIVE_INFINITY) ||
      String(a.sku).localeCompare(String(b.sku)),
    );
    return items.slice(0, limit);
  }

  private restockRow(row: Row, targetCoverDays: number): Row {
    const stock = Math.max(0, Number(row.stockQuantity ?? 0));
    const unitsSold30 = Math.max(0, Number(row.unitsSold30 ?? 0));
    const unitsSold90 = Math.max(0, Number(row.unitsSold90 ?? 0));
    const rate30 = dailySalesRate(unitsSold30, SALES_WINDOW_DAYS.short);
    const rate90 = dailySalesRate(unitsSold90, SALES_WINDOW_DAYS.long);
    // Recent velocity wins; the 90-day window only fills in when the last 30 days are empty.
    const effectiveRate = rate30 > 0 ? rate30 : rate90;
    const cover = daysOfCover(stock, effectiveRate);
    const lowStockThreshold = Math.max(0, Number(row.lowStockThreshold ?? 0));
    return {
      variantId: row.variantId,
      productId: row.productId,
      sku: row.sku,
      productName: row.productName,
      variantName: row.variantName,
      stockQuantity: stock,
      lowStockThreshold,
      unitsSold30,
      unitsSold90,
      averageDailySales30: roundTo(rate30, 3),
      averageDailySales90: roundTo(rate90, 3),
      daysOfCover: cover === null ? null : roundTo(cover, 1),
      suggestedOrderQuantity: suggestedOrderQuantity(stock, effectiveRate, targetCoverDays),
      targetCoverDays,
      isLowStock: isLowStock(stock, lowStockThreshold),
      lastSupplierId: row.lastSupplierId ?? null,
      lastSupplierName: row.lastSupplierName ?? null,
      lastUnitCost: row.lastUnitCost ?? null,
      quotedCostPrice: row.quotedCostPrice ?? null,
      lastReceivedAt: row.lastReceivedAt ?? null,
    };
  }
}
