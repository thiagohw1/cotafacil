-- Add source_quote_id to price_history if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_history' AND column_name = 'source_quote_id') THEN
        ALTER TABLE public.price_history ADD COLUMN source_quote_id bigint REFERENCES public.quotes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create or replace the function to save price history
CREATE OR REPLACE FUNCTION public.save_price_history_from_quote(p_quote_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert new price history records for the winning items of the quote
    INSERT INTO public.price_history (
        tenant_id,
        product_id,
        supplier_id,
        price,
        recorded_at,
        source_quote_id
    )
    SELECT
        q.tenant_id,
        qi.product_id,
        qi.winner_supplier_id,
        qr.price,
        NOW(),
        q.id
    FROM
        public.quote_items qi
    JOIN
        public.quotes q ON q.id = qi.quote_id
    JOIN
        public.quote_suppliers qs ON qs.quote_id = q.id AND qs.supplier_id = qi.winner_supplier_id
    JOIN
        public.quote_responses qr ON qr.quote_item_id = qi.id AND qr.quote_supplier_id = qs.id
    WHERE
        q.id = p_quote_id
        AND qi.winner_supplier_id IS NOT NULL;
END;
$$;
