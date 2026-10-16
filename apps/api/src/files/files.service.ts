import { Inject, Injectable } from '@nestjs/common';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Database, Row } from '../core/db';
import { settings, root } from '../core/config';
import { assert } from '../core/errors';
import { Context, Routes } from '../core/registry';
import { ReportsService, Report, Column } from '../reports/reports.service';
import { DocumentsService } from '../inventory/documents.service';

export class Download { constructor(readonly buffer:Buffer,readonly contentType:string,readonly filename:string){} }
@Injectable()
export class FilesService {
  private readonly upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:0}}).single('file');
  constructor(@Inject(Database) private readonly db:Database,@Inject(ReportsService) private readonly reports:ReportsService,@Inject(DocumentsService) private readonly documents:DocumentsService){}
  private async media(c:Context):Promise<Row>{
    await new Promise<void>((ok,reject)=>this.upload(c.req,c.res,error=>error?reject(error):ok()));
    const file=c.req.file;
    assert(file,'VALIDATION_ERROR','Cần chọn một file ảnh.',400);
    const data=file.buffer;
    const png=data.length>8&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg=data.length>3&&data[0]===255&&data[1]===216&&data[2]===255;
    const webp=data.length>12&&data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP';
    assert(png||jpeg||webp,'VALIDATION_ERROR','Chỉ nhận ảnh PNG, JPEG hoặc WebP hợp lệ, tối đa 8 MB.',400);
    const extension=png?'png':jpeg?'jpg':'webp',mimeType=png?'image/png':jpeg?'image/jpeg':'image/webp';
    const id=randomUUID(),storageName=`${id}.${extension}`,path=resolve(settings.uploadDir,storageName);
    await mkdir(settings.uploadDir,{recursive:true});await writeFile(path,data,{flag:'wx'});
    try{
      const row=await this.db.insert('media_assets',{id,url:`${settings.publicBaseUrl.replace(/\/$/,'')}/media/${storageName}`,storageName,mimeType,size:file.size,originalName:basename(file.originalname).slice(0,255),accountId:c.actor.accountId});
      return {id:row.id,url:row.url,mimeType:row.mimeType,size:row.size,originalName:row.originalName};
    }catch(error){await unlink(path);throw error;}
  }
  private format(value:unknown,type:Column['type']):string{
    if(value===null||value===undefined)return '—';
    if(type==='MONEY')return `${BigInt(String(value)).toLocaleString('vi-VN')} ₫`;
    if(type==='DATETIME')return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(String(value)));
    return String(value);
  }
  async pdf(title:string,columns:Column[],rows:Row[],summary:string[]=[]):Promise<Buffer>{
    return new Promise((resolveBuffer,reject)=>{
      const pdf=new PDFDocument({size:'A4',layout:columns.length>5?'landscape':'portrait',margin:36,bufferPages:true});
      const chunks:Buffer[]=[];pdf.on('data',(b:Buffer)=>chunks.push(b));pdf.on('end',()=>resolveBuffer(Buffer.concat(chunks)));pdf.on('error',reject);
      pdf.font(resolve(root,'apps/api/assets/fonts/NotoSans-Regular.ttf'));
      const width=pdf.page.width-72,cellWidth=width/columns.length;
      const heading=()=>{pdf.fontSize(15).text(title);pdf.moveDown(0.4);pdf.fontSize(8).text('Halora — thời gian hiển thị theo giờ Việt Nam');pdf.moveDown();};
      const row=(values:string[],header=false)=>{
        const heights=values.map(v=>pdf.fontSize(header?8:7).heightOfString(v,{width:cellWidth-10}));
        const h=Math.min(Math.max(...heights,14)+10,pdf.page.height-150);
        if(pdf.y+h>pdf.page.height-48){pdf.addPage();heading();row(columns.map(c=>c.label),true);}
        const y=pdf.y;
        values.forEach((v,i)=>{pdf.rect(36+i*cellWidth,y,cellWidth,h).strokeColor('#dddddd').stroke();pdf.fontSize(header?8:7).fillColor('#222222').text(v,41+i*cellWidth,y+5,{width:cellWidth-10,height:h-8,ellipsis:true});});
        pdf.x=36;pdf.y=y+h;
      };
      heading();
      for(const line of summary){pdf.fontSize(9).text(line);}
      if(summary.length)pdf.moveDown();
      row(columns.map(c=>c.label),true);
      for(const record of rows)row(columns.map(c=>this.format(record[c.key],c.type)));
      const range=pdf.bufferedPageRange();
      for(let i=range.start;i<range.start+range.count;i++){pdf.switchToPage(i);pdf.fontSize(7).text(`${i+1}/${range.count}`,36,pdf.page.height-30,{width,align:'right',lineBreak:false});}
      pdf.end();
    });
  }
  private async documentExport(c:Context,kind:'invoice'|'receipt'):Promise<Download>{
    const doc=await this.documents.detail(kind,c.params.id),items=doc.items as Row[];
    const columns:Column[]=[{key:'sku',label:'SKU',type:'TEXT'},{key:'productName',label:'Sản phẩm',type:'TEXT'},{key:'variantName',label:'Biến thể',type:'TEXT'},{key:'quantity',label:'Số lượng',type:'NUMBER'},{key:kind==='invoice'?'unitPrice':'unitCost',label:kind==='invoice'?'Đơn giá gốc':'Đơn giá nhập',type:'MONEY'},{key:'lineTotal',label:'Thành tiền',type:'MONEY'}];
    const code=String(kind==='invoice'?doc.invoiceCode:doc.receiptCode);
    const lines=[`Mã: ${code} | Trạng thái: ${doc.status}`,`Nhân viên lập: ${doc.employeeName}`,`Tổng tiền hàng: ${this.format(doc.totalAmount,'MONEY')}`];
    if(kind==='invoice')lines.push(`Đơn hàng: ${doc.orderCode}`,'Giảm giá, phí giao hàng và số tiền phải trả được theo dõi riêng trên đơn hàng.');
    else lines.push(`Nhà cung cấp: ${doc.supplierName}`);
    return new Download(await this.pdf(kind==='invoice'?'HÓA ĐƠN BÁN HÀNG':'PHIẾU NHẬP HÀNG',columns,items,lines),'application/pdf',`${code}.pdf`);
  }
  private async reportExport(c:Context):Promise<Download>{
    const report=await this.db.snapshot(async()=>{
      const first=await this.reports.get(c.params.reportType,{...c.query,page:1,limit:100});
      assert(first.meta.total<=10000,'VALIDATION_ERROR','Bản xuất tối đa 10.000 dòng. Hãy thu hẹp khoảng thời gian hoặc bộ lọc.',413);
      for(let page=2;page<=first.meta.totalPages;page++){const next=await this.reports.get(c.params.reportType,{...c.query,page,limit:100});first.rows.push(...next.rows);}
      return first;
    });
    const name=`halora-${c.params.reportType}`;
    if(c.query.format==='pdf')return new Download(await this.pdf(`BÁO CÁO HALORA — ${c.params.reportType}`,report.columns,report.rows.map(r=>r.values),report.metrics.map(m=>`${m.label}: ${this.format(m.value,m.unit==='VND'?'MONEY':'NUMBER')}`)),'application/pdf',`${name}.pdf`);
    const workbook=new ExcelJS.Workbook();
    workbook.creator='Halora';
    const totals=workbook.addWorksheet('Chỉ tiêu');totals.addRow(['Chỉ tiêu','Giá trị','Đơn vị']);
    for(const m of report.metrics)totals.addRow([m.label,m.value,m.unit]);
    totals.columns=[{width:48},{width:28},{width:15}];
    const sheet=workbook.addWorksheet('Chi tiết');sheet.columns=report.columns.map(col=>({header:col.label,key:col.key,width:col.type==='DATETIME'?25:24}));
    for(const r of report.rows){const row:Row={};for(const col of report.columns)row[col.key]=r.values[col.key]??'';sheet.addRow(row);}
    sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];
    return new Download(Buffer.from(await workbook.xlsx.writeBuffer()),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',`${name}.xlsx`);
  }
  registerRoutes(routes:Routes):void{
    routes.add('POST','/admin/media',{permission:'media.create'},c=>this.media(c));
    routes.add('GET','/admin/invoices/{id}/export',{permission:'invoices.export'},c=>this.documentExport(c,'invoice'));
    routes.add('GET','/admin/goods-receipts/{id}/export',{permission:'goodsReceipts.export'},c=>this.documentExport(c,'receipt'));
    routes.add('GET','/admin/reports/{reportType}/export',{permission:'reports.export'},c=>this.reportExport(c));
  }
}
