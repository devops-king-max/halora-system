import { Inject, Injectable } from '@nestjs/common';
import { Actor, Database, Row } from '../core/db';
import { assert } from '../core/errors';

@Injectable()
export class StockService {
  constructor(@Inject(Database) private readonly db:Database){}
  async apply(actor:Actor,items:{variantId:string;quantityDelta:number}[],type:string,sourceType:string,sourceId:unknown,note:unknown):Promise<void>{
    assert(items.length>0&&new Set(items.map(i=>i.variantId)).size===items.length,'VALIDATION_ERROR','Các dòng kho không hợp lệ.',400);
    const balances=await this.db.query('SELECT * FROM inventory_balances WHERE variant_id=ANY($1::uuid[]) ORDER BY variant_id FOR UPDATE',[items.map(i=>i.variantId).sort()]);
    assert(balances.length===items.length,'NOT_FOUND','Không tìm thấy số dư biến thể.',404);
    for(const item of [...items].sort((a,b)=>a.variantId.localeCompare(b.variantId))){
      const balance=balances.find(b=>b.variantId===item.variantId)!;
      const after=Number(balance.stockQuantity)+item.quantityDelta;
      assert(Number.isSafeInteger(after)&&after>=0&&after<=2147483647,'INSUFFICIENT_STOCK','Không đủ tồn kho hoặc số lượng vượt giới hạn.');
      const v=await this.db.one('SELECT v.sku,v.status,p.status AS product_status FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=$1',[item.variantId]);
      if(type==='SALE') assert(v.status==='ACTIVE'&&v.productStatus==='ACTIVE','INVALID_STATE','Không xuất bán biến thể đã ngừng hoạt động.');
      await this.db.query('UPDATE inventory_balances SET stock_quantity=$2,updated_at=clock_timestamp() WHERE variant_id=$1',[item.variantId,after]);
      await this.db.insert('stock_movements',{variantId:item.variantId,sku:v.sku,type,quantityDelta:item.quantityDelta,quantityAfter:after,sourceType,sourceId,accountId:actor.accountId,performedByName:actor.displayName,note:note||null});
    }
  }
  async assertLedger():Promise<Row[]>{
    return this.db.query('SELECT b.variant_id,b.stock_quantity,COALESCE(sum(m.quantity_delta),0)::integer AS ledger_quantity FROM inventory_balances b LEFT JOIN stock_movements m ON m.variant_id=b.variant_id GROUP BY b.variant_id,b.stock_quantity HAVING b.stock_quantity<>COALESCE(sum(m.quantity_delta),0)');
  }
}
