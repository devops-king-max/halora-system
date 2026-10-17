-- Halora PostgreSQL 18: install once into an empty database.
-- Existing databases must use versioned migrations.
-- Optional test data: import database/seed-demo.sql explicitly after bootstrap.
--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6 (Debian 18.6-1.pgdg13+2)
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
    LANGUAGE plpgsql
    AS $$
DECLARE number bigint;
BEGIN
 INSERT INTO business_code_counters AS counters(prefix,last_value) VALUES(prefix,1)
 ON CONFLICT ON CONSTRAINT business_code_counters_pkey DO UPDATE SET last_value=counters.last_value+1
 RETURNING last_value INTO number;
 RETURN prefix || lpad(number::text,greatest(2,length(number::text)),'0');
END $$;


--
-- Name: halora_remember_promotion_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.halora_remember_promotion_usage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 INSERT INTO promotion_usage(promotion_id,product_rule_id,order_rule_id,voucher_id,first_order_id)
 VALUES(NEW.promotion_id,NEW.product_rule_id,NEW.order_rule_id,NEW.voucher_id,NEW.order_id) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;


--
-- Name: halora_touch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.halora_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = clock_timestamp(); NEW.version = OLD.version + 1; RETURN NEW; END $$;


--
-- Name: halora_track_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.halora_track_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE number bigint;
BEGIN
 number:=substring(to_jsonb(NEW)->>TG_ARGV[0] from '([0-9]+)$')::bigint;
 INSERT INTO business_code_counters AS counters(prefix,last_value) VALUES(TG_ARGV[1],number)
 ON CONFLICT ON CONSTRAINT business_code_counters_pkey DO UPDATE SET last_value=greatest(counters.last_value,excluded.last_value);
 RETURN NEW;
END $_$;


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
    code text DEFAULT public.halora_code('TK'::text) NOT NULL,
    CONSTRAINT accounts_business_code_format CHECK ((code ~ '^TK[0-9]{2,}$'::text)),
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
    CONSTRAINT customers_business_code_format CHECK ((code ~ '^KH[0-9]{2,}$'::text)),
    CONSTRAINT customers_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);


--
-- Name: employee_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_roles (
    employee_id uuid NOT NULL,
    role_id uuid NOT NULL
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
    CONSTRAINT employees_business_code_format CHECK ((code ~ '^NV[0-9]{2,}$'::text)),
    CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
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
-- Name: api_accounts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_accounts AS
 SELECT a.id,
    a.code,
    a.realm,
    a.username,
    a.email,
    a.status,
    a.created_at,
    a.updated_at,
    a.version,
    c.id AS customer_id,
    e.id AS employee_id,
        CASE
            WHEN (a.realm = 'CUSTOMER'::text) THEN ARRAY[( SELECT roles.id
               FROM public.roles
              WHERE (roles.code = 'CUSTOMER'::text))]
            ELSE COALESCE(( SELECT array_agg(er.role_id ORDER BY er.role_id) AS array_agg
               FROM public.employee_roles er
              WHERE (er.employee_id = e.id)), '{}'::uuid[])
        END AS role_ids
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
    sku text DEFAULT public.halora_code('SKU'::text) NOT NULL,
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
    CONSTRAINT product_variants_business_code_format CHECK ((sku ~ '^SKU[0-9]{2,}$'::text)),
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
    thumbnail_media_id uuid,
    CONSTRAINT products_business_code_format CHECK ((code ~ '^SP[0-9]{2,}$'::text)),
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
    thumbnail_media_id uuid,
    CONSTRAINT brands_business_code_format CHECK ((code ~ '^TH[0-9]{2,}$'::text)),
    CONSTRAINT brands_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);


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
-- Name: api_brands; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_brands AS
 SELECT b.id,
    b.code,
    b.name,
    b.description,
    b.status,
    b.created_at,
    b.updated_at,
    b.version,
    b.thumbnail_media_id,
    m.url AS thumbnail_url
   FROM (public.brands b
     LEFT JOIN public.media_assets m ON ((m.id = b.thumbnail_media_id)));


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
    version integer DEFAULT 1 NOT NULL,
    code text DEFAULT public.halora_code('KMHD'::text) NOT NULL,
    promotion_type text GENERATED ALWAYS AS ('ORDER'::text) STORED,
    CONSTRAINT order_promotion_rules_code_check CHECK ((code ~ '^KMHD[0-9]{2,}$'::text))
);


--
-- Name: promotion_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_id uuid NOT NULL,
    product_rule_id uuid,
    order_rule_id uuid,
    voucher_id uuid,
    first_order_id uuid NOT NULL,
    used_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT promotion_usage_check CHECK ((num_nonnulls(product_rule_id, order_rule_id, voucher_id) = 1))
);


--
-- Name: api_order_promotion_rules; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_order_promotion_rules AS
 SELECT id,
    promotion_id,
    min_order_amount,
    discount_percent,
    max_discount_amount,
    created_at,
    updated_at,
    version,
    code,
    (EXISTS ( SELECT 1
           FROM public.promotion_usage u
          WHERE (u.order_rule_id = r.id))) AS has_usage
   FROM public.order_promotion_rules r;


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
    CONSTRAINT orders_business_code_format CHECK ((order_code ~ '^DH[0-9]{2,}$'::text)),
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
    code text DEFAULT public.halora_code('KMSP'::text) NOT NULL,
    promotion_type text GENERATED ALWAYS AS ('PRODUCT'::text) STORED,
    CONSTRAINT product_promotion_rules_code_check CHECK ((code ~ '^KMSP[0-9]{2,}$'::text)),
    CONSTRAINT product_promotion_rules_min_quantity_check CHECK ((min_quantity >= 0))
);


--
-- Name: api_product_promotion_rules; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_product_promotion_rules AS
 SELECT id,
    promotion_id,
    product_id,
    variant_id,
    discount_percent,
    min_quantity,
    max_discount_amount,
    created_at,
    updated_at,
    version,
    code,
    (EXISTS ( SELECT 1
           FROM public.promotion_usage u
          WHERE (u.product_rule_id = r.id))) AS has_usage
   FROM public.product_promotion_rules r;


--
-- Name: api_products; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_products AS
 SELECT p.id,
    p.code,
    p.name,
    p.slug,
    p.category_id,
    p.brand_id,
    p.description,
    p.ingredients,
    p.benefits,
    p.is_featured,
    p.status,
    p.created_at,
    p.updated_at,
    p.version,
    p.thumbnail_media_id,
    COALESCE(m.url, ( SELECT i.url
           FROM public.api_images i
          WHERE (i.product_id = p.id)
          ORDER BY i.sort_order, i.id
         LIMIT 1)) AS thumbnail_url
   FROM (public.products p
     LEFT JOIN public.media_assets m ON ((m.id = p.thumbnail_media_id)));


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
    type text NOT NULL,
    CONSTRAINT promotions_business_code_format CHECK ((code ~ '^KM[0-9]{2,}$'::text)),
    CONSTRAINT promotions_check CHECK ((starts_at <= ends_at)),
    CONSTRAINT promotions_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'PAUSED'::text, 'ENDED'::text]))),
    CONSTRAINT promotions_type_check CHECK ((type = ANY (ARRAY['PRODUCT'::text, 'ORDER'::text, 'VOUCHER'::text])))
);


--
-- Name: vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_id uuid NOT NULL,
    code text DEFAULT public.halora_code('VC'::text) NOT NULL,
    discount_percent public.discount_percent NOT NULL,
    min_order_amount public.money_vnd NOT NULL,
    max_discount_amount public.money_vnd,
    max_uses integer,
    per_customer_limit integer NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    promotion_type text GENERATED ALWAYS AS ('VOUCHER'::text) STORED,
    CONSTRAINT vouchers_business_code_format CHECK ((code ~ '^VC[0-9]{2,}$'::text)),
    CONSTRAINT vouchers_max_uses_check CHECK ((max_uses >= 0)),
    CONSTRAINT vouchers_per_customer_limit_check CHECK ((per_customer_limit >= 0)),
    CONSTRAINT vouchers_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
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
           FROM (((public.promotion_usage u
             LEFT JOIN public.product_promotion_rules pr ON ((pr.id = u.product_rule_id)))
             LEFT JOIN public.order_promotion_rules r ON ((r.id = u.order_rule_id)))
             LEFT JOIN public.vouchers v ON ((v.id = u.voucher_id)))
          WHERE ((u.promotion_id = p.id) OR (pr.promotion_id = p.id) OR (r.promotion_id = p.id) OR (v.promotion_id = p.id)))) AS has_usage,
    type,
    (EXISTS ( SELECT 1
           FROM public.product_promotion_rules
          WHERE (product_promotion_rules.promotion_id = p.id)
        UNION ALL
         SELECT 1
           FROM public.order_promotion_rules
          WHERE (order_promotion_rules.promotion_id = p.id)
        UNION ALL
         SELECT 1
           FROM public.vouchers
          WHERE (vouchers.promotion_id = p.id))) AS has_conditions
   FROM public.promotions p;


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
    CONSTRAINT categories_business_code_format CHECK ((code ~ '^LSP[0-9]{2,}$'::text)),
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
    COALESCE(( SELECT m.url
           FROM public.media_assets m
          WHERE (m.id = p.thumbnail_media_id)), ( SELECT i.url
           FROM public.api_images i
          WHERE (i.product_id = p.id)
          ORDER BY i.sort_order, i.id
         LIMIT 1)) AS thumbnail_url,
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
          WHERE ((r.voucher_id = v.id) AND (r.status = 'HELD'::text))) AS reserved_count,
    (EXISTS ( SELECT 1
           FROM public.promotion_usage u
          WHERE (u.voucher_id = v.id))) AS has_usage
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
-- Name: business_code_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_code_counters (
    prefix text NOT NULL,
    last_value bigint NOT NULL,
    CONSTRAINT business_code_counters_last_value_check CHECK ((last_value >= 0)),
    CONSTRAINT business_code_counters_prefix_check CHECK ((prefix ~ '^[A-Z]{2,6}$'::text))
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
    CONSTRAINT goods_receipts_business_code_format CHECK ((receipt_code ~ '^PN[0-9]{2,}$'::text)),
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
    CONSTRAINT inventory_adjustments_business_code_format CHECK ((adjustment_code ~ '^DC[0-9]{2,}$'::text)),
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
    CONSTRAINT invoices_business_code_format CHECK ((invoice_code ~ '^HD[0-9]{2,}$'::text)),
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
    CONSTRAINT suppliers_business_code_format CHECK ((code ~ '^NCC[0-9]{2,}$'::text)),
    CONSTRAINT suppliers_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: accounts accounts_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_code_key UNIQUE (code);


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
-- Name: business_code_counters business_code_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_code_counters
    ADD CONSTRAINT business_code_counters_pkey PRIMARY KEY (prefix);


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
-- Name: order_promotion_rules order_promotion_rules_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_promotion_rules
    ADD CONSTRAINT order_promotion_rules_code_key UNIQUE (code);


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
-- Name: product_promotion_rules product_promotion_rules_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_promotion_rules
    ADD CONSTRAINT product_promotion_rules_code_key UNIQUE (code);


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
-- Name: promotion_usage promotion_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage
    ADD CONSTRAINT promotion_usage_pkey PRIMARY KEY (id);


--
-- Name: promotion_usage promotion_usage_product_rule_id_order_rule_id_voucher_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage
    ADD CONSTRAINT promotion_usage_product_rule_id_order_rule_id_voucher_id_key UNIQUE NULLS NOT DISTINCT (product_rule_id, order_rule_id, voucher_id);


--
-- Name: promotions promotions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_code_key UNIQUE (code);


--
-- Name: promotions promotions_id_type_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_id_type_unique UNIQUE (id, type);


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
-- Name: brands_thumbnail_media_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brands_thumbnail_media_idx ON public.brands USING btree (thumbnail_media_id) WHERE (thumbnail_media_id IS NOT NULL);


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
-- Name: products_thumbnail_media_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_thumbnail_media_idx ON public.products USING btree (thumbnail_media_id) WHERE (thumbnail_media_id IS NOT NULL);


--
-- Name: promotion_usage_promotion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promotion_usage_promotion_idx ON public.promotion_usage USING btree (promotion_id);


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
-- Name: order_discounts remember_promotion_usage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER remember_promotion_usage AFTER INSERT ON public.order_discounts FOR EACH ROW EXECUTE FUNCTION public.halora_remember_promotion_usage();


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
-- Name: accounts track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF code ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('code', 'TK');


--
-- Name: brands track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF code ON public.brands FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('code', 'TH');


--
-- Name: categories track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF code ON public.categories FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('code', 'LSP');


--
-- Name: customers track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF code ON public.customers FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('code', 'KH');


--
-- Name: employees track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF code ON public.employees FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('code', 'NV');


--
-- Name: goods_receipts track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF receipt_code ON public.goods_receipts FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('receipt_code', 'PN');


--
-- Name: inventory_adjustments track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF adjustment_code ON public.inventory_adjustments FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('adjustment_code', 'DC');


--
-- Name: invoices track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF invoice_code ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('invoice_code', 'HD');


--
-- Name: order_promotion_rules track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF code ON public.order_promotion_rules FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('code', 'KMHD');


--
-- Name: orders track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF order_code ON public.orders FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('order_code', 'DH');


--
-- Name: product_promotion_rules track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF code ON public.product_promotion_rules FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('code', 'KMSP');


--
-- Name: product_variants track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF sku ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('sku', 'SKU');


--
-- Name: products track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF code ON public.products FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('code', 'SP');


--
-- Name: promotions track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF code ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('code', 'KM');


--
-- Name: suppliers track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF code ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('code', 'NCC');


--
-- Name: vouchers track_business_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_business_code AFTER INSERT OR UPDATE OF code ON public.vouchers FOR EACH ROW EXECUTE FUNCTION public.halora_track_code('code', 'VC');


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
-- Name: brands brands_thumbnail_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_thumbnail_media_id_fkey FOREIGN KEY (thumbnail_media_id) REFERENCES public.media_assets(id) ON DELETE RESTRICT;


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
-- Name: order_promotion_rules order_rules_promotion_type_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_promotion_rules
    ADD CONSTRAINT order_rules_promotion_type_fk FOREIGN KEY (promotion_id, promotion_type) REFERENCES public.promotions(id, type) ON UPDATE RESTRICT ON DELETE RESTRICT;


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
-- Name: product_promotion_rules product_rules_promotion_type_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_promotion_rules
    ADD CONSTRAINT product_rules_promotion_type_fk FOREIGN KEY (promotion_id, promotion_type) REFERENCES public.promotions(id, type) ON UPDATE RESTRICT ON DELETE RESTRICT;


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
-- Name: products products_thumbnail_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_thumbnail_media_id_fkey FOREIGN KEY (thumbnail_media_id) REFERENCES public.media_assets(id) ON DELETE RESTRICT;


--
-- Name: promotion_usage promotion_usage_first_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage
    ADD CONSTRAINT promotion_usage_first_order_id_fkey FOREIGN KEY (first_order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: promotion_usage promotion_usage_order_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage
    ADD CONSTRAINT promotion_usage_order_rule_id_fkey FOREIGN KEY (order_rule_id) REFERENCES public.order_promotion_rules(id) ON DELETE RESTRICT;


--
-- Name: promotion_usage promotion_usage_product_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage
    ADD CONSTRAINT promotion_usage_product_rule_id_fkey FOREIGN KEY (product_rule_id) REFERENCES public.product_promotion_rules(id) ON DELETE RESTRICT;


--
-- Name: promotion_usage promotion_usage_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage
    ADD CONSTRAINT promotion_usage_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE RESTRICT;


--
-- Name: promotion_usage promotion_usage_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage
    ADD CONSTRAINT promotion_usage_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE RESTRICT;


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
-- Name: vouchers vouchers_promotion_type_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_promotion_type_fk FOREIGN KEY (promotion_id, promotion_type) REFERENCES public.promotions(id, type) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--



-- System access control and migration baseline; no accounts or business data.
--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6 (Debian 18.6-1.pgdg13+2)
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
-- Data for Name: business_code_counters; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.business_code_counters VALUES ('TK', 0);
INSERT INTO public.business_code_counters VALUES ('KH', 0);
INSERT INTO public.business_code_counters VALUES ('NV', 0);
INSERT INTO public.business_code_counters VALUES ('LSP', 0);
INSERT INTO public.business_code_counters VALUES ('TH', 0);
INSERT INTO public.business_code_counters VALUES ('SP', 0);
INSERT INTO public.business_code_counters VALUES ('SKU', 0);
INSERT INTO public.business_code_counters VALUES ('NCC', 0);
INSERT INTO public.business_code_counters VALUES ('KM', 0);
INSERT INTO public.business_code_counters VALUES ('VC', 0);
INSERT INTO public.business_code_counters VALUES ('DH', 0);
INSERT INTO public.business_code_counters VALUES ('HD', 0);
INSERT INTO public.business_code_counters VALUES ('PN', 0);
INSERT INTO public.business_code_counters VALUES ('DC', 0);
INSERT INTO public.business_code_counters VALUES ('KMSP', 0);
INSERT INTO public.business_code_counters VALUES ('KMHD', 0);


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.permissions VALUES ('d17cd069-c73c-496f-9f82-2546b205a3db', 'categories.read', 'categories.read', 'Quyền hệ thống Halora: categories.read');
INSERT INTO public.permissions VALUES ('46a1474d-4c39-4cab-baa8-39f27c856d86', 'categories.create', 'categories.create', 'Quyền hệ thống Halora: categories.create');
INSERT INTO public.permissions VALUES ('22503f83-2117-417e-a6c5-a46b69eb8af4', 'categories.update', 'categories.update', 'Quyền hệ thống Halora: categories.update');
INSERT INTO public.permissions VALUES ('deea4b17-613a-44fe-ac56-4479f55bd688', 'categories.delete', 'categories.delete', 'Quyền hệ thống Halora: categories.delete');
INSERT INTO public.permissions VALUES ('030b75ee-7c23-4737-be43-fc987fd75fc9', 'brands.read', 'brands.read', 'Quyền hệ thống Halora: brands.read');
INSERT INTO public.permissions VALUES ('68e216bd-80bc-4a0f-92ce-186b5678308a', 'brands.create', 'brands.create', 'Quyền hệ thống Halora: brands.create');
INSERT INTO public.permissions VALUES ('01b928e4-87f3-4f26-9d66-bb4cfaeff7be', 'brands.update', 'brands.update', 'Quyền hệ thống Halora: brands.update');
INSERT INTO public.permissions VALUES ('2964c189-5657-43d4-ae98-fc78006ae445', 'brands.delete', 'brands.delete', 'Quyền hệ thống Halora: brands.delete');
INSERT INTO public.permissions VALUES ('72f16bba-70bb-4877-a498-2ba6d8b815a8', 'products.read', 'products.read', 'Quyền hệ thống Halora: products.read');
INSERT INTO public.permissions VALUES ('4de291e8-138f-469e-b95e-f411dc710690', 'products.create', 'products.create', 'Quyền hệ thống Halora: products.create');
INSERT INTO public.permissions VALUES ('f2f1d65e-9ef8-46f9-8328-934f9ee4ae6f', 'products.update', 'products.update', 'Quyền hệ thống Halora: products.update');
INSERT INTO public.permissions VALUES ('bc648d67-04eb-4368-b631-2090d13ca093', 'products.delete', 'products.delete', 'Quyền hệ thống Halora: products.delete');
INSERT INTO public.permissions VALUES ('199f77e3-e0ae-4f6e-bfb7-3f61eebc0f1b', 'customers.read', 'customers.read', 'Quyền hệ thống Halora: customers.read');
INSERT INTO public.permissions VALUES ('21ace77f-1f0a-47f6-97f2-80c1bd56852d', 'customers.update', 'customers.update', 'Quyền hệ thống Halora: customers.update');
INSERT INTO public.permissions VALUES ('cf7f20ce-e150-42e3-a9d7-1e13f9ce42c6', 'customers.delete', 'customers.delete', 'Quyền hệ thống Halora: customers.delete');
INSERT INTO public.permissions VALUES ('e9b28f23-e906-4deb-b31d-d0253b268047', 'employees.read', 'employees.read', 'Quyền hệ thống Halora: employees.read');
INSERT INTO public.permissions VALUES ('1d2cdfdb-988f-437b-ba72-5c9b2f11a797', 'employees.create', 'employees.create', 'Quyền hệ thống Halora: employees.create');
INSERT INTO public.permissions VALUES ('7dd15781-3dde-4116-9f40-c27847dcd0ed', 'employees.update', 'employees.update', 'Quyền hệ thống Halora: employees.update');
INSERT INTO public.permissions VALUES ('f66ee100-36fc-4fbf-aedd-27402b3b4326', 'employees.delete', 'employees.delete', 'Quyền hệ thống Halora: employees.delete');
INSERT INTO public.permissions VALUES ('af3216c7-1758-4217-ba2b-3243c5fb08b9', 'employees.createAccount', 'employees.createAccount', 'Quyền hệ thống Halora: employees.createAccount');
INSERT INTO public.permissions VALUES ('2bc99b61-a734-46cc-a083-a8bfb5787a36', 'employees.assignRoles', 'employees.assignRoles', 'Quyền hệ thống Halora: employees.assignRoles');
INSERT INTO public.permissions VALUES ('45c34bd7-33d7-40f9-aff5-1efb0a7c0fd7', 'accounts.read', 'accounts.read', 'Quyền hệ thống Halora: accounts.read');
INSERT INTO public.permissions VALUES ('ee0419a5-77f9-41dc-88e3-9111ba58fa8d', 'accounts.update', 'accounts.update', 'Quyền hệ thống Halora: accounts.update');
INSERT INTO public.permissions VALUES ('ae2dcc52-bdc2-40b9-89bd-754d28f9c455', 'roles.read', 'roles.read', 'Quyền hệ thống Halora: roles.read');
INSERT INTO public.permissions VALUES ('70aa4e2d-c58d-42c7-a20f-58cb1c7bfb19', 'permissions.read', 'permissions.read', 'Quyền hệ thống Halora: permissions.read');
INSERT INTO public.permissions VALUES ('0f63e6c3-af84-467d-bf8c-0e64684c9c25', 'suppliers.read', 'suppliers.read', 'Quyền hệ thống Halora: suppliers.read');
INSERT INTO public.permissions VALUES ('fd7318dd-4402-421b-86f3-eb16c79fa710', 'suppliers.create', 'suppliers.create', 'Quyền hệ thống Halora: suppliers.create');
INSERT INTO public.permissions VALUES ('3854fd20-37ad-413a-8308-9236d9495828', 'suppliers.update', 'suppliers.update', 'Quyền hệ thống Halora: suppliers.update');
INSERT INTO public.permissions VALUES ('a014d50c-bc3d-4a83-97ff-6929b49c7d14', 'suppliers.delete', 'suppliers.delete', 'Quyền hệ thống Halora: suppliers.delete');
INSERT INTO public.permissions VALUES ('dcfeed77-686e-41ef-8481-8ce635b12662', 'promotions.read', 'promotions.read', 'Quyền hệ thống Halora: promotions.read');
INSERT INTO public.permissions VALUES ('8b4fc1ec-368f-487c-8de3-556d5704f17f', 'promotions.create', 'promotions.create', 'Quyền hệ thống Halora: promotions.create');
INSERT INTO public.permissions VALUES ('7bcd9265-12cd-488d-80c9-e2e364e85211', 'promotions.update', 'promotions.update', 'Quyền hệ thống Halora: promotions.update');
INSERT INTO public.permissions VALUES ('542e93c2-be16-4e7e-94f0-da8f9dbbd549', 'promotions.delete', 'promotions.delete', 'Quyền hệ thống Halora: promotions.delete');
INSERT INTO public.permissions VALUES ('6a9a04ee-4c7b-4fa7-9467-3adcce77d1ee', 'orders.read', 'orders.read', 'Quyền hệ thống Halora: orders.read');
INSERT INTO public.permissions VALUES ('55d5c3ac-6fcf-42ea-bd51-95ba57c721c8', 'orders.confirm', 'orders.confirm', 'Quyền hệ thống Halora: orders.confirm');
INSERT INTO public.permissions VALUES ('7cfd4dd5-3b16-46d2-9e62-6ba26e988b43', 'orders.dispatch', 'orders.dispatch', 'Quyền hệ thống Halora: orders.dispatch');
INSERT INTO public.permissions VALUES ('79dc90b8-b743-43f0-bae6-9a2f8f12f90d', 'orders.complete', 'orders.complete', 'Quyền hệ thống Halora: orders.complete');
INSERT INTO public.permissions VALUES ('fda3eb28-4dda-4f82-80f5-63545c940a84', 'orders.cancel', 'orders.cancel', 'Quyền hệ thống Halora: orders.cancel');
INSERT INTO public.permissions VALUES ('86d51017-27b1-4942-9432-12719325b1bd', 'payments.create', 'payments.create', 'Quyền hệ thống Halora: payments.create');
INSERT INTO public.permissions VALUES ('39cec04d-4067-47ec-a577-7b708ea6046e', 'payments.confirm', 'payments.confirm', 'Quyền hệ thống Halora: payments.confirm');
INSERT INTO public.permissions VALUES ('f05df2d7-cf98-4c75-b05e-665b31983215', 'payments.fail', 'payments.fail', 'Quyền hệ thống Halora: payments.fail');
INSERT INTO public.permissions VALUES ('cedf437c-ff68-4c29-a6a2-b676296b61c1', 'refunds.confirm', 'refunds.confirm', 'Quyền hệ thống Halora: refunds.confirm');
INSERT INTO public.permissions VALUES ('b85e7183-939a-462d-aa62-436134edf420', 'refunds.fail', 'refunds.fail', 'Quyền hệ thống Halora: refunds.fail');
INSERT INTO public.permissions VALUES ('0529b0bd-731e-4b05-98ce-50363c467950', 'invoices.read', 'invoices.read', 'Quyền hệ thống Halora: invoices.read');
INSERT INTO public.permissions VALUES ('ed0c980f-dc28-4b98-bdf4-062bc9ee287e', 'invoices.create', 'invoices.create', 'Quyền hệ thống Halora: invoices.create');
INSERT INTO public.permissions VALUES ('f2c2c7a4-678e-44fc-854e-f5b0ab8ae26c', 'invoices.update', 'invoices.update', 'Quyền hệ thống Halora: invoices.update');
INSERT INTO public.permissions VALUES ('5836ef78-fc12-4801-83f3-7daf91a79813', 'invoices.delete', 'invoices.delete', 'Quyền hệ thống Halora: invoices.delete');
INSERT INTO public.permissions VALUES ('58d391f4-fc87-4900-9359-8ccb32197fff', 'invoices.post', 'invoices.post', 'Quyền hệ thống Halora: invoices.post');
INSERT INTO public.permissions VALUES ('6ecdb2fc-f3d4-449f-a941-b1bb74cf3b33', 'invoices.export', 'invoices.export', 'Quyền hệ thống Halora: invoices.export');
INSERT INTO public.permissions VALUES ('13e2cfdf-b2ad-4123-b124-1c3eae48756f', 'goodsReceipts.read', 'goodsReceipts.read', 'Quyền hệ thống Halora: goodsReceipts.read');
INSERT INTO public.permissions VALUES ('8aa9602f-b931-40c7-9da8-068c0bf94e6e', 'goodsReceipts.create', 'goodsReceipts.create', 'Quyền hệ thống Halora: goodsReceipts.create');
INSERT INTO public.permissions VALUES ('293ed04d-7531-4a0d-95ba-9cdf444cdf48', 'goodsReceipts.update', 'goodsReceipts.update', 'Quyền hệ thống Halora: goodsReceipts.update');
INSERT INTO public.permissions VALUES ('542e0b60-6257-4cea-b60c-ea0aa13840de', 'goodsReceipts.delete', 'goodsReceipts.delete', 'Quyền hệ thống Halora: goodsReceipts.delete');
INSERT INTO public.permissions VALUES ('73329ba8-cd3d-465c-a186-07b9fb087703', 'goodsReceipts.post', 'goodsReceipts.post', 'Quyền hệ thống Halora: goodsReceipts.post');
INSERT INTO public.permissions VALUES ('2c30597f-deb3-4408-8707-a1bb8cf95548', 'goodsReceipts.export', 'goodsReceipts.export', 'Quyền hệ thống Halora: goodsReceipts.export');
INSERT INTO public.permissions VALUES ('8be0a609-f19d-4572-a5c3-6a4987c76124', 'inventory.read', 'inventory.read', 'Quyền hệ thống Halora: inventory.read');
INSERT INTO public.permissions VALUES ('848f1ebe-7249-4853-bb7e-c6ad4e6c98ca', 'inventoryAdjustments.read', 'inventoryAdjustments.read', 'Quyền hệ thống Halora: inventoryAdjustments.read');
INSERT INTO public.permissions VALUES ('e8f57daa-770c-4b43-ae99-40ef04546318', 'inventoryAdjustments.create', 'inventoryAdjustments.create', 'Quyền hệ thống Halora: inventoryAdjustments.create');
INSERT INTO public.permissions VALUES ('82553b82-8b06-48ba-ab6a-11f94351dbd7', 'inventoryAdjustments.update', 'inventoryAdjustments.update', 'Quyền hệ thống Halora: inventoryAdjustments.update');
INSERT INTO public.permissions VALUES ('f7d57137-6e1a-4eb2-a17e-d1a7097661d7', 'inventoryAdjustments.delete', 'inventoryAdjustments.delete', 'Quyền hệ thống Halora: inventoryAdjustments.delete');
INSERT INTO public.permissions VALUES ('de0da37f-c714-4f90-887b-0681883a2849', 'inventoryAdjustments.post', 'inventoryAdjustments.post', 'Quyền hệ thống Halora: inventoryAdjustments.post');
INSERT INTO public.permissions VALUES ('d2c44dff-9033-461f-bfe3-c4b8071326cd', 'reports.read', 'reports.read', 'Quyền hệ thống Halora: reports.read');
INSERT INTO public.permissions VALUES ('815a6e29-0f5a-47f9-ba3f-fd9121ede957', 'reports.export', 'reports.export', 'Quyền hệ thống Halora: reports.export');
INSERT INTO public.permissions VALUES ('643f77a1-7c6d-47ad-9851-8e36f423a221', 'media.create', 'media.create', 'Quyền hệ thống Halora: media.create');


--
-- Data for Name: pgmigrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.pgmigrations VALUES (1, '001_initial', '2026-10-17 12:15:20.149555');
INSERT INTO public.pgmigrations VALUES (2, '002_access_control', '2026-10-17 12:15:20.149555');
INSERT INTO public.pgmigrations VALUES (3, '003_business_codes', '2026-10-17 12:15:20.149555');
INSERT INTO public.pgmigrations VALUES (4, '004_fixed_role_permissions', '2026-10-17 12:15:20.149555');
INSERT INTO public.pgmigrations VALUES (5, '005_clean_display_labels', '2026-10-17 12:15:20.149555');
INSERT INTO public.pgmigrations VALUES (6, '006_catalog_thumbnails', '2026-10-17 12:15:20.149555');
INSERT INTO public.pgmigrations VALUES (7, '007_promotion_management', '2026-10-17 12:15:20.149555');
INSERT INTO public.pgmigrations VALUES (8, '008_single_promotion_type', '2026-10-17 12:15:20.149555');


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.roles VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'ADMIN', 'Quản trị viên', 'Quản trị toàn bộ hệ thống', '2026-10-17 12:15:20.149555+00', '2026-10-17 12:15:20.149555+00', 1);
INSERT INTO public.roles VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', 'SALES', 'Bán hàng', 'Quản lý khách hàng và xử lý đơn hàng', '2026-10-17 12:15:20.149555+00', '2026-10-17 12:15:20.149555+00', 1);
INSERT INTO public.roles VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', 'WAREHOUSE', 'Kho', 'Quản lý sản phẩm, cung ứng và kho', '2026-10-17 12:15:20.149555+00', '2026-10-17 12:15:20.149555+00', 1);
INSERT INTO public.roles VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', 'ACCOUNTANT', 'Kế toán', 'Đối soát thanh toán, hóa đơn và báo cáo', '2026-10-17 12:15:20.149555+00', '2026-10-17 12:15:20.149555+00', 1);
INSERT INTO public.roles VALUES ('898577f7-e3df-4f47-955b-367fcc40511b', 'CUSTOMER', 'Khách hàng', 'Truy cập dữ liệu cá nhân qua /me', '2026-10-17 12:15:20.149555+00', '2026-10-17 12:15:20.149555+00', 1);


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'd17cd069-c73c-496f-9f82-2546b205a3db');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '46a1474d-4c39-4cab-baa8-39f27c856d86');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '22503f83-2117-417e-a6c5-a46b69eb8af4');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'deea4b17-613a-44fe-ac56-4479f55bd688');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '030b75ee-7c23-4737-be43-fc987fd75fc9');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '68e216bd-80bc-4a0f-92ce-186b5678308a');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '01b928e4-87f3-4f26-9d66-bb4cfaeff7be');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '2964c189-5657-43d4-ae98-fc78006ae445');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '72f16bba-70bb-4877-a498-2ba6d8b815a8');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '4de291e8-138f-469e-b95e-f411dc710690');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'f2f1d65e-9ef8-46f9-8328-934f9ee4ae6f');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'bc648d67-04eb-4368-b631-2090d13ca093');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '199f77e3-e0ae-4f6e-bfb7-3f61eebc0f1b');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '21ace77f-1f0a-47f6-97f2-80c1bd56852d');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'cf7f20ce-e150-42e3-a9d7-1e13f9ce42c6');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'e9b28f23-e906-4deb-b31d-d0253b268047');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '1d2cdfdb-988f-437b-ba72-5c9b2f11a797');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '7dd15781-3dde-4116-9f40-c27847dcd0ed');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'f66ee100-36fc-4fbf-aedd-27402b3b4326');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'af3216c7-1758-4217-ba2b-3243c5fb08b9');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '2bc99b61-a734-46cc-a083-a8bfb5787a36');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '45c34bd7-33d7-40f9-aff5-1efb0a7c0fd7');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'ee0419a5-77f9-41dc-88e3-9111ba58fa8d');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'ae2dcc52-bdc2-40b9-89bd-754d28f9c455');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '70aa4e2d-c58d-42c7-a20f-58cb1c7bfb19');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '0f63e6c3-af84-467d-bf8c-0e64684c9c25');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'fd7318dd-4402-421b-86f3-eb16c79fa710');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '3854fd20-37ad-413a-8308-9236d9495828');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'a014d50c-bc3d-4a83-97ff-6929b49c7d14');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'dcfeed77-686e-41ef-8481-8ce635b12662');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '8b4fc1ec-368f-487c-8de3-556d5704f17f');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '7bcd9265-12cd-488d-80c9-e2e364e85211');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '542e93c2-be16-4e7e-94f0-da8f9dbbd549');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '6a9a04ee-4c7b-4fa7-9467-3adcce77d1ee');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '55d5c3ac-6fcf-42ea-bd51-95ba57c721c8');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '7cfd4dd5-3b16-46d2-9e62-6ba26e988b43');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '79dc90b8-b743-43f0-bae6-9a2f8f12f90d');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'fda3eb28-4dda-4f82-80f5-63545c940a84');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '86d51017-27b1-4942-9432-12719325b1bd');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '39cec04d-4067-47ec-a577-7b708ea6046e');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'f05df2d7-cf98-4c75-b05e-665b31983215');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'cedf437c-ff68-4c29-a6a2-b676296b61c1');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'b85e7183-939a-462d-aa62-436134edf420');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '0529b0bd-731e-4b05-98ce-50363c467950');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'ed0c980f-dc28-4b98-bdf4-062bc9ee287e');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'f2c2c7a4-678e-44fc-854e-f5b0ab8ae26c');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '5836ef78-fc12-4801-83f3-7daf91a79813');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '58d391f4-fc87-4900-9359-8ccb32197fff');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '6ecdb2fc-f3d4-449f-a941-b1bb74cf3b33');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '13e2cfdf-b2ad-4123-b124-1c3eae48756f');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '8aa9602f-b931-40c7-9da8-068c0bf94e6e');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '293ed04d-7531-4a0d-95ba-9cdf444cdf48');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '542e0b60-6257-4cea-b60c-ea0aa13840de');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '73329ba8-cd3d-465c-a186-07b9fb087703');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '2c30597f-deb3-4408-8707-a1bb8cf95548');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '8be0a609-f19d-4572-a5c3-6a4987c76124');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '848f1ebe-7249-4853-bb7e-c6ad4e6c98ca');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'e8f57daa-770c-4b43-ae99-40ef04546318');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '82553b82-8b06-48ba-ab6a-11f94351dbd7');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'f7d57137-6e1a-4eb2-a17e-d1a7097661d7');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'de0da37f-c714-4f90-887b-0681883a2849');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', 'd2c44dff-9033-461f-bfe3-c4b8071326cd');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '815a6e29-0f5a-47f9-ba3f-fd9121ede957');
INSERT INTO public.role_permissions VALUES ('dc91fc07-2505-4976-898c-dfd881b93831', '643f77a1-7c6d-47ad-9851-8e36f423a221');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', 'd17cd069-c73c-496f-9f82-2546b205a3db');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', 'd17cd069-c73c-496f-9f82-2546b205a3db');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', 'd17cd069-c73c-496f-9f82-2546b205a3db');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '46a1474d-4c39-4cab-baa8-39f27c856d86');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '22503f83-2117-417e-a6c5-a46b69eb8af4');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', 'deea4b17-613a-44fe-ac56-4479f55bd688');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', '030b75ee-7c23-4737-be43-fc987fd75fc9');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '030b75ee-7c23-4737-be43-fc987fd75fc9');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', '030b75ee-7c23-4737-be43-fc987fd75fc9');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '68e216bd-80bc-4a0f-92ce-186b5678308a');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '01b928e4-87f3-4f26-9d66-bb4cfaeff7be');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '2964c189-5657-43d4-ae98-fc78006ae445');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', '72f16bba-70bb-4877-a498-2ba6d8b815a8');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '72f16bba-70bb-4877-a498-2ba6d8b815a8');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', '72f16bba-70bb-4877-a498-2ba6d8b815a8');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '4de291e8-138f-469e-b95e-f411dc710690');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', 'f2f1d65e-9ef8-46f9-8328-934f9ee4ae6f');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', 'bc648d67-04eb-4368-b631-2090d13ca093');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', '199f77e3-e0ae-4f6e-bfb7-3f61eebc0f1b');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', '199f77e3-e0ae-4f6e-bfb7-3f61eebc0f1b');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', '21ace77f-1f0a-47f6-97f2-80c1bd56852d');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', 'cf7f20ce-e150-42e3-a9d7-1e13f9ce42c6');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', 'e9b28f23-e906-4deb-b31d-d0253b268047');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '0f63e6c3-af84-467d-bf8c-0e64684c9c25');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', 'fd7318dd-4402-421b-86f3-eb16c79fa710');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '3854fd20-37ad-413a-8308-9236d9495828');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', 'a014d50c-bc3d-4a83-97ff-6929b49c7d14');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', '6a9a04ee-4c7b-4fa7-9467-3adcce77d1ee');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '6a9a04ee-4c7b-4fa7-9467-3adcce77d1ee');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', '6a9a04ee-4c7b-4fa7-9467-3adcce77d1ee');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', '55d5c3ac-6fcf-42ea-bd51-95ba57c721c8');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '55d5c3ac-6fcf-42ea-bd51-95ba57c721c8');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', '7cfd4dd5-3b16-46d2-9e62-6ba26e988b43');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '7cfd4dd5-3b16-46d2-9e62-6ba26e988b43');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', '79dc90b8-b743-43f0-bae6-9a2f8f12f90d');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', 'fda3eb28-4dda-4f82-80f5-63545c940a84');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', '86d51017-27b1-4942-9432-12719325b1bd');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', '86d51017-27b1-4942-9432-12719325b1bd');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', '39cec04d-4067-47ec-a577-7b708ea6046e');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', 'f05df2d7-cf98-4c75-b05e-665b31983215');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', 'cedf437c-ff68-4c29-a6a2-b676296b61c1');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', 'b85e7183-939a-462d-aa62-436134edf420');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', '0529b0bd-731e-4b05-98ce-50363c467950');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', '0529b0bd-731e-4b05-98ce-50363c467950');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', 'ed0c980f-dc28-4b98-bdf4-062bc9ee287e');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', 'ed0c980f-dc28-4b98-bdf4-062bc9ee287e');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', 'f2c2c7a4-678e-44fc-854e-f5b0ab8ae26c');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', 'f2c2c7a4-678e-44fc-854e-f5b0ab8ae26c');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', '5836ef78-fc12-4801-83f3-7daf91a79813');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', '58d391f4-fc87-4900-9359-8ccb32197fff');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', '58d391f4-fc87-4900-9359-8ccb32197fff');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', '6ecdb2fc-f3d4-449f-a941-b1bb74cf3b33');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', '6ecdb2fc-f3d4-449f-a941-b1bb74cf3b33');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '13e2cfdf-b2ad-4123-b124-1c3eae48756f');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', '13e2cfdf-b2ad-4123-b124-1c3eae48756f');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '8aa9602f-b931-40c7-9da8-068c0bf94e6e');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '293ed04d-7531-4a0d-95ba-9cdf444cdf48');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '542e0b60-6257-4cea-b60c-ea0aa13840de');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '73329ba8-cd3d-465c-a186-07b9fb087703');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '2c30597f-deb3-4408-8707-a1bb8cf95548');
INSERT INTO public.role_permissions VALUES ('3b24ffd8-0762-433c-bcbd-3669907b9fbe', '8be0a609-f19d-4572-a5c3-6a4987c76124');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '8be0a609-f19d-4572-a5c3-6a4987c76124');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', '8be0a609-f19d-4572-a5c3-6a4987c76124');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '848f1ebe-7249-4853-bb7e-c6ad4e6c98ca');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', 'e8f57daa-770c-4b43-ae99-40ef04546318');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '82553b82-8b06-48ba-ab6a-11f94351dbd7');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', 'f7d57137-6e1a-4eb2-a17e-d1a7097661d7');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', 'de0da37f-c714-4f90-887b-0681883a2849');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', 'd2c44dff-9033-461f-bfe3-c4b8071326cd');
INSERT INTO public.role_permissions VALUES ('1c857ffd-f890-45a5-ab09-d66ee3f68319', '815a6e29-0f5a-47f9-ba3f-fd9121ede957');
INSERT INTO public.role_permissions VALUES ('fe9197a5-6dd4-4c9f-a1aa-1639eb72891b', '643f77a1-7c6d-47ad-9851-8e36f423a221');


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pgmigrations_id_seq', 8, true);


--
-- PostgreSQL database dump complete
--



SELECT setval(pg_get_serial_sequence('public.pgmigrations','id'), (SELECT max(id) FROM public.pgmigrations), true);

SET search_path = public;
