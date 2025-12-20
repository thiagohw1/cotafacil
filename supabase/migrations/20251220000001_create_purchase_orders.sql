-- ============================================================================
-- Migration: Criar estrutura de Purchase Orders
-- Data: 2025-12-20
-- Descrição: Cria todas as tabelas, funções e triggers necessários para
--            gerenciar pedidos de compra (POs) no sistema
-- ============================================================================

-- ============================================================================
-- ENUM para status de Purchase Order
-- ============================================================================

CREATE TYPE public.po_status AS ENUM (
  'draft',      -- Rascunho, ainda sendo editado
  'sent',       -- Enviado para o fornecedor
  'confirmed',  -- Confirmado pelo fornecedor
  'delivered',  -- Entregue
  'cancelled'   -- Cancelado
);

-- ============================================================================
-- Tabela principal de Purchase Orders
-- ============================================================================

CREATE TABLE public.purchase_orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote_id BIGINT REFERENCES public.quotes(id) ON DELETE SET NULL,
  po_number TEXT NOT NULL,
  supplier_id BIGINT NOT NULL REFERENCES public.suppliers(id),
  status public.po_status DEFAULT 'draft' NOT NULL,
  
  -- Valores
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  shipping_cost NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  
  -- Informações adicionais
  notes TEXT,
  internal_notes TEXT, -- Notas internas que o fornecedor não vê
  
  -- Datas
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE(tenant_id, po_number),
  CHECK (total_amount >= 0),
  CHECK (subtotal >= 0)
);

-- ============================================================================
-- Tabela de itens do Purchase Order
-- ============================================================================

CREATE TABLE public.purchase_order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  po_id BIGINT NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  
  -- Produto e embalagem
  product_id BIGINT NOT NULL REFERENCES public.products(id),
  package_id BIGINT REFERENCES public.product_packages(id),
  
  -- Referências
  quote_item_id BIGINT REFERENCES public.quote_items(id) ON DELETE SET NULL,
  quote_response_id BIGINT REFERENCES public.quote_responses(id) ON DELETE SET NULL,
  
  -- Quantidades e preços
  qty NUMERIC(10,2) NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(12,4) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  
  -- Informações adicionais
  notes TEXT,
  delivery_days INTEGER, -- Prazo de entrega prometido
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- Sequência para geração automática de número de PO
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.po_number_seq START 1000;

-- ============================================================================
-- Função para gerar número de PO automaticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_po_number(_tenant_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next_num INTEGER;
  _po_number TEXT;
BEGIN
  -- Obter próximo número da sequência
  SELECT nextval('po_number_seq') INTO _next_num;
  
  -- Formato: PO-YYYYMMDD-NNNN
  _po_number := 'PO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(_next_num::TEXT, 4, '0');
  
  RETURN _po_number;
END;
$$;

-- ============================================================================
-- Trigger para gerar número de PO automaticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_po_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := generate_po_number(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_po_number
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_po_number();

-- ============================================================================
-- Trigger para atualizar updated_at
-- ============================================================================

CREATE TRIGGER trigger_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_purchase_order_items_updated_at
  BEFORE UPDATE ON public.purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Função para calcular total do PO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_po_total(_po_id BIGINT)
RETURNS NUMERIC(12,2)
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(total_price), 0)
  FROM public.purchase_order_items
  WHERE po_id = _po_id;
$$;

-- ============================================================================
-- Trigger para atualizar total do PO quando itens mudarem
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_po_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.purchase_orders
  SET 
    subtotal = calculate_po_total(COALESCE(NEW.po_id, OLD.po_id)),
    total_amount = subtotal + COALESCE(tax_amount, 0) + COALESCE(shipping_cost, 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_po_total_on_insert
  AFTER INSERT ON public.purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_po_total();

CREATE TRIGGER trigger_update_po_total_on_update
  AFTER UPDATE ON public.purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_po_total();

CREATE TRIGGER trigger_update_po_total_on_delete
  AFTER DELETE ON public.purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_po_total();

-- ============================================================================
-- Índices para performance
-- ============================================================================

CREATE INDEX idx_purchase_orders_tenant ON public.purchase_orders(tenant_id);
CREATE INDEX idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_quote ON public.purchase_orders(quote_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_po_number ON public.purchase_orders(po_number);

CREATE INDEX idx_po_items_po ON public.purchase_order_items(po_id);
CREATE INDEX idx_po_items_product ON public.purchase_order_items(product_id);

-- ============================================================================
-- Habilitar RLS
-- ============================================================================

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Políticas RLS para purchase_orders
-- ============================================================================

CREATE POLICY "Users can view tenant purchase_orders"
ON public.purchase_orders FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert tenant purchase_orders"
ON public.purchase_orders FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update tenant purchase_orders"
ON public.purchase_orders FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete tenant purchase_orders"
ON public.purchase_orders FOR DELETE
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- ============================================================================
-- Políticas RLS para purchase_order_items
-- ============================================================================

CREATE POLICY "Users can view po items from their tenant"
ON public.purchase_order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE id = po_id AND tenant_id = get_user_tenant_id(auth.uid())
  )
);

CREATE POLICY "Users can insert po items to their tenant POs"
ON public.purchase_order_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE id = po_id AND tenant_id = get_user_tenant_id(auth.uid())
  )
);

CREATE POLICY "Users can update po items from their tenant"
ON public.purchase_order_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE id = po_id AND tenant_id = get_user_tenant_id(auth.uid())
  )
);

CREATE POLICY "Users can delete po items from their tenant"
ON public.purchase_order_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE id = po_id AND tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- ============================================================================
-- Comentários
-- ============================================================================

COMMENT ON TABLE public.purchase_orders IS 'Pedidos de compra gerados a partir de cotações';
COMMENT ON TABLE public.purchase_order_items IS 'Itens dos pedidos de compra';
COMMENT ON COLUMN public.purchase_orders.po_number IS 'Número único do pedido (gerado automaticamente no formato PO-YYYYMMDD-NNNN)';
COMMENT ON COLUMN public.purchase_orders.quote_id IS 'Referência à cotação que originou este PO (opcional)';
COMMENT ON COLUMN public.purchase_orders.internal_notes IS 'Notas internas visíveis apenas para o tenant, não compartilhadas com fornecedor';
