import type { ToolDefinition } from './assistant.engine';
import type { Row } from '../core/db';
import type { AssistantProduct } from './assistant.types';

export interface AssistantQuery {
  query<T extends object = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY = /^\d{1,18}$/;
const MAX_QUERY = 120;
const MAX_LIMIT = 10;
const DEFAULT_LIMIT = 6;

export const formatVnd = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  if (!MONEY.test(text)) return null;
  return text.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '\u00a0₫';
};

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
};

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

const toProduct = (row: Row): AssistantProduct => ({
  id: String(row.id),
  code: String(row.code),
  name: String(row.name),
  thumbnailUrl: row.thumbnailUrl ? String(row.thumbnailUrl) : null,
  priceFrom: row.priceFrom === null || row.priceFrom === undefined ? null : String(row.priceFrom),
});

interface SearchInput {
  query: string;
  categoryId?: string;
  minPrice?: string;
  maxPrice?: string;
  limit: number;
}

const parseSearch = (input: unknown): SearchInput | { error: string } => {
  if (!input || typeof input !== 'object') return { error: 'Tham số tìm kiếm không hợp lệ.' };
  const raw = input as Record<string, unknown>;
  const query = text(raw.query, MAX_QUERY);
  if (!query) return { error: 'Cần nhập từ khóa tìm kiếm sản phẩm.' };
  const result: SearchInput = { query, limit: DEFAULT_LIMIT };
  if (raw.categoryId !== undefined && raw.categoryId !== null && raw.categoryId !== '') {
    if (typeof raw.categoryId !== 'string' || !UUID.test(raw.categoryId)) return { error: 'Mã loại sản phẩm không hợp lệ.' };
    result.categoryId = raw.categoryId;
  }
  for (const key of ['minPrice', 'maxPrice'] as const) {
    const value = raw[key];
    if (value === undefined || value === null || value === '') continue;
    const normalized = typeof value === 'number' ? String(Math.trunc(value)) : String(value).trim();
    if (!MONEY.test(normalized)) return { error: 'Khoảng giá phải là số nguyên VND.' };
    result[key] = normalized;
  }
  if (result.minPrice && result.maxPrice && BigInt(result.minPrice) > BigInt(result.maxPrice)) {
    return { error: 'Giá thấp nhất không được lớn hơn giá cao nhất.' };
  }
  if (raw.limit !== undefined && raw.limit !== null) {
    const limit = Number(raw.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return { error: `Số lượng kết quả phải từ 1 đến ${MAX_LIMIT}.` };
    result.limit = limit;
  }
  return result;
};

export class AssistantTools {
  readonly definitions: ToolDefinition[] = [
    {
      name: 'search_products',
      description:
        'Tìm sản phẩm đang bán còn hàng trong cơ sở dữ liệu Halora theo từ khóa, loại sản phẩm và khoảng giá VND. Dùng công cụ này trước khi trả lời về sản phẩm.',
      input_schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string', description: 'Từ khóa tên sản phẩm, mã sản phẩm hoặc SKU.' },
          categoryId: { type: 'string', description: 'UUID loại sản phẩm (tùy chọn).' },
          minPrice: { type: 'string', description: 'Giá tối thiểu VND, số nguyên dạng chuỗi (tùy chọn).' },
          maxPrice: { type: 'string', description: 'Giá tối đa VND, số nguyên dạng chuỗi (tùy chọn).' },
          limit: { type: 'integer', description: `Số sản phẩm tối đa, 1-${MAX_LIMIT}, mặc định ${DEFAULT_LIMIT}.` },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_product',
      description:
        'Lấy thông tin chi tiết một sản phẩm đang bán: mô tả, thành phần, công dụng, các biến thể, giá bán và tồn kho thực tế.',
      input_schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'UUID sản phẩm lấy từ kết quả search_products.' },
        },
        required: ['id'],
      },
    },
  ];

  constructor(private readonly db: AssistantQuery) {}

  async execute(name: string, input: unknown): Promise<unknown> {
    if (name === 'search_products') return this.searchProducts(input);
    if (name === 'get_product') return this.getProduct(input);
    return { error: 'Công cụ không được hỗ trợ.' };
  }

  async searchProducts(input: unknown): Promise<unknown> {
    const parsed = parseSearch(input);
    if ('error' in parsed) return { error: parsed.error };
    const params: unknown[] = [];
    const where = [
      "EXISTS(SELECT 1 FROM product_variants sv JOIN inventory_balances sb ON sb.variant_id=sv.id WHERE sv.product_id=ap.id AND sv.status='ACTIVE' AND sb.stock_quantity>0)",
    ];
    params.push(`%${escapeLike(parsed.query)}%`);
    where.push(`(ap.name ILIKE $${params.length} OR ap.code ILIKE $${params.length} OR EXISTS(SELECT 1 FROM product_variants sv WHERE sv.product_id=ap.id AND sv.sku ILIKE $${params.length}))`);
    if (parsed.categoryId) {
      params.push(parsed.categoryId);
      where.push(`ap.category_id=$${params.length}::uuid`);
    }
    if (parsed.minPrice) {
      params.push(parsed.minPrice);
      where.push(`ap.price_from>=$${params.length}::numeric`);
    }
    if (parsed.maxPrice) {
      params.push(parsed.maxPrice);
      where.push(`ap.price_from<=$${params.length}::numeric`);
    }
    params.push(parsed.limit);
    const rows = await this.db.query<Row>(
      `SELECT ap.id,ap.code,ap.name,ap.thumbnail_url,ap.price_from,ap.category_name,ap.brand_name
        ,(SELECT COALESCE(SUM(b.stock_quantity),0)::integer FROM product_variants v JOIN inventory_balances b ON b.variant_id=v.id WHERE v.product_id=ap.id AND v.status='ACTIVE') AS stock_quantity
       FROM api_public_products ap
       WHERE ${where.join(' AND ')}
       ORDER BY ap.is_featured DESC,ap.name ASC,ap.id ASC
       LIMIT $${params.length}`,
      params,
    );
    return {
      products: rows.map((row) => ({
        ...toProduct(row),
        priceFromText: formatVnd(row.priceFrom),
        categoryName: row.categoryName ? String(row.categoryName) : null,
        brandName: row.brandName ? String(row.brandName) : null,
        stockQuantity: Number(row.stockQuantity || 0),
      })),
    };
  }

  async getProduct(input: unknown): Promise<unknown> {
    const id = input && typeof input === 'object' ? (input as Record<string, unknown>).id : undefined;
    if (typeof id !== 'string' || !UUID.test(id)) return { error: 'Mã sản phẩm không hợp lệ.' };
    const product = (await this.db.query<Row>(
      `SELECT ap.id,ap.code,ap.name,ap.thumbnail_url,ap.price_from,ap.category_name,ap.brand_name
        ,(SELECT COALESCE(SUM(b.stock_quantity),0)::integer FROM product_variants v JOIN inventory_balances b ON b.variant_id=v.id WHERE v.product_id=ap.id AND v.status='ACTIVE') AS stock_quantity
       FROM api_public_products ap WHERE ap.id=$1::uuid`,
      [id],
    ))[0];
    if (!product) return { error: 'Không tìm thấy sản phẩm đang bán.' };
    const detail = await this.db.query<Row>('SELECT description,ingredients,benefits FROM products WHERE id=$1::uuid', [id]);
    const variants = await this.db.query<Row>(
      `SELECT v.id,v.sku,v.name,v.color,v.volume_ml,v.weight_grams,v.sale_price
        ,COALESCE(b.stock_quantity,0)::integer AS stock_quantity
       FROM product_variants v LEFT JOIN inventory_balances b ON b.variant_id=v.id
       WHERE v.product_id=$1::uuid AND v.status='ACTIVE'
       ORDER BY v.sale_price ASC,v.id ASC`,
      [id],
    );
    const info = detail[0] || {};
    return {
      product: {
        ...toProduct(product),
        priceFromText: formatVnd(product.priceFrom),
        categoryName: product.categoryName ? String(product.categoryName) : null,
        brandName: product.brandName ? String(product.brandName) : null,
        stockQuantity: Number(product.stockQuantity || 0),
        description: text(info.description, 1500),
        ingredients: text(info.ingredients, 1200),
        benefits: text(info.benefits, 1200),
        variants: variants.map((variant) => ({
          id: String(variant.id),
          sku: String(variant.sku),
          name: String(variant.name),
          color: variant.color ? String(variant.color) : null,
          volumeMl: variant.volumeMl === null || variant.volumeMl === undefined ? null : Number(variant.volumeMl),
          weightGrams: variant.weightGrams === null || variant.weightGrams === undefined ? null : Number(variant.weightGrams),
          salePrice: String(variant.salePrice),
          salePriceText: formatVnd(variant.salePrice),
          stockQuantity: Number(variant.stockQuantity || 0),
          inStock: Number(variant.stockQuantity || 0) > 0,
        })),
      },
    };
  }
}
