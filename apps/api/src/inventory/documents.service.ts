import { Inject, Injectable } from '@nestjs/common';
import { Database, Row, ident } from '../core/db';
import { Context, Routes } from '../core/registry';
import { assert, version } from '../core/errors';
import { CatalogService } from '../catalog/catalog.service';
import { StockService } from './stock.service';
import { money } from '../commerce/pricing.service';

@Injectable()
export class DocumentsService {
  constructor(@Inject(Database) private readonly db:Database,@Inject(CatalogService) private readonly catalog:CatalogService,@Inject(StockService) private readonly stock:StockService){}
  async detail(kind:string,id:unknown):Promise<Row>{
    const table=kind==='receipt'?'goods_receipts':kind==='invoice'?'invoices':'inventory_adjustments';
    const lines=kind==='receipt'?'goods_receipt_items':kind==='invoice'?'invoice_items':'inventory_adjustment_items';
    const fk=kind==='receipt'?'receipt_id':kind==='invoice'?'invoice_id':'adjustment_id';
    const document=await this.db.one(`SELECT * FROM ${ident(table)} WHERE id=$1`,[id]);
    const items=await this.db.query(`SELECT * FROM ${ident(lines)} WHERE ${ident(fk)}=$1 ORDER BY id`,[id]);
    return {...document,items};
  }
  private async save(c:Context,kind:'receipt'|'adjustment',create:boolean):Promise<Row>{
    const table=kind==='receipt'?'goods_receipts':'inventory_adjustments';
    let old:Row|undefined;
    if(!create){old=await this.db.one<Row>(`SELECT * FROM ${ident(table)} WHERE id=$1 FOR UPDATE`,[c.params.id]);version(old,c.body.version);assert(old.status==='DRAFT','INVALID_STATE','Chỉ sửa chứng từ đang soạn.');}
    const input=c.body.items as Row[];
    assert(input.length>0&&input.length<=100&&new Set(input.map(i=>i.variantId)).size===input.length,'VALIDATION_ERROR','Chứng từ cần 1–100 biến thể không trùng.',400);
    const employee=await this.db.one("SELECT * FROM employees WHERE id=$1 AND status='ACTIVE'",[c.actor.employeeId]);
    let supplier:Row|undefined;
    if(kind==='receipt') supplier=await this.db.one<Row>("SELECT * FROM suppliers WHERE id=$1 AND status='ACTIVE'",[c.body.supplierId]);
    const items:Row[]=[];
    let total=0n;
    for(const item of input){
      const v=await this.db.one('SELECT v.*,p.name AS product_name FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=$1',[item.variantId]);
      if(kind==='receipt'){
        const link=await this.db.query("SELECT id FROM supplier_variants WHERE supplier_id=$1 AND variant_id=$2 AND status='ACTIVE'",[supplier!.id,v.id]);
        assert(link.length===1,'VALIDATION_ERROR','Biến thể chưa được liên kết cung ứng với nhà cung cấp đã chọn.',400);
        const line=BigInt(Number(item.quantity))*money(item.unitCost);total+=line;
        items.push({productId:v.productId,variantId:v.id,productName:v.productName,variantName:v.name,sku:v.sku,quantity:item.quantity,unitCost:item.unitCost,lineTotal:line.toString(),supplierId:supplier!.id});
      }else{
        assert(Number.isInteger(item.quantityDelta)&&Number(item.quantityDelta)!==0&&Math.abs(Number(item.quantityDelta))<=1000000,'VALIDATION_ERROR','Số lượng điều chỉnh phải là số nguyên khác 0, tối đa 1.000.000.',400);
        items.push({variantId:v.id,productName:v.productName,variantName:v.name,sku:v.sku,quantityDelta:item.quantityDelta});
      }
    }
    assert(total<=999999999999999999n,'VALIDATION_ERROR','Giá trị chứng từ vượt giới hạn.',400);
    const header:Row=kind==='receipt'?{supplierId:supplier!.id,supplierName:supplier!.name,receivedAt:c.body.receivedAt,note:c.body.note||null,totalAmount:total.toString()}:{reason:c.body.reason};
    const lines=kind==='receipt'?'goods_receipt_items':'inventory_adjustment_items',fk=kind==='receipt'?'receiptId':'adjustmentId';
    if(!create) await this.db.query(`DELETE FROM ${ident(lines)} WHERE ${ident(kind==='receipt'?'receipt_id':'adjustment_id')}=$1`,[old!.id]);
    const saved=create?await this.db.insert(table,{...header,employeeId:employee.id,employeeName:employee.fullName}):await this.db.update(table,old!.id,header);
    for(const item of items) await this.db.insert(lines,{...item,[fk]:saved.id});
    await this.db.audit(c.actor,create?'CREATE':'UPDATE',table,saved.id);
    return this.detail(kind,saved.id);
  }
  // Latest posted receipt wins: the posted unit cost becomes both the supplier's
  // quoted cost for that SKU and the variant's official reference cost. Locks are
  // taken in variant-id order so concurrent receipts cannot deadlock; the version
  // triggers bump version only when a value actually changes.
  private async syncCosts(supplierId:unknown,items:Row[]):Promise<void>{
    for(const item of [...items].sort((a,b)=>String(a.variantId).localeCompare(String(b.variantId)))){
      await this.db.one('SELECT id FROM supplier_variants WHERE supplier_id=$1 AND variant_id=$2 FOR UPDATE',[supplierId,item.variantId]);
      await this.db.query('UPDATE supplier_variants SET quoted_cost_price=$3::numeric WHERE supplier_id=$1 AND variant_id=$2 AND quoted_cost_price IS DISTINCT FROM $3::numeric',[supplierId,item.variantId,item.unitCost]);
      await this.db.one('SELECT id FROM product_variants WHERE id=$1 FOR UPDATE',[item.variantId]);
      await this.db.query('UPDATE product_variants SET reference_cost_price=$2::numeric WHERE id=$1 AND reference_cost_price IS DISTINCT FROM $2::numeric',[item.variantId,item.unitCost]);
    }
  }
  async invoiceItems(invoiceId:unknown,orderId:unknown):Promise<void>{
    await this.db.query('DELETE FROM invoice_items WHERE invoice_id=$1',[invoiceId]);
    await this.db.query('INSERT INTO invoice_items(invoice_id,product_id,variant_id,product_name,variant_name,sku,quantity,unit_price,line_total) SELECT $1,product_id,variant_id,product_name,variant_name,sku,quantity,unit_price,line_subtotal FROM order_items WHERE order_id=$2',[invoiceId,orderId]);
    await this.db.query('UPDATE invoices SET total_amount=(SELECT COALESCE(sum(line_total),0) FROM invoice_items WHERE invoice_id=$1) WHERE id=$1',[invoiceId]);
  }
  registerRoutes(routes:Routes):void{
    for(const kind of ['receipt','adjustment'] as const){
      const resource=kind==='receipt'?'goods-receipts':'inventory-adjustments',table=kind==='receipt'?'goods_receipts':'inventory_adjustments',permission=kind==='receipt'?'goodsReceipts':'inventoryAdjustments';
      const path=`/admin/${resource}`;
      routes.add('GET',path,{permission:`${permission}.read`},c=>this.catalog.list(table,c,kind==='receipt'?['receiptCode','supplierName','employeeName']:['adjustmentCode','reason','employeeName'],kind==='receipt'?['status','supplierId']:['status']));
      routes.add('GET',`${path}/{id}`,{permission:`${permission}.read`},c=>this.detail(kind,c.params.id));
      routes.add('POST',path,{permission:`${permission}.create`},c=>this.save(c,kind,true));
      routes.add('PATCH',`${path}/{id}`,{permission:`${permission}.update`},c=>this.save(c,kind,false));
      routes.add('DELETE',`${path}/{id}`,{permission:`${permission}.delete`},async c=>{
        const doc=await this.db.one(`SELECT * FROM ${ident(table)} WHERE id=$1 FOR UPDATE`,[c.params.id]);
        assert(doc.status==='DRAFT','INVALID_STATE','Chỉ xóa chứng từ đang soạn.');
        await this.db.query(`DELETE FROM ${ident(table)} WHERE id=$1`,[doc.id]);
        await this.db.audit(c.actor,'DELETE',table,doc.id);
      });
      routes.add('POST',`${path}/{id}/post`,{permission:`${permission}.post`},async c=>{
        const doc=await this.db.one(`SELECT * FROM ${ident(table)} WHERE id=$1 FOR UPDATE`,[c.params.id]);version(doc,c.body.version);
        assert(doc.status==='DRAFT','INVALID_STATE','Chứng từ không còn ở trạng thái đang soạn.');
        await this.db.one("SELECT id FROM employees WHERE id=$1 AND status='ACTIVE'",[doc.employeeId]);
        if(kind==='receipt'){
          await this.db.one("SELECT id FROM suppliers WHERE id=$1 AND status='ACTIVE'",[doc.supplierId]);
          const invalid=await this.db.query("SELECT i.id FROM goods_receipt_items i JOIN supplier_variants sv ON sv.supplier_id=i.supplier_id AND sv.variant_id=i.variant_id WHERE i.receipt_id=$1 AND sv.status<>'ACTIVE'",[doc.id]);
          assert(!invalid.length,'INVALID_STATE','Liên kết cung ứng đã ngừng hoạt động.');
        }
        const detail=await this.detail(kind,doc.id),items=detail.items as Row[];
        if(kind==='receipt') assert(items.reduce((s,i)=>s+money(i.lineTotal),0n)===money(doc.totalAmount),'INVALID_STATE','Tổng phiếu nhập không khớp.');
        await this.stock.apply(c.actor,items.map(i=>({variantId:String(i.variantId),quantityDelta:Number(kind==='receipt'?i.quantity:i.quantityDelta)})),kind==='receipt'?'RECEIPT':'ADJUSTMENT',kind==='receipt'?'GOODS_RECEIPT':'INVENTORY_ADJUSTMENT',doc.id,c.body.note||doc.reason||null);
        if(kind==='receipt') await this.syncCosts(doc.supplierId,items);
        await this.db.query(`UPDATE ${ident(table)} SET status='POSTED',posted_at=clock_timestamp() WHERE id=$1`,[doc.id]);
        await this.db.audit(c.actor,'POST',table,doc.id);
        return this.detail(kind,doc.id);
      });
    }
    routes.add('GET','/admin/inventory/balances',{permission:'inventory.read'},c=>this.catalog.list('api_balances',c,['sku','productName','variantName'],['productId']));
    routes.add('GET','/admin/inventory/movements',{permission:'inventory.read'},c=>this.catalog.list('stock_movements',c,['sku'],['variantId','type']));
    routes.add('POST','/admin/orders/{id}/invoice',{permission:'invoices.create'},async c=>{
      const order=await this.db.one('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[c.params.id]);
      assert(order.status==='COMPLETED','INVALID_STATE','Chỉ lập hóa đơn từ đơn hoàn tất.');
      const employee=await this.db.one("SELECT * FROM employees WHERE id=$1 AND status='ACTIVE'",[c.actor.employeeId]);
      const invoice=await this.db.insert('invoices',{orderId:order.id,orderCode:order.orderCode,employeeId:employee.id,employeeName:employee.fullName,note:c.body.note||null});
      await this.invoiceItems(invoice.id,order.id);
      await this.db.audit(c.actor,'CREATE','invoices',invoice.id);
      return this.detail('invoice',invoice.id);
    });
    routes.add('GET','/admin/invoices',{permission:'invoices.read'},c=>this.catalog.list('invoices',c,['invoiceCode','orderCode','employeeName'],['status']));
    routes.add('GET','/admin/invoices/{id}',{permission:'invoices.read'},c=>this.detail('invoice',c.params.id));
    for(const action of ['PATCH','DELETE','REFRESH','POST']){
      const path=`/admin/invoices/{id}${action==='REFRESH'?'/refresh-items':action==='POST'?'/post':''}`;
      routes.add(action==='REFRESH'?'POST':action,path,{permission:`invoices.${action==='PATCH'||action==='REFRESH'?'update':action.toLowerCase()}`},async c=>{
        const invoice=await this.db.one('SELECT * FROM invoices WHERE id=$1 FOR UPDATE',[c.params.id]);
        assert(invoice.status==='DRAFT','INVALID_STATE','Hóa đơn đã ghi nhận không được thay đổi.');
        if(action!=='DELETE') version(invoice,c.body.version);
        if(action==='DELETE'){await this.db.query('DELETE FROM invoices WHERE id=$1',[invoice.id]);await this.db.audit(c.actor,'DELETE','invoices',invoice.id);return;}
        if(action==='PATCH') await this.db.update('invoices',invoice.id,{note:c.body.note});
        if(action==='REFRESH') await this.invoiceItems(invoice.id,invoice.orderId);
        if(action==='POST'){
          const total=await this.db.one('SELECT count(*)::integer AS count,COALESCE(sum(line_total),0)::numeric(18,0) AS total FROM invoice_items WHERE invoice_id=$1',[invoice.id]);
          assert(Number(total.count)>0&&money(total.total)===money(invoice.totalAmount),'INVALID_STATE','Dòng hoặc tổng hóa đơn không hợp lệ.');
          await this.db.query("UPDATE invoices SET status='POSTED',issued_at=clock_timestamp() WHERE id=$1",[invoice.id]);
        }
        await this.db.audit(c.actor,action,'invoices',invoice.id);
        return this.detail('invoice',invoice.id);
      });
    }
  }
}
