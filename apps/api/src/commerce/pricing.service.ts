import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Database, Row } from '../core/db';
import { assert, fail } from '../core/errors';
import { secret, settings } from '../core/config';
import type { Context } from '../core/registry';

export const money=(value:unknown):bigint=>BigInt(String(value));
export const digest=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function discount(base:bigint,percent:unknown,cap:unknown):bigint{
  const [whole,fraction='']=String(percent).split('.');
  const rate=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  let amount=base*rate/10000n;
  if(cap!==null&&cap!==undefined&&amount>money(cap)) amount=money(cap);
  return amount>base?base:amount;
}
export interface PricingResult { items:Row[]; amounts:Record<string,string>; discounts:Row[]; address:Row; voucher:Row|null; }
@Injectable()
export class PricingService {
  private readonly quoteSecret=secret('QUOTE_SECRET');
  constructor(@Inject(Database) private readonly db:Database){}
  inputHash(body:Row):string{
    const items=[...(body.items as {variantId:string;quantity:number}[])].sort((a,b)=>a.variantId.localeCompare(b.variantId));
    return digest({items,addressId:body.addressId,paymentMethod:body.paymentMethod,voucherCode:body.voucherCode?String(body.voucherCode).trim().toUpperCase():null});
  }
  private quoteHash(result:PricingResult):string{return digest({items:result.items,amounts:result.amounts,discounts:result.discounts,address:result.address});}
  async calculate(c:Context,editingOrderId?:string):Promise<PricingResult>{
    const input=c.body.items as {variantId:string;quantity:number}[];
    assert(Array.isArray(input)&&input.length>0&&input.length<=100,'VALIDATION_ERROR','Đơn hàng phải có từ 1 đến 100 biến thể.',400);
    assert(new Set(input.map(i=>i.variantId)).size===input.length,'VALIDATION_ERROR','Một biến thể chỉ xuất hiện một lần trong đơn.',400);
    const address=await this.db.one('SELECT * FROM customer_addresses WHERE id=$1 AND customer_id=$2',[c.body.addressId,c.actor.customerId]);
    // Lock pricing inputs and promotions against configuration edits until the order commits.
    const ids=input.map(i=>i.variantId).sort();
    await this.db.query('SELECT id FROM product_variants WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',[ids]);
    const active=await this.db.query("SELECT * FROM promotions WHERE status='ACTIVE' AND starts_at<=now() AND ends_at>=now() ORDER BY id FOR SHARE");
    const promotionIds=active.map(p=>String(p.id));
    const productRules=await this.db.query('SELECT r.*,p.name AS promotion_name FROM product_promotion_rules r JOIN promotions p ON p.id=r.promotion_id WHERE p.id=ANY($1::uuid[]) ORDER BY r.id',[promotionIds]);
    const orderRules=await this.db.query('SELECT r.*,p.name AS promotion_name FROM order_promotion_rules r JOIN promotions p ON p.id=r.promotion_id WHERE p.id=ANY($1::uuid[]) ORDER BY r.id',[promotionIds]);
    const items:Row[]=[],discounts:Row[]=[];
    let subtotal=0n,productTotal=0n;
    for(const selected of [...input].sort((a,b)=>a.variantId.localeCompare(b.variantId))){
      assert(Number.isInteger(selected.quantity)&&selected.quantity>0&&selected.quantity<=1000000,'VALIDATION_ERROR','Số lượng không hợp lệ.',400);
      const v=await this.db.one(`SELECT v.*,p.name AS product_name,p.status AS product_status,b.stock_quantity,
        (SELECT i.url FROM api_images i WHERE i.product_id=p.id AND (i.variant_id IS NULL OR i.variant_id=v.id) ORDER BY (i.variant_id=v.id) DESC NULLS LAST,i.sort_order,i.id LIMIT 1) AS thumbnail_url
        FROM product_variants v JOIN products p ON p.id=v.product_id JOIN api_public_products pub ON pub.id=p.id JOIN inventory_balances b ON b.variant_id=v.id WHERE v.id=$1`,[selected.variantId]);
      assert(v.status==='ACTIVE'&&v.productStatus==='ACTIVE','INVALID_STATE','Biến thể đã ngừng bán.');
      assert(Number(v.stockQuantity)>=selected.quantity,'INSUFFICIENT_STOCK','Không đủ tồn kho cho biến thể đã chọn.');
      const base=money(v.salePrice)*BigInt(selected.quantity);
      let best:Row|null=null,bestAmount=0n;
      for(const r of productRules){
        if(r.productId!==v.productId||(r.variantId!==null&&r.variantId!==v.id)||selected.quantity<Number(r.minQuantity))continue;
        const amount=discount(base,r.discountPercent,r.maxDiscountAmount);
        if(amount>bestAmount){best=r;bestAmount=amount;}
      }
      items.push({productId:v.productId,variantId:v.id,productName:v.productName,variantName:v.name,sku:v.sku,thumbnailUrl:v.thumbnailUrl,quantity:selected.quantity,unitPrice:v.salePrice,lineSubtotal:base.toString(),productDiscountAmount:bestAmount.toString(),lineTotal:(base-bestAmount).toString(),productPromotionRuleId:best?.id||null});
      if(best) discounts.push({scope:'PRODUCT',promotionId:best.promotionId,ruleId:best.id,variantId:v.id,promotionName:best.promotionName,voucherCode:null,amount:bestAmount.toString()});
      subtotal+=base;productTotal+=bestAmount;
    }
    let remaining=subtotal-productTotal,orderAmount=0n;
    let bestOrder:Row|null=null;
    for(const r of orderRules) if(remaining>=money(r.minOrderAmount)){
      const amount=discount(remaining,r.discountPercent,r.maxDiscountAmount);
      if(amount>orderAmount){bestOrder=r;orderAmount=amount;}
    }
    if(bestOrder) discounts.push({scope:'ORDER',promotionId:bestOrder.promotionId,ruleId:bestOrder.id,variantId:null,promotionName:bestOrder.promotionName,voucherCode:null,amount:orderAmount.toString()});
    remaining-=orderAmount;
    let voucher:Row|null=null,voucherAmount=0n;
    if(c.body.voucherCode){
      const found=await this.db.query('SELECT v.*,p.name AS promotion_name FROM vouchers v JOIN promotions p ON p.id=v.promotion_id WHERE lower(trim(v.code))=lower(trim($1)) FOR UPDATE OF v',[c.body.voucherCode]);
      voucher=found[0]||null;
      assert(voucher&&voucher.status==='ACTIVE'&&promotionIds.includes(String(voucher.promotionId))&&remaining>=money(voucher.minOrderAmount),'VOUCHER_INVALID','Voucher không hợp lệ hoặc chưa đủ điều kiện.');
      const usage=await this.db.one("SELECT count(*)::integer AS total,count(*) FILTER(WHERE customer_id=$2)::integer AS customer FROM voucher_redemptions WHERE voucher_id=$1 AND status IN ('HELD','USED') AND ($3::uuid IS NULL OR order_id<>$3::uuid)",[voucher.id,c.actor.customerId,editingOrderId||null]);
      assert((voucher.maxUses===null||Number(usage.total)<Number(voucher.maxUses))&&Number(usage.customer)<Number(voucher.perCustomerLimit),'VOUCHER_LIMIT_REACHED','Voucher đã hết lượt hoặc vượt giới hạn của khách hàng.');
      voucherAmount=discount(remaining,voucher.discountPercent,voucher.maxDiscountAmount);
      discounts.push({scope:'VOUCHER',promotionId:voucher.promotionId,ruleId:voucher.id,variantId:null,promotionName:voucher.promotionName,voucherCode:voucher.code,amount:voucherAmount.toString()});
    }
    const shipping=money(settings.shippingFee);
    const amounts={subtotalAmount:subtotal.toString(),productDiscountAmount:productTotal.toString(),orderDiscountAmount:orderAmount.toString(),voucherDiscountAmount:voucherAmount.toString(),shippingFee:shipping.toString(),totalAmount:(remaining-voucherAmount+shipping).toString()};
    assert(Object.values(amounts).every(a=>money(a)<=999999999999999999n),'VALIDATION_ERROR','Giá trị đơn vượt giới hạn.',400);
    return {items,amounts,discounts,address,voucher};
  }
  async quote(c:Context):Promise<Row>{
    let orderId:string|undefined;
    if(c.body.orderId){
      const order=await this.db.one('SELECT * FROM orders WHERE id=$1 AND customer_id=$2',[c.body.orderId,c.actor.customerId]);
      assert(order.status==='PENDING_CONFIRMATION','INVALID_STATE','Đơn không còn được sửa.');orderId=String(order.id);
    }
    const result=await this.calculate(c,orderId);
    const quoteToken=jwt.sign({customerId:c.actor.customerId,inputHash:this.inputHash(c.body),quoteHash:this.quoteHash(result),orderId:orderId||null},this.quoteSecret,{expiresIn:300,issuer:'halora',audience:'halora-quote',algorithm:'HS256'});
    return {quoteToken,expiresAt:new Date(Date.now()+300000).toISOString(),items:result.items,amounts:result.amounts,discounts:result.discounts};
  }
  verify(c:Context,result:PricingResult,orderId?:string):void{
    let token:JwtPayload;
    try{token=jwt.verify(String(c.body.quoteToken),this.quoteSecret,{algorithms:['HS256'],issuer:'halora',audience:'halora-quote'}) as JwtPayload;}
    catch{fail('QUOTE_EXPIRED','Báo giá đã hết hạn hoặc không hợp lệ. Vui lòng lấy báo giá mới.');}
    assert(token.customerId===c.actor.customerId&&token.orderId===(orderId||null)&&token.inputHash===this.inputHash(c.body)&&token.quoteHash===this.quoteHash(result),'QUOTE_CHANGED','Thông tin hoặc giá đã thay đổi. Vui lòng lấy báo giá và xác nhận lại.');
  }
}
