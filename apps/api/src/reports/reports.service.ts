import { Inject, Injectable } from '@nestjs/common';
import { Database, Row, pagination } from '../core/db';
import { Context, Routes } from '../core/registry';
import { assert } from '../core/errors';

export interface Metric {key:string;label:string;value:string;unit:'VND'|'COUNT'|'QUANTITY';}
export interface Column {key:string;label:string;type:'TEXT'|'MONEY'|'NUMBER'|'DATETIME'|'STATUS';}
export interface Report {metrics:Metric[];series:{key:string;name:string;unit:Metric['unit'];points:{period:string;value:string}[]}[];columns:Column[];rows:{key:string;values:Row;sourceType:string|null;sourceId:string|null}[];meta:{page:number;limit:number;total:number;totalPages:number};}
type Source='orders'|'invoices'|'payments'|'refunds'|'goods_receipts'|'stock_movements'|'audit_logs';
const ZONE='Asia/Ho_Chi_Minh';
const ZONE_OFFSET='+07:00';
const monthFormat=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit'});
export function currentReportYear():number{return Number(new Intl.DateTimeFormat('en-US',{timeZone:ZONE,year:'numeric'}).format(new Date()));}
function monthKey(value:string):string{
  const parts=monthFormat.formatToParts(new Date(value));
  return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}`;
}
function nextMonth(key:string):string{
  const [year,month]=key.split('-').map(Number);
  return month===12?`${year+1}-01`:`${year}-${String(month+1).padStart(2,'0')}`;
}
// Reports are scoped to a single calendar year by default (Asia/Ho_Chi_Minh), optionally a quarter.
export function resolveReportPeriod(query:Row,defaultYear=currentReportYear()):Row{
  const rawYear=query.year===undefined||query.year===null||query.year===''?undefined:Number(query.year);
  const rawQuarter=query.quarter===undefined||query.quarter===null||query.quarter===''?undefined:Number(query.quarter);
  assert(rawYear===undefined||(Number.isInteger(rawYear)&&rawYear>=2000&&rawYear<=2100),'VALIDATION_ERROR','Năm báo cáo không hợp lệ.',400);
  assert(rawQuarter===undefined||(Number.isInteger(rawQuarter)&&rawQuarter>=1&&rawQuarter<=4),'VALIDATION_ERROR','Quý báo cáo phải từ 1 đến 4.',400);
  if(rawYear===undefined&&rawQuarter===undefined){
    if(query.from||query.to)return query;
    return {...query,year:defaultYear,from:`${defaultYear}-01-01T00:00:00${ZONE_OFFSET}`,to:`${defaultYear+1}-01-01T00:00:00${ZONE_OFFSET}`};
  }
  const year=rawYear??defaultYear;
  const startMonth=rawQuarter?(rawQuarter-1)*3:0;
  const endMonth=rawQuarter?startMonth+3:12;
  const pad=(month:number)=>String(month+1).padStart(2,'0');
  return {...query,year,quarter:rawQuarter,from:`${year}-${pad(startMonth)}-01T00:00:00${ZONE_OFFSET}`,to:endMonth===12?`${year+1}-01-01T00:00:00${ZONE_OFFSET}`:`${year}-${pad(endMonth)}-01T00:00:00${ZONE_OFFSET}`};
}
function periodMonths(from:string,to:string):string[]{
  const last=monthKey(new Date(new Date(to).getTime()-1).toISOString());
  const months:string[]=[];
  let key=monthKey(from);
  for(let i=0;i<240;i++){months.push(key);if(key===last)break;key=nextMonth(key);}
  return months;
}
@Injectable()
export class ReportsService {
  constructor(@Inject(Database) private readonly db:Database){}
  private where(q:Row,source:Source,time:string):{sql:string;args:unknown[]}{
    const args:unknown[]=[],conditions:string[]=[];
    const value=(v:unknown)=>{args.push(v);return `$${args.length}`;};
    if(q.from)conditions.push(`s.${time}>=${value(q.from)}::timestamptz`);
    if(q.to)conditions.push(`s.${time}<${value(q.to)}::timestamptz`);
    const orderSource=['orders','invoices','payments','refunds'].includes(source);
    const orderAlias=source==='orders'?'s':'o';
    if(orderSource){
      if(q.orderStatus)conditions.push(`${orderAlias}.status=${value(q.orderStatus)}`);
      if(q.paymentStatus&&source!=='payments') conditions.push(`EXISTS(SELECT 1 FROM payments px WHERE px.order_id=${orderAlias}.id AND px.status=${value(q.paymentStatus)})`);
      const product:string[]=[];
      if(q.productId)product.push(`li.product_id=${value(q.productId)}`);
      if(q.variantId)product.push(`li.variant_id=${value(q.variantId)}`);
      if(q.categoryId)product.push(`pr.category_id=${value(q.categoryId)}`);
      if(q.supplierId)product.push(`EXISTS(SELECT 1 FROM supplier_variants sv WHERE sv.variant_id=li.variant_id AND sv.supplier_id=${value(q.supplierId)})`);
      if(product.length)conditions.push(`EXISTS(SELECT 1 FROM order_items li JOIN products pr ON pr.id=li.product_id WHERE li.order_id=${orderAlias}.id AND ${product.join(' AND ')})`);
    }
    if(source==='payments'&&q.paymentStatus)conditions.push(`s.status=${value(q.paymentStatus)}`);
    if(source==='goods_receipts'){
      if(q.supplierId)conditions.push(`s.supplier_id=${value(q.supplierId)}`);
      const product:string[]=[];
      if(q.productId)product.push(`li.product_id=${value(q.productId)}`);
      if(q.variantId)product.push(`li.variant_id=${value(q.variantId)}`);
      if(q.categoryId)product.push(`pr.category_id=${value(q.categoryId)}`);
      if(product.length)conditions.push(`EXISTS(SELECT 1 FROM goods_receipt_items li JOIN products pr ON pr.id=li.product_id WHERE li.receipt_id=s.id AND ${product.join(' AND ')})`);
    }
    if(q.employeeId){
      if(['invoices','goods_receipts','audit_logs'].includes(source))conditions.push(`s.employee_id=${value(q.employeeId)}`);
      else if(source==='payments')conditions.push(`s.created_by=(SELECT account_id FROM employees WHERE id=${value(q.employeeId)})`);
      else if(source==='orders')conditions.push(`EXISTS(SELECT 1 FROM order_status_history h JOIN employees e ON e.account_id=h.account_id WHERE h.order_id=s.id AND e.id=${value(q.employeeId)})`);
    }
    return {sql:conditions.length?' AND '+conditions.join(' AND '):'',args};
  }
  private async scalar(sql:string,args:unknown[]):Promise<string>{const row=await this.db.one(sql,args);return String(row.value??'0');}
  private column(key:string,label:string,type:Column['type']='TEXT'):Column{return {key,label,type};}
  private validate(q:Row):void{
    for(const [from,to] of [['from','to'],['compareFrom','compareTo']]){
      if(from==='compareFrom') assert(Boolean(q[from])===Boolean(q[to]),'VALIDATION_ERROR','Cần đủ hai mốc thời gian so sánh.',400);
      if(q[from]&&q[to])assert(new Date(String(q[from]))<new Date(String(q[to])),'VALIDATION_ERROR','Thời gian bắt đầu phải trước kết thúc.',400);
    }
  }
  async get(kind:string,q:Row):Promise<Report>{
    const period=resolveReportPeriod(q);
    this.validate(period);
    return this.db.snapshot(async()=>{
      const report=await this.build(kind,period);
      if(period.compareFrom&&period.compareTo){
        const previous=await this.build(kind,{...period,from:period.compareFrom,to:period.compareTo,year:undefined,quarter:undefined,compareFrom:undefined,compareTo:undefined});
        report.metrics.push(...previous.metrics.map(m=>({...m,key:`compare_${m.key}`,label:`Kỳ so sánh: ${m.label}`})));
        report.series.push(...previous.series.map(s=>({...s,key:`compare_${s.key}`,name:`Kỳ so sánh: ${s.name}`})));
      }
      return report;
    });
  }
  private async build(kind:string,q:Row):Promise<Report>{
    const {page,limit,offset}=pagination(q);
    const report:Report={metrics:[],series:[],columns:[],rows:[],meta:{page,limit,total:0,totalPages:0}};
    const add=(key:string,label:string,value:string,unit:Metric['unit'])=>report.metrics.push({key,label,value,unit});
    let sql='',args:unknown[]=[],sourceType:string|null=null;
    if(kind==='sales'||kind==='dashboard'){
      const inv=this.where(q,'invoices','issued_at'),ord=this.where(q,'orders','completed_at'),all=this.where(q,'orders','created_at');
      add('invoiceCount','Số hóa đơn ghi nhận',await this.scalar(`SELECT count(*)::text AS value FROM invoices s JOIN orders o ON o.id=s.order_id WHERE s.status='POSTED'${inv.sql}`,inv.args),'COUNT');
      add('invoiceAmount','Giá trị hóa đơn theo giá gốc',await this.scalar(`SELECT COALESCE(sum(s.total_amount),0)::text AS value FROM invoices s JOIN orders o ON o.id=s.order_id WHERE s.status='POSTED'${inv.sql}`,inv.args),'VND');
      add('completedOrders','Đơn hoàn tất',await this.scalar(`SELECT count(*)::text AS value FROM orders s WHERE s.status='COMPLETED'${ord.sql}`,ord.args),'COUNT');
      add('completedOrderAmount','Giá trị phải trả của đơn hoàn tất',await this.scalar(`SELECT COALESCE(sum(s.total_amount),0)::text AS value FROM orders s WHERE s.status='COMPLETED'${ord.sql}`,ord.args),'VND');
      const status=await this.db.query(`SELECT s.status,count(*)::text AS value FROM orders s WHERE true${all.sql} GROUP BY s.status ORDER BY s.status`,all.args);
      for(const row of status)add(`status_${row.status}`,`Đơn ${row.status}`,String(row.value),'COUNT');
      const points=await this.db.query(`SELECT to_char(s.completed_at AT TIME ZONE '${ZONE}','YYYY-MM') AS period,sum(s.total_amount)::text AS value FROM orders s WHERE s.status='COMPLETED'${ord.sql} GROUP BY 1 ORDER BY 1`,ord.args);
      report.series.push({key:'completedOrderAmount',name:'Giá trị đơn hoàn tất',unit:'VND',points:points as {period:string;value:string}[]});
      sql=`SELECT s.id,s.order_code AS code,s.customer_name,s.status,s.total_amount,s.created_at FROM orders s WHERE true${all.sql}`;args=all.args;sourceType='ORDER';
      report.columns=[this.column('code','Mã đơn'),this.column('customerName','Khách hàng'),this.column('status','Trạng thái','STATUS'),this.column('totalAmount','Tổng phải trả','MONEY'),this.column('createdAt','Ngày đặt','DATETIME')];
    }else if(kind==='payments'){
      const w=this.where(q,'payments','paid_at'),r=this.where(q,'refunds','refunded_at');
      add('receivedAmount','Tiền thu thành công',await this.scalar(`SELECT COALESCE(sum(s.amount),0)::text AS value FROM payments s JOIN orders o ON o.id=s.order_id WHERE s.status='SUCCEEDED'${w.sql}`,w.args),'VND');
      add('cancelledOrderReceived','Đã thu của đơn bị hủy',await this.scalar(`SELECT COALESCE(sum(s.amount),0)::text AS value FROM payments s JOIN orders o ON o.id=s.order_id WHERE s.status='SUCCEEDED' AND o.status='CANCELLED'${w.sql}`,w.args),'VND');
      add('refundedAmount','Đã hoàn tiền',await this.scalar(`SELECT COALESCE(sum(s.amount),0)::text AS value FROM refunds s JOIN orders o ON o.id=s.order_id WHERE s.status='SUCCEEDED'${r.sql}`,r.args),'VND');
      const due=this.where(q,'refunds','created_at');
      add('refundDue','Còn phải hoàn',await this.scalar(`SELECT COALESCE(sum(s.amount),0)::text AS value FROM refunds s JOIN orders o ON o.id=s.order_id WHERE s.status IN ('PENDING','FAILED')${due.sql}`,due.args),'VND');
      const rows=this.where(q,'payments','created_at');
      sql=`SELECT s.id,o.id AS source_id,o.order_code AS code,s.method,s.amount,s.status,s.paid_at,s.created_at FROM payments s JOIN orders o ON o.id=s.order_id WHERE true${rows.sql}`;args=rows.args;sourceType='ORDER';
      report.columns=[this.column('code','Mã đơn'),this.column('method','Phương thức'),this.column('amount','Số tiền','MONEY'),this.column('status','Kết quả','STATUS'),this.column('paidAt','Ngày thu','DATETIME')];
    }else if(kind==='purchases'){
      const w=this.where(q,'goods_receipts','posted_at');
      add('receiptCount','Phiếu nhập đã ghi nhận',await this.scalar(`SELECT count(*)::text AS value FROM goods_receipts s WHERE s.status='POSTED'${w.sql}`,w.args),'COUNT');
      add('purchaseAmount','Giá trị nhập',await this.scalar(`SELECT COALESCE(sum(s.total_amount),0)::text AS value FROM goods_receipts s WHERE s.status='POSTED'${w.sql}`,w.args),'VND');
      add('purchaseQuantity','Số lượng nhập',await this.scalar(`SELECT COALESCE(sum((SELECT sum(i.quantity) FROM goods_receipt_items i WHERE i.receipt_id=s.id)),0)::text AS value FROM goods_receipts s WHERE s.status='POSTED'${w.sql}`,w.args),'QUANTITY');
      sql=`SELECT s.id,s.receipt_code AS code,s.supplier_name,s.employee_name,s.total_amount,s.posted_at FROM goods_receipts s WHERE s.status='POSTED'${w.sql}`;args=w.args;sourceType='GOODS_RECEIPT';
      report.columns=[this.column('code','Mã phiếu'),this.column('supplierName','Nhà cung cấp'),this.column('employeeName','Nhân viên'),this.column('totalAmount','Giá trị nhập','MONEY'),this.column('postedAt','Ngày ghi nhận','DATETIME')];
    }else if(kind==='inventory'){
      const params:unknown[]=[q.from||null,q.to||null],filters:string[]=[];
      for(const [key,column] of [['productId','v.product_id'],['variantId','v.id'],['categoryId','p.category_id']])if(q[key]){params.push(q[key]);filters.push(`${column}=$${params.length}`);}
      if(q.supplierId){params.push(q.supplierId);filters.push(`EXISTS(SELECT 1 FROM supplier_variants sv WHERE sv.variant_id=v.id AND sv.supplier_id=$${params.length})`);}
      const query=`SELECT v.id,v.sku,p.name AS product_name,v.name AS variant_name,b.stock_quantity,
       COALESCE((SELECT sum(m.quantity_delta) FROM stock_movements m WHERE m.variant_id=v.id AND $1::timestamptz IS NOT NULL AND m.created_at<$1),0)::integer AS opening_quantity,
       COALESCE((SELECT sum(m.quantity_delta) FILTER(WHERE m.quantity_delta>0) FROM stock_movements m WHERE m.variant_id=v.id AND ($1::timestamptz IS NULL OR m.created_at>=$1) AND ($2::timestamptz IS NULL OR m.created_at<$2)),0)::integer AS inbound_quantity,
       COALESCE((SELECT -sum(m.quantity_delta) FILTER(WHERE m.quantity_delta<0) FROM stock_movements m WHERE m.variant_id=v.id AND ($1::timestamptz IS NULL OR m.created_at>=$1) AND ($2::timestamptz IS NULL OR m.created_at<$2)),0)::integer AS outbound_quantity,
       COALESCE((SELECT sum(m.quantity_delta) FROM stock_movements m WHERE m.variant_id=v.id AND ($2::timestamptz IS NULL OR m.created_at<$2)),0)::integer AS closing_quantity,
       (b.stock_quantity<=v.low_stock_threshold) AS is_low FROM product_variants v JOIN products p ON p.id=v.product_id JOIN inventory_balances b ON b.variant_id=v.id${filters.length?' WHERE '+filters.join(' AND '):''}`;
      const totals=await this.db.one(`SELECT COALESCE(sum(stock_quantity),0)::text AS stock,count(*) FILTER(WHERE is_low)::text AS low FROM (${query}) inv`,params);
      add('currentStock','Tồn hiện tại',String(totals.stock),'QUANTITY');add('lowStockVariants','Biến thể dưới ngưỡng',String(totals.low),'COUNT');
      sql=query;args=params;
      report.columns=[this.column('sku','SKU'),this.column('productName','Sản phẩm'),this.column('variantName','Biến thể'),this.column('openingQuantity','Tồn đầu kỳ','NUMBER'),this.column('inboundQuantity','Nhập trong kỳ','NUMBER'),this.column('outboundQuantity','Xuất trong kỳ','NUMBER'),this.column('closingQuantity','Tồn cuối kỳ','NUMBER'),this.column('stockQuantity','Tồn hiện tại','NUMBER')];
    }else if(kind==='products'){
      const w=this.where(q,'orders','completed_at');
      const scope=`FROM order_items li JOIN orders s ON s.id=li.order_id WHERE s.status='COMPLETED'${w.sql}`;
      add('productQuantity','Số lượng bán',await this.scalar(`SELECT COALESCE(sum(li.quantity),0)::text AS value ${scope}`,w.args),'QUANTITY');
      add('productAmount','Doanh thu theo giá gốc',await this.scalar(`SELECT COALESCE(sum(li.line_subtotal),0)::text AS value ${scope}`,w.args),'VND');
      add('soldSkuCount','Số SKU bán được',await this.scalar(`SELECT count(DISTINCT li.sku)::text AS value ${scope}`,w.args),'COUNT');
      const buckets=q.from&&q.to?periodMonths(String(q.from),String(q.to)):[];
      if(buckets.length){
        const monthly=await this.db.query(`SELECT to_char(s.completed_at AT TIME ZONE '${ZONE}','YYYY-MM') AS period,sum(li.quantity)::text AS quantity,sum(li.line_subtotal)::text AS amount ${scope} GROUP BY 1`,w.args);
        const byPeriod=new Map(monthly.map(row=>[String(row.period),row]));
        report.series.push({key:'productQuantity',name:'Số lượng bán theo tháng',unit:'QUANTITY',points:buckets.map(period=>({period,value:String(byPeriod.get(period)?.quantity??'0')}))});
        report.series.push({key:'productAmount',name:'Doanh thu theo giá gốc theo tháng',unit:'VND',points:buckets.map(period=>({period,value:String(byPeriod.get(period)?.amount??'0')}))});
      }
      sql=`SELECT li.sku||' | '||li.variant_name||' | '||li.unit_price::text AS id,li.sku,li.product_name AS product_name,li.variant_name AS variant_name,li.unit_price::text AS unit_price,sum(li.quantity)::integer AS quantity,sum(li.line_subtotal)::text AS amount ${scope} GROUP BY li.sku,li.product_name,li.variant_name,li.unit_price`;args=w.args;
      report.columns=[this.column('sku','SKU'),this.column('productName','Sản phẩm'),this.column('variantName','Biến thể'),this.column('quantity','Số lượng','NUMBER'),this.column('unitPrice','Đơn giá','MONEY'),this.column('amount','Thành tiền','MONEY')];
    }else if(kind==='promotions'){
      const w=this.where(q,'orders','created_at');
      add('discountAmount','Ưu đãi của đơn chưa hủy',await this.scalar(`SELECT COALESCE(sum(s.product_discount_amount+s.order_discount_amount+s.voucher_discount_amount),0)::text AS value FROM orders s WHERE s.status<>'CANCELLED'${w.sql}`,w.args),'VND');
      add('usedVouchers','Lượt voucher đã sử dụng',await this.scalar(`SELECT count(*)::text AS value FROM voucher_redemptions vr JOIN orders s ON s.id=vr.order_id WHERE vr.status='USED'${w.sql}`,w.args),'COUNT');
      add('heldVouchers','Lượt voucher đang giữ',await this.scalar(`SELECT count(*)::text AS value FROM voucher_redemptions vr JOIN orders s ON s.id=vr.order_id WHERE vr.status='HELD'${w.sql}`,w.args),'COUNT');
      sql=`SELECT d.id,s.id AS source_id,s.order_code AS code,d.promotion_name,d.scope,d.voucher_code,d.amount,s.status FROM order_discounts d JOIN orders s ON s.id=d.order_id WHERE true${w.sql}`;args=w.args;sourceType='ORDER';
      report.columns=[this.column('code','Mã đơn'),this.column('promotionName','Chương trình'),this.column('scope','Phạm vi'),this.column('voucherCode','Voucher'),this.column('amount','Tiền giảm','MONEY'),this.column('status','Trạng thái đơn','STATUS')];
    }else{
      assert(kind==='activity','NOT_FOUND','Loại báo cáo không hợp lệ.',404);
      const w=this.where(q,'audit_logs','created_at');
      add('activityCount','Số thao tác được ghi nhận',await this.scalar(`SELECT count(*)::text AS value FROM audit_logs s WHERE true${w.sql}`,w.args),'COUNT');
      sql=`SELECT s.id,s.performed_by_name,s.action,s.entity_type,s.entity_id,s.created_at FROM audit_logs s WHERE true${w.sql}`;args=w.args;
      report.columns=[this.column('performedByName','Người thực hiện'),this.column('action','Thao tác'),this.column('entityType','Đối tượng'),this.column('entityId','Mã tham chiếu'),this.column('createdAt','Thời gian','DATETIME')];
    }
    const total=await this.db.one(`SELECT count(*)::integer AS count FROM (${sql}) report`,args);
    const data=await this.db.query(`${sql} ORDER BY 1 LIMIT $${args.length+1} OFFSET $${args.length+2}`,[...args,limit,offset]);
    report.rows=data.map(r=>({key:String(r.id),values:Object.fromEntries(report.columns.map(col=>[col.key,r[col.key]??null])),sourceType,sourceId:sourceType?String(r.sourceId||r.id):null}));
    report.meta={page,limit,total:Number(total.count),totalPages:Math.ceil(Number(total.count)/limit)};
    return report;
  }
  registerRoutes(routes:Routes):void{
    routes.add('GET','/admin/dashboard',{permission:'reports.read'},c=>this.get('dashboard',c.query));
    for(const kind of ['sales','payments','inventory','purchases','products','promotions','activity'])routes.add('GET',`/admin/reports/${kind}`,{permission:'reports.read'},c=>this.get(kind,c.query));
  }
}
