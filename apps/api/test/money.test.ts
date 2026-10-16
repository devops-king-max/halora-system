import { discount } from '../src/commerce/pricing.service';
describe('VND arithmetic',()=>{
  it('applies sequential discounts with exact integer rounding',()=>{
    const product=discount(200000n,'10.00',null);
    const order=discount(200000n-product,'5.00',null);
    const voucher=discount(200000n-product-order,'10.00',null);
    expect([product,order,voucher]).toEqual([20000n,9000n,17100n]);
    expect(200000n-product-order-voucher+30000n).toBe(183900n);
  });
  it('respects caps and avoids floating point precision loss',()=>{
    expect(discount(999999999999999999n,'99.99','20000')).toBe(20000n);
    expect(discount(101n,'10.25',null)).toBe(10n);
    expect(discount(101n,'100.00',null)).toBe(101n);
  });
});
