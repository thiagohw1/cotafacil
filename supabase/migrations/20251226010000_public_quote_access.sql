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
    -- Get quote_supplier info using public_token (or token if public_token doesn't exist, handling both just in case or standardized on public_token based on recent migration)
    -- Checking recent migration 20251224000000_fix_save_supplier_response.sql uses public_token.
    
    SELECT id, quote_id, supplier_id
    INTO v_quote_supplier_id, v_quote_id, v_supplier_id
    FROM public.quote_suppliers
    WHERE public_token = p_token; -- Try both to be safe or just public_token if that's the standard

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

-- Grant execution to anon (public)
GRANT EXECUTE ON FUNCTION public.get_public_quote_data(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_quote_data(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_quote_data(text) TO service_role;
