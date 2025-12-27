-- Update the view to include aggregated product and supplier names for search purposes
-- We use subqueries to concatenate names. This allows a single ILIKE on these columns to find matches.
CREATE OR REPLACE VIEW public.quotes_list_view WITH (security_invoker = true) AS
SELECT
    q.*,
    (SELECT count(*) FROM public.quote_items qi WHERE qi.quote_id = q.id) as items_count,
    (SELECT count(*) FROM public.quote_suppliers qs WHERE qs.quote_id = q.id) as suppliers_invited_count,
    (SELECT count(*) FROM public.quote_suppliers qs WHERE qs.quote_id = q.id AND qs.status = 'submitted') as suppliers_responded_count,
    -- Aggregated Product Names
    (
        SELECT string_agg(p.name, ' ' ORDER BY p.name)
        FROM public.quote_items qi
        JOIN public.products p ON p.id = qi.product_id
        WHERE qi.quote_id = q.id
    ) as product_names,
    -- Aggregated Supplier Names
    (
        SELECT string_agg(s.name, ' ' ORDER BY s.name)
        FROM public.quote_suppliers qs
        JOIN public.suppliers s ON s.id = qs.supplier_id
        WHERE qs.quote_id = q.id
    ) as supplier_names
FROM
    public.quotes q
WHERE
    q.deleted_at IS NULL;

GRANT SELECT ON public.quotes_list_view TO authenticated;
