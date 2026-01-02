-- Create Quick Orders table
CREATE TABLE IF NOT EXISTS public.quick_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT DEFAULT 'draft',
    name TEXT,
    total_items INTEGER DEFAULT 0,
    total_amount NUMERIC DEFAULT 0
);

-- Create Quick Order Items table
CREATE TABLE IF NOT EXISTS public.quick_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quick_order_id UUID REFERENCES public.quick_orders(id) ON DELETE CASCADE NOT NULL,
    product_id BIGINT REFERENCES public.products(id) NOT NULL,
    supplier_id BIGINT REFERENCES public.suppliers(id),
    package_id BIGINT REFERENCES public.product_packages(id),
    quantity NUMERIC DEFAULT 0 NOT NULL,
    unit_price NUMERIC DEFAULT 0,
    total_price NUMERIC DEFAULT 0
);

-- RLS Policies (Standard Tenant Isolation)
ALTER TABLE public.quick_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_order_items ENABLE ROW LEVEL SECURITY;

-- Policies for quick_orders
CREATE POLICY "Users can view tenant quick_orders"
    ON public.quick_orders FOR SELECT
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert tenant quick_orders"
    ON public.quick_orders FOR INSERT
    WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update tenant quick_orders"
    ON public.quick_orders FOR UPDATE
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete tenant quick_orders"
    ON public.quick_orders FOR DELETE
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Policies for quick_order_items
CREATE POLICY "Users can view quick_order_items from their tenant"
    ON public.quick_order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.quick_orders
            WHERE id = quick_order_id AND tenant_id = public.get_user_tenant_id(auth.uid())
        )
    );

CREATE POLICY "Users can insert quick_order_items to their tenant orders"
    ON public.quick_order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.quick_orders
            WHERE id = quick_order_id AND tenant_id = public.get_user_tenant_id(auth.uid())
        )
    );

CREATE POLICY "Users can update quick_order_items from their tenant"
    ON public.quick_order_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.quick_orders
            WHERE id = quick_order_id AND tenant_id = public.get_user_tenant_id(auth.uid())
        )
    );

CREATE POLICY "Users can delete quick_order_items from their tenant"
    ON public.quick_order_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.quick_orders
            WHERE id = quick_order_id AND tenant_id = public.get_user_tenant_id(auth.uid())
        )
    );
