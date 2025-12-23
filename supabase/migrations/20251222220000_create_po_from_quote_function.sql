-- ============================================================================
-- Migration: Create function to generate PO from Quote
-- Data: 2025-12-22
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_purchase_order_from_quote(
  p_quote_id BIGINT,
  p_supplier_id BIGINT,
  p_delivery_address TEXT DEFAULT NULL,
  p_payment_terms TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id BIGINT;
  _po_id BIGINT;
BEGIN
  -- Get tenant_id from quote
  SELECT tenant_id INTO _tenant_id
  FROM public.quotes
  WHERE id = p_quote_id;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  -- Create Purchase Order
  INSERT INTO public.purchase_orders (
    tenant_id,
    quote_id,
    supplier_id,
    status,
    notes,
    created_by
  ) VALUES (
    _tenant_id,
    p_quote_id,
    p_supplier_id,
    'draft',
    CONCAT_WS(E'\n\n', 
      CASE WHEN p_delivery_address IS NOT NULL AND p_delivery_address <> '' THEN 'Endereço de Entrega: ' || p_delivery_address ELSE NULL END,
      CASE WHEN p_payment_terms IS NOT NULL AND p_payment_terms <> '' THEN 'Condições de Pagamento: ' || p_payment_terms ELSE NULL END,
      CASE WHEN p_notes IS NOT NULL AND p_notes <> '' THEN 'Observações: ' || p_notes ELSE NULL END
    ),
    auth.uid()
  )
  RETURNING id INTO _po_id;

  -- Insert Items
  INSERT INTO public.purchase_order_items (
    po_id,
    product_id,
    package_id,
    quote_item_id,
    quote_response_id,
    qty,
    unit_price,
    total_price
  )
  SELECT
    _po_id,
    qi.product_id,
    qi.package_id,
    qi.id,
    qi.winner_response_id,
    qi.requested_qty,
    qr.price,
    (qi.requested_qty * qr.price)
  FROM public.quote_items qi
  JOIN public.quote_responses qr ON qr.id = qi.winner_response_id
  WHERE qi.quote_id = p_quote_id
    AND qi.winner_supplier_id = p_supplier_id;

  RETURN _po_id;
END;
$$;
