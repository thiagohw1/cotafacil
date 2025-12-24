/**
 * CORREÇÃO RÁPIDA - Função save_supplier_response
 * 
 * Execute este script para permitir que fornecedores atualizem suas respostas
 * 
 * COMO USAR:
 * npx tsx scripts/fix-supplier-response-simple.ts
 */

import { supabase } from '../src/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

async function applyFix() {
    console.log('🔧 Aplicando correção...\n');

    // Usar service role key para ter permissões administrativas
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;

    if (!serviceKey) {
        console.error('❌ VITE_SUPABASE_SERVICE_ROLE_KEY não encontrada no .env');
        return;
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const sql = `
DROP FUNCTION IF EXISTS public.save_supplier_response(text, bigint, numeric, numeric, integer, text, jsonb);

CREATE OR REPLACE FUNCTION public.save_supplier_response(
  p_token text, 
  p_quote_item_id bigint, 
  p_price numeric, 
  p_min_qty numeric DEFAULT NULL::numeric, 
  p_delivery_days integer DEFAULT NULL::integer, 
  p_notes text DEFAULT NULL::text, 
  p_pricing_tiers jsonb DEFAULT NULL::jsonb
) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_quote_supplier_id BIGINT;
  v_quote_id BIGINT;
BEGIN
  SELECT qs.id, qs.quote_id INTO v_quote_supplier_id, v_quote_id
  FROM public.quote_suppliers qs
  JOIN public.quotes q ON q.id = qs.quote_id
  WHERE qs.public_token = p_token
    AND q.status = 'open'
    AND (q.deadline_at IS NULL OR q.deadline_at > NOW());
  
  IF v_quote_supplier_id IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.quote_responses (
    quote_id, quote_supplier_id, quote_item_id, price, min_qty, 
    delivery_days, notes, pricing_tiers, filled_at
  ) VALUES (
    v_quote_id, v_quote_supplier_id, p_quote_item_id, p_price, p_min_qty, 
    p_delivery_days, p_notes, p_pricing_tiers, NOW()
  )
  ON CONFLICT (quote_supplier_id, quote_item_id)
  DO UPDATE SET
    price = EXCLUDED.price, min_qty = EXCLUDED.min_qty,
    delivery_days = EXCLUDED.delivery_days, notes = EXCLUDED.notes,
    pricing_tiers = EXCLUDED.pricing_tiers, filled_at = NOW();

  UPDATE public.quote_suppliers
  SET status = 'partial', last_access_at = NOW()
  WHERE id = v_quote_supplier_id AND status != 'submitted';

  RETURN TRUE;
END;
$$;
  `;

    try {
        // Executar o SQL diretamente
        const { error } = await adminClient.rpc('exec_sql', { sql_query: sql });

        if (error) {
            throw error;
        }

        console.log('✅ Correção aplicada com sucesso!');
        console.log('✅ Fornecedores agora podem atualizar suas respostas.');
    } catch (err: any) {
        console.error('❌ Erro ao aplicar via RPC:', err.message);
        console.log('\n📋 SOLUÇÃO MANUAL:');
        console.log('1. Acesse: https://supabase.com/dashboard/project/YOUR_PROJECT/sql');
        console.log('2. Cole o conteúdo do arquivo:');
        console.log('   supabase/migrations/20251224073000_allow_supplier_response_updates.sql');
        console.log('3. Clique em "Run"');
    }
}

applyFix();
