/**
 * Script para aplicar migrations automaticamente via browser
 * 
 * Execute este script no console do navegador (F12) enquanto estiver
 * logado na aplicação.
 * 
 * IMPORTANTE: Este script usa o supabaseAdmin que tem acesso total
 */

import { supabaseAdmin, hasAdminAccess } from '@/integrations/supabase/client';

export async function applyMigrations() {
  console.log('🚀 Iniciando aplicação de migrations...\n');

  // Verificar acesso admin
  if (!hasAdminAccess()) {
    console.error('❌ Service Role Key não configurada!');
    console.error('Configure VITE_SUPABASE_SERVICE_ROLE_KEY no .env');
    return false;
  }

  console.log('✅ Service Role Key detectada\n');

  // =========================================================================
  // MIGRATION 1: Winner Fields
  // =========================================================================

  console.log('📝 Aplicando Migration 1: Winner Fields em quote_items...');

  const migration1 = `
    -- Adicionar campos de vencedor
    ALTER TABLE public.quote_items 
    ADD COLUMN IF NOT EXISTS winner_supplier_id BIGINT REFERENCES public.suppliers(id),
    ADD COLUMN IF NOT EXISTS winner_response_id BIGINT REFERENCES public.quote_responses(id),
    ADD COLUMN IF NOT EXISTS winner_reason TEXT,
    ADD COLUMN IF NOT EXISTS winner_set_at TIMESTAMPTZ;

    -- Criar índice para melhorar performance
    CREATE INDEX IF NOT EXISTS idx_quote_items_winner 
    ON public.quote_items(winner_supplier_id) 
    WHERE winner_supplier_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id 
    ON public.quote_items(quote_id);
  `;

  try {
    const { error: error1 } = await supabaseAdmin!.rpc('execute_sql', {
      query: migration1
    });

    if (error1) {
      console.error('❌ Erro na Migration 1:', error1);
      return false;
    }

    console.log('✅ Migration 1 aplicada com sucesso!\n');
  } catch (e) {
    console.error('❌ Exceção na Migration 1:', e);
    return false;
  }

  // =========================================================================
  // MIGRATION 2: Purchase Orders - Parte 1 (ENUM e Tabelas)
  // =========================================================================

  console.log('📝 Aplicando Migration 2 (Parte 1): ENUM e Tabelas...');

  const migration2_parte1 = `
    -- ENUM para status
    DO $$ BEGIN
      CREATE TYPE public.po_status AS ENUM ('draft', 'sent', 'confirmed', 'delivered', 'cancelled');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Tabela purchase_orders
    CREATE TABLE IF NOT EXISTS public.purchase_orders (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      tenant_id BIGINT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      quote_id BIGINT REFERENCES public.quotes(id) ON DELETE SET NULL,
      po_number TEXT NOT NULL,
      supplier_id BIGINT NOT NULL REFERENCES public.suppliers(id),
      status public.po_status DEFAULT 'draft' NOT NULL,
      subtotal NUMERIC(12,2) DEFAULT 0,
      tax_amount NUMERIC(12,2) DEFAULT 0,
      shipping_cost NUMERIC(12,2) DEFAULT 0,
      total_amount NUMERIC(12,2) DEFAULT 0,
      notes TEXT,
      internal_notes TEXT,
      expected_delivery_date DATE,
      actual_delivery_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      created_by UUID REFERENCES auth.users(id),
      updated_by UUID REFERENCES auth.users(id),
      deleted_at TIMESTAMPTZ,
      UNIQUE(tenant_id, po_number),
      CHECK (total_amount >= 0),
      CHECK (subtotal >= 0)
    );

    -- Tabela purchase_order_items
    CREATE TABLE IF NOT EXISTS public.purchase_order_items (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      po_id BIGINT NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
      product_id BIGINT NOT NULL REFERENCES public.products(id),
      package_id BIGINT REFERENCES public.product_packages(id),
      quote_item_id BIGINT REFERENCES public.quote_items(id) ON DELETE SET NULL,
      quote_response_id BIGINT REFERENCES public.quote_responses(id) ON DELETE SET NULL,
      qty NUMERIC(10,2) NOT NULL CHECK (qty > 0),
      unit_price NUMERIC(12,4) NOT NULL CHECK (unit_price >= 0),
      total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
      notes TEXT,
      delivery_days INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    -- Sequência para número de PO
    CREATE SEQUENCE IF NOT EXISTS public.po_number_seq START 1000;
  `;

  try {
    const { error: error2 } = await supabaseAdmin!.rpc('execute_sql', {
      query: migration2_parte1
    });

    if (error2) {
      console.error('❌ Erro na Migration 2 (Parte 1):', error2);
      return false;
    }

    console.log('✅ Migration 2 (Parte 1) aplicada com sucesso!\n');
  } catch (e) {
    console.error('❌ Exceção na Migration 2 (Parte 1):', e);
    return false;
  }

  // =========================================================================
  // MIGRATION 2: Purchase Orders - Parte 2 (Funções e Triggers)
  // =========================================================================

  console.log('📝 Aplicando Migration 2 (Parte 2): Funções e Triggers...');

  // Dividir em blocos menores para evitar erros

  // Função generate_po_number
  const migration2_fn1 = `
    CREATE OR REPLACE FUNCTION public.generate_po_number(_tenant_id BIGINT)
    RETURNS TEXT
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DECLARE
      _next_num INTEGER;
      _po_number TEXT;
    BEGIN
      SELECT nextval('po_number_seq') INTO _next_num;
      _po_number := 'PO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(_next_num::TEXT, 4, '0');
      RETURN _po_number;
    END;
    $$;
  `;

  // Função set_po_number
  const migration2_fn2 = `
    CREATE OR REPLACE FUNCTION public.set_po_number()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
        NEW.po_number := generate_po_number(NEW.tenant_id);
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS trigger_set_po_number ON public.purchase_orders;
    CREATE TRIGGER trigger_set_po_number
      BEFORE INSERT ON public.purchase_orders
      FOR EACH ROW
      EXECUTE FUNCTION public.set_po_number();
  `;

  // Triggers para updated_at
  const migration2_fn3 = `
    DROP TRIGGER IF EXISTS trigger_purchase_orders_updated_at ON public.purchase_orders;
    CREATE TRIGGER trigger_purchase_orders_updated_at
      BEFORE UPDATE ON public.purchase_orders
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();

    DROP TRIGGER IF EXISTS trigger_purchase_order_items_updated_at ON public.purchase_order_items;
    CREATE TRIGGER trigger_purchase_order_items_updated_at
      BEFORE UPDATE ON public.purchase_order_items
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  `;

  // Função calculate_po_total
  const migration2_fn4 = `
    CREATE OR REPLACE FUNCTION public.calculate_po_total(_po_id BIGINT)
    RETURNS NUMERIC(12,2)
    LANGUAGE sql
    STABLE
    AS $$
      SELECT COALESCE(SUM(total_price), 0)
      FROM public.purchase_order_items
      WHERE po_id = _po_id;
    $$;
  `;

  // Função update_po_total e triggers
  const migration2_fn5 = `
    CREATE OR REPLACE FUNCTION public.update_po_total()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      UPDATE public.purchase_orders
      SET 
        subtotal = calculate_po_total(COALESCE(NEW.po_id, OLD.po_id)),
        total_amount = subtotal + COALESCE(tax_amount, 0) + COALESCE(shipping_cost, 0),
        updated_at = NOW()
      WHERE id = COALESCE(NEW.po_id, OLD.po_id);
      
      RETURN COALESCE(NEW, OLD);
    END;
    $$;

    DROP TRIGGER IF EXISTS trigger_update_po_total_on_insert ON public.purchase_order_items;
    CREATE TRIGGER trigger_update_po_total_on_insert
      AFTER INSERT ON public.purchase_order_items
      FOR EACH ROW
      EXECUTE FUNCTION public.update_po_total();

    DROP TRIGGER IF EXISTS trigger_update_po_total_on_update ON public.purchase_order_items;
    CREATE TRIGGER trigger_update_po_total_on_update
      AFTER UPDATE ON public.purchase_order_items
      FOR EACH ROW
      EXECUTE FUNCTION public.update_po_total();

    DROP TRIGGER IF EXISTS trigger_update_po_total_on_delete ON public.purchase_order_items;
    CREATE TRIGGER trigger_update_po_total_on_delete
      AFTER DELETE ON public.purchase_order_items
      FOR EACH ROW
      EXECUTE FUNCTION public.update_po_total();
  `;

  const funcoes = [migration2_fn1, migration2_fn2, migration2_fn3, migration2_fn4, migration2_fn5];

  for (let i = 0; i < funcoes.length; i++) {
    try {
      const { error } = await supabaseAdmin!.rpc('execute_sql', {
        query: funcoes[i]
      });

      if (error) {
        console.error(`❌ Erro ao criar função ${i + 1}:`, error);
        return false;
      }

      console.log(`✅ Função/Trigger ${i + 1}/${funcoes.length} criada`);
    } catch (e) {
      console.error(`❌ Exceção ao criar função ${i + 1}:`, e);
      return false;
    }
  }

  console.log('✅ Migration 2 (Parte 2) aplicada com sucesso!\n');

  // =========================================================================
  // MIGRATION 2: Purchase Orders - Parte 3 (Índices e RLS)
  // =========================================================================

  console.log('📝 Aplicando Migration 2 (Parte 3): Índices e RLS...');

  const migration2_parte3 = `
    -- Índices
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON public.purchase_orders(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_quote ON public.purchase_orders(quote_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON public.purchase_orders(po_number);
    CREATE INDEX IF NOT EXISTS idx_po_items_po ON public.purchase_order_items(po_id);
    CREATE INDEX IF NOT EXISTS idx_po_items_product ON public.purchase_order_items(product_id);

    -- Habilitar RLS
    ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

    -- Políticas RLS para purchase_orders
    DROP POLICY IF EXISTS "Users can view tenant purchase_orders" ON public.purchase_orders;
    CREATE POLICY "Users can view tenant purchase_orders"
    ON public.purchase_orders FOR SELECT
    USING (tenant_id = get_user_tenant_id(auth.uid()));

    DROP POLICY IF EXISTS "Users can insert tenant purchase_orders" ON public.purchase_orders;
    CREATE POLICY "Users can insert tenant purchase_orders"
    ON public.purchase_orders FOR INSERT
    WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

    DROP POLICY IF EXISTS "Users can update tenant purchase_orders" ON public.purchase_orders;
    CREATE POLICY "Users can update tenant purchase_orders"
    ON public.purchase_orders FOR UPDATE
    USING (tenant_id = get_user_tenant_id(auth.uid()));

    DROP POLICY IF EXISTS "Users can delete tenant purchase_orders" ON public.purchase_orders;
    CREATE POLICY "Users can delete tenant purchase_orders"
    ON public.purchase_orders FOR DELETE
    USING (tenant_id = get_user_tenant_id(auth.uid()));

    -- Políticas RLS para purchase_order_items
    DROP POLICY IF EXISTS "Users can view po items from their tenant" ON public.purchase_order_items;
    CREATE POLICY "Users can view po items from their tenant"
    ON public.purchase_order_items FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.purchase_orders
        WHERE id = po_id AND tenant_id = get_user_tenant_id(auth.uid())
      )
    );

    DROP POLICY IF EXISTS "Users can insert po items to their tenant POs" ON public.purchase_order_items;
    CREATE POLICY "Users can insert po items to their tenant POs"
    ON public.purchase_order_items FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.purchase_orders
        WHERE id = po_id AND tenant_id = get_user_tenant_id(auth.uid())
      )
    );

    DROP POLICY IF EXISTS "Users can update po items from their tenant" ON public.purchase_order_items;
    CREATE POLICY "Users can update po items from their tenant"
    ON public.purchase_order_items FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.purchase_orders
        WHERE id = po_id AND tenant_id = get_user_tenant_id(auth.uid())
      )
    );

    DROP POLICY IF EXISTS "Users can delete po items from their tenant" ON public.purchase_order_items;
    CREATE POLICY "Users can delete po items from their tenant"
    ON public.purchase_order_items FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.purchase_orders
        WHERE id = po_id AND tenant_id = get_user_tenant_id(auth.uid())
      )
    );
  `;

  try {
    const { error: error3 } = await supabaseAdmin!.rpc('execute_sql', {
      query: migration2_parte3
    });

    if (error3) {
      console.error('❌ Erro na Migration 2 (Parte 3):', error3);
      return false;
    }

    console.log('✅ Migration 2 (Parte 3) aplicada com sucesso!\n');
  } catch (e) {
    console.error('❌ Exceção na Migration 2 (Parte 3):', e);
    return false;
  }

  // =========================================================================
  // MIGRATION 3: Fix Update PO Total
  // =========================================================================

  console.log('📝 Aplicando Migration 3: Fix Update PO Total...');

  const migration3 = `
    -- Fix update_po_total function logic
    CREATE OR REPLACE FUNCTION public.update_po_total()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    DECLARE
      _new_subtotal NUMERIC;
    BEGIN
      -- Calcular o novo subtotal primeiro
      _new_subtotal := public.calculate_po_total(COALESCE(NEW.po_id, OLD.po_id));

      -- Atualizar a tabela usando o valor calculado
      UPDATE public.purchase_orders
      SET 
        subtotal = _new_subtotal,
        total_amount = _new_subtotal + COALESCE(tax_amount, 0) + COALESCE(shipping_cost, 0),
        updated_at = NOW()
      WHERE id = COALESCE(NEW.po_id, OLD.po_id);
      
      RETURN COALESCE(NEW, OLD);
    END;
    $$;

    -- Recalcular totais para POs existentes
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN SELECT id FROM public.purchase_orders LOOP
        PERFORM public.calculate_po_total(r.id);
        
        -- Vamos chamar a lógica de update manualmente para cada PO
        UPDATE public.purchase_orders
        SET 
            subtotal = public.calculate_po_total(id),
            total_amount = public.calculate_po_total(id) + COALESCE(tax_amount, 0) + COALESCE(shipping_cost, 0)
        WHERE id = r.id;
      END LOOP;
    END;
    $$;
    `;

  try {
    const { error: error4 } = await supabaseAdmin!.rpc('execute_sql', {
      query: migration3
    });

    if (error4) {
      console.error('❌ Erro na Migration 3:', error4);
      return false;
    }

    console.log('✅ Migration 3 aplicada com sucesso!\n');
  } catch (e) {
    console.error('❌ Exceção na Migration 3:', e);
    return false;
  }

  // =========================================================================
  // MIGRATION 4: Optimize Auto Select Winners
  // =========================================================================

  console.log('📝 Aplicando Migration 4: Optimize Auto Select Winners...');

  const migration4 = `
    CREATE OR REPLACE FUNCTION public.auto_select_winners(p_quote_id BIGINT)
    RETURNS INTEGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_count INTEGER := 0;
      r_item RECORD;
      r_response RECORD;
    BEGIN
      -- Iterar sobre itens da cotação que AINDA NÃO TÊM vencedor definido
      FOR r_item IN
        SELECT id 
        FROM public.quote_items 
        WHERE quote_id = p_quote_id 
          AND winner_supplier_id IS NULL
      LOOP
        
        -- Selecionar a resposta com menor preço para este item
        SELECT 
          qr.id AS response_id,
          qs.supplier_id
        INTO r_response
        FROM public.quote_responses qr
        JOIN public.quote_suppliers qs ON qr.quote_supplier_id = qs.id
        WHERE qr.quote_item_id = r_item.id
          AND qr.price IS NOT NULL
          AND qr.price > 0
        ORDER BY qr.price ASC, qr.filled_at ASC
        LIMIT 1;

        -- Se encontrou uma resposta válida, atualiza o item
        IF FOUND THEN
          UPDATE public.quote_items
          SET 
            winner_supplier_id = r_response.supplier_id,
            winner_response_id = r_response.response_id,
            winner_reason = 'Menor Preço (Automático)',
            winner_set_at = NOW()
          WHERE id = r_item.id;

          v_count := v_count + 1;
        END IF;

      END LOOP;

      RETURN v_count;
    END;
    $$;
  `;

  try {
    const { error: error5 } = await supabaseAdmin!.rpc('execute_sql', {
      query: migration4
    });

    if (error5) {
      console.error('❌ Erro na Migration 4:', error5);
      return false;
    }

    console.log('✅ Migration 4 aplicada com sucesso!\n');
  } catch (e) {
    console.error('❌ Exceção na Migration 4:', e);
    return false;
  }

  // =========================================================================
  // MIGRATION 5: Fix Save Supplier Response
  // =========================================================================

  console.log('📝 Aplicando Migration 5: Fix Save Supplier Response...');

  const migration5 = `
    CREATE OR REPLACE FUNCTION public.save_supplier_response(p_token text, p_quote_item_id bigint, p_price numeric, p_min_qty numeric DEFAULT NULL::numeric, p_delivery_days integer DEFAULT NULL::integer, p_notes text DEFAULT NULL::text, p_pricing_tiers jsonb DEFAULT NULL::jsonb) RETURNS boolean
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
        pricing_tiers,
        filled_at
      ) VALUES (
        v_quote_id,
        v_quote_supplier_id,
        p_quote_item_id,
        p_price,
        p_min_qty,
        p_delivery_days,
        p_notes,
        p_pricing_tiers,
        NOW()
      )
      ON CONFLICT (quote_supplier_id, quote_item_id)
      DO UPDATE SET
        price = EXCLUDED.price,
        min_qty = EXCLUDED.min_qty,
        delivery_days = EXCLUDED.delivery_days,
        notes = EXCLUDED.notes,
        pricing_tiers = EXCLUDED.pricing_tiers,
        filled_at = NOW();

      -- Atualizar status do quote_supplier para partial se ainda não foi submetido
      UPDATE public.quote_suppliers
      SET status = 'partial', last_access_at = NOW()
      WHERE id = v_quote_supplier_id AND status != 'submitted';

      RETURN TRUE;
    END;
    $$;
  `;

  try {
    const { error: error6 } = await supabaseAdmin!.rpc('execute_sql', {
      query: migration5
    });

    if (error6) {
      console.error('❌ Erro na Migration 5:', error6);
      return false;
    }

    console.log('✅ Migration 5 aplicada com sucesso!\n');
  } catch (e) {
    console.error('❌ Exceção na Migration 5:', e);
    return false;
  }

  // =========================================================================
  // MIGRATION 6: Fix Ambiguous Function (Drop old signature)
  // =========================================================================

  console.log('📝 Aplicando Migration 6: Resolve Ambiguous Function...');

  const migration6 = `
    -- Drop the old function signature to resolve ambiguity
    DROP FUNCTION IF EXISTS public.save_supplier_response(text, bigint, numeric, numeric, integer, text);

    -- Ensure the new function exists
    CREATE OR REPLACE FUNCTION public.save_supplier_response(p_token text, p_quote_item_id bigint, p_price numeric, p_min_qty numeric DEFAULT NULL::numeric, p_delivery_days integer DEFAULT NULL::integer, p_notes text DEFAULT NULL::text, p_pricing_tiers jsonb DEFAULT NULL::jsonb) RETURNS boolean
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
        pricing_tiers,
        filled_at
      ) VALUES (
        v_quote_id,
        v_quote_supplier_id,
        p_quote_item_id,
        p_price,
        p_min_qty,
        p_delivery_days,
        p_notes,
        p_pricing_tiers,
        NOW()
      )
      ON CONFLICT (quote_supplier_id, quote_item_id)
      DO UPDATE SET
        price = EXCLUDED.price,
        min_qty = EXCLUDED.min_qty,
        delivery_days = EXCLUDED.delivery_days,
        notes = EXCLUDED.notes,
        pricing_tiers = EXCLUDED.pricing_tiers,
        filled_at = NOW();

      -- Atualizar status do quote_supplier para partial se ainda não foi submetido
      UPDATE public.quote_suppliers
      SET status = 'partial', last_access_at = NOW()
      WHERE id = v_quote_supplier_id AND status != 'submitted';

      RETURN TRUE;
    END;
    $$;
  `;

  try {
    const { error: error7 } = await supabaseAdmin!.rpc('execute_sql', {
      query: migration6
    });

    if (error7) {
      console.error('❌ Erro na Migration 6:', error7);
      return false;
    }

    console.log('✅ Migration 6 aplicada com sucesso!\n');
  } catch (e) {
    console.error('❌ Exceção na Migration 6:', e);
    return false;
  }

  // =========================================================================
  // MIGRATION 7: Force Cleanup Functions (Drop ALL by name)
  // =========================================================================

  console.log('📝 Aplicando Migration 7: Force Cleanup Functions...');

  const migration7 = `
    -- Force drop ALL variations of save_supplier_response to clean up ambiguity
    DO $$ 
    DECLARE 
        r RECORD;
    BEGIN 
        -- Iterate over all functions with this name in public schema
        FOR r IN 
            SELECT oid::regprocedure AS func_signature 
            FROM pg_proc 
            WHERE proname = 'save_supplier_response' 
            AND pronamespace = 'public'::regnamespace
        LOOP 
            RAISE NOTICE 'Dropping function: %', r.func_signature;
            EXECUTE 'DROP FUNCTION ' || r.func_signature; 
        END LOOP; 
    END $$;

    -- Recreate the function with the correct signature
    CREATE OR REPLACE FUNCTION public.save_supplier_response(p_token text, p_quote_item_id bigint, p_price numeric, p_min_qty numeric DEFAULT NULL::numeric, p_delivery_days integer DEFAULT NULL::integer, p_notes text DEFAULT NULL::text, p_pricing_tiers jsonb DEFAULT NULL::jsonb) RETURNS boolean
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
        pricing_tiers,
        filled_at
      ) VALUES (
        v_quote_id,
        v_quote_supplier_id,
        p_quote_item_id,
        p_price,
        p_min_qty,
        p_delivery_days,
        p_notes,
        p_pricing_tiers,
        NOW()
      )
      ON CONFLICT (quote_supplier_id, quote_item_id)
      DO UPDATE SET
        price = EXCLUDED.price,
        min_qty = EXCLUDED.min_qty,
        delivery_days = EXCLUDED.delivery_days,
        notes = EXCLUDED.notes,
        pricing_tiers = EXCLUDED.pricing_tiers,
        filled_at = NOW();

      -- Atualizar status do quote_supplier para partial se ainda não foi submetido
      UPDATE public.quote_suppliers
      SET status = 'partial', last_access_at = NOW()
      WHERE id = v_quote_supplier_id AND status != 'submitted';

      RETURN TRUE;
    END;
    $$;
  `;

  try {
    const { error: error8 } = await supabaseAdmin!.rpc('execute_sql', {
      query: migration7
    });

    if (error8) {
      console.error('❌ Erro na Migration 7:', error8);
      return false;
    }

    console.log('✅ Migration 7 aplicada com sucesso!\n');
  } catch (e) {
    console.error('❌ Exceção na Migration 7:', e);
    return false;
  }

  // =========================================================================
  // MIGRATION 8: Add Product Unit
  // =========================================================================

  console.log('📝 Aplicando Migration 8: Add Product Unit...');

  const migration8 = `
    -- Add unit column to products table
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit text DEFAULT 'un';
    
    -- Update existing NULLs (just in case)
    UPDATE public.products SET unit = 'un' WHERE unit IS NULL;
  `;

  try {
    const { error: error9 } = await supabaseAdmin!.rpc('execute_sql', {
      query: migration8
    });

    if (error9) {
      console.error('❌ Erro na Migration 8:', error9);
      return false;
    }

    console.log('✅ Migration 8 aplicada com sucesso!\n');
  } catch (e) {
    console.error('❌ Exceção na Migration 8:', e);
    return false;
  }

  // =========================================================================
  // VERIFICAÇÃO FINAL
  // =========================================================================

  console.log('🔍 Verificando estrutura...\n');

  // Verificar tabelas
  const { data: tables } = await supabaseAdmin!.rpc('execute_sql', {
    query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'"
  });

  console.log(`📊 Total de tabelas: ${tables?.[0]?.count || 'N/A'}`);

  // Verificar campos de winner
  const { data: winnerFields } = await supabaseAdmin!.rpc('execute_sql', {
    query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'quote_items' AND column_name LIKE 'winner%'"
  });

  console.log(`✅ Campos de vencedor: ${winnerFields?.length || 0}/4`);

  // Verificar PO tables
  const { data: poTables } = await supabaseAdmin!.rpc('execute_sql', {
    query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'purchase%'"
  });

  console.log(`✅ Tabelas de PO: ${poTables?.length || 0}/2`);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 MIGRATIONS APLICADAS COM SUCESSO!');
  console.log('='.repeat(60));
  console.log('\n📝 Próximos passos:');
  console.log('1. Testar seleção de vencedores na interface');
  console.log('2. Verificar que os dados estão sendo salvos');
  console.log('3. Implementar UI para Purchase Orders');

  return true;
}

// Exportar para uso via console
(window as any).applyMigrations = applyMigrations;

console.log('💡 Script carregado! Execute: applyMigrations()');
