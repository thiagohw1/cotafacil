CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'buyer',
    'supplier'
);


--
-- Name: quote_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quote_status AS ENUM (
    'draft',
    'open',
    'closed',
    'cancelled'
);


--
-- Name: supplier_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.supplier_status AS ENUM (
    'invited',
    'viewed',
    'partial',
    'submitted'
);


--
-- Name: get_quote_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quote_by_token(p_token text) RETURNS TABLE(quote_supplier_id bigint, quote_id bigint, supplier_id bigint, status public.supplier_status, submitted_at timestamp with time zone, quote_status public.quote_status, quote_title text, quote_description text, quote_deadline timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    qs.id as quote_supplier_id,
    qs.quote_id,
    qs.supplier_id,
    qs.status,
    qs.submitted_at,
    q.status as quote_status,
    q.title as quote_title,
    q.description as quote_description,
    q.deadline_at as quote_deadline
  FROM public.quote_suppliers qs
  JOIN public.quotes q ON q.id = qs.quote_id
  WHERE qs.public_token = p_token
  LIMIT 1;
$$;


--
-- Name: get_user_tenant_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_tenant_id(_user_id uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_tenant_id BIGINT;
BEGIN
  -- Create a new tenant for the user
  INSERT INTO public.tenants (name, slug, created_by)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'Minha Empresa'),
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'empresa-' || LEFT(NEW.id::text, 8)), ' ', '-')),
    NEW.id
  )
  RETURNING id INTO new_tenant_id;
  
  -- Create profile
  INSERT INTO public.profiles (user_id, tenant_id, email, full_name)
  VALUES (
    NEW.id,
    new_tenant_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  
  -- Assign admin role to new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');
  
  RETURN NEW;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: save_supplier_response(text, bigint, numeric, numeric, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_supplier_response(p_token text, p_quote_item_id bigint, p_price numeric, p_min_qty numeric DEFAULT NULL::numeric, p_delivery_days integer DEFAULT NULL::integer, p_notes text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_quote_supplier_id BIGINT;
  v_quote_id BIGINT;
BEGIN
  -- Verificar token e obter IDs
  SELECT qs.id, qs.quote_id INTO v_quote_supplier_id, v_quote_id
  FROM public.quote_suppliers qs
  JOIN public.quotes q ON q.id = qs.quote_id
  WHERE qs.public_token = p_token
    AND q.status = 'open'
    AND (q.deadline_at IS NULL OR q.deadline_at > NOW())
    AND qs.submitted_at IS NULL;
  
  IF v_quote_supplier_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Upsert da resposta
  INSERT INTO public.quote_responses (
    quote_id,
    quote_supplier_id,
    quote_item_id,
    price,
    min_qty,
    delivery_days,
    notes,
    filled_at
  ) VALUES (
    v_quote_id,
    v_quote_supplier_id,
    p_quote_item_id,
    p_price,
    p_min_qty,
    p_delivery_days,
    p_notes,
    NOW()
  )
  ON CONFLICT (quote_supplier_id, quote_item_id)
  DO UPDATE SET
    price = EXCLUDED.price,
    min_qty = EXCLUDED.min_qty,
    delivery_days = EXCLUDED.delivery_days,
    notes = EXCLUDED.notes,
    filled_at = NOW();

  -- Atualizar status do quote_supplier para partial se ainda não foi submetido
  UPDATE public.quote_suppliers
  SET status = 'partial', last_access_at = NOW()
  WHERE id = v_quote_supplier_id AND status IN ('invited', 'viewed');

  RETURN TRUE;
END;
$$;


--
-- Name: submit_supplier_quote(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_supplier_quote(p_token text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_quote_supplier_id BIGINT;
BEGIN
  -- Verificar token e obter ID
  SELECT qs.id INTO v_quote_supplier_id
  FROM public.quote_suppliers qs
  JOIN public.quotes q ON q.id = qs.quote_id
  WHERE qs.public_token = p_token
    AND q.status = 'open'
    AND (q.deadline_at IS NULL OR q.deadline_at > NOW())
    AND qs.submitted_at IS NULL;
  
  IF v_quote_supplier_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Marcar como submetido
  UPDATE public.quote_suppliers
  SET status = 'submitted', submitted_at = NOW(), last_access_at = NOW()
  WHERE id = v_quote_supplier_id;

  RETURN TRUE;
END;
$$;


--
-- Name: update_supplier_access(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_supplier_access(p_token text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.quote_suppliers
  SET last_access_at = NOW(),
      status = CASE WHEN status = 'invited' THEN 'viewed' ELSE status END
  WHERE public_token = p_token;
  
  RETURN FOUND;
END;
$$;


--
-- Name: verify_supplier_token(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_supplier_token(p_quote_supplier_id bigint, p_token text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.quote_suppliers qs
    JOIN public.quotes q ON q.id = qs.quote_id
    WHERE qs.id = p_quote_supplier_id
      AND qs.public_token = p_token
      AND q.status = 'open'
      AND (q.deadline_at IS NULL OR q.deadline_at > NOW())
  );
$$;


SET default_table_access_method = heap;

--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    id bigint NOT NULL,
    tenant_id bigint,
    user_id uuid,
    action text NOT NULL,
    entity_type text,
    entity_id bigint,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.activity_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.activity_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    name text NOT NULL,
    parent_id bigint,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.categories ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: product_list_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_list_items (
    id bigint NOT NULL,
    list_id bigint NOT NULL,
    product_id bigint NOT NULL,
    preferred_package_id bigint,
    default_qty numeric(10,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_list_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.product_list_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.product_list_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: product_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_lists (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone
);


--
-- Name: product_lists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.product_lists ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.product_lists_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: product_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_packages (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    unit text NOT NULL,
    multiplier numeric(10,2) DEFAULT 1 NOT NULL,
    barcode text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_packages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.product_packages ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.product_packages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    category_id bigint,
    name text NOT NULL,
    brand text,
    notes text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.products ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.products_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    tenant_id bigint,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.profiles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.profiles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: quote_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_items (
    id bigint NOT NULL,
    quote_id bigint NOT NULL,
    product_id bigint NOT NULL,
    package_id bigint,
    requested_qty numeric(10,2),
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.quote_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.quote_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: quote_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_responses (
    id bigint NOT NULL,
    quote_id bigint NOT NULL,
    quote_supplier_id bigint NOT NULL,
    quote_item_id bigint NOT NULL,
    price numeric(12,4),
    min_qty numeric(10,2),
    delivery_days integer,
    notes text,
    filled_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.quote_responses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.quote_responses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: quote_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_suppliers (
    id bigint NOT NULL,
    quote_id bigint NOT NULL,
    supplier_id bigint NOT NULL,
    public_token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    invited_at timestamp with time zone DEFAULT now() NOT NULL,
    last_access_at timestamp with time zone,
    submitted_at timestamp with time zone,
    status public.supplier_status DEFAULT 'invited'::public.supplier_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.quote_suppliers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.quote_suppliers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    title text NOT NULL,
    description text,
    status public.quote_status DEFAULT 'draft'::public.quote_status NOT NULL,
    deadline_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone
);


--
-- Name: quotes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.quotes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.quotes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    name text NOT NULL,
    cnpj text,
    email text NOT NULL,
    phone text,
    contact_name text,
    notes text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone
);


--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.suppliers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id bigint NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.tenants ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.tenants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'buyer'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.user_roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: product_list_items product_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_list_items
    ADD CONSTRAINT product_list_items_pkey PRIMARY KEY (id);


--
-- Name: product_lists product_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_lists
    ADD CONSTRAINT product_lists_pkey PRIMARY KEY (id);


--
-- Name: product_packages product_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_packages
    ADD CONSTRAINT product_packages_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: quote_items quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_pkey PRIMARY KEY (id);


--
-- Name: quote_responses quote_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_responses
    ADD CONSTRAINT quote_responses_pkey PRIMARY KEY (id);


--
-- Name: quote_responses quote_responses_quote_supplier_id_quote_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_responses
    ADD CONSTRAINT quote_responses_quote_supplier_id_quote_item_id_key UNIQUE (quote_supplier_id, quote_item_id);


--
-- Name: quote_responses quote_responses_supplier_item_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_responses
    ADD CONSTRAINT quote_responses_supplier_item_unique UNIQUE (quote_supplier_id, quote_item_id);


--
-- Name: quote_suppliers quote_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_suppliers
    ADD CONSTRAINT quote_suppliers_pkey PRIMARY KEY (id);


--
-- Name: quote_suppliers quote_suppliers_public_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_suppliers
    ADD CONSTRAINT quote_suppliers_public_token_key UNIQUE (public_token);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_activity_log_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_tenant ON public.activity_log USING btree (tenant_id);


--
-- Name: idx_categories_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_tenant ON public.categories USING btree (tenant_id);


--
-- Name: idx_product_list_items_list; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_list_items_list ON public.product_list_items USING btree (list_id);


--
-- Name: idx_product_lists_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_lists_tenant ON public.product_lists USING btree (tenant_id);


--
-- Name: idx_product_packages_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_packages_product ON public.product_packages USING btree (product_id);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (category_id);


--
-- Name: idx_products_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_tenant ON public.products USING btree (tenant_id);


--
-- Name: idx_profiles_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_tenant ON public.profiles USING btree (tenant_id);


--
-- Name: idx_profiles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_user ON public.profiles USING btree (user_id);


--
-- Name: idx_quote_items_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_items_quote ON public.quote_items USING btree (quote_id);


--
-- Name: idx_quote_responses_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_responses_quote ON public.quote_responses USING btree (quote_id);


--
-- Name: idx_quote_responses_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_responses_supplier ON public.quote_responses USING btree (quote_supplier_id);


--
-- Name: idx_quote_suppliers_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_suppliers_quote ON public.quote_suppliers USING btree (quote_id);


--
-- Name: idx_quote_suppliers_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_suppliers_supplier ON public.quote_suppliers USING btree (supplier_id);


--
-- Name: idx_quote_suppliers_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_suppliers_token ON public.quote_suppliers USING btree (public_token);


--
-- Name: idx_quotes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_status ON public.quotes USING btree (status);


--
-- Name: idx_quotes_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_tenant ON public.quotes USING btree (tenant_id);


--
-- Name: idx_suppliers_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_tenant ON public.suppliers USING btree (tenant_id);


--
-- Name: categories set_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: product_lists set_product_lists_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_product_lists_updated_at BEFORE UPDATE ON public.product_lists FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: product_packages set_product_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_product_packages_updated_at BEFORE UPDATE ON public.product_packages FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: products set_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: quote_items set_quote_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quote_items_updated_at BEFORE UPDATE ON public.quote_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: quotes set_quotes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: suppliers set_suppliers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: tenants set_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: activity_log activity_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: activity_log activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: categories categories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: categories categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: categories categories_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: product_list_items product_list_items_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_list_items
    ADD CONSTRAINT product_list_items_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.product_lists(id) ON DELETE CASCADE;


--
-- Name: product_list_items product_list_items_preferred_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_list_items
    ADD CONSTRAINT product_list_items_preferred_package_id_fkey FOREIGN KEY (preferred_package_id) REFERENCES public.product_packages(id) ON DELETE SET NULL;


--
-- Name: product_list_items product_list_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_list_items
    ADD CONSTRAINT product_list_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_lists product_lists_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_lists
    ADD CONSTRAINT product_lists_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: product_lists product_lists_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_lists
    ADD CONSTRAINT product_lists_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: product_lists product_lists_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_lists
    ADD CONSTRAINT product_lists_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: product_packages product_packages_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_packages
    ADD CONSTRAINT product_packages_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: products products_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: products products_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: products products_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: quote_items quote_items_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.product_packages(id) ON DELETE SET NULL;


--
-- Name: quote_items quote_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: quote_items quote_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_responses quote_responses_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_responses
    ADD CONSTRAINT quote_responses_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_responses quote_responses_quote_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_responses
    ADD CONSTRAINT quote_responses_quote_item_id_fkey FOREIGN KEY (quote_item_id) REFERENCES public.quote_items(id) ON DELETE CASCADE;


--
-- Name: quote_responses quote_responses_quote_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_responses
    ADD CONSTRAINT quote_responses_quote_supplier_id_fkey FOREIGN KEY (quote_supplier_id) REFERENCES public.quote_suppliers(id) ON DELETE CASCADE;


--
-- Name: quote_suppliers quote_suppliers_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_suppliers
    ADD CONSTRAINT quote_suppliers_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_suppliers quote_suppliers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_suppliers
    ADD CONSTRAINT quote_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: quotes quotes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: suppliers suppliers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: suppliers suppliers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: suppliers suppliers_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: tenants tenants_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: tenants tenants_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: quote_responses Public can read responses for open quotes via token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read responses for open quotes via token" ON public.quote_responses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.quote_suppliers qs
  WHERE (qs.id = quote_responses.quote_supplier_id))));


--
-- Name: product_packages Users can delete product packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete product packages" ON public.product_packages FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.products
  WHERE ((products.id = product_packages.product_id) AND (products.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: product_list_items Users can delete product_list_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete product_list_items" ON public.product_list_items FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.product_lists
  WHERE ((product_lists.id = product_list_items.list_id) AND (product_lists.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: quote_items Users can delete quote_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete quote_items" ON public.quote_items FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_items.quote_id) AND (quotes.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: quote_suppliers Users can delete quote_suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete quote_suppliers" ON public.quote_suppliers FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_suppliers.quote_id) AND (quotes.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: categories Users can delete tenant categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete tenant categories" ON public.categories FOR DELETE USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: product_lists Users can delete tenant product_lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete tenant product_lists" ON public.product_lists FOR DELETE USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: products Users can delete tenant products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete tenant products" ON public.products FOR DELETE USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: quotes Users can delete tenant quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete tenant quotes" ON public.quotes FOR DELETE USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: suppliers Users can delete tenant suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete tenant suppliers" ON public.suppliers FOR DELETE USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: activity_log Users can insert activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert activity" ON public.activity_log FOR INSERT WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: product_packages Users can insert product packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert product packages" ON public.product_packages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.products
  WHERE ((products.id = product_packages.product_id) AND (products.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: product_list_items Users can insert product_list_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert product_list_items" ON public.product_list_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.product_lists
  WHERE ((product_lists.id = product_list_items.list_id) AND (product_lists.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: quote_items Users can insert quote_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert quote_items" ON public.quote_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_items.quote_id) AND (quotes.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: quote_responses Users can insert quote_responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert quote_responses" ON public.quote_responses FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_responses.quote_id) AND (quotes.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: quote_suppliers Users can insert quote_suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert quote_suppliers" ON public.quote_suppliers FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_suppliers.quote_id) AND (quotes.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: categories Users can insert tenant categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert tenant categories" ON public.categories FOR INSERT WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: product_lists Users can insert tenant product_lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert tenant product_lists" ON public.product_lists FOR INSERT WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: products Users can insert tenant products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert tenant products" ON public.products FOR INSERT WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: quotes Users can insert tenant quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert tenant quotes" ON public.quotes FOR INSERT WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: suppliers Users can insert tenant suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert tenant suppliers" ON public.suppliers FOR INSERT WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: tenants Users can update own tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own tenant" ON public.tenants FOR UPDATE USING ((id = public.get_user_tenant_id(auth.uid())));


--
-- Name: product_packages Users can update product packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update product packages" ON public.product_packages FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.products
  WHERE ((products.id = product_packages.product_id) AND (products.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: product_list_items Users can update product_list_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update product_list_items" ON public.product_list_items FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.product_lists
  WHERE ((product_lists.id = product_list_items.list_id) AND (product_lists.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: quote_items Users can update quote_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update quote_items" ON public.quote_items FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_items.quote_id) AND (quotes.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: quote_responses Users can update quote_responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update quote_responses" ON public.quote_responses FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_responses.quote_id) AND (quotes.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: quote_suppliers Users can update quote_suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update quote_suppliers" ON public.quote_suppliers FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_suppliers.quote_id) AND (quotes.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: categories Users can update tenant categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update tenant categories" ON public.categories FOR UPDATE USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: product_lists Users can update tenant product_lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update tenant product_lists" ON public.product_lists FOR UPDATE USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: products Users can update tenant products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update tenant products" ON public.products FOR UPDATE USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: quotes Users can update tenant quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update tenant quotes" ON public.quotes FOR UPDATE USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: suppliers Users can update tenant suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update tenant suppliers" ON public.suppliers FOR UPDATE USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: tenants Users can view own tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own tenant" ON public.tenants FOR SELECT USING ((id = public.get_user_tenant_id(auth.uid())));


--
-- Name: product_packages Users can view product packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view product packages" ON public.product_packages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.products
  WHERE ((products.id = product_packages.product_id) AND (products.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: product_list_items Users can view product_list_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view product_list_items" ON public.product_list_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.product_lists
  WHERE ((product_lists.id = product_list_items.list_id) AND (product_lists.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: quote_items Users can view quote_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view quote_items" ON public.quote_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_items.quote_id) AND (quotes.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: quote_responses Users can view quote_responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view quote_responses" ON public.quote_responses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_responses.quote_id) AND (quotes.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: quote_suppliers Users can view quote_suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view quote_suppliers" ON public.quote_suppliers FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_suppliers.quote_id) AND (quotes.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: activity_log Users can view tenant activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tenant activity" ON public.activity_log FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: categories Users can view tenant categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tenant categories" ON public.categories FOR SELECT USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND (deleted_at IS NULL)));


--
-- Name: product_lists Users can view tenant product_lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tenant product_lists" ON public.product_lists FOR SELECT USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND (deleted_at IS NULL)));


--
-- Name: products Users can view tenant products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tenant products" ON public.products FOR SELECT USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND (deleted_at IS NULL)));


--
-- Name: quotes Users can view tenant quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tenant quotes" ON public.quotes FOR SELECT USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND (deleted_at IS NULL)));


--
-- Name: suppliers Users can view tenant suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tenant suppliers" ON public.suppliers FOR SELECT USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND (deleted_at IS NULL)));


--
-- Name: activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: product_list_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_list_items ENABLE ROW LEVEL SECURITY;

--
-- Name: product_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: product_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


