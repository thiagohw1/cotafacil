# INSTRUÇÕES PARA CORRIGIR O ERRO DE ATUALIZAÇÃO DE FORNECEDOR

## Passo a Passo (COPIE E COLE NO SUPABASE):

1. Acesse: https://supabase.com/dashboard
2. Entre no seu projeto
3. Clique em **SQL Editor** no menu lateral esquerdo
4. Clique em **New Query**
5. Copie e cole o SQL abaixo:

```sql
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
```

6. Clique em **RUN** (ou pressione Ctrl+Enter)
7. Aguarde a mensagem de sucesso

## O que isso faz?
Remove a restrição que impedia fornecedores de atualizarem suas respostas após o envio inicial.

✅ Após executar, fornecedores poderão atualizar preços normalmente!
