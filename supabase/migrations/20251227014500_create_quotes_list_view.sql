-- Create a view to summarize quote statistics
-- This view uses security_invoker = true to respect the underlying RLS policies of the quotes table
CREATE OR REPLACE VIEW public.quotes_list_view WITH (security_invoker = true) AS
SELECT
    q.*,
    (SELECT count(*) FROM public.quote_items qi WHERE qi.quote_id = q.id) as items_count,
    (SELECT count(*) FROM public.quote_suppliers qs WHERE qs.quote_id = q.id) as suppliers_invited_count,
    (SELECT count(*) FROM public.quote_suppliers qs WHERE qs.quote_id = q.id AND qs.status = 'submitted') as suppliers_responded_count
FROM
    public.quotes q
WHERE
    q.deleted_at IS NULL;

-- Grant access to authenticated users
GRANT SELECT ON public.quotes_list_view TO authenticated;
