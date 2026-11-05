import {
  DEFAULT_TARGET_COVER_DAYS,
  MAX_RECOMMENDATIONS,
  clampInteger,
  dailySalesRate,
  daysOfCover,
  isLowStock,
  roundTo,
  suggestedOrderQuantity,
} from '../src/insights/insights.math';

describe('insights math (deterministic restock and recommendation helpers)', () => {
  it('computes daily sales velocity from a sold-units window', () => {
    expect(dailySalesRate(90, 30)).toBe(3);
    expect(dailySalesRate(0, 90)).toBe(0);
    expect(dailySalesRate(45, 90)).toBe(0.5);
    expect(dailySalesRate(-5, 30)).toBe(0);
    expect(dailySalesRate(10, 0)).toBe(0);
  });

  it('computes days of cover and treats zero velocity as unknown', () => {
    expect(daysOfCover(30, 3)).toBe(10);
    expect(daysOfCover(0, 3)).toBe(0);
    expect(daysOfCover(120, 0)).toBeNull();
    expect(daysOfCover(120, -1)).toBeNull();
    expect(daysOfCover(-10, 2)).toBe(0);
  });

  it('suggests a non-negative whole-unit order to reach the cover target', () => {
    expect(suggestedOrderQuantity(10, 2, 30)).toBe(50);
    expect(suggestedOrderQuantity(60, 2, 30)).toBe(0);
    expect(suggestedOrderQuantity(5, 0.5, 30)).toBe(10);
    expect(suggestedOrderQuantity(5, 0.333, 30)).toBe(5);
    expect(suggestedOrderQuantity(100, 0, 30)).toBe(0);
    expect(suggestedOrderQuantity(10, 2, 0)).toBe(0);
    expect(suggestedOrderQuantity(10, 2, DEFAULT_TARGET_COVER_DAYS)).toBe(50);
  });

  it('flags low stock only at or below the configured threshold', () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(4, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
  });

  it('clamps integer query parameters into a safe range', () => {
    expect(clampInteger(undefined, 8, 1, MAX_RECOMMENDATIONS)).toBe(8);
    expect(clampInteger('12', 8, 1, 20)).toBe(12);
    expect(clampInteger(0, 8, 1, 20)).toBe(1);
    expect(clampInteger(999, 8, 1, 20)).toBe(20);
    expect(clampInteger(7.9, 8, 1, 20)).toBe(7);
    expect(clampInteger('not-a-number', 30, 1, 365)).toBe(30);
  });

  it('rounds for display without changing the underlying math', () => {
    expect(roundTo(1.23456, 3)).toBe(1.235);
    expect(roundTo(2.25, 1)).toBe(2.3);
    expect(roundTo(10, 1)).toBe(10);
  });
});
