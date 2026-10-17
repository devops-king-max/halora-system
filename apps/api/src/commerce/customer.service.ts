import { Inject, Injectable } from '@nestjs/common';
import { Database, Row } from '../core/db';
import { Context, Routes } from '../core/registry';
import { assert, version } from '../core/errors';

@Injectable()
export class CustomerService {
  constructor(@Inject(Database) private readonly db:Database){}
  async cart(customerId:unknown,lock=false):Promise<Row>{
    return this.db.one(`SELECT * FROM carts WHERE customer_id=$1${lock?' FOR UPDATE':''}`,[customerId]);
  }
  async cartDetail(customerId:unknown):Promise<Row>{
    const cart=await this.cart(customerId);
    const items=await this.db.query(`SELECT ci.id,ci.product_id,ci.variant_id,p.name AS product_name,v.name AS variant_name,v.sku,
      COALESCE((SELECT i.url FROM api_images i WHERE i.product_id=p.id AND i.variant_id=v.id ORDER BY i.sort_order,i.id LIMIT 1),(SELECT m.url FROM media_assets m WHERE m.id=p.thumbnail_media_id),(SELECT i.url FROM api_images i WHERE i.product_id=p.id AND i.variant_id IS NULL ORDER BY i.sort_order,i.id LIMIT 1)) AS thumbnail_url,
      ci.quantity,v.sale_price AS unit_price,(ci.quantity*v.sale_price)::numeric(18,0) AS line_subtotal,b.stock_quantity,
      (v.status='ACTIVE' AND p.status='ACTIVE' AND c.status='ACTIVE' AND br.status='ACTIVE' AND b.stock_quantity>0) AS is_available
      FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id JOIN products p ON p.id=v.product_id JOIN categories c ON c.id=p.category_id JOIN brands br ON br.id=p.brand_id JOIN inventory_balances b ON b.variant_id=v.id WHERE ci.cart_id=$1 ORDER BY ci.id`,[cart.id]);
    return {id:cart.id,version:cart.version,items,totalQuantity:items.reduce((s,i)=>s+Number(i.quantity),0),subtotalAmount:items.reduce((s,i)=>s+BigInt(String(i.lineSubtotal)),0n).toString()};
  }
  registerRoutes(routes:Routes):void{
    routes.add('GET','/me/profile',{customer:true},c=>this.db.one('SELECT * FROM api_customers WHERE id=$1',[c.actor.customerId]));
    routes.add('PATCH','/me/profile',{customer:true},async c=>{
      const row=await this.db.one('SELECT * FROM customers WHERE id=$1 FOR UPDATE',[c.actor.customerId]);version(row,c.body.version);
      await this.db.update('customers',row.id,{fullName:c.body.fullName,phone:c.body.phone});
      return this.db.one('SELECT * FROM api_customers WHERE id=$1',[row.id]);
    });
    routes.add('GET','/me/addresses',{customer:true},async c=>({data:await this.db.query('SELECT * FROM customer_addresses WHERE customer_id=$1 ORDER BY is_default DESC,created_at,id',[c.actor.customerId])}));
    routes.add('POST','/me/addresses',{customer:true},c=>this.saveAddress(c,true));
    routes.add('PATCH','/me/addresses/{id}',{customer:true},c=>this.saveAddress(c,false));
    routes.add('DELETE','/me/addresses/{id}',{customer:true},async c=>{
      await this.db.one('SELECT id FROM customers WHERE id=$1 FOR UPDATE',[c.actor.customerId]);
      const row=await this.db.one('DELETE FROM customer_addresses WHERE id=$1 AND customer_id=$2 RETURNING id',[c.params.id,c.actor.customerId]);
      await this.db.audit(c.actor,'DELETE','customer_address',row.id);
    });
    routes.add('GET','/admin/customers/{id}/addresses',{permission:'customers.read'},async c=>{
      await this.db.one('SELECT id FROM customers WHERE id=$1',[c.params.id]);
      return {data:await this.db.query('SELECT * FROM customer_addresses WHERE customer_id=$1 ORDER BY is_default DESC,created_at,id',[c.params.id])};
    });
    routes.add('GET','/me/cart',{customer:true},c=>this.cartDetail(c.actor.customerId));
    routes.add('POST','/me/cart/items',{customer:true},async c=>{
      const cart=await this.cart(c.actor.customerId,true);
      const variant=await this.db.one("SELECT v.* FROM product_variants v JOIN products p ON p.id=v.product_id JOIN api_public_products a ON a.id=p.id WHERE v.id=$1 AND v.status='ACTIVE'",[c.body.variantId]);
      await this.db.query('INSERT INTO cart_items(cart_id,product_id,variant_id,quantity) VALUES($1,$2,$3,$4) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=cart_items.quantity+excluded.quantity',[cart.id,variant.productId,variant.id,c.body.quantity]);
      await this.db.query('UPDATE carts SET customer_id=customer_id WHERE id=$1',[cart.id]);
      return this.cartDetail(c.actor.customerId);
    });
    routes.add('PATCH','/me/cart/items/{id}',{customer:true},async c=>{
      const cart=await this.cart(c.actor.customerId,true);version(cart,c.body.version);
      await this.db.one('UPDATE cart_items SET quantity=$3 WHERE id=$1 AND cart_id=$2 RETURNING id',[c.params.id,cart.id,c.body.quantity]);
      await this.db.query('UPDATE carts SET customer_id=customer_id WHERE id=$1',[cart.id]);
      return this.cartDetail(c.actor.customerId);
    });
    for(const single of [false,true]) routes.add('DELETE',`/me/cart/items${single?'/{id}':''}`,{customer:true},async c=>{
      const cart=await this.cart(c.actor.customerId,true);version(cart,Number(c.query.version));
      if(single) await this.db.one('DELETE FROM cart_items WHERE id=$1 AND cart_id=$2 RETURNING id',[c.params.id,cart.id]);
      else await this.db.query('DELETE FROM cart_items WHERE cart_id=$1',[cart.id]);
      await this.db.query('UPDATE carts SET customer_id=customer_id WHERE id=$1',[cart.id]);
    });
  }
  private async saveAddress(c:Context,create:boolean):Promise<Row>{
    await this.db.one('SELECT id FROM customers WHERE id=$1 FOR UPDATE',[c.actor.customerId]);
    if(!create){const a=await this.db.one('SELECT * FROM customer_addresses WHERE id=$1 AND customer_id=$2 FOR UPDATE',[c.params.id,c.actor.customerId]);version(a,c.body.version);}
    if(c.body.isDefault===true) await this.db.query('UPDATE customer_addresses SET is_default=false WHERE customer_id=$1 AND is_default AND id<>$2::uuid',[c.actor.customerId,create?'00000000-0000-0000-0000-000000000000':c.params.id]);
    const fields=['recipientName','recipientPhone','addressLine','provinceName','wardName','isDefault'];
    const data:Row=Object.fromEntries(fields.filter(f=>c.body[f]!==undefined).map(f=>[f,c.body[f]]));
    return create?this.db.insert('customer_addresses',{...data,customerId:c.actor.customerId}):this.db.update('customer_addresses',c.params.id,data);
  }
}
