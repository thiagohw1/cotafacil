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
