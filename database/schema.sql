-- Halora PostgreSQL 18: install once into an empty database.
-- Existing databases must use versioned migrations.
--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: discount_percent; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.discount_percent AS numeric(5,2)
	CONSTRAINT discount_percent_check CHECK (((VALUE >= (0)::numeric) AND (VALUE <= (100)::numeric)));


--
-- Name: money_vnd; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.money_vnd AS numeric(18,0)
	CONSTRAINT money_vnd_check CHECK ((VALUE >= (0)::numeric));


--
-- Name: halora_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.halora_code(prefix text) RETURNS text
    LANGUAGE sql
    AS $$
  SELECT prefix || '-' || lpad(nextval('business_code_sequence')::text, 10, '0')
$$;


--
-- Name: halora_touch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.halora_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = clock_timestamp(); NEW.version = OLD.version + 1; RETURN NEW; END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    realm text NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    auth_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT accounts_realm_check CHECK ((realm = ANY (ARRAY['STAFF'::text, 'CUSTOMER'::text]))),
    CONSTRAINT accounts_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'LOCKED'::text, 'INACTIVE'::text]))),
    CONSTRAINT accounts_username_check CHECK ((length(TRIM(BOTH FROM username)) > 0))
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text DEFAULT public.halora_code('KH'::text) NOT NULL,
    account_id uuid NOT NULL,
    account_realm text DEFAULT 'CUSTOMER'::text NOT NULL,
    full_name text NOT NULL,
    phone text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT customers_account_realm_check CHECK ((account_realm = 'CUSTOMER'::text)),
    CONSTRAINT customers_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text DEFAULT public.halora_code('NV'::text) NOT NULL,
    account_id uuid,
    account_realm text DEFAULT 'STAFF'::text NOT NULL,
    full_name text NOT NULL,
    phone text NOT NULL,
    email text NOT NULL,
    "position" text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT employees_account_realm_check CHECK ((account_realm = 'STAFF'::text)),
    CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);


--
-- Name: api_accounts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_accounts AS
 SELECT a.id,
    a.realm,
    a.username,
    a.email,
    a.status,
    a.created_at,
    a.updated_at,
    a.version,
    c.id AS customer_id,
    e.id AS employee_id
   FROM ((public.accounts a
     LEFT JOIN public.customers c ON ((c.account_id = a.id)))
     LEFT JOIN public.employees e ON ((e.account_id = a.id)));


--
-- Name: inventory_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_balances (
    variant_id uuid NOT NULL,
    stock_quantity integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_balances_stock_quantity_check CHECK ((stock_quantity >= 0))
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    color text,
    volume_ml double precision,
    weight_grams double precision,
    sale_price public.money_vnd NOT NULL,
    reference_cost_price public.money_vnd,
    low_stock_threshold integer DEFAULT 5 NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT product_variants_low_stock_threshold_check CHECK ((low_stock_threshold >= 0)),
    CONSTRAINT product_variants_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]))),
    CONSTRAINT product_variants_volume_ml_check CHECK ((volume_ml > (0)::double precision)),
    CONSTRAINT product_variants_weight_grams_check CHECK ((weight_grams > (0)::double precision))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text DEFAULT public.halora_code('SP'::text) NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    category_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    description text,
    ingredients text,
    benefits text,
    is_featured boolean DEFAULT false NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT products_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);


--
-- Name: api_balances; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_balances AS
 SELECT v.id AS variant_id,
    v.product_id,
    p.name AS product_name,
    v.name AS variant_name,
    v.sku,
    COALESCE(b.stock_quantity, 0) AS stock_quantity,
    v.low_stock_threshold,
    COALESCE(b.updated_at, v.updated_at) AS updated_at
   FROM ((public.product_variants v
     JOIN public.products p ON ((p.id = v.product_id)))
     LEFT JOIN public.inventory_balances b ON ((b.variant_id = v.id)));


--
-- Name: api_customers; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_customers AS
 SELECT c.id,
    c.code,
    c.account_id,
    c.full_name,
    c.phone,
    a.email,
    c.status,
    a.status AS account_status,
    c.created_at,
    c.updated_at,
    c.version
   FROM (public.customers c
     JOIN public.accounts a ON ((a.id = c.account_id)));


--
-- Name: order_discounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_discounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    scope text NOT NULL,
    promotion_id uuid NOT NULL,
    promotion_name text NOT NULL,
    variant_id uuid,
    product_rule_id uuid,
    order_rule_id uuid,
    voucher_id uuid,
    voucher_code text,
    amount public.money_vnd NOT NULL,
    CONSTRAINT order_discounts_check CHECK ((((scope = 'PRODUCT'::text) AND (product_rule_id IS NOT NULL) AND (variant_id IS NOT NULL) AND (order_rule_id IS NULL) AND (voucher_id IS NULL)) OR ((scope = 'ORDER'::text) AND (order_rule_id IS NOT NULL) AND (variant_id IS NULL) AND (product_rule_id IS NULL) AND (voucher_id IS NULL)) OR ((scope = 'VOUCHER'::text) AND (voucher_id IS NOT NULL) AND (variant_id IS NULL) AND (product_rule_id IS NULL) AND (order_rule_id IS NULL)))),
    CONSTRAINT order_discounts_scope_check CHECK ((scope = ANY (ARRAY['PRODUCT'::text, 'ORDER'::text, 'VOUCHER'::text])))
);


--
-- Name: api_discounts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_discounts AS
 SELECT scope,
    promotion_id,
    COALESCE(product_rule_id, order_rule_id, voucher_id) AS rule_id,
    variant_id,
    promotion_name,
    voucher_code,
    amount,
    order_id
   FROM public.order_discounts;


--
-- Name: employee_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_roles (
    employee_id uuid NOT NULL,
    role_id uuid NOT NULL
);


--
-- Name: api_employees; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_employees AS
 SELECT id,
    code,
    account_id,
    full_name,
    phone,
    email,
    "position",
    status,
    created_at,
    updated_at,
    version,
    COALESCE(( SELECT array_agg(er.role_id ORDER BY er.role_id) AS array_agg
           FROM public.employee_roles er
          WHERE (er.employee_id = e.id)), '{}'::uuid[]) AS role_ids
   FROM public.employees e;


--
-- Name: media_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    url text NOT NULL,
    storage_name text NOT NULL,
    mime_type text NOT NULL,
    size integer NOT NULL,
    original_name text NOT NULL,
    account_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_assets_size_check CHECK ((size > 0))
);


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    media_id uuid NOT NULL,
    alt_text text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT product_images_sort_order_check CHECK ((sort_order >= 0))
);


--
-- Name: api_images; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_images AS
 SELECT i.id,
    i.product_id,
    i.variant_id,
    i.media_id,
    i.alt_text,
    i.sort_order,
    i.created_at,
    i.updated_at,
    i.version,
    m.url
   FROM (public.product_images i
     JOIN public.media_assets m ON ((m.id = i.media_id)));


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_code text DEFAULT public.halora_code('DH'::text) NOT NULL,
    customer_id uuid NOT NULL,
    customer_name text NOT NULL,
    status text DEFAULT 'PENDING_CONFIRMATION'::text NOT NULL,
    payment_method text NOT NULL,
    recipient_name text NOT NULL,
    recipient_phone text NOT NULL,
    address_line text NOT NULL,
    province_name text NOT NULL,
    ward_name text NOT NULL,
    note text,
    subtotal_amount public.money_vnd NOT NULL,
    product_discount_amount public.money_vnd NOT NULL,
    order_discount_amount public.money_vnd NOT NULL,
    voucher_discount_amount public.money_vnd NOT NULL,
    shipping_fee public.money_vnd NOT NULL,
    total_amount public.money_vnd NOT NULL,
    confirmed_at timestamp with time zone,
    shipped_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT orders_check CHECK (((((product_discount_amount)::numeric + (order_discount_amount)::numeric) + (voucher_discount_amount)::numeric) <= (subtotal_amount)::numeric)),
    CONSTRAINT orders_check1 CHECK (((total_amount)::numeric = (((((subtotal_amount)::numeric - (product_discount_amount)::numeric) - (order_discount_amount)::numeric) - (voucher_discount_amount)::numeric) + (shipping_fee)::numeric))),
    CONSTRAINT orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['COD'::text, 'BANK_TRANSFER'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['PENDING_CONFIRMATION'::text, 'CONFIRMED'::text, 'SHIPPING'::text, 'COMPLETED'::text, 'CANCELLED'::text])))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    method text NOT NULL,
    amount public.money_vnd NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    reference text,
    note text,
    paid_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_check CHECK (((amount)::numeric > (0)::numeric)),
    CONSTRAINT payments_method_check CHECK ((method = ANY (ARRAY['COD'::text, 'BANK_TRANSFER'::text]))),
    CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'SUCCEEDED'::text, 'FAILED'::text, 'CANCELLED'::text])))
);


--
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    amount public.money_vnd NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    reference text,
    reason text,
    refunded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT refunds_amount_check CHECK (((amount)::numeric > (0)::numeric)),
    CONSTRAINT refunds_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'SUCCEEDED'::text, 'FAILED'::text])))
);


--
-- Name: api_orders; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_orders AS
 SELECT id,
    order_code,
    customer_id,
    customer_name,
    status,
    payment_method,
    recipient_name,
    recipient_phone,
    address_line,
    province_name,
    ward_name,
    note,
    subtotal_amount,
    product_discount_amount,
    order_discount_amount,
    voucher_discount_amount,
    shipping_fee,
    total_amount,
    confirmed_at,
    shipped_at,
    completed_at,
    cancelled_at,
    cancellation_reason,
    created_at,
    updated_at,
    version,
    (COALESCE(( SELECT sum((p.amount)::numeric) AS sum
           FROM public.payments p
          WHERE ((p.order_id = o.id) AND (p.status = 'SUCCEEDED'::text))), (0)::numeric))::numeric(18,0) AS paid_amount,
    (COALESCE(( SELECT sum((r.amount)::numeric) AS sum
           FROM public.refunds r
          WHERE ((r.order_id = o.id) AND (r.status = 'SUCCEEDED'::text))), (0)::numeric))::numeric(18,0) AS refunded_amount
   FROM public.orders o;


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text DEFAULT public.halora_code('KM'::text) NOT NULL,
    name text NOT NULL,
    description text,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT promotions_check CHECK ((starts_at <= ends_at)),
    CONSTRAINT promotions_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'PAUSED'::text, 'ENDED'::text])))
);


--
-- Name: api_promotions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_promotions AS
 SELECT id,
    code,
    name,
    description,
    starts_at,
    ends_at,
    status,
    created_at,
    updated_at,
    version,
    (EXISTS ( SELECT 1
           FROM public.order_discounts d
          WHERE (d.promotion_id = p.id))) AS has_usage
   FROM public.promotions p;


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text DEFAULT public.halora_code('TH'::text) NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT brands_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text DEFAULT public.halora_code('LSP'::text) NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT categories_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);


--
-- Name: TABLE categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.categories IS 'Loại sản phẩm';


--
-- Name: api_public_products; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_public_products AS
 SELECT p.id,
    p.code,
    p.name,
    p.slug,
    p.category_id,
    c.name AS category_name,
    p.brand_id,
    b.name AS brand_name,
    p.is_featured,
    p.created_at,
    ( SELECT i.url
           FROM public.api_images i
          WHERE (i.product_id = p.id)
          ORDER BY i.sort_order, i.id
         LIMIT 1) AS thumbnail_url,
    ( SELECT (min((v.sale_price)::numeric))::numeric(18,0) AS min
           FROM public.product_variants v
          WHERE ((v.product_id = p.id) AND (v.status = 'ACTIVE'::text))) AS price_from
   FROM ((public.products p
     JOIN public.categories c ON ((c.id = p.category_id)))
     JOIN public.brands b ON ((b.id = p.brand_id)))
  WHERE ((p.status = 'ACTIVE'::text) AND (c.status = 'ACTIVE'::text) AND (b.status = 'ACTIVE'::text));


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: api_roles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_roles AS
 SELECT id,
    code,
    name,
    description,
    created_at,
    updated_at,
    version,
    COALESCE(( SELECT array_agg(rp.permission_id ORDER BY rp.permission_id) AS array_agg
           FROM public.role_permissions rp
          WHERE (rp.role_id = r.id)), '{}'::uuid[]) AS permission_ids
   FROM public.roles r;


--
-- Name: supplier_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    quoted_cost_price public.money_vnd NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT supplier_variants_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);


--
-- Name: api_supplier_variants; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_supplier_variants AS
 SELECT s.id,
    s.supplier_id,
    s.variant_id,
    s.quoted_cost_price,
    s.status,
    s.created_at,
    s.updated_at,
    s.version,
    p.name AS product_name,
    v.name AS variant_name,
    v.sku
   FROM ((public.supplier_variants s
     JOIN public.product_variants v ON ((v.id = s.variant_id)))
     JOIN public.products p ON ((p.id = v.product_id)));


--
-- Name: api_variants; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_variants AS
 SELECT v.id,
    v.product_id,
    v.sku,
    v.name,
    v.color,
    v.volume_ml,
    v.weight_grams,
    v.sale_price,
    v.reference_cost_price,
    v.low_stock_threshold,
    v.status,
    v.created_at,
    v.updated_at,
    v.version,
    COALESCE(b.stock_quantity, 0) AS stock_quantity
   FROM (public.product_variants v
     LEFT JOIN public.inventory_balances b ON ((b.variant_id = v.id)));


--
-- Name: voucher_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voucher_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    voucher_id uuid NOT NULL,
    order_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT voucher_redemptions_status_check CHECK ((status = ANY (ARRAY['HELD'::text, 'USED'::text, 'RELEASED'::text])))
);


--
-- Name: vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_id uuid NOT NULL,
    code text NOT NULL,
    discount_percent public.discount_percent NOT NULL,
    min_order_amount public.money_vnd NOT NULL,
    max_discount_amount public.money_vnd,
    max_uses integer,
    per_customer_limit integer NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT vouchers_max_uses_check CHECK ((max_uses > 0)),
    CONSTRAINT vouchers_per_customer_limit_check CHECK ((per_customer_limit > 0)),
    CONSTRAINT vouchers_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);


--
-- Name: api_vouchers; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_vouchers AS
 SELECT id,
    promotion_id,
    code,
    discount_percent,
    min_order_amount,
    max_discount_amount,
    max_uses,
    per_customer_limit,
    status,
    created_at,
    updated_at,
    version,
    ( SELECT (count(*))::integer AS count
           FROM public.voucher_redemptions r
          WHERE ((r.voucher_id = v.id) AND (r.status = 'USED'::text))) AS used_count,
    ( SELECT (count(*))::integer AS count
           FROM public.voucher_redemptions r
          WHERE ((r.voucher_id = v.id) AND (r.status = 'HELD'::text))) AS reserved_count
   FROM public.vouchers v;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    employee_id uuid,
    performed_by_name text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    request_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    refresh_token_hash text NOT NULL,
    previous_token_hash text,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: business_code_sequence; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.business_code_sequence
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cart_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    quantity integer NOT NULL,
    CONSTRAINT cart_items_quantity_check CHECK (((quantity > 0) AND (quantity <= 1000000)))
);


--
-- Name: carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: customer_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    recipient_name text NOT NULL,
    recipient_phone text NOT NULL,
    address_line text NOT NULL,
    province_name text NOT NULL,
    ward_name text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: goods_receipt_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipt_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    product_name text NOT NULL,
    variant_name text NOT NULL,
    sku text NOT NULL,
    quantity integer NOT NULL,
    unit_cost public.money_vnd NOT NULL,
    line_total public.money_vnd NOT NULL,
    CONSTRAINT goods_receipt_items_check CHECK (((line_total)::numeric = ((quantity)::numeric * (unit_cost)::numeric))),
    CONSTRAINT goods_receipt_items_quantity_check CHECK (((quantity > 0) AND (quantity <= 1000000)))
);


--
-- Name: goods_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_code text DEFAULT public.halora_code('PN'::text) NOT NULL,
    supplier_id uuid NOT NULL,
    supplier_name text NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text NOT NULL,
    received_at timestamp with time zone NOT NULL,
    posted_at timestamp with time zone,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    note text,
    total_amount public.money_vnd DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT goods_receipts_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'POSTED'::text, 'CANCELLED'::text])))
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_keys (
    account_id uuid NOT NULL,
    key uuid NOT NULL,
    fingerprint text NOT NULL,
    response_body jsonb NOT NULL,
    status_code integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE idempotency_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.idempotency_keys IS 'Kết quả thao tác đã commit, khóa duy nhất theo tài khoản và Idempotency-Key';


--
-- Name: inventory_adjustment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_adjustment_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    adjustment_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    product_name text NOT NULL,
    variant_name text NOT NULL,
    sku text NOT NULL,
    quantity_delta integer NOT NULL,
    CONSTRAINT inventory_adjustment_items_quantity_delta_check CHECK (((quantity_delta <> 0) AND ((quantity_delta >= '-1000000'::integer) AND (quantity_delta <= 1000000))))
);


--
-- Name: inventory_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    adjustment_code text DEFAULT public.halora_code('DC'::text) NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    posted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT inventory_adjustments_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'POSTED'::text, 'CANCELLED'::text])))
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    product_name text NOT NULL,
    variant_name text NOT NULL,
    sku text NOT NULL,
    quantity integer NOT NULL,
    unit_price public.money_vnd NOT NULL,
    line_total public.money_vnd NOT NULL,
    CONSTRAINT invoice_items_check CHECK (((line_total)::numeric = ((quantity)::numeric * (unit_price)::numeric))),
    CONSTRAINT invoice_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_code text DEFAULT public.halora_code('HD'::text) NOT NULL,
    order_id uuid NOT NULL,
    order_code text NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    issued_at timestamp with time zone,
    note text,
    total_amount public.money_vnd DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'POSTED'::text, 'CANCELLED'::text])))
);


--
-- Name: TABLE invoices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.invoices IS 'Tổng giá gốc dòng hàng; ưu đãi và phí giao hàng theo dõi tại đơn';


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    product_name text NOT NULL,
    variant_name text NOT NULL,
    sku text NOT NULL,
    thumbnail_url text,
    quantity integer NOT NULL,
    unit_price public.money_vnd NOT NULL,
    line_subtotal public.money_vnd NOT NULL,
    product_discount_amount public.money_vnd NOT NULL,
    line_total public.money_vnd NOT NULL,
    product_promotion_rule_id uuid,
    CONSTRAINT order_items_check CHECK (((line_subtotal)::numeric = ((quantity)::numeric * (unit_price)::numeric))),
    CONSTRAINT order_items_check1 CHECK (((line_total)::numeric = ((line_subtotal)::numeric - (product_discount_amount)::numeric))),
    CONSTRAINT order_items_quantity_check CHECK (((quantity > 0) AND (quantity <= 1000000)))
);


--
-- Name: order_promotion_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_promotion_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_id uuid NOT NULL,
    min_order_amount public.money_vnd NOT NULL,
    discount_percent public.discount_percent NOT NULL,
    max_discount_amount public.money_vnd,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    from_status text,
    to_status text NOT NULL,
    note text,
    account_id uuid NOT NULL,
    performed_by_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text NOT NULL
);


--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: product_promotion_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_promotion_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    discount_percent public.discount_percent NOT NULL,
    min_quantity integer NOT NULL,
    max_discount_amount public.money_vnd,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT product_promotion_rules_min_quantity_check CHECK ((min_quantity > 0))
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    variant_id uuid NOT NULL,
    sku text NOT NULL,
    type text NOT NULL,
    quantity_delta integer NOT NULL,
    quantity_after integer NOT NULL,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    account_id uuid NOT NULL,
    performed_by_name text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_movements_quantity_after_check CHECK ((quantity_after >= 0)),
    CONSTRAINT stock_movements_quantity_delta_check CHECK ((quantity_delta <> 0)),
    CONSTRAINT stock_movements_type_check CHECK ((type = ANY (ARRAY['RECEIPT'::text, 'SALE'::text, 'CANCELLATION'::text, 'ADJUSTMENT'::text])))
);


--
-- Name: TABLE stock_movements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stock_movements IS 'Bút toán kho ghi tại lúc xác nhận, không ghi lùi theo ngày chứng từ';


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text DEFAULT public.halora_code('NCC'::text) NOT NULL,
    name text NOT NULL,
    contact_name text NOT NULL,
    phone text NOT NULL,
    email text NOT NULL,
    address text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT suppliers_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: accounts accounts_id_realm_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_id_realm_key UNIQUE (id, realm);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_refresh_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_refresh_token_hash_key UNIQUE (refresh_token_hash);


--
-- Name: brands brands_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_code_key UNIQUE (code);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_cart_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_variant_id_key UNIQUE (cart_id, variant_id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: carts carts_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_customer_id_key UNIQUE (customer_id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: categories categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_code_key UNIQUE (code);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: customer_addresses customer_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_pkey PRIMARY KEY (id);


--
-- Name: customers customers_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_account_id_key UNIQUE (account_id);


--
-- Name: customers customers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_code_key UNIQUE (code);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: employee_roles employee_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_roles
    ADD CONSTRAINT employee_roles_pkey PRIMARY KEY (employee_id, role_id);


--
-- Name: employees employees_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_account_id_key UNIQUE (account_id);


--
-- Name: employees employees_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_code_key UNIQUE (code);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: goods_receipt_items goods_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: goods_receipt_items goods_receipt_items_receipt_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_receipt_id_variant_id_key UNIQUE (receipt_id, variant_id);


--
-- Name: goods_receipts goods_receipts_id_supplier_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_id_supplier_id_key UNIQUE (id, supplier_id);


--
-- Name: goods_receipts goods_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_pkey PRIMARY KEY (id);


--
-- Name: goods_receipts goods_receipts_receipt_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_receipt_code_key UNIQUE (receipt_code);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (account_id, key);


--
-- Name: inventory_adjustment_items inventory_adjustment_items_adjustment_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustment_items
    ADD CONSTRAINT inventory_adjustment_items_adjustment_id_variant_id_key UNIQUE (adjustment_id, variant_id);


--
-- Name: inventory_adjustment_items inventory_adjustment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustment_items
    ADD CONSTRAINT inventory_adjustment_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_adjustments inventory_adjustments_adjustment_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_adjustment_code_key UNIQUE (adjustment_code);


--
-- Name: inventory_adjustments inventory_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_pkey PRIMARY KEY (id);


--
-- Name: inventory_balances inventory_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_balances
    ADD CONSTRAINT inventory_balances_pkey PRIMARY KEY (variant_id);


--
-- Name: invoice_items invoice_items_invoice_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_variant_id_key UNIQUE (invoice_id, variant_id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_code_key UNIQUE (invoice_code);


--
-- Name: invoices invoices_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_order_id_key UNIQUE (order_id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: media_assets media_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);


--
-- Name: media_assets media_assets_storage_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_storage_name_key UNIQUE (storage_name);


--
-- Name: order_discounts order_discounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_discounts
    ADD CONSTRAINT order_discounts_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_order_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_variant_id_key UNIQUE (order_id, variant_id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_promotion_rules order_promotion_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_promotion_rules
    ADD CONSTRAINT order_promotion_rules_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_code_key UNIQUE (order_code);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_promotion_rules product_promotion_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_promotion_rules
    ADD CONSTRAINT product_promotion_rules_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_product_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_id_key UNIQUE (product_id, id);


--
-- Name: products products_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_code_key UNIQUE (code);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: promotions promotions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_code_key UNIQUE (code);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: refunds refunds_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_payment_id_key UNIQUE (payment_id);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_variant_id_source_type_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_variant_id_source_type_source_id_key UNIQUE (variant_id, source_type, source_id);


--
-- Name: supplier_variants supplier_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_variants
    ADD CONSTRAINT supplier_variants_pkey PRIMARY KEY (id);


--
-- Name: supplier_variants supplier_variants_supplier_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_variants
    ADD CONSTRAINT supplier_variants_supplier_id_variant_id_key UNIQUE (supplier_id, variant_id);


--
-- Name: suppliers suppliers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_code_key UNIQUE (code);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: voucher_redemptions voucher_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_redemptions
    ADD CONSTRAINT voucher_redemptions_pkey PRIMARY KEY (id);


--
-- Name: voucher_redemptions voucher_redemptions_voucher_id_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_redemptions
    ADD CONSTRAINT voucher_redemptions_voucher_id_order_id_key UNIQUE (voucher_id, order_id);


--
-- Name: vouchers vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_pkey PRIMARY KEY (id);


--
-- Name: accounts_email_realm_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX accounts_email_realm_uq ON public.accounts USING btree (realm, lower(email));


--
-- Name: accounts_username_realm_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX accounts_username_realm_uq ON public.accounts USING btree (realm, lower(username));


--
-- Name: audit_logs_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_time_idx ON public.audit_logs USING btree (created_at, employee_id);


--
-- Name: auth_sessions_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_sessions_account_idx ON public.auth_sessions USING btree (account_id);


--
-- Name: auth_sessions_previous_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_sessions_previous_idx ON public.auth_sessions USING btree (previous_token_hash) WHERE (previous_token_hash IS NOT NULL);


--
-- Name: brands_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX brands_name_uq ON public.brands USING btree (lower(TRIM(BOTH FROM name)));


--
-- Name: categories_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX categories_name_uq ON public.categories USING btree (lower(TRIM(BOTH FROM name)));


--
-- Name: customer_addresses_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_addresses_customer_idx ON public.customer_addresses USING btree (customer_id);


--
-- Name: customer_addresses_default_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_addresses_default_uq ON public.customer_addresses USING btree (customer_id) WHERE is_default;


--
-- Name: order_discounts_promotion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_discounts_promotion_idx ON public.order_discounts USING btree (promotion_id);


--
-- Name: orders_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_customer_idx ON public.orders USING btree (customer_id, created_at DESC);


--
-- Name: orders_status_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_status_time_idx ON public.orders USING btree (status, created_at DESC);


--
-- Name: payments_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_order_idx ON public.payments USING btree (order_id);


--
-- Name: payments_reference_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payments_reference_uq ON public.payments USING btree (method, reference) WHERE ((status = 'SUCCEEDED'::text) AND (reference IS NOT NULL));


--
-- Name: product_images_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_images_product_idx ON public.product_images USING btree (product_id, sort_order);


--
-- Name: product_variants_sku_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_variants_sku_uq ON public.product_variants USING btree (lower(TRIM(BOTH FROM sku)));


--
-- Name: products_brand_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_brand_idx ON public.products USING btree (brand_id);


--
-- Name: products_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_category_idx ON public.products USING btree (category_id);


--
-- Name: refunds_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refunds_order_idx ON public.refunds USING btree (order_id);


--
-- Name: stock_movements_variant_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_variant_time_idx ON public.stock_movements USING btree (variant_id, created_at);


--
-- Name: voucher_redemptions_usage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX voucher_redemptions_usage_idx ON public.voucher_redemptions USING btree (voucher_id, customer_id, status);


--
-- Name: vouchers_code_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vouchers_code_uq ON public.vouchers USING btree (lower(TRIM(BOTH FROM code)));


--
-- Name: accounts touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: brands touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: carts touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.carts FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: categories touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: customer_addresses touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: customers touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: employees touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: goods_receipts touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.goods_receipts FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: inventory_adjustments touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.inventory_adjustments FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: invoices touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: order_promotion_rules touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.order_promotion_rules FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: orders touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: product_images touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.product_images FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: product_promotion_rules touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.product_promotion_rules FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: product_variants touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: products touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: promotions touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: roles touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: supplier_variants touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.supplier_variants FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: suppliers touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: vouchers touch_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_version BEFORE UPDATE ON public.vouchers FOR EACH ROW EXECUTE FUNCTION public.halora_touch();


--
-- Name: audit_logs audit_logs_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: audit_logs audit_logs_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: auth_sessions auth_sessions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_product_id_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_variant_id_fkey FOREIGN KEY (product_id, variant_id) REFERENCES public.product_variants(product_id, id) ON DELETE RESTRICT;


--
-- Name: carts carts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_addresses customer_addresses_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customers customers_account_id_account_realm_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_account_id_account_realm_fkey FOREIGN KEY (account_id, account_realm) REFERENCES public.accounts(id, realm) ON DELETE RESTRICT;


--
-- Name: employee_roles employee_roles_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_roles
    ADD CONSTRAINT employee_roles_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_roles employee_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_roles
    ADD CONSTRAINT employee_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- Name: employees employees_account_id_account_realm_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_account_id_account_realm_fkey FOREIGN KEY (account_id, account_realm) REFERENCES public.accounts(id, realm) ON DELETE RESTRICT;


--
-- Name: goods_receipt_items goods_receipt_items_product_id_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_product_id_variant_id_fkey FOREIGN KEY (product_id, variant_id) REFERENCES public.product_variants(product_id, id) ON DELETE RESTRICT;


--
-- Name: goods_receipt_items goods_receipt_items_receipt_id_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_receipt_id_supplier_id_fkey FOREIGN KEY (receipt_id, supplier_id) REFERENCES public.goods_receipts(id, supplier_id) ON DELETE CASCADE;


--
-- Name: goods_receipt_items goods_receipt_items_supplier_id_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_supplier_id_variant_id_fkey FOREIGN KEY (supplier_id, variant_id) REFERENCES public.supplier_variants(supplier_id, variant_id) ON DELETE RESTRICT;


--
-- Name: goods_receipts goods_receipts_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: goods_receipts goods_receipts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


--
-- Name: idempotency_keys idempotency_keys_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: inventory_adjustment_items inventory_adjustment_items_adjustment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustment_items
    ADD CONSTRAINT inventory_adjustment_items_adjustment_id_fkey FOREIGN KEY (adjustment_id) REFERENCES public.inventory_adjustments(id) ON DELETE CASCADE;


--
-- Name: inventory_adjustment_items inventory_adjustment_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustment_items
    ADD CONSTRAINT inventory_adjustment_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE RESTRICT;


--
-- Name: inventory_adjustments inventory_adjustments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: inventory_balances inventory_balances_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_balances
    ADD CONSTRAINT inventory_balances_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE RESTRICT;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_product_id_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_product_id_variant_id_fkey FOREIGN KEY (product_id, variant_id) REFERENCES public.product_variants(product_id, id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: media_assets media_assets_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: order_discounts order_discounts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_discounts
    ADD CONSTRAINT order_discounts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_discounts order_discounts_order_id_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_discounts
    ADD CONSTRAINT order_discounts_order_id_variant_id_fkey FOREIGN KEY (order_id, variant_id) REFERENCES public.order_items(order_id, variant_id) ON DELETE CASCADE;


--
-- Name: order_discounts order_discounts_order_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_discounts
    ADD CONSTRAINT order_discounts_order_rule_id_fkey FOREIGN KEY (order_rule_id) REFERENCES public.order_promotion_rules(id) ON DELETE RESTRICT;


--
-- Name: order_discounts order_discounts_product_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_discounts
    ADD CONSTRAINT order_discounts_product_rule_id_fkey FOREIGN KEY (product_rule_id) REFERENCES public.product_promotion_rules(id) ON DELETE RESTRICT;


--
-- Name: order_discounts order_discounts_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_discounts
    ADD CONSTRAINT order_discounts_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE RESTRICT;


--
-- Name: order_discounts order_discounts_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_discounts
    ADD CONSTRAINT order_discounts_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE RESTRICT;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_variant_id_fkey FOREIGN KEY (product_id, variant_id) REFERENCES public.product_variants(product_id, id) ON DELETE RESTRICT;


--
-- Name: order_items order_items_product_promotion_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_promotion_rule_id_fkey FOREIGN KEY (product_promotion_rule_id) REFERENCES public.product_promotion_rules(id) ON DELETE RESTRICT;


--
-- Name: order_promotion_rules order_promotion_rules_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_promotion_rules
    ADD CONSTRAINT order_promotion_rules_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE RESTRICT;


--
-- Name: order_status_history order_status_history_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: password_reset_tokens password_reset_tokens_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: payments payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: product_images product_images_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media_assets(id) ON DELETE RESTRICT;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: product_images product_images_product_id_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_variant_id_fkey FOREIGN KEY (product_id, variant_id) REFERENCES public.product_variants(product_id, id) ON DELETE RESTRICT;


--
-- Name: product_promotion_rules product_promotion_rules_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_promotion_rules
    ADD CONSTRAINT product_promotion_rules_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: product_promotion_rules product_promotion_rules_product_id_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_promotion_rules
    ADD CONSTRAINT product_promotion_rules_product_id_variant_id_fkey FOREIGN KEY (product_id, variant_id) REFERENCES public.product_variants(product_id, id) ON DELETE RESTRICT;


--
-- Name: product_promotion_rules product_promotion_rules_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_promotion_rules
    ADD CONSTRAINT product_promotion_rules_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE RESTRICT;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE RESTRICT;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: refunds refunds_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: refunds refunds_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE RESTRICT;


--
-- Name: supplier_variants supplier_variants_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_variants
    ADD CONSTRAINT supplier_variants_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


--
-- Name: supplier_variants supplier_variants_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_variants
    ADD CONSTRAINT supplier_variants_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE RESTRICT;


--
-- Name: voucher_redemptions voucher_redemptions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_redemptions
    ADD CONSTRAINT voucher_redemptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: voucher_redemptions voucher_redemptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_redemptions
    ADD CONSTRAINT voucher_redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: voucher_redemptions voucher_redemptions_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_redemptions
    ADD CONSTRAINT voucher_redemptions_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE RESTRICT;


--
-- Name: vouchers vouchers_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--



-- System access control and migration baseline; no accounts or business data.
--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.permissions VALUES ('0d7faf87-4379-4674-9bda-95fc6ee899ae', 'categories.read', 'categories.read', 'Quyền hệ thống Halora: categories.read');
INSERT INTO public.permissions VALUES ('492ecb0d-7030-4ef6-9869-c3ac25440f04', 'categories.create', 'categories.create', 'Quyền hệ thống Halora: categories.create');
INSERT INTO public.permissions VALUES ('c2814a16-68af-4f51-bd0c-148c87392e1b', 'categories.update', 'categories.update', 'Quyền hệ thống Halora: categories.update');
INSERT INTO public.permissions VALUES ('68b803de-d878-4752-9183-cf40ee7f45cf', 'categories.delete', 'categories.delete', 'Quyền hệ thống Halora: categories.delete');
INSERT INTO public.permissions VALUES ('de0a6321-c0ac-4c8b-8ee7-dd6f72cb3b8d', 'brands.read', 'brands.read', 'Quyền hệ thống Halora: brands.read');
INSERT INTO public.permissions VALUES ('a32692b3-b353-4bf2-8bdc-ea7febb458c8', 'brands.create', 'brands.create', 'Quyền hệ thống Halora: brands.create');
INSERT INTO public.permissions VALUES ('529a2e09-6188-4fd2-98a2-8d75d6420c0f', 'brands.update', 'brands.update', 'Quyền hệ thống Halora: brands.update');
INSERT INTO public.permissions VALUES ('45648970-4ccb-457f-9dd5-ae8b5e00da5f', 'brands.delete', 'brands.delete', 'Quyền hệ thống Halora: brands.delete');
INSERT INTO public.permissions VALUES ('bebfa059-ff71-4b6c-b61c-daa46bb6c1c4', 'products.read', 'products.read', 'Quyền hệ thống Halora: products.read');
INSERT INTO public.permissions VALUES ('e16b76eb-6c1b-4d74-81d4-fe42b042e411', 'products.create', 'products.create', 'Quyền hệ thống Halora: products.create');
INSERT INTO public.permissions VALUES ('cda7d4ee-4d33-4290-a82f-1f5aa4dc31d7', 'products.update', 'products.update', 'Quyền hệ thống Halora: products.update');
INSERT INTO public.permissions VALUES ('4fe3682c-f825-48c8-9eb1-cb8b614634e1', 'products.delete', 'products.delete', 'Quyền hệ thống Halora: products.delete');
INSERT INTO public.permissions VALUES ('0d5ce2f6-84b6-4123-8fc9-3d8c2d7c7526', 'customers.read', 'customers.read', 'Quyền hệ thống Halora: customers.read');
INSERT INTO public.permissions VALUES ('9a8dfe2d-560c-4881-9794-1f0f0c158bd7', 'customers.update', 'customers.update', 'Quyền hệ thống Halora: customers.update');
INSERT INTO public.permissions VALUES ('cba90ce8-279b-4d68-b640-070a023c107d', 'customers.delete', 'customers.delete', 'Quyền hệ thống Halora: customers.delete');
INSERT INTO public.permissions VALUES ('8ce59fdc-efdd-44b8-be93-2802c3294a43', 'employees.read', 'employees.read', 'Quyền hệ thống Halora: employees.read');
INSERT INTO public.permissions VALUES ('589ce4b0-5d61-4b8d-87ab-8d004ec56c23', 'employees.create', 'employees.create', 'Quyền hệ thống Halora: employees.create');
INSERT INTO public.permissions VALUES ('19b8a1aa-855b-43ab-adb9-49905ad07315', 'employees.update', 'employees.update', 'Quyền hệ thống Halora: employees.update');
INSERT INTO public.permissions VALUES ('2e2f3dd2-8f49-42ab-aba9-4c354c65d1ff', 'employees.delete', 'employees.delete', 'Quyền hệ thống Halora: employees.delete');
INSERT INTO public.permissions VALUES ('345c6c1f-85bf-4e8c-8b19-d6a62ef4a2d7', 'employees.createAccount', 'employees.createAccount', 'Quyền hệ thống Halora: employees.createAccount');
INSERT INTO public.permissions VALUES ('3ba8a250-8d5a-4390-a794-acf0bac6eb96', 'employees.assignRoles', 'employees.assignRoles', 'Quyền hệ thống Halora: employees.assignRoles');
INSERT INTO public.permissions VALUES ('f0b4aadd-d426-4cab-942d-f80e56f69301', 'accounts.read', 'accounts.read', 'Quyền hệ thống Halora: accounts.read');
INSERT INTO public.permissions VALUES ('271b9f77-5d08-4a03-9ff3-e8508c412361', 'accounts.update', 'accounts.update', 'Quyền hệ thống Halora: accounts.update');
INSERT INTO public.permissions VALUES ('2ef49afc-a3d2-480a-a113-6ccd0ceb870d', 'roles.read', 'roles.read', 'Quyền hệ thống Halora: roles.read');
INSERT INTO public.permissions VALUES ('4871605c-f5c3-4f92-87b0-6bf913a5cd6e', 'roles.update', 'roles.update', 'Quyền hệ thống Halora: roles.update');
INSERT INTO public.permissions VALUES ('b9d60f07-fe6a-4683-aa51-ea75817aadf2', 'permissions.read', 'permissions.read', 'Quyền hệ thống Halora: permissions.read');
INSERT INTO public.permissions VALUES ('451f8270-5006-4e5c-baa1-5214d1cf9348', 'suppliers.read', 'suppliers.read', 'Quyền hệ thống Halora: suppliers.read');
INSERT INTO public.permissions VALUES ('785109ba-fa44-4646-81f9-1af928f4c62f', 'suppliers.create', 'suppliers.create', 'Quyền hệ thống Halora: suppliers.create');
INSERT INTO public.permissions VALUES ('6928ad77-d7c6-4d40-a293-e4ad3017e206', 'suppliers.update', 'suppliers.update', 'Quyền hệ thống Halora: suppliers.update');
INSERT INTO public.permissions VALUES ('fce0a247-18c2-4e95-8931-501e6d11fdc1', 'suppliers.delete', 'suppliers.delete', 'Quyền hệ thống Halora: suppliers.delete');
INSERT INTO public.permissions VALUES ('328de263-cf93-4a87-af23-48f19dc298ed', 'promotions.read', 'promotions.read', 'Quyền hệ thống Halora: promotions.read');
INSERT INTO public.permissions VALUES ('4459a89f-988c-4128-9334-c4e2aaf0dab5', 'promotions.create', 'promotions.create', 'Quyền hệ thống Halora: promotions.create');
INSERT INTO public.permissions VALUES ('6e387cc9-f8d3-4420-8938-472aab2099bf', 'promotions.update', 'promotions.update', 'Quyền hệ thống Halora: promotions.update');
INSERT INTO public.permissions VALUES ('f13208a3-911a-4d18-98d7-55f30acc645e', 'promotions.delete', 'promotions.delete', 'Quyền hệ thống Halora: promotions.delete');
INSERT INTO public.permissions VALUES ('121c5dbb-1649-4923-ae42-6e3a69d9f11f', 'orders.read', 'orders.read', 'Quyền hệ thống Halora: orders.read');
INSERT INTO public.permissions VALUES ('2c72d0b8-72c1-4fc0-962f-8fdf66d925f2', 'orders.confirm', 'orders.confirm', 'Quyền hệ thống Halora: orders.confirm');
INSERT INTO public.permissions VALUES ('edc38b0e-f4bf-4a17-b1f3-5ec8301b5ca6', 'orders.dispatch', 'orders.dispatch', 'Quyền hệ thống Halora: orders.dispatch');
INSERT INTO public.permissions VALUES ('ee99c5bc-edf7-4df2-9e54-08ad4ef760b7', 'orders.complete', 'orders.complete', 'Quyền hệ thống Halora: orders.complete');
INSERT INTO public.permissions VALUES ('4ea034fb-d89e-4ca0-bfb9-edac9340b18a', 'orders.cancel', 'orders.cancel', 'Quyền hệ thống Halora: orders.cancel');
INSERT INTO public.permissions VALUES ('491a4c23-4bb3-479d-9f20-9e84463ece29', 'payments.create', 'payments.create', 'Quyền hệ thống Halora: payments.create');
INSERT INTO public.permissions VALUES ('ca9fa310-c169-4637-baaa-3e7f8b5a21cf', 'payments.confirm', 'payments.confirm', 'Quyền hệ thống Halora: payments.confirm');
INSERT INTO public.permissions VALUES ('588d3422-a0d9-48a0-94fa-15e0e5fb6d46', 'payments.fail', 'payments.fail', 'Quyền hệ thống Halora: payments.fail');
INSERT INTO public.permissions VALUES ('889b72cb-77e8-47ee-a989-46373451732e', 'refunds.confirm', 'refunds.confirm', 'Quyền hệ thống Halora: refunds.confirm');
INSERT INTO public.permissions VALUES ('98cda9e6-9622-4c27-88ea-d27389d516b3', 'refunds.fail', 'refunds.fail', 'Quyền hệ thống Halora: refunds.fail');
INSERT INTO public.permissions VALUES ('57e48fab-506d-40ca-a006-2fbb3e333397', 'invoices.read', 'invoices.read', 'Quyền hệ thống Halora: invoices.read');
INSERT INTO public.permissions VALUES ('f0fbfd14-57ca-49ba-98e0-5104c7d283ec', 'invoices.create', 'invoices.create', 'Quyền hệ thống Halora: invoices.create');
INSERT INTO public.permissions VALUES ('c9675988-b76f-431e-817f-5ff81e670e2d', 'invoices.update', 'invoices.update', 'Quyền hệ thống Halora: invoices.update');
INSERT INTO public.permissions VALUES ('fa822de7-4a21-4235-8b92-d842437c7584', 'invoices.delete', 'invoices.delete', 'Quyền hệ thống Halora: invoices.delete');
INSERT INTO public.permissions VALUES ('b4ca6276-2f9b-4edd-8ded-46c0ded9ea80', 'invoices.post', 'invoices.post', 'Quyền hệ thống Halora: invoices.post');
INSERT INTO public.permissions VALUES ('ccf6010d-34d8-49ea-af5c-6f252bb2849a', 'invoices.export', 'invoices.export', 'Quyền hệ thống Halora: invoices.export');
INSERT INTO public.permissions VALUES ('306d654a-3a75-410d-9b0c-8c03bb00c168', 'goodsReceipts.read', 'goodsReceipts.read', 'Quyền hệ thống Halora: goodsReceipts.read');
INSERT INTO public.permissions VALUES ('b4faa72d-f3d0-41d6-aa62-d310f39df007', 'goodsReceipts.create', 'goodsReceipts.create', 'Quyền hệ thống Halora: goodsReceipts.create');
INSERT INTO public.permissions VALUES ('7edbb4c5-d508-4eb2-96d6-5ac039d5af89', 'goodsReceipts.update', 'goodsReceipts.update', 'Quyền hệ thống Halora: goodsReceipts.update');
INSERT INTO public.permissions VALUES ('057bd8a1-9433-404b-95d3-4a4424d8e106', 'goodsReceipts.delete', 'goodsReceipts.delete', 'Quyền hệ thống Halora: goodsReceipts.delete');
INSERT INTO public.permissions VALUES ('b71675de-7225-4324-85d3-088eb9c676b1', 'goodsReceipts.post', 'goodsReceipts.post', 'Quyền hệ thống Halora: goodsReceipts.post');
INSERT INTO public.permissions VALUES ('6145c6d0-a93b-4dfd-a200-3c64301fdbde', 'goodsReceipts.export', 'goodsReceipts.export', 'Quyền hệ thống Halora: goodsReceipts.export');
INSERT INTO public.permissions VALUES ('2927f7ae-c732-4c1c-afd5-c68d77714b00', 'inventory.read', 'inventory.read', 'Quyền hệ thống Halora: inventory.read');
INSERT INTO public.permissions VALUES ('1a297b58-6706-4693-ad55-d5169927a2ae', 'inventoryAdjustments.read', 'inventoryAdjustments.read', 'Quyền hệ thống Halora: inventoryAdjustments.read');
INSERT INTO public.permissions VALUES ('65278eeb-3d89-4133-83a2-409c12d3bd27', 'inventoryAdjustments.create', 'inventoryAdjustments.create', 'Quyền hệ thống Halora: inventoryAdjustments.create');
INSERT INTO public.permissions VALUES ('e8deca04-bcfd-4355-b505-b0328e7c89d8', 'inventoryAdjustments.update', 'inventoryAdjustments.update', 'Quyền hệ thống Halora: inventoryAdjustments.update');
INSERT INTO public.permissions VALUES ('1624d272-43c1-49b6-beb0-a1d1e9b1f522', 'inventoryAdjustments.delete', 'inventoryAdjustments.delete', 'Quyền hệ thống Halora: inventoryAdjustments.delete');
INSERT INTO public.permissions VALUES ('7b29893c-214a-4f66-8ea7-769b03215bf3', 'inventoryAdjustments.post', 'inventoryAdjustments.post', 'Quyền hệ thống Halora: inventoryAdjustments.post');
INSERT INTO public.permissions VALUES ('c3686743-5e09-48e4-b52c-713d8d3d3edf', 'reports.read', 'reports.read', 'Quyền hệ thống Halora: reports.read');
INSERT INTO public.permissions VALUES ('72f90f07-ebfa-4e63-b78b-dc58561edc57', 'reports.export', 'reports.export', 'Quyền hệ thống Halora: reports.export');
INSERT INTO public.permissions VALUES ('1b762558-6c52-408f-afb6-52917121a16b', 'media.create', 'media.create', 'Quyền hệ thống Halora: media.create');


--
-- Data for Name: pgmigrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.pgmigrations VALUES (1, '001_initial', '2026-10-15 22:36:37.821941');
INSERT INTO public.pgmigrations VALUES (2, '002_access_control', '2026-10-15 22:36:37.821941');


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.roles VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'ADMIN', 'Quản trị viên', 'Quản trị toàn bộ hệ thống', '2026-10-15 22:36:37.821941+07', '2026-10-15 22:36:37.821941+07', 1);
INSERT INTO public.roles VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', 'SALES', 'Bán hàng', 'Quản lý khách hàng và xử lý đơn hàng', '2026-10-15 22:36:37.821941+07', '2026-10-15 22:36:37.821941+07', 1);
INSERT INTO public.roles VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', 'WAREHOUSE', 'Kho', 'Quản lý sản phẩm, cung ứng và kho', '2026-10-15 22:36:37.821941+07', '2026-10-15 22:36:37.821941+07', 1);
INSERT INTO public.roles VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', 'ACCOUNTANT', 'Kế toán', 'Đối soát thanh toán, hóa đơn và báo cáo', '2026-10-15 22:36:37.821941+07', '2026-10-15 22:36:37.821941+07', 1);
INSERT INTO public.roles VALUES ('5a0401e9-a291-46a9-8833-855982098c2e', 'CUSTOMER', 'Khách hàng', 'Truy cập dữ liệu cá nhân qua /me', '2026-10-15 22:36:37.821941+07', '2026-10-15 22:36:37.821941+07', 1);


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '0d7faf87-4379-4674-9bda-95fc6ee899ae');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '492ecb0d-7030-4ef6-9869-c3ac25440f04');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'c2814a16-68af-4f51-bd0c-148c87392e1b');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '68b803de-d878-4752-9183-cf40ee7f45cf');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'de0a6321-c0ac-4c8b-8ee7-dd6f72cb3b8d');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'a32692b3-b353-4bf2-8bdc-ea7febb458c8');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '529a2e09-6188-4fd2-98a2-8d75d6420c0f');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '45648970-4ccb-457f-9dd5-ae8b5e00da5f');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'bebfa059-ff71-4b6c-b61c-daa46bb6c1c4');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'e16b76eb-6c1b-4d74-81d4-fe42b042e411');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'cda7d4ee-4d33-4290-a82f-1f5aa4dc31d7');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '4fe3682c-f825-48c8-9eb1-cb8b614634e1');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '0d5ce2f6-84b6-4123-8fc9-3d8c2d7c7526');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '9a8dfe2d-560c-4881-9794-1f0f0c158bd7');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'cba90ce8-279b-4d68-b640-070a023c107d');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '8ce59fdc-efdd-44b8-be93-2802c3294a43');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '589ce4b0-5d61-4b8d-87ab-8d004ec56c23');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '19b8a1aa-855b-43ab-adb9-49905ad07315');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '2e2f3dd2-8f49-42ab-aba9-4c354c65d1ff');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '345c6c1f-85bf-4e8c-8b19-d6a62ef4a2d7');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '3ba8a250-8d5a-4390-a794-acf0bac6eb96');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'f0b4aadd-d426-4cab-942d-f80e56f69301');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '271b9f77-5d08-4a03-9ff3-e8508c412361');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '2ef49afc-a3d2-480a-a113-6ccd0ceb870d');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '4871605c-f5c3-4f92-87b0-6bf913a5cd6e');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'b9d60f07-fe6a-4683-aa51-ea75817aadf2');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '451f8270-5006-4e5c-baa1-5214d1cf9348');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '785109ba-fa44-4646-81f9-1af928f4c62f');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '6928ad77-d7c6-4d40-a293-e4ad3017e206');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'fce0a247-18c2-4e95-8931-501e6d11fdc1');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '328de263-cf93-4a87-af23-48f19dc298ed');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '4459a89f-988c-4128-9334-c4e2aaf0dab5');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '6e387cc9-f8d3-4420-8938-472aab2099bf');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'f13208a3-911a-4d18-98d7-55f30acc645e');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '121c5dbb-1649-4923-ae42-6e3a69d9f11f');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '2c72d0b8-72c1-4fc0-962f-8fdf66d925f2');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'edc38b0e-f4bf-4a17-b1f3-5ec8301b5ca6');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'ee99c5bc-edf7-4df2-9e54-08ad4ef760b7');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '4ea034fb-d89e-4ca0-bfb9-edac9340b18a');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '491a4c23-4bb3-479d-9f20-9e84463ece29');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'ca9fa310-c169-4637-baaa-3e7f8b5a21cf');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '588d3422-a0d9-48a0-94fa-15e0e5fb6d46');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '889b72cb-77e8-47ee-a989-46373451732e');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '98cda9e6-9622-4c27-88ea-d27389d516b3');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '57e48fab-506d-40ca-a006-2fbb3e333397');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'f0fbfd14-57ca-49ba-98e0-5104c7d283ec');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'c9675988-b76f-431e-817f-5ff81e670e2d');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'fa822de7-4a21-4235-8b92-d842437c7584');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'b4ca6276-2f9b-4edd-8ded-46c0ded9ea80');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'ccf6010d-34d8-49ea-af5c-6f252bb2849a');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '306d654a-3a75-410d-9b0c-8c03bb00c168');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'b4faa72d-f3d0-41d6-aa62-d310f39df007');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '7edbb4c5-d508-4eb2-96d6-5ac039d5af89');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '057bd8a1-9433-404b-95d3-4a4424d8e106');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'b71675de-7225-4324-85d3-088eb9c676b1');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '6145c6d0-a93b-4dfd-a200-3c64301fdbde');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '2927f7ae-c732-4c1c-afd5-c68d77714b00');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '1a297b58-6706-4693-ad55-d5169927a2ae');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '65278eeb-3d89-4133-83a2-409c12d3bd27');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'e8deca04-bcfd-4355-b505-b0328e7c89d8');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '1624d272-43c1-49b6-beb0-a1d1e9b1f522');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '7b29893c-214a-4f66-8ea7-769b03215bf3');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', 'c3686743-5e09-48e4-b52c-713d8d3d3edf');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '72f90f07-ebfa-4e63-b78b-dc58561edc57');
INSERT INTO public.role_permissions VALUES ('005c46aa-f9d1-400f-906d-a4d40ee8c63f', '1b762558-6c52-408f-afb6-52917121a16b');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', '0d7faf87-4379-4674-9bda-95fc6ee899ae');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '0d7faf87-4379-4674-9bda-95fc6ee899ae');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', '0d7faf87-4379-4674-9bda-95fc6ee899ae');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '492ecb0d-7030-4ef6-9869-c3ac25440f04');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', 'c2814a16-68af-4f51-bd0c-148c87392e1b');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '68b803de-d878-4752-9183-cf40ee7f45cf');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', 'de0a6321-c0ac-4c8b-8ee7-dd6f72cb3b8d');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', 'de0a6321-c0ac-4c8b-8ee7-dd6f72cb3b8d');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', 'de0a6321-c0ac-4c8b-8ee7-dd6f72cb3b8d');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', 'a32692b3-b353-4bf2-8bdc-ea7febb458c8');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '529a2e09-6188-4fd2-98a2-8d75d6420c0f');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '45648970-4ccb-457f-9dd5-ae8b5e00da5f');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', 'bebfa059-ff71-4b6c-b61c-daa46bb6c1c4');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', 'bebfa059-ff71-4b6c-b61c-daa46bb6c1c4');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', 'bebfa059-ff71-4b6c-b61c-daa46bb6c1c4');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', 'e16b76eb-6c1b-4d74-81d4-fe42b042e411');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', 'cda7d4ee-4d33-4290-a82f-1f5aa4dc31d7');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '4fe3682c-f825-48c8-9eb1-cb8b614634e1');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', '0d5ce2f6-84b6-4123-8fc9-3d8c2d7c7526');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', '0d5ce2f6-84b6-4123-8fc9-3d8c2d7c7526');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', '9a8dfe2d-560c-4881-9794-1f0f0c158bd7');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', 'cba90ce8-279b-4d68-b640-070a023c107d');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', '8ce59fdc-efdd-44b8-be93-2802c3294a43');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '451f8270-5006-4e5c-baa1-5214d1cf9348');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '785109ba-fa44-4646-81f9-1af928f4c62f');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '6928ad77-d7c6-4d40-a293-e4ad3017e206');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', 'fce0a247-18c2-4e95-8931-501e6d11fdc1');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', '121c5dbb-1649-4923-ae42-6e3a69d9f11f');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '121c5dbb-1649-4923-ae42-6e3a69d9f11f');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', '121c5dbb-1649-4923-ae42-6e3a69d9f11f');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', '2c72d0b8-72c1-4fc0-962f-8fdf66d925f2');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '2c72d0b8-72c1-4fc0-962f-8fdf66d925f2');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', 'edc38b0e-f4bf-4a17-b1f3-5ec8301b5ca6');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', 'edc38b0e-f4bf-4a17-b1f3-5ec8301b5ca6');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', 'ee99c5bc-edf7-4df2-9e54-08ad4ef760b7');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', '4ea034fb-d89e-4ca0-bfb9-edac9340b18a');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', '491a4c23-4bb3-479d-9f20-9e84463ece29');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', '491a4c23-4bb3-479d-9f20-9e84463ece29');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', 'ca9fa310-c169-4637-baaa-3e7f8b5a21cf');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', '588d3422-a0d9-48a0-94fa-15e0e5fb6d46');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', '889b72cb-77e8-47ee-a989-46373451732e');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', '98cda9e6-9622-4c27-88ea-d27389d516b3');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', '57e48fab-506d-40ca-a006-2fbb3e333397');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', '57e48fab-506d-40ca-a006-2fbb3e333397');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', 'f0fbfd14-57ca-49ba-98e0-5104c7d283ec');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', 'f0fbfd14-57ca-49ba-98e0-5104c7d283ec');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', 'c9675988-b76f-431e-817f-5ff81e670e2d');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', 'c9675988-b76f-431e-817f-5ff81e670e2d');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', 'fa822de7-4a21-4235-8b92-d842437c7584');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', 'b4ca6276-2f9b-4edd-8ded-46c0ded9ea80');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', 'b4ca6276-2f9b-4edd-8ded-46c0ded9ea80');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', 'ccf6010d-34d8-49ea-af5c-6f252bb2849a');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', 'ccf6010d-34d8-49ea-af5c-6f252bb2849a');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '306d654a-3a75-410d-9b0c-8c03bb00c168');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', '306d654a-3a75-410d-9b0c-8c03bb00c168');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', 'b4faa72d-f3d0-41d6-aa62-d310f39df007');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '7edbb4c5-d508-4eb2-96d6-5ac039d5af89');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '057bd8a1-9433-404b-95d3-4a4424d8e106');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', 'b71675de-7225-4324-85d3-088eb9c676b1');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '6145c6d0-a93b-4dfd-a200-3c64301fdbde');
INSERT INTO public.role_permissions VALUES ('83de7360-b95a-49fb-a8ae-d6de547e771e', '2927f7ae-c732-4c1c-afd5-c68d77714b00');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '2927f7ae-c732-4c1c-afd5-c68d77714b00');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', '2927f7ae-c732-4c1c-afd5-c68d77714b00');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '1a297b58-6706-4693-ad55-d5169927a2ae');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '65278eeb-3d89-4133-83a2-409c12d3bd27');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', 'e8deca04-bcfd-4355-b505-b0328e7c89d8');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '1624d272-43c1-49b6-beb0-a1d1e9b1f522');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '7b29893c-214a-4f66-8ea7-769b03215bf3');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', 'c3686743-5e09-48e4-b52c-713d8d3d3edf');
INSERT INTO public.role_permissions VALUES ('b75c2760-0c76-46c9-99de-5595e43caadb', '72f90f07-ebfa-4e63-b78b-dc58561edc57');
INSERT INTO public.role_permissions VALUES ('502f20bd-924e-4a72-8a4a-0e9af77a7cf8', '1b762558-6c52-408f-afb6-52917121a16b');


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pgmigrations_id_seq', 2, true);


--
-- PostgreSQL database dump complete
--



SELECT setval(pg_get_serial_sequence('public.pgmigrations','id'), (SELECT max(id) FROM public.pgmigrations), true);

SET search_path = public;
