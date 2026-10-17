import { Inject, Injectable } from '@nestjs/common';
import { Database, Row } from '../core/db';
import { Context, Routes } from '../core/registry';
import { assert, version } from '../core/errors';
import { PricingService, PricingResult, money } from './pricing.service';
import { CustomerService } from './customer.service';
import { CatalogService } from '../catalog/catalog.service';
import { StockService } from '../inventory/stock.service';

@Injectable()
export class OrdersService {
  constructor(@Inject(Database) private readonly db:Database,@Inject(PricingService) private readonly pricing:PricingService,@Inject(CustomerService) private readonly customers:CustomerService,@Inject(CatalogService) private readonly catalog:CatalogService,@Inject(StockService) private readonly stock:StockService){}
  async detail(id:unknown,customerId?:unknown):Promise<Row>{
    const order=await this.db.one(`SELECT * FROM api_orders WHERE id=$1${customerId?' AND customer_id=$2':''}`,[id,...(customerId?[customerId]:[])]);
    const amounts=Object.fromEntries(['subtotalAmount','productDiscountAmount','orderDiscountAmount','voucherDiscountAmount','shippingFee','totalAmount'].map(k=>[k,order[k]]));
    const items=await this.db.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY variant_id',[id]);
    const discounts=await this.db.query('SELECT scope,promotion_id,rule_id,variant_id,promotion_name,voucher_code,amount FROM api_discounts WHERE order_id=$1 ORDER BY scope,rule_id',[id]);
    const payments=await this.db.query('SELECT id,order_id,method,amount,status,reference,note,paid_at,created_at,updated_at FROM payments WHERE order_id=$1 ORDER BY created_at,id',[id]);
    const refunds=await this.db.query('SELECT * FROM refunds WHERE order_id=$1 ORDER BY created_at,id',[id]);
    const statusHistory=await this.db.query('SELECT id,from_status,to_status,note,performed_by_name,created_at FROM order_status_history WHERE order_id=$1 ORDER BY created_at,id',[id]);
    return {...order,amounts,items,discounts,payments,refunds,statusHistory};
  }
  private async history(c:Context,orderId:unknown,from:unknown,to:string,note:unknown):Promise<void>{
    await this.db.insert('order_status_history',{orderId,fromStatus:from||null,toStatus:to,note:note||null,accountId:c.actor.accountId,performedByName:c.actor.displayName});
    await this.db.audit(c.actor,to,'orders',orderId,c.req.get('x-request-id'));
  }
  private async replaceLines(orderId:unknown,result:PricingResult):Promise<void>{
    await this.db.query('DELETE FROM order_discounts WHERE order_id=$1',[orderId]);
    await this.db.query('DELETE FROM order_items WHERE order_id=$1',[orderId]);
    for(const item of result.items) await this.db.insert('order_items',{...item,orderId});
    for(const d of result.discounts){
      const {ruleId,...fields}=d;
      await this.db.insert('order_discounts',{...fields,orderId,[d.scope==='PRODUCT'?'productRuleId':d.scope==='ORDER'?'orderRuleId':'voucherId']:ruleId});
    }
    await this.db.query("UPDATE voucher_redemptions SET status='RELEASED' WHERE order_id=$1 AND status='HELD'",[orderId]);
    if(result.voucher) await this.db.query("INSERT INTO voucher_redemptions(voucher_id,order_id,customer_id,status) SELECT $1,$2,customer_id,'HELD' FROM orders WHERE id=$2 ON CONFLICT(voucher_id,order_id) DO UPDATE SET status='HELD'",[result.voucher.id,orderId]);
  }
  private async save(c:Context,create:boolean):Promise<Row>{
    const cart=await this.customers.cart(c.actor.customerId,true);
    let old:Row|undefined;
    if(!create){
      old=await this.db.one<Row>('SELECT * FROM orders WHERE id=$1 AND customer_id=$2 FOR UPDATE',[c.params.id,c.actor.customerId]);version(old,c.body.version);
      assert(old.status==='PENDING_CONFIRMATION','INVALID_STATE','Chỉ sửa đơn chờ xác nhận.');
      const paid=await this.db.one('SELECT paid_amount FROM api_orders WHERE id=$1',[old.id]);
      assert(money(paid.paidAmount)===0n,'INVALID_STATE','Không sửa đơn đã thu tiền.');
    }
    const result=await this.pricing.calculate(c,old?String(old.id):undefined);
    this.pricing.verify(c,result,old?String(old.id):undefined);
    const customer=await this.db.one('SELECT full_name FROM customers WHERE id=$1',[c.actor.customerId]);
    const {recipientName,recipientPhone,addressLine,provinceName,wardName}=result.address;
    const header={customerId:c.actor.customerId,customerName:customer.fullName,paymentMethod:c.body.paymentMethod,recipientName,recipientPhone,addressLine,provinceName,wardName,note:c.body.note||null,...result.amounts};
    const order=create?await this.db.insert('orders',header):await this.db.update('orders',old!.id,header);
    await this.replaceLines(order.id,result);
    if(create){
      for(const item of result.items){
        await this.db.query('DELETE FROM cart_items WHERE cart_id=$1 AND variant_id=$2 AND quantity<=$3',[cart.id,item.variantId,item.quantity]);
        await this.db.query('UPDATE cart_items SET quantity=quantity-$3 WHERE cart_id=$1 AND variant_id=$2 AND quantity>$3',[cart.id,item.variantId,item.quantity]);
      }
      await this.db.query('UPDATE carts SET customer_id=customer_id WHERE id=$1',[cart.id]);
      await this.history(c,order.id,null,'PENDING_CONFIRMATION',c.body.note);
    }else{
      await this.db.query("UPDATE payments SET status='CANCELLED',updated_at=clock_timestamp() WHERE order_id=$1 AND status='PENDING'",[order.id]);
      await this.db.audit(c.actor,'UPDATE','orders',order.id);
    }
    return this.detail(order.id,c.actor.customerId);
  }
  private async transition(c:Context,action:string,customer=false):Promise<Row>{
    const order=await this.db.one(`SELECT * FROM orders WHERE id=$1${customer?' AND customer_id=$2':''} FOR UPDATE`,[c.params.id,...(customer?[c.actor.customerId]:[])]);
    version(order,c.body.version);
    let next:string;
    if(action==='confirm'){
      assert(order.status==='PENDING_CONFIRMATION','INVALID_STATE','Đơn không ở trạng thái chờ xác nhận.');
      await this.db.query('SELECT id FROM vouchers WHERE id IN (SELECT voucher_id FROM voucher_redemptions WHERE order_id=$1) ORDER BY id FOR UPDATE',[order.id]);
      await this.db.query("UPDATE voucher_redemptions SET status='USED' WHERE order_id=$1 AND status='HELD'",[order.id]);
      const items=await this.db.query('SELECT variant_id,quantity FROM order_items WHERE order_id=$1 ORDER BY variant_id',[order.id]);
      await this.stock.apply(c.actor,items.map(i=>({variantId:String(i.variantId),quantityDelta:-Number(i.quantity)})),'SALE','ORDER',order.id,c.body.note);
      await this.db.query('UPDATE orders SET confirmed_at=clock_timestamp() WHERE id=$1',[order.id]);next='CONFIRMED';
    }else if(action==='dispatch'){
      assert(order.status==='CONFIRMED','INVALID_STATE','Chỉ giao đơn đã xác nhận.');
      await this.db.query('UPDATE orders SET shipped_at=clock_timestamp() WHERE id=$1',[order.id]);next='SHIPPING';
    }else if(action==='complete'){
      assert(order.status==='SHIPPING','INVALID_STATE','Chỉ hoàn tất đơn đang giao.');
      const balance=await this.db.one('SELECT paid_amount,total_amount FROM api_orders WHERE id=$1',[order.id]);
      assert(money(balance.paidAmount)===money(balance.totalAmount),'INVALID_STATE','Đơn phải được thu đủ tiền trước khi hoàn tất.');
      await this.db.query('UPDATE orders SET completed_at=clock_timestamp() WHERE id=$1',[order.id]);
      next='COMPLETED';
    }else{
      assert(customer?order.status==='PENDING_CONFIRMATION':['PENDING_CONFIRMATION','CONFIRMED'].includes(String(order.status)),'INVALID_STATE','Đơn không còn được hủy.');
      await this.db.query('SELECT id FROM vouchers WHERE id IN (SELECT voucher_id FROM voucher_redemptions WHERE order_id=$1) ORDER BY id FOR UPDATE',[order.id]);
      if(order.status==='CONFIRMED'){
        const items=await this.db.query('SELECT variant_id,quantity FROM order_items WHERE order_id=$1 ORDER BY variant_id',[order.id]);
        await this.stock.apply(c.actor,items.map(i=>({variantId:String(i.variantId),quantityDelta:Number(i.quantity)})),'CANCELLATION','ORDER_CANCEL',order.id,c.body.reason);
      }
      await this.db.query("UPDATE voucher_redemptions SET status='RELEASED' WHERE order_id=$1 AND status IN ('HELD','USED')",[order.id]);
      await this.db.query("UPDATE payments SET status='CANCELLED',updated_at=clock_timestamp() WHERE order_id=$1 AND status='PENDING'",[order.id]);
      await this.db.query("INSERT INTO refunds(order_id,payment_id,amount,reason) SELECT order_id,id,amount,$2 FROM payments WHERE order_id=$1 AND status='SUCCEEDED' ON CONFLICT(payment_id) DO NOTHING",[order.id,c.body.reason]);
      await this.db.query('UPDATE orders SET cancelled_at=clock_timestamp(),cancellation_reason=$2 WHERE id=$1',[order.id,c.body.reason]);next='CANCELLED';
    }
    await this.db.query('UPDATE orders SET status=$2 WHERE id=$1',[order.id,next]);
    await this.history(c,order.id,order.status,next,c.body.reason||c.body.note);
    return this.detail(order.id,customer?c.actor.customerId:undefined);
  }
  private async payment(c:Context,refund:boolean,confirm:boolean):Promise<Row>{
    const table=refund?'refunds':'payments';
    const source=await this.db.one(`SELECT order_id FROM ${table} WHERE id=$1`,[c.params.id]);
    const order=await this.db.one('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[source.orderId]);
    const row=await this.db.one(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[c.params.id]);
    if(confirm&&row.status==='SUCCEEDED') return row;
    assert(row.status==='PENDING'||(refund&&confirm&&row.status==='FAILED'),'INVALID_STATE','Giao dịch không còn ở trạng thái được xử lý.');
    if(confirm){
      if(refund){
        assert(order.status==='CANCELLED','INVALID_STATE','Chỉ hoàn khoản thu của đơn đã hủy.');
        const payment=await this.db.one("SELECT * FROM payments WHERE id=$1 AND status='SUCCEEDED'",[row.paymentId]);
        assert(money(row.amount)<=money(payment.amount),'PAYMENT_AMOUNT_EXCEEDED','Số tiền hoàn vượt số tiền đã thu.');
      }else{
        assert(!['CANCELLED','COMPLETED'].includes(String(order.status)),'INVALID_STATE','Đơn không thể thu thêm tiền.');
        const total=await this.db.one('SELECT paid_amount FROM api_orders WHERE id=$1',[order.id]);
        assert(money(total.paidAmount)+money(row.amount)<=money(order.totalAmount),'PAYMENT_AMOUNT_EXCEEDED','Số tiền thu vượt số còn phải trả.');
      }
    }
    const updated=await this.db.one(`UPDATE ${table} SET status=$2,reference=COALESCE(NULLIF(trim($3),''),reference),${refund?'reason':'note'}=COALESCE($4,${refund?'reason':'note'}),${refund?'refunded_at':'paid_at'}=CASE WHEN $2='SUCCEEDED' THEN clock_timestamp() ELSE NULL END,updated_at=clock_timestamp() WHERE id=$1 RETURNING *`,[row.id,confirm?'SUCCEEDED':'FAILED',c.body.reference||null,c.body.note||null]);
    await this.db.query('UPDATE orders SET note=note WHERE id=$1',[order.id]);
    await this.db.audit(c.actor,confirm?'CONFIRM':'FAIL',table,row.id);
    return updated;
  }
  registerRoutes(routes:Routes):void{
    routes.add('POST','/me/checkout/quote',{customer:true},c=>this.pricing.quote(c));
    routes.add('POST','/me/orders',{customer:true},c=>this.save(c,true));
    routes.add('PATCH','/me/orders/{id}',{customer:true},c=>this.save(c,false));
    routes.add('GET','/me/orders',{customer:true},c=>this.catalog.list('api_orders',c,['orderCode','recipientPhone'],['status'],['customer_id=$1'],[c.actor.customerId]));
    routes.add('GET','/me/orders/{id}',{customer:true},c=>this.detail(c.params.id,c.actor.customerId));
    routes.add('POST','/me/orders/{id}/cancel',{customer:true},c=>this.transition(c,'cancel',true));
    routes.add('GET','/admin/orders',{permission:'orders.read'},c=>this.catalog.list('api_orders',c,['orderCode','customerName','recipientPhone'],['status','paymentMethod']));
    routes.add('GET','/admin/orders/{id}',{permission:'orders.read'},c=>this.detail(c.params.id));
    routes.add('GET','/admin/customers/{id}/orders',{permission:'customers.read'},async c=>{
      await this.db.one('SELECT id FROM customers WHERE id=$1',[c.params.id]);
      return this.catalog.list('api_orders',c,['orderCode'],['status'],['customer_id=$1'],[c.params.id]);
    });
    for(const action of ['confirm','dispatch','complete','cancel']) routes.add('POST',`/admin/orders/{id}/${action}`,{permission:`orders.${action}`},c=>this.transition(c,action));
    routes.add('POST','/admin/orders/{id}/payments',{permission:'payments.create'},async c=>{
      const order=await this.db.one('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[c.params.id]);
      assert(!['CANCELLED','COMPLETED'].includes(String(order.status)),'INVALID_STATE','Đơn không thể tạo khoản thu.');
      const balance=await this.db.one('SELECT paid_amount FROM api_orders WHERE id=$1',[order.id]);
      assert(money(c.body.amount)>0n&&money(c.body.amount)+money(balance.paidAmount)<=money(order.totalAmount),'PAYMENT_AMOUNT_EXCEEDED','Số tiền thu không hợp lệ.');
      const payment=await this.db.insert('payments',{orderId:order.id,method:c.body.method,amount:c.body.amount,reference:c.body.reference?String(c.body.reference).trim()||null:null,note:c.body.note||null,createdBy:c.actor.accountId});
      await this.db.audit(c.actor,'CREATE','payments',payment.id);
      return payment;
    });
    for(const refund of [false,true]) for(const action of ['confirm','fail']) routes.add('POST',`/admin/${refund?'refunds':'payments'}/{id}/${action}`,{permission:`${refund?'refunds':'payments'}.${action}`},c=>this.payment(c,refund,action==='confirm'));
  }
}
