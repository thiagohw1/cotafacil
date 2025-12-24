-- ============================================================================
-- Migration: Optimize Auto Select Winners
-- Data: 2025-12-23
-- Descrição: Cria função RPC para selecionar vencedores (menor preço) em lote
--            para evitar múltiplas requisições do frontend.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_select_winners(p_quote_id BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER -- Roda com permissões de dono para garantir acesso
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
    
    -- Selecionar a resposta com menor preço (maior que zero) para este item
    -- Ordenar por preço ASC, depois por data de envio (primeiro ganha em empate)
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
