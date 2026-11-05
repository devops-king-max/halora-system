/**
 * Deterministic, explainable arithmetic used by the insights endpoints.
 * Kept free of NestJS/PostgreSQL imports so it can be unit-tested in isolation.
 */

/** Cover target used when the caller does not supply one (documented constant). */
export const DEFAULT_TARGET_COVER_DAYS = 30;
/** Cover below which the admin screen highlights the variant even above the low-stock threshold. */
export const LOW_COVER_ALERT_DAYS = 14;
/** Sales windows (in days) used for the two velocity figures. */
export const SALES_WINDOW_DAYS = { short: 30, long: 90 } as const;

export const DEFAULT_RECOMMENDATIONS = 8;
export const MAX_RECOMMENDATIONS = 20;
export const DEFAULT_RESTOCK_ROWS = 50;
export const MAX_RESTOCK_ROWS = 200;

export type RecommendationReason = "CO_PURCHASE" | "CATEGORY" | "POPULAR";

export function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Units sold per day for a window. Negative or invalid input is treated as no sales. */
export function dailySalesRate(unitsSold: number, windowDays: number): number {
  if (!Number.isFinite(unitsSold) || !Number.isFinite(windowDays) || windowDays <= 0) return 0;
  return Math.max(0, unitsSold) / windowDays;
}

/** Stock divided by velocity. Returns null when there is no velocity (infinite cover). */
export function daysOfCover(stockQuantity: number, rate: number): number | null {
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return Math.max(0, stockQuantity) / rate;
}

/**
 * Quantity needed to reach the target cover at the current velocity.
 * Never returns a negative number; rounds up to a whole unit.
 */
export function suggestedOrderQuantity(stockQuantity: number, rate: number, targetCoverDays: number): number {
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(targetCoverDays) || targetCoverDays <= 0) return 0;
  return Math.max(0, Math.ceil(targetCoverDays * rate - Math.max(0, stockQuantity)));
}

export function isLowStock(stockQuantity: number, lowStockThreshold: number): boolean {
  return stockQuantity <= lowStockThreshold;
}
