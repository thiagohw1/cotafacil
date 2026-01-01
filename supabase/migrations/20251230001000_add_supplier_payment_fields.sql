-- Add Payment and Freight columns to quote_suppliers
ALTER TABLE public.quote_suppliers
ADD COLUMN IF NOT EXISTS payment_terms TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS freight_type TEXT, -- 'CIF', 'FOB', etc.
ADD COLUMN IF NOT EXISTS freight_cost NUMERIC(10,2);

-- Update get_public_quote_data to include these fields
CREATE OR REPLACE FUNCTION public.get_public_quote_data(p_token text)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_quote_supplier_id BIGINT;
    v_quote_id BIGINT;
    v_supplier_id BIGINT;
    v_result JSON;
BEGIN
    SELECT id, quote_id, supplier_id
    INTO v_quote_supplier_id, v_quote_id, v_supplier_id
    FROM public.quote_suppliers
    WHERE public_token = p_token;

    IF v_quote_supplier_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Update access stats
    UPDATE public.quote_suppliers
    SET last_access_at = NOW()
    WHERE id = v_quote_supplier_id;

    -- Build JSON result
    SELECT json_build_object(
        'quote', (
            SELECT row_to_json(q) FROM (
                 SELECT 
                    qs.id as quote_supplier_id,
                    qs.quote_id,
                    qs.supplier_id,
                    qs.status,
                    qs.submitted_at,
                    qs.payment_terms,
                    qs.payment_method,
                    qs.freight_type,
                    qs.freight_cost,
                    q.status as quote_status,
                    q.title as quote_title,
                    q.description as quote_description,
                    q.deadline_at as quote_deadline
                 FROM public.quote_suppliers qs
                 JOIN public.quotes q ON q.id = qs.quote_id
                 WHERE qs.id = v_quote_supplier_id
            ) q
        ),
        'supplier', (
            SELECT json_build_object('name', s.name)
            FROM public.suppliers s
            WHERE s.id = v_supplier_id
        ),
        'items', (
            SELECT COALESCE(json_agg(i), '[]'::json) FROM (
                SELECT 
                    qi.id,
                    qi.requested_qty,
                    json_build_object('name', p.name) as product,
                    CASE WHEN pp.id IS NOT NULL THEN 
                        json_build_object('unit', pp.unit, 'multiplier', pp.multiplier)
                    ELSE NULL END as package
                FROM public.quote_items qi
                JOIN public.products p ON p.id = qi.product_id
                LEFT JOIN public.product_packages pp ON pp.id = qi.package_id
                WHERE qi.quote_id = v_quote_id
                ORDER BY qi.sort_order
            ) i
        ),
        'responses', (
            SELECT COALESCE(json_agg(r), '[]'::json) FROM (
                SELECT *
                FROM public.quote_responses
                WHERE quote_supplier_id = v_quote_supplier_id
            ) r
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Function to update supplier header info
CREATE OR REPLACE FUNCTION public.update_supplier_header(
    p_token text,
    p_payment_terms text DEFAULT NULL,
    p_payment_method text DEFAULT NULL,
    p_freight_type text DEFAULT NULL,
    p_freight_cost numeric DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_quote_supplier_id BIGINT;
BEGIN
    SELECT id INTO v_quote_supplier_id
    FROM public.quote_suppliers
    WHERE public_token = p_token;

    IF v_quote_supplier_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.quote_suppliers
    SET 
        payment_terms = p_payment_terms,
        payment_method = p_payment_method,
        freight_type = p_freight_type,
        freight_cost = p_freight_cost,
        last_access_at = NOW()
    WHERE id = v_quote_supplier_id;

    RETURN TRUE;
END;
$$;
