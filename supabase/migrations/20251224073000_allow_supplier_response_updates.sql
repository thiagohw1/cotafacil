-- Allow suppliers to update their responses even after submission
-- Remove the submitted_at check that was blocking updates

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
  -- Verificar token e obter IDs
  -- Removed the submitted_at IS NULL check to allow updates after submission
  SELECT qs.id, qs.quote_id INTO v_quote_supplier_id, v_quote_id
  FROM public.quote_suppliers qs
  JOIN public.quotes q ON q.id = qs.quote_id
  WHERE qs.public_token = p_token
    AND q.status = 'open'
    AND (q.deadline_at IS NULL OR q.deadline_at > NOW());
  
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
