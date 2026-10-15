/**
 * Official TypeScript definitions for Halora system.
 * Strictly aligned with docs/api/openapi.yaml contract.
 */

export type UUID = string;
export type Money = string; // Integer string in VND, e.g. "250000"
export type Percentage = string; // Decimal string, e.g. "10.00"
export type ISODateTime = string; // ISO 8601 string, e.g. "2026-10-15T14:30:00Z"

export type ActiveStatus = "ACTIVE" | "INACTIVE";

export type AccountRealm = "CUSTOMER" | "STAFF";

export type AccountStatus = "ACTIVE" | "LOCKED" | "INACTIVE";

export type OrderStatus =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "SHIPPING"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentMethod = "COD" | "BANK_TRANSFER";

export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type RefundStatus = "PENDING" | "SUCCEEDED" | "FAILED";

export type DocumentStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type PromotionStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";

export type StockMovementType =
  | "RECEIPT"
  | "SALE"
  | "CANCELLATION"
  | "ADJUSTMENT";

export type DiscountScope = "PRODUCT" | "ORDER" | "VOUCHER";

export type ReportMetricUnit = "VND" | "COUNT" | "QUANTITY";

export type ReportColumnType =
  | "TEXT"
  | "MONEY"
  | "NUMBER"
  | "DATETIME"
  | "STATUS";

export type ReportSourceType = "ORDER" | "INVOICE" | "GOODS_RECEIPT";

// ================= API ENVELOPES & COMMON =================
export interface ApiResponse<T> {
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId: string;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface EntityMetadata {
  id: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
}

export interface ActionInput {
  version: number;
  note?: string | null;
}

// ================= AUTHENTICATION & PRINCIPAL =================
export interface Principal {
  accountId: UUID;
  realm: AccountRealm;
  username: string;
  email: string;
  displayName: string;
  customerId: UUID | null;
  employeeId: UUID | null;
  roles: string[];
  permissions: string[];
}

export interface StaffAuthResult {
  accessToken: string;
  expiresIn: number;
  principal: Principal;
}

export interface CustomerAuthResult extends StaffAuthResult {
  refreshToken: string;
}

// ================= PRODUCT CATEGORIES =================
export interface Category extends EntityMetadata {
  code: string;
  name: string;
  description: string | null;
  status: ActiveStatus;
}

export interface CategoryInput {
  name: string;
  description: string | null;
  status: ActiveStatus;
}

// ================= BRANDS =================
export interface Brand extends EntityMetadata {
  code: string;
  name: string;
  description: string | null;
  status: ActiveStatus;
}

export interface BrandInput {
  name: string;
  description: string | null;
  status: ActiveStatus;
}

// ================= PRODUCTS & VARIANTS =================
export interface Product extends EntityMetadata {
  code: string;
  name: string;
  slug: string;
  categoryId: UUID;
  brandId: UUID;
  description: string | null;
  ingredients: string | null;
  benefits: string | null;
  isFeatured: boolean;
  status: ActiveStatus;
}

export interface ProductInput {
  name: string;
  slug: string;
  categoryId: UUID;
  brandId: UUID;
  description: string | null;
  ingredients: string | null;
  benefits: string | null;
  isFeatured: boolean;
  status: ActiveStatus;
}

export interface ProductVariant extends EntityMetadata {
  productId: UUID;
  sku: string;
  name: string;
  color: string | null;
  volumeMl: number | null;
  weightGrams: number | null;
  salePrice: Money;
  referenceCostPrice: Money | null;
  stockQuantity: number;
  lowStockThreshold: number;
  status: ActiveStatus;
}

export interface VariantInput {
  sku: string;
  name: string;
  color: string | null;
  volumeMl: number | null;
  weightGrams: number | null;
  salePrice: Money;
  referenceCostPrice: Money | null;
  lowStockThreshold: number;
  status: ActiveStatus;
}

export interface ProductImage extends EntityMetadata {
  productId: UUID;
  variantId: UUID | null;
  mediaId: UUID;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface ProductImageInput {
  mediaId: UUID;
  variantId: UUID | null;
  altText: string | null;
  sortOrder: number;
}

export interface MediaAsset {
  id: UUID;
  url: string;
  mimeType: string;
  size: number;
  originalName: string;
}

// Public storefront views
export interface PublicProductVariant {
  id: UUID;
  productId: UUID;
  sku: string;
  name: string;
  color: string | null;
  volumeMl: number | null;
  weightGrams: number | null;
  salePrice: Money;
  stockQuantity: number;
  status: ActiveStatus;
}

export interface PublicProductSummary {
  id: UUID;
  code: string;
  name: string;
  slug: string;
  categoryId: UUID;
  categoryName: string;
  brandId: UUID;
  brandName: string;
  thumbnailUrl: string | null;
  priceFrom: Money | null;
  isFeatured: boolean;
}

export interface PublicProductDetail extends PublicProductSummary {
  description: string | null;
  ingredients: string | null;
  benefits: string | null;
  variants: PublicProductVariant[];
  images: ProductImage[];
}

export interface ProductFilterQuery extends ListQuery {
  categoryId?: UUID;
  brandId?: UUID;
  minPrice?: Money;
  maxPrice?: Money;
  isFeatured?: boolean;
  inStock?: boolean;
}

// ================= CUSTOMERS & ADDRESSES =================
export interface Customer extends EntityMetadata {
  code: string;
  accountId: UUID;
  fullName: string;
  phone: string;
  email: string;
  status: ActiveStatus;
  accountStatus: AccountStatus;
}

export interface CustomerProfileUpdateInput {
  fullName: string;
  phone: string;
  version: number;
}

export interface CustomerAddress extends EntityMetadata {
  customerId: UUID;
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  provinceName: string;
  wardName: string;
  isDefault: boolean;
}

export interface CustomerAddressInput {
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  provinceName: string;
  wardName: string;
  isDefault: boolean;
}

export interface CustomerAddressUpdateInput extends CustomerAddressInput {
  version: number;
}

// ================= EMPLOYEES & ACCOUNTS & ROLES =================
export interface Employee extends EntityMetadata {
  code: string;
  accountId: UUID | null;
  fullName: string;
  phone: string;
  email: string;
  position: string;
  status: ActiveStatus;
  roleIds: UUID[];
}

export interface EmployeeInput {
  fullName: string;
  phone: string;
  email: string;
  position: string;
  status: ActiveStatus;
}

export interface EmployeeAccountInput {
  username: string;
  email: string;
  password: string;
}

export interface EmployeeRoleAssignInput {
  roleIds: UUID[];
  version: number;
}

export interface Account extends EntityMetadata {
  realm: AccountRealm;
  username: string;
  email: string;
  status: AccountStatus;
  customerId: UUID | null;
  employeeId: UUID | null;
}

export interface AccountStatusUpdateInput {
  status: AccountStatus;
  version: number;
}

export interface Role extends EntityMetadata {
  code: string;
  name: string;
  description: string;
  permissionIds: UUID[];
}

export interface RolePermissionAssignInput {
  permissionIds: UUID[];
  version: number;
}

export interface Permission {
  id: UUID;
  code: string;
  name: string;
  description: string;
}

// ================= CART, CHECKOUT & QUOTE =================
export interface CartItem {
  id: UUID;
  productId: UUID;
  variantId: UUID;
  productName: string;
  variantName: string;
  sku: string;
  thumbnailUrl: string | null;
  quantity: number;
  unitPrice: Money;
  lineSubtotal: Money;
  stockQuantity: number;
  isAvailable: boolean;
}

export interface Cart {
  id: UUID;
  version: number;
  items: CartItem[];
  totalQuantity: number;
  subtotalAmount: Money;
}

export interface CheckoutItemInput {
  variantId: UUID;
  quantity: number;
}

export interface CheckoutInput {
  items: CheckoutItemInput[];
  addressId: UUID;
  paymentMethod: PaymentMethod;
  voucherCode?: string;
  note?: string;
}

export interface CheckoutQuoteInput extends CheckoutInput {
  orderId?: UUID;
}

export interface OrderAmounts {
  subtotalAmount: Money;
  productDiscountAmount: Money;
  orderDiscountAmount: Money;
  voucherDiscountAmount: Money;
  shippingFee: Money;
  totalAmount: Money;
}

export interface QuotedOrderItem {
  productId: UUID;
  variantId: UUID;
  productName: string;
  variantName: string;
  sku: string;
  thumbnailUrl: string | null;
  quantity: number;
  unitPrice: Money;
  lineSubtotal: Money;
  productDiscountAmount: Money;
  lineTotal: Money;
  productPromotionRuleId: UUID | null;
}

export interface AppliedDiscount {
  scope: DiscountScope;
  promotionId: UUID;
  ruleId: UUID;
  variantId: UUID | null;
  promotionName: string;
  voucherCode: string | null;
  amount: Money;
}

export interface CheckoutQuote {
  quoteToken: string;
  expiresAt: ISODateTime;
  items: QuotedOrderItem[];
  amounts: OrderAmounts;
  discounts: AppliedDiscount[];
}

export interface CreateOrderInput extends CheckoutInput {
  quoteToken: string;
}

export interface UpdatePendingOrderInput extends CreateOrderInput {
  version: number;
}

export interface OrderCancelInput {
  version: number;
  reason: string;
}

// ================= ORDERS, PAYMENTS, REFUNDS =================
export interface OrderItem extends QuotedOrderItem {
  id: UUID;
}

export interface OrderStatusHistory {
  id: UUID;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  performedByName: string | null;
  createdAt: ISODateTime;
}

export interface Payment {
  id: UUID;
  orderId: UUID;
  method: PaymentMethod;
  amount: Money;
  status: PaymentStatus;
  reference: string | null;
  note: string | null;
  paidAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CreateOrderPaymentInput {
  method: PaymentMethod;
  amount: Money;
  reference?: string;
  note?: string;
}

export interface PaymentActionInput {
  reference?: string;
  note?: string;
}

export interface PaymentFailInput {
  note: string;
}

export interface Refund {
  id: UUID;
  orderId: UUID;
  paymentId: UUID;
  amount: Money;
  status: RefundStatus;
  reference: string | null;
  reason: string | null;
  refundedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface OrderSummary {
  id: UUID;
  version: number;
  orderCode: string;
  customerId: UUID;
  customerName: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalAmount: Money;
  paidAmount: Money;
  refundedAmount: Money;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface OrderDetail extends OrderSummary {
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  provinceName: string;
  wardName: string;
  note: string | null;
  amounts: OrderAmounts;
  items: OrderItem[];
  discounts: AppliedDiscount[];
  payments: Payment[];
  refunds: Refund[];
  statusHistory: OrderStatusHistory[];
  confirmedAt: ISODateTime | null;
  shippedAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  cancelledAt: ISODateTime | null;
  cancellationReason: string | null;
}

// ================= INVOICES =================
export interface Invoice extends EntityMetadata {
  invoiceCode: string;
  orderId: UUID;
  orderCode: string;
  employeeId: UUID;
  employeeName: string;
  status: DocumentStatus;
  issuedAt: ISODateTime | null;
  note: string | null;
  totalAmount: Money;
}

export interface InvoiceItem {
  id: UUID;
  productId: UUID;
  variantId: UUID;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface InvoiceDetail extends Invoice {
  items: InvoiceItem[];
}

export interface CreateInvoiceInput {
  note?: string;
}

export interface InvoiceUpdateInput {
  note: string;
  version: number;
}

// ================= SUPPLIERS & GOODS RECEIPTS =================
export interface Supplier extends EntityMetadata {
  code: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  status: ActiveStatus;
}

export interface SupplierInput {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  status: ActiveStatus;
}

export interface SupplierVariant extends EntityMetadata {
  supplierId: UUID;
  variantId: UUID;
  productName: string;
  variantName: string;
  sku: string;
  quotedCostPrice: Money;
  status: ActiveStatus;
}

export interface SupplierVariantInput {
  variantId: UUID;
  quotedCostPrice: Money;
  status: ActiveStatus;
}

export interface GoodsReceiptItem {
  id: UUID;
  productId: UUID;
  variantId: UUID;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitCost: Money;
  lineTotal: Money;
}

export interface GoodsReceipt extends EntityMetadata {
  receiptCode: string;
  supplierId: UUID;
  supplierName: string;
  employeeId: UUID;
  employeeName: string;
  receivedAt: ISODateTime;
  status: DocumentStatus;
  note: string | null;
  totalAmount: Money;
}

export interface GoodsReceiptDetail extends GoodsReceipt {
  items: GoodsReceiptItem[];
}

export interface GoodsReceiptItemInput {
  variantId: UUID;
  quantity: number;
  unitCost: Money;
}

export interface GoodsReceiptInput {
  supplierId: UUID;
  receivedAt: ISODateTime;
  note?: string;
  items: GoodsReceiptItemInput[];
}

// ================= INVENTORY & ADJUSTMENTS =================
export interface InventoryBalance {
  variantId: UUID;
  productId: UUID;
  productName: string;
  variantName: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  updatedAt: ISODateTime;
}

export interface StockMovement {
  id: UUID;
  variantId: UUID;
  sku: string;
  type: StockMovementType;
  quantityDelta: number;
  quantityAfter: number;
  sourceType: string;
  sourceId: UUID;
  performedByName: string | null;
  note: string | null;
  createdAt: ISODateTime;
}

export interface InventoryAdjustmentItem {
  id: UUID;
  variantId: UUID;
  productName: string;
  variantName: string;
  sku: string;
  quantityDelta: number;
}

export interface InventoryAdjustment extends EntityMetadata {
  adjustmentCode: string;
  employeeId: UUID;
  employeeName: string;
  status: DocumentStatus;
  reason: string;
  postedAt: ISODateTime | null;
}

export interface InventoryAdjustmentDetail extends InventoryAdjustment {
  items: InventoryAdjustmentItem[];
}

export interface InventoryAdjustmentItemInput {
  variantId: UUID;
  quantityDelta: number;
}

export interface InventoryAdjustmentInput {
  reason: string;
  items: InventoryAdjustmentItemInput[];
}

// ================= PROMOTIONS & VOUCHERS =================
export interface Promotion extends EntityMetadata {
  code: string;
  name: string;
  description: string | null;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  status: PromotionStatus;
  hasUsage: boolean;
}

export interface PromotionInput {
  name: string;
  description: string | null;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  status: PromotionStatus;
}

export interface ProductPromotionRule extends EntityMetadata {
  promotionId: UUID;
  productId: UUID;
  variantId: UUID | null;
  discountPercent: Percentage;
  minQuantity: number;
  maxDiscountAmount: Money | null;
}

export interface ProductPromotionRuleInput {
  productId: UUID;
  variantId: UUID | null;
  discountPercent: Percentage;
  minQuantity: number;
  maxDiscountAmount: Money | null;
}

export interface OrderPromotionRule extends EntityMetadata {
  promotionId: UUID;
  minOrderAmount: Money;
  discountPercent: Percentage;
  maxDiscountAmount: Money | null;
}

export interface OrderPromotionRuleInput {
  minOrderAmount: Money;
  discountPercent: Percentage;
  maxDiscountAmount: Money | null;
}

export interface Voucher extends EntityMetadata {
  promotionId: UUID;
  code: string;
  discountPercent: Percentage;
  minOrderAmount: Money;
  maxDiscountAmount: Money | null;
  maxUses: number | null;
  usedCount: number;
  reservedCount: number;
  perCustomerLimit: number;
  status: ActiveStatus;
}

export interface VoucherInput {
  code: string;
  discountPercent: Percentage;
  minOrderAmount: Money;
  maxDiscountAmount: Money | null;
  maxUses: number | null;
  perCustomerLimit: number;
  status: ActiveStatus;
}

// ================= REPORTS & DASHBOARD =================
export interface ReportMetric {
  key: string;
  label: string;
  value: string;
  unit: ReportMetricUnit;
}

export interface ReportSeriesPoint {
  period: string;
  value: string;
}

export interface ReportSeries {
  key: string;
  name: string;
  unit: ReportMetricUnit;
  points: ReportSeriesPoint[];
}

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportColumnType;
}

export interface ReportRow {
  key: string;
  values: Record<string, string | number | null>;
  sourceType: ReportSourceType | null;
  sourceId: UUID | null;
}

export interface ReportData {
  metrics: ReportMetric[];
  series: ReportSeries[];
  columns: ReportColumn[];
  rows: ReportRow[];
  meta: PaginationMeta;
}

export interface ReportFilterQuery {
  from?: ISODateTime;
  to?: ISODateTime;
  compareFrom?: ISODateTime;
  compareTo?: ISODateTime;
  productId?: UUID;
  variantId?: UUID;
  categoryId?: UUID;
  employeeId?: UUID;
  supplierId?: UUID;
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  page?: number;
  limit?: number;
}
