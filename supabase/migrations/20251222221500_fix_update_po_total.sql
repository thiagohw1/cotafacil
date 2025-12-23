-- ============================================================================
-- Migration: Fix update_po_total function logic
-- Data: 2025-12-22
-- Descrição: Corrigir o cálculo do total_amount para usar o subtotal calculado
--            e não o valor antigo da coluna.
-- ============================================================================

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

-- Recalcular totais para POs existentes (opcional, mas bom para corrigir os dados atuais)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.purchase_orders LOOP
    PERFORM public.calculate_po_total(r.id); -- Isso não dispara o trigger diretamente se for só SELECT
    
    -- Forçar atualização
    UPDATE public.purchase_orders
    SET updated_at = NOW() -- Isso dispara o trigger? Não, o trigger é na tabela items.
    WHERE id = r.id;
    
    -- Vamos chamar a lógica de update manualmente para cada PO
    UPDATE public.purchase_orders
    SET 
        subtotal = public.calculate_po_total(id),
        total_amount = public.calculate_po_total(id) + COALESCE(tax_amount, 0) + COALESCE(shipping_cost, 0)
    WHERE id = r.id;
  END LOOP;
END;
$$;
