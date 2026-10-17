-- Halora: bộ dữ liệu mẫu được nạp thủ công theo yêu cầu người dùng.
-- Chạy sau migration và bootstrap: pnpm db:seed:demo:docker
-- Tất cả tài khoản mẫu và admin hiện có dùng mật khẩu 123456 (Argon2id).
-- Không dùng trên hệ thống vận hành thật. Không tự nạp khi Docker khởi động.
-- Giữ schema.sql là bản cấu trúc; không sửa migration đã áp dụng.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh';
SET LOCAL lock_timeout = '10s';

CREATE OR REPLACE FUNCTION pg_temp.demo_id(kind text, n integer) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$ SELECT md5('halora-demo-v1:' || kind || ':' || n)::uuid $$;

DO $seed$
DECLARE
    admin_id uuid; admin_employee_id uuid; admin_name text; admin_count integer;
    demo_hash constant text := '$argon2id$v=19$m=19456,t=2,p=1$avcTGjSVGJgm53q5SlmldQ$Vs2PQiIn0eiMexLZVAalYpY45GOk38evafvWuYwDVfY';
    seed_marker uuid := pg_temp.demo_id('seed', 1);
    role_code text; user_prefix text; role_label text; person_name text; v_account_id uuid; v_employee_id uuid;
    i integer; j integer; p integer; k integer; supplier_no integer; customer_no integer;
    category_names text[] := ARRAY['Sữa rửa mặt','Toner','Serum','Kem dưỡng','Kem chống nắng','Son môi'];
    product_names text[] := ARRAY['Sữa rửa mặt dịu nhẹ','Sữa rửa mặt sạch sâu','Toner cấp ẩm','Toner cân bằng',
        'Serum vitamin C','Serum phục hồi','Kem dưỡng ban ngày','Kem dưỡng ban đêm',
        'Kem chống nắng SPF50','Kem chống nắng nâng tông','Son môi đỏ đất','Son môi hồng đào'];
    brand_names text[] := ARRAY['Halora','Glow Lab','Pure Skin'];
    state text; at_time timestamptz; sale_price numeric; cost_price numeric; qty integer; after_qty integer;
    subtotal numeric; product_discount numeric; order_discount numeric; voucher_discount numeric; payable numeric;
    line_amount numeric; line_discount numeric;
    variant_row record; receipt_total numeric;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('halora-demo-seed-v1',0));
    IF EXISTS (SELECT 1 FROM audit_logs WHERE id=seed_marker AND action='IMPORT_DEMO') THEN
        RAISE NOTICE 'Bộ mẫu v1 đã được nạp; giữ nguyên dữ liệu và mật khẩu hiện tại.';
        RETURN;
    END IF;
    SELECT count(DISTINCT a.id) INTO admin_count FROM accounts a
        JOIN employees e ON e.account_id=a.id JOIN employee_roles er ON er.employee_id=e.id
        JOIN roles r ON r.id=er.role_id WHERE r.code='ADMIN' AND a.realm='STAFF';
    IF admin_count<>1 THEN
        RAISE EXCEPTION 'Cần đúng 1 admin đã bootstrap; tìm thấy %. Không tạo thêm hoặc tự chọn admin.',admin_count;
    END IF;
    SELECT a.id,e.id,e.full_name INTO admin_id,admin_employee_id,admin_name FROM accounts a
        JOIN employees e ON e.account_id=a.id JOIN employee_roles er ON er.employee_id=e.id
        JOIN roles r ON r.id=er.role_id WHERE r.code='ADMIN';
    IF NOT EXISTS (SELECT 1 FROM accounts a JOIN employees e ON e.account_id=a.id
        WHERE a.id=admin_id AND a.status='ACTIVE' AND e.status='ACTIVE') THEN
        RAISE EXCEPTION 'Admin hiện có không hoạt động; không tự thay đổi trạng thái.';
    END IF;
    IF (SELECT count(*) FROM roles WHERE code IN ('ADMIN','SALES','WAREHOUSE','ACCOUNTANT','CUSTOMER'))<>5 THEN
        RAISE EXCEPTION 'Thiếu vai trò hệ thống. Hãy chạy migration trước.';
    END IF;

    -- 9 nhân viên: mỗi tài khoản có đúng một vai trò, không thêm admin.
    FOR i IN 1..3 LOOP
        role_code := (ARRAY['SALES','WAREHOUSE','ACCOUNTANT'])[i];
        user_prefix := (ARRAY['banhang','kho','ketoan'])[i];
        role_label := (ARRAY['Bán hàng','Kho','Kế toán'])[i];
        FOR j IN 1..3 LOOP
            k:=(i-1)*3+j; v_account_id:=pg_temp.demo_id('staff-account',k); v_employee_id:=pg_temp.demo_id('employee',k);
            person_name:=role_label || ' ' || lpad(j::text,2,'0');
            INSERT INTO accounts(id,realm,username,email,password_hash)
                VALUES(v_account_id,'STAFF',user_prefix||lpad(j::text,2,'0'),user_prefix||lpad(j::text,2,'0')||'@demo.halora.test',demo_hash);
            INSERT INTO employees(id,code,account_id,full_name,phone,email,position)
                VALUES(v_employee_id,halora_code('NV'),v_account_id,person_name,'09010000'||lpad(k::text,2,'0'),
                    user_prefix||lpad(j::text,2,'0')||'@demo.halora.test',role_label);
            INSERT INTO employee_roles(employee_id,role_id) SELECT v_employee_id,r.id FROM roles r WHERE r.code=role_code;
        END LOOP;
    END LOOP;

    -- 3 khách hàng, mỗi người có 2 địa chỉ và một giỏ hàng.
    FOR i IN 1..3 LOOP
        INSERT INTO accounts(id,realm,username,email,password_hash)
            VALUES(pg_temp.demo_id('customer-account',i),'CUSTOMER','khachhang'||lpad(i::text,2,'0'),
                'khachhang'||lpad(i::text,2,'0')||'@demo.halora.test',demo_hash);
        INSERT INTO customers(id,code,account_id,full_name,phone)
            VALUES(pg_temp.demo_id('customer',i),'KH'||lpad(i::text,2,'0'),pg_temp.demo_id('customer-account',i),
                (ARRAY['Nguyễn Minh Anh','Trần Ngọc Linh','Lê Hoàng Mai'])[i],'090200000'||i);
        FOR j IN 1..2 LOOP
            INSERT INTO customer_addresses(id,customer_id,recipient_name,recipient_phone,address_line,province_name,ward_name,is_default)
                SELECT pg_temp.demo_id('address',(i-1)*2+j),c.id,c.full_name,c.phone,
                    (10*i+j)||' Đường Hoa '||j,'Thành phố Hồ Chí Minh','Phường Bến Thành',j=1
                FROM customers c WHERE c.id=pg_temp.demo_id('customer',i);
        END LOOP;
        INSERT INTO carts(id,customer_id) VALUES(pg_temp.demo_id('cart',i),pg_temp.demo_id('customer',i));
    END LOOP;

    FOR i IN 1..6 LOOP
        INSERT INTO categories(id,code,name,description) VALUES(pg_temp.demo_id('category',i),'LSP'||lpad(i::text,2,'0'),
            category_names[i],'Phân loại sản phẩm theo công dụng.');
    END LOOP;
    FOR i IN 1..3 LOOP
        INSERT INTO brands(id,code,name,description) VALUES(pg_temp.demo_id('brand',i),'TH'||lpad(i::text,2,'0'),brand_names[i],'Thương hiệu mỹ phẩm.');
        INSERT INTO suppliers(id,code,name,contact_name,phone,email,address)
            VALUES(pg_temp.demo_id('supplier',i),'NCC'||lpad(i::text,2,'0'),'Nhà cung cấp mỹ phẩm '||i,
                'Liên hệ '||i,'090300000'||i,'nhacungcap'||i||'@demo.halora.test',i||' Đường Cung Ứng, Thành phố Hồ Chí Minh');
    END LOOP;
    FOR p IN 1..12 LOOP
        INSERT INTO products(id,code,name,slug,category_id,brand_id,description,ingredients,benefits,is_featured)
            VALUES(pg_temp.demo_id('product',p),'SP'||lpad(p::text,2,'0'),product_names[p],'san-pham-mau-'||p,
                pg_temp.demo_id('category',(p+1)/2),pg_temp.demo_id('brand',((p-1)%3)+1),
                'Sản phẩm chăm sóc và làm đẹp Halora.',
                'Thông tin thành phần sản phẩm.','Thông tin công dụng sản phẩm.',p<=4);
        FOR j IN 1..2 LOOP
            k:=(p-1)*2+j; sale_price:=120000+p*15000+j*25000; cost_price:=floor(sale_price*0.6); supplier_no:=((k-1)%3)+1;
            INSERT INTO product_variants(id,product_id,sku,name,color,volume_ml,weight_grams,sale_price,reference_cost_price,low_stock_threshold)
                VALUES(pg_temp.demo_id('variant',k),pg_temp.demo_id('product',p),'SKU'||lpad(k::text,2,'0'),
                    CASE WHEN p>=11 THEN (ARRAY['Màu tự nhiên','Màu đậm'])[j] ELSE (ARRAY['Chai nhỏ','Chai lớn'])[j] END,
                    CASE WHEN p>=11 THEN (ARRAY['Đỏ đất','Hồng đào'])[j] END,CASE WHEN p<11 THEN j*50 END,
                    CASE WHEN p>=11 THEN 3.5 END,sale_price,cost_price,5);
            INSERT INTO inventory_balances(variant_id) VALUES(pg_temp.demo_id('variant',k));
            INSERT INTO supplier_variants(id,supplier_id,variant_id,quoted_cost_price)
                VALUES(pg_temp.demo_id('supplier-variant',k),pg_temp.demo_id('supplier',supplier_no),pg_temp.demo_id('variant',k),cost_price);
        END LOOP;
    END LOOP;

    -- Phiếu nhập ghi nhận có đủ dòng tiền và bút toán kho, cùng transaction.
    FOR i IN 1..3 LOOP
        SELECT sum((CASE WHEN v.id=pg_temp.demo_id('variant',24) THEN 3 ELSE 50 END)*v.reference_cost_price)
            INTO receipt_total FROM product_variants v JOIN supplier_variants sv ON sv.variant_id=v.id WHERE sv.supplier_id=pg_temp.demo_id('supplier',i);
        INSERT INTO goods_receipts(id,receipt_code,supplier_id,supplier_name,employee_id,employee_name,received_at,posted_at,status,note,total_amount,created_at)
            SELECT pg_temp.demo_id('receipt',i),'PN'||lpad(i::text,2,'0'),s.id,s.name,e.id,e.full_name,now()-interval '10 days',now()-interval '10 days',
                'POSTED','Nhập hàng ban đầu',receipt_total,now()-interval '10 days'
            FROM suppliers s CROSS JOIN employees e WHERE s.id=pg_temp.demo_id('supplier',i) AND e.id=pg_temp.demo_id('employee',i+3);
        FOR variant_row IN SELECT v.*,p.name AS product_name FROM product_variants v JOIN products p ON p.id=v.product_id
            JOIN supplier_variants sv ON sv.variant_id=v.id WHERE sv.supplier_id=pg_temp.demo_id('supplier',i) ORDER BY v.sku LOOP
            qty:=CASE WHEN variant_row.id=pg_temp.demo_id('variant',24) THEN 3 ELSE 50 END;
            INSERT INTO goods_receipt_items(receipt_id,supplier_id,product_id,variant_id,product_name,variant_name,sku,quantity,unit_cost,line_total)
                VALUES(pg_temp.demo_id('receipt',i),pg_temp.demo_id('supplier',i),variant_row.product_id,variant_row.id,variant_row.product_name,
                    variant_row.name,variant_row.sku,qty,variant_row.reference_cost_price,qty*variant_row.reference_cost_price);
            UPDATE inventory_balances SET stock_quantity=qty,updated_at=now()-interval '10 days' WHERE variant_id=variant_row.id;
            INSERT INTO stock_movements(variant_id,sku,type,quantity_delta,quantity_after,source_type,source_id,account_id,performed_by_name,note,created_at)
                SELECT variant_row.id,variant_row.sku,'RECEIPT',qty,qty,'GOODS_RECEIPT',pg_temp.demo_id('receipt',i),e.account_id,e.full_name,
                    'Nhập hàng ban đầu',now()-interval '10 days' FROM employees e WHERE e.id=pg_temp.demo_id('employee',i+3);
        END LOOP;
    END LOOP;
    INSERT INTO goods_receipts(id,receipt_code,supplier_id,supplier_name,employee_id,employee_name,received_at,status,note,total_amount)
        SELECT pg_temp.demo_id('receipt',4),'PN04',s.id,s.name,e.id,e.full_name,now(),'DRAFT','Phiếu nhập đang soạn',sum(5*v.reference_cost_price)
        FROM suppliers s CROSS JOIN employees e JOIN supplier_variants sv ON sv.supplier_id=pg_temp.demo_id('supplier',1)
        JOIN product_variants v ON v.id=sv.variant_id WHERE s.id=pg_temp.demo_id('supplier',1) AND e.id=pg_temp.demo_id('employee',4)
        GROUP BY s.id,s.name,e.id,e.full_name;
    INSERT INTO goods_receipt_items(receipt_id,supplier_id,product_id,variant_id,product_name,variant_name,sku,quantity,unit_cost,line_total)
        SELECT pg_temp.demo_id('receipt',4),sv.supplier_id,v.product_id,v.id,p.name,v.name,v.sku,5,v.reference_cost_price,5*v.reference_cost_price
        FROM supplier_variants sv JOIN product_variants v ON v.id=sv.variant_id JOIN products p ON p.id=v.product_id
        WHERE sv.supplier_id=pg_temp.demo_id('supplier',1);

    INSERT INTO inventory_adjustments(id,adjustment_code,employee_id,employee_name,reason,status,posted_at,created_at)
        SELECT pg_temp.demo_id('adjustment',1),'DC01',e.id,e.full_name,'Kiểm kê chênh lệch hàng trưng bày','POSTED',now()-interval '8 days',now()-interval '8 days'
        FROM employees e WHERE e.id=pg_temp.demo_id('employee',4);
    FOR i IN 23..24 LOOP
        SELECT v.*,p.name AS product_name INTO variant_row FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=pg_temp.demo_id('variant',i);
        qty:=CASE WHEN i=23 THEN 3 ELSE -1 END;
        INSERT INTO inventory_adjustment_items(adjustment_id,variant_id,product_name,variant_name,sku,quantity_delta)
            VALUES(pg_temp.demo_id('adjustment',1),variant_row.id,variant_row.product_name,variant_row.name,variant_row.sku,qty);
        UPDATE inventory_balances SET stock_quantity=stock_quantity+qty,updated_at=now()-interval '8 days' WHERE variant_id=variant_row.id RETURNING stock_quantity INTO after_qty;
        INSERT INTO stock_movements(variant_id,sku,type,quantity_delta,quantity_after,source_type,source_id,account_id,performed_by_name,note,created_at)
            SELECT variant_row.id,variant_row.sku,'ADJUSTMENT',qty,after_qty,'INVENTORY_ADJUSTMENT',pg_temp.demo_id('adjustment',1),e.account_id,e.full_name,
                'Kiểm kê',now()-interval '8 days' FROM employees e WHERE e.id=pg_temp.demo_id('employee',4);
    END LOOP;

    INSERT INTO promotions(id,code,name,description,starts_at,ends_at,status,type)
        VALUES(pg_temp.demo_id('promotion',1),'KM01','Ưu đãi trải nghiệm sản phẩm','Ưu đãi cho sản phẩm.',now()-interval '30 days',now()+interval '90 days','ACTIVE','PRODUCT'),
            (pg_temp.demo_id('promotion',2),'KM02','Chương trình sắp triển khai','Chương trình đang soạn.',now()+interval '15 days',now()+interval '45 days','DRAFT','PRODUCT'),
            (pg_temp.demo_id('promotion',3),'KM03','Ưu đãi trải nghiệm hóa đơn','Ưu đãi tiền hàng của đơn.',now()-interval '30 days',now()+interval '90 days','ACTIVE','ORDER'),
            (pg_temp.demo_id('promotion',4),'KM04','Ưu đãi trải nghiệm voucher','Ưu đãi khi nhập mã voucher.',now()-interval '30 days',now()+interval '90 days','ACTIVE','VOUCHER');
    INSERT INTO product_promotion_rules(id,promotion_id,product_id,discount_percent,min_quantity,max_discount_amount)
        VALUES(pg_temp.demo_id('product-rule',1),pg_temp.demo_id('promotion',1),pg_temp.demo_id('product',1),10,1,50000);
    INSERT INTO order_promotion_rules(id,promotion_id,min_order_amount,discount_percent,max_discount_amount)
        VALUES(pg_temp.demo_id('order-rule',1),pg_temp.demo_id('promotion',3),500000,5,100000);
    INSERT INTO vouchers(id,promotion_id,code,discount_percent,min_order_amount,max_discount_amount,max_uses,per_customer_limit,status)
        VALUES(pg_temp.demo_id('voucher',1),pg_temp.demo_id('promotion',4),'VC01',10,200000,50000,100,3,'ACTIVE');

    -- 6 đơn: chờ xác nhận, xác nhận, đang giao, hoàn tất, hủy trước/sau xác nhận.
    FOR i IN 1..6 LOOP
        customer_no:=((i-1)%3)+1; at_time:=now()-make_interval(days=>7-i);
        state:=(ARRAY['PENDING_CONFIRMATION','CONFIRMED','SHIPPING','COMPLETED','CANCELLED','CANCELLED'])[i];
        subtotal:=0; product_discount:=0;
        FOR j IN 1..2 LOOP
            k:=(i-1)*2+j; SELECT * INTO variant_row FROM product_variants WHERE id=pg_temp.demo_id('variant',k);
            qty:=CASE WHEN j=1 THEN 2 ELSE 1 END; line_amount:=qty*variant_row.sale_price;
            line_discount:=CASE WHEN variant_row.product_id=pg_temp.demo_id('product',1) THEN least(floor(line_amount*0.10),50000) ELSE 0 END;
            subtotal:=subtotal+line_amount; product_discount:=product_discount+line_discount;
        END LOOP;
        order_discount:=CASE WHEN subtotal-product_discount>=500000 THEN least(floor((subtotal-product_discount)*0.05),100000) ELSE 0 END;
        voucher_discount:=least(floor((subtotal-product_discount-order_discount)*0.10),50000);
        payable:=subtotal-product_discount-order_discount-voucher_discount+30000;
        INSERT INTO orders(id,order_code,customer_id,customer_name,status,payment_method,recipient_name,recipient_phone,address_line,province_name,ward_name,note,
            subtotal_amount,product_discount_amount,order_discount_amount,voucher_discount_amount,shipping_fee,total_amount,
            confirmed_at,shipped_at,completed_at,cancelled_at,cancellation_reason,created_at)
            SELECT pg_temp.demo_id('order',i),'DH'||lpad(i::text,2,'0'),c.id,c.full_name,state,CASE WHEN i%2=0 THEN 'COD' ELSE 'BANK_TRANSFER' END,
                a.recipient_name,a.recipient_phone,a.address_line,a.province_name,a.ward_name,'Đơn hàng kiểm thử số '||i,
                subtotal,product_discount,order_discount,voucher_discount,30000,payable,
                CASE WHEN i IN (2,3,4,6) THEN at_time+interval '1 hour' END,CASE WHEN i IN (3,4) THEN at_time+interval '2 hours' END,
                CASE WHEN i=4 THEN at_time+interval '4 hours' END,CASE WHEN i IN (5,6) THEN at_time+interval '3 hours' END,
                CASE WHEN i IN (5,6) THEN 'Khách đổi nhu cầu' END,at_time
            FROM customers c JOIN customer_addresses a ON a.customer_id=c.id AND a.is_default WHERE c.id=pg_temp.demo_id('customer',customer_no);
        FOR j IN 1..2 LOOP
            k:=(i-1)*2+j; SELECT v.*,p.name AS product_name INTO variant_row FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=pg_temp.demo_id('variant',k);
            qty:=CASE WHEN j=1 THEN 2 ELSE 1 END; line_amount:=qty*variant_row.sale_price;
            line_discount:=CASE WHEN variant_row.product_id=pg_temp.demo_id('product',1) THEN least(floor(line_amount*0.10),50000) ELSE 0 END;
            INSERT INTO order_items(id,order_id,product_id,variant_id,product_name,variant_name,sku,quantity,unit_price,line_subtotal,product_discount_amount,line_total,product_promotion_rule_id)
                VALUES(pg_temp.demo_id('order-item',k),pg_temp.demo_id('order',i),variant_row.product_id,variant_row.id,variant_row.product_name,
                    variant_row.name,variant_row.sku,qty,variant_row.sale_price,line_amount,line_discount,line_amount-line_discount,
                    CASE WHEN line_discount>0 THEN pg_temp.demo_id('product-rule',1) END);
            IF line_discount>0 THEN
                INSERT INTO order_discounts(order_id,scope,promotion_id,promotion_name,variant_id,product_rule_id,amount)
                    VALUES(pg_temp.demo_id('order',i),'PRODUCT',pg_temp.demo_id('promotion',1),'Ưu đãi trải nghiệm sản phẩm',variant_row.id,pg_temp.demo_id('product-rule',1),line_discount);
            END IF;
            IF i IN (2,3,4,6) THEN
                UPDATE inventory_balances SET stock_quantity=stock_quantity-qty,updated_at=at_time+interval '1 hour' WHERE variant_id=variant_row.id RETURNING stock_quantity INTO after_qty;
                INSERT INTO stock_movements(variant_id,sku,type,quantity_delta,quantity_after,source_type,source_id,account_id,performed_by_name,note,created_at)
                    SELECT variant_row.id,variant_row.sku,'SALE',-qty,after_qty,'ORDER',pg_temp.demo_id('order',i),e.account_id,e.full_name,
                        'Xác nhận đơn',at_time+interval '1 hour' FROM employees e WHERE e.id=pg_temp.demo_id('employee',1);
                IF i=6 THEN
                    UPDATE inventory_balances SET stock_quantity=stock_quantity+qty,updated_at=at_time+interval '3 hours' WHERE variant_id=variant_row.id RETURNING stock_quantity INTO after_qty;
                    INSERT INTO stock_movements(variant_id,sku,type,quantity_delta,quantity_after,source_type,source_id,account_id,performed_by_name,note,created_at)
                        SELECT variant_row.id,variant_row.sku,'CANCELLATION',qty,after_qty,'ORDER_CANCEL',pg_temp.demo_id('order',i),e.account_id,e.full_name,
                            'Hủy và hoàn kho',at_time+interval '3 hours' FROM employees e WHERE e.id=pg_temp.demo_id('employee',1);
                END IF;
            END IF;
        END LOOP;
        IF order_discount>0 THEN
            INSERT INTO order_discounts(order_id,scope,promotion_id,promotion_name,order_rule_id,amount)
                VALUES(pg_temp.demo_id('order',i),'ORDER',pg_temp.demo_id('promotion',3),'Ưu đãi trải nghiệm hóa đơn',pg_temp.demo_id('order-rule',1),order_discount);
        END IF;
        INSERT INTO order_discounts(order_id,scope,promotion_id,promotion_name,voucher_id,voucher_code,amount)
            VALUES(pg_temp.demo_id('order',i),'VOUCHER',pg_temp.demo_id('promotion',4),'Ưu đãi trải nghiệm voucher',pg_temp.demo_id('voucher',1),'VC01',voucher_discount);
        INSERT INTO voucher_redemptions(voucher_id,order_id,customer_id,status,created_at)
            VALUES(pg_temp.demo_id('voucher',1),pg_temp.demo_id('order',i),pg_temp.demo_id('customer',customer_no),
                CASE WHEN i IN (2,3,4) THEN 'USED' WHEN i IN (5,6) THEN 'RELEASED' ELSE 'HELD' END,at_time);
        INSERT INTO order_status_history(order_id,from_status,to_status,account_id,performed_by_name,created_at)
            SELECT pg_temp.demo_id('order',i),NULL,'PENDING_CONFIRMATION',c.account_id,c.full_name,at_time FROM customers c WHERE c.id=pg_temp.demo_id('customer',customer_no);
        IF i IN (2,3,4,6) THEN
            INSERT INTO order_status_history(order_id,from_status,to_status,account_id,performed_by_name,created_at)
                SELECT pg_temp.demo_id('order',i),'PENDING_CONFIRMATION','CONFIRMED',e.account_id,e.full_name,at_time+interval '1 hour' FROM employees e WHERE e.id=pg_temp.demo_id('employee',1);
        END IF;
        IF i IN (3,4) THEN
            INSERT INTO order_status_history(order_id,from_status,to_status,account_id,performed_by_name,created_at)
                SELECT pg_temp.demo_id('order',i),'CONFIRMED','SHIPPING',e.account_id,e.full_name,at_time+interval '2 hours' FROM employees e WHERE e.id=pg_temp.demo_id('employee',4);
        END IF;
        IF i IN (4,5,6) THEN
            INSERT INTO order_status_history(order_id,from_status,to_status,note,account_id,performed_by_name,created_at)
                SELECT pg_temp.demo_id('order',i),CASE WHEN i=4 THEN 'SHIPPING' WHEN i=5 THEN 'PENDING_CONFIRMATION' ELSE 'CONFIRMED' END,
                    state,CASE WHEN i<>4 THEN 'Khách đổi nhu cầu' END,e.account_id,e.full_name,
                    at_time+CASE WHEN i=4 THEN interval '4 hours' ELSE interval '3 hours' END FROM employees e WHERE e.id=pg_temp.demo_id('employee',1);
        END IF;
        IF i IN (2,3,4,6) THEN
            INSERT INTO payments(id,order_id,method,amount,status,reference,note,paid_at,created_by,created_at)
                SELECT pg_temp.demo_id('payment',i),o.id,o.payment_method,o.total_amount,CASE WHEN i=2 THEN 'PENDING' ELSE 'SUCCEEDED' END,
                    'TT'||lpad(i::text,2,'0'),'Thanh toán kiểm thử',CASE WHEN i<>2 THEN at_time+interval '150 minutes' END,e.account_id,at_time+interval '90 minutes'
                FROM orders o CROSS JOIN employees e WHERE o.id=pg_temp.demo_id('order',i) AND e.id=pg_temp.demo_id('employee',7);
        END IF;
        IF i=6 THEN
            INSERT INTO refunds(id,order_id,payment_id,amount,status,reference,reason,refunded_at,created_at)
                VALUES(pg_temp.demo_id('refund',1),pg_temp.demo_id('order',i),pg_temp.demo_id('payment',i),payable,'SUCCEEDED','HT01',
                    'Hoàn tiền đơn đã hủy',at_time+interval '4 hours',at_time+interval '3 hours');
        END IF;
        IF i=4 THEN
            INSERT INTO invoices(id,invoice_code,order_id,order_code,employee_id,employee_name,status,issued_at,note,total_amount,created_at)
                SELECT pg_temp.demo_id('invoice',i),halora_code('HD'),pg_temp.demo_id('order',i),'DH'||lpad(i::text,2,'0'),e.id,e.full_name,
                    CASE WHEN i=4 THEN 'POSTED' ELSE 'DRAFT' END,CASE WHEN i=4 THEN at_time+interval '5 hours' END,
                    'Hóa đơn theo giá gốc dòng hàng',subtotal,at_time+interval '150 minutes' FROM employees e WHERE e.id=pg_temp.demo_id('employee',7);
            INSERT INTO invoice_items(invoice_id,product_id,variant_id,product_name,variant_name,sku,quantity,unit_price,line_total)
                SELECT pg_temp.demo_id('invoice',i),product_id,variant_id,product_name,variant_name,sku,quantity,unit_price,line_subtotal
                FROM order_items WHERE order_id=pg_temp.demo_id('order',i);
        END IF;
    END LOOP;
    FOR i IN 1..3 LOOP
        FOR j IN 1..2 LOOP
            k:=12+(i-1)*2+j;
            INSERT INTO cart_items(cart_id,product_id,variant_id,quantity)
                SELECT pg_temp.demo_id('cart',i),v.product_id,v.id,j FROM product_variants v WHERE v.id=pg_temp.demo_id('variant',k);
        END LOOP;
    END LOOP;

    INSERT INTO audit_logs(account_id,employee_id,performed_by_name,action,entity_type,entity_id,created_at)
        SELECT e.account_id,e.id,e.full_name,'POST','goods_receipts',g.id,g.posted_at
        FROM goods_receipts g JOIN employees e ON e.id=g.employee_id
        WHERE g.id IN (SELECT pg_temp.demo_id('receipt',n) FROM generate_series(1,3) n);
    INSERT INTO audit_logs(account_id,employee_id,performed_by_name,action,entity_type,entity_id,created_at)
        SELECT h.account_id,e.id,h.performed_by_name,h.to_status,'orders',h.order_id,h.created_at
        FROM order_status_history h LEFT JOIN employees e ON e.account_id=h.account_id
        WHERE h.order_id IN (SELECT pg_temp.demo_id('order',n) FROM generate_series(1,6) n);
    INSERT INTO audit_logs(account_id,employee_id,performed_by_name,action,entity_type,entity_id,created_at)
        SELECT p.created_by,e.id,e.full_name,'CONFIRM','payments',p.id,p.paid_at
        FROM payments p JOIN employees e ON e.account_id=p.created_by
        WHERE p.id IN (SELECT pg_temp.demo_id('payment',n) FROM generate_series(1,6) n) AND p.status='SUCCEEDED';

    -- Chỉ lần nạp đầu: đổi mật khẩu admin đã có, thu hồi phiên/reset token cũ.
    UPDATE accounts SET password_hash=demo_hash,auth_version=auth_version+1 WHERE id=admin_id;
    UPDATE auth_sessions SET revoked_at=now() WHERE account_id=admin_id AND revoked_at IS NULL;
    UPDATE password_reset_tokens SET used_at=now() WHERE account_id=admin_id AND used_at IS NULL;
    INSERT INTO audit_logs(id,account_id,employee_id,performed_by_name,action,entity_type,entity_id)
        VALUES(seed_marker,admin_id,admin_employee_id,admin_name,'IMPORT_DEMO','demo_seed',seed_marker);
    IF EXISTS (SELECT 1 FROM inventory_balances b LEFT JOIN stock_movements m ON m.variant_id=b.variant_id
        WHERE b.variant_id IN (SELECT pg_temp.demo_id('variant',n) FROM generate_series(1,24) n)
        GROUP BY b.variant_id,b.stock_quantity HAVING b.stock_quantity<>COALESCE(sum(m.quantity_delta),0)) THEN
        RAISE EXCEPTION 'Bộ mẫu có số dư kho không khớp sổ; rollback toàn bộ.';
    END IF;
    RAISE NOTICE 'HALORA_DEMO_APPLIED: 12 tài khoản mới, giữ 1 admin, 12 sản phẩm/24 SKU và 6 đơn hàng.';
END
$seed$;
COMMIT;
