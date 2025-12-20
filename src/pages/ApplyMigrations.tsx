import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ApplyMigrationsPage() {
    const [copiedStep, setCopiedStep] = useState<number | null>(null);
    const { toast } = useToast();

    const copyToClipboard = (text: string, stepNumber: number) => {
        navigator.clipboard.writeText(text);
        setCopiedStep(stepNumber);
        toast({
            title: "✅ Copiado!",
            description: "SQL copiado para a área de transferência",
        });
        setTimeout(() => setCopiedStep(null), 2000);
    };

    const migration1 = `-- Migration 1: Adicionar campos de vencedor em quote_items
ALTER TABLE public.quote_items 
ADD COLUMN IF NOT EXISTS winner_supplier_id BIGINT REFERENCES public.suppliers(id),
ADD COLUMN IF NOT EXISTS winner_response_id BIGINT REFERENCES public.quote_responses(id),
ADD COLUMN IF NOT EXISTS winner_reason TEXT,
ADD COLUMN IF NOT EXISTS winner_set_at TIMESTAMPTZ;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_quote_items_winner 
ON public.quote_items(winner_supplier_id) 
WHERE winner_supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id 
ON public.quote_items(quote_id);`;

    const migration2 = `-- Migration 2: Criar estrutura de Purchase Orders
-- PARTE 1: ENUM e Tabelas
DO $$ BEGIN
  CREATE TYPE public.po_status AS ENUM ('draft', 'sent', 'confirmed', 'delivered', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote_id BIGINT REFERENCES public.quotes(id) ON DELETE SET NULL,
  po_number TEXT NOT NULL,
  supplier_id BIGINT NOT NULL REFERENCES public.suppliers(id),
  status public.po_status DEFAULT 'draft' NOT NULL,
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  shipping_cost NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  internal_notes TEXT,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  UNIQUE(tenant_id, po_number),
  CHECK (total_amount >= 0),
  CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  po_id BIGINT NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products(id),
  package_id BIGINT REFERENCES public.product_packages(id),
  quote_item_id BIGINT REFERENCES public.quote_items(id) ON DELETE SET NULL,
  quote_response_id BIGINT REFERENCES public.quote_responses(id) ON DELETE SET NULL,
  qty NUMERIC(10,2) NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(12,4) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  notes TEXT,
  delivery_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS public.po_number_seq START 1000;

-- PARTE 2: Funções
CREATE OR REPLACE FUNCTION public.generate_po_number(_tenant_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _next_num INTEGER; _po_number TEXT;
BEGIN
  SELECT nextval('po_number_seq') INTO _next_num;
  _po_number := 'PO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(_next_num::TEXT, 4, '0');
  RETURN _po_number;
END; $$;

CREATE OR REPLACE FUNCTION public.set_po_number() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := generate_po_number(NEW.tenant_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.calculate_po_total(_po_id BIGINT)
RETURNS NUMERIC(12,2) LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(total_price), 0) FROM public.purchase_order_items WHERE po_id = _po_id;
$$;

CREATE OR REPLACE FUNCTION public.update_po_total() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.purchase_orders SET 
    subtotal = calculate_po_total(COALESCE(NEW.po_id, OLD.po_id)),
    total_amount = subtotal + COALESCE(tax_amount, 0) + COALESCE(shipping_cost, 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  RETURN COALESCE(NEW, OLD);
END; $$;

-- PARTE 3: Triggers
DROP TRIGGER IF EXISTS trigger_set_po_number ON public.purchase_orders;
CREATE TRIGGER trigger_set_po_number BEFORE INSERT ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.set_po_number();

DROP TRIGGER IF EXISTS trigger_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER trigger_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_purchase_order_items_updated_at ON public.purchase_order_items;
CREATE TRIGGER trigger_purchase_order_items_updated_at BEFORE UPDATE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_update_po_total_on_insert ON public.purchase_order_items;
CREATE TRIGGER trigger_update_po_total_on_insert AFTER INSERT ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION public.update_po_total();

DROP TRIGGER IF EXISTS trigger_update_po_total_on_update ON public.purchase_order_items;
CREATE TRIGGER trigger_update_po_total_on_update AFTER UPDATE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION public.update_po_total();

DROP TRIGGER IF EXISTS trigger_update_po_total_on_delete ON public.purchase_order_items;
CREATE TRIGGER trigger_update_po_total_on_delete AFTER DELETE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION public.update_po_total();

-- PARTE 4: Índices e RLS
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON public.purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_quote ON public.purchase_orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON public.purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON public.purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON public.purchase_order_items(product_id);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view tenant purchase_orders" ON public.purchase_orders;
CREATE POLICY "Users can view tenant purchase_orders" ON public.purchase_orders FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert tenant purchase_orders" ON public.purchase_orders;
CREATE POLICY "Users can insert tenant purchase_orders" ON public.purchase_orders FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update tenant purchase_orders" ON public.purchase_orders;
CREATE POLICY "Users can update tenant purchase_orders" ON public.purchase_orders FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete tenant purchase_orders" ON public.purchase_orders;
CREATE POLICY "Users can delete tenant purchase_orders" ON public.purchase_orders FOR DELETE
USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view po items from their tenant" ON public.purchase_order_items;
CREATE POLICY "Users can view po items from their tenant" ON public.purchase_order_items FOR SELECT
USING (EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = po_id AND tenant_id = get_user_tenant_id(auth.uid())));

DROP POLICY IF EXISTS "Users can insert po items to their tenant POs" ON public.purchase_order_items;
CREATE POLICY "Users can insert po items to their tenant POs" ON public.purchase_order_items FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = po_id AND tenant_id = get_user_tenant_id(auth.uid())));

DROP POLICY IF EXISTS "Users can update po items from their tenant" ON public.purchase_order_items;
CREATE POLICY "Users can update po items from their tenant" ON public.purchase_order_items FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = po_id AND tenant_id = get_user_tenant_id(auth.uid())));

DROP POLICY IF EXISTS "Users can delete po items from their tenant" ON public.purchase_order_items;
CREATE POLICY "Users can delete po items from their tenant" ON public.purchase_order_items FOR DELETE
USING (EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = po_id AND tenant_id = get_user_tenant_id(auth.uid())));`;

    const verification = `-- Verificar se as migrations foram aplicadas
SELECT COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public';
-- Deve retornar 17 (eram 15, agora +2)

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'purchase%';
-- Deve mostrar: purchase_orders, purchase_order_items

SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'quote_items' 
AND column_name LIKE 'winner%';
-- Deve mostrar 4 colunas`;

    return (
        <div className="container mx-auto p-8 max-w-6xl">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>🚀 Aplicar Migrations - Purchase Orders</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open('https://supabase.com/dashboard/project/wnrdxcukslmcnzvwpisu/sql/new', '_blank')}
                        >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Abrir SQL Editor
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 mb-2">📋 Instruções</h4>
                        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                            <li>Clique em "Abrir SQL Editor" (abre em nova aba)</li>
                            <li>Copie o SQL da Migration 1</li>
                            <li>Cole no SQL Editor e clique em RUN</li>
                            <li>Repita para Migration 2</li>
                            <li>Execute a Verificação para confirmar</li>
                        </ol>
                    </div>

                    <Tabs defaultValue="migration1" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="migration1">Migration 1</TabsTrigger>
                            <TabsTrigger value="migration2">Migration 2</TabsTrigger>
                            <TabsTrigger value="verification">Verificação</TabsTrigger>
                        </TabsList>

                        <TabsContent value="migration1" className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold">Migration 1: Winner Fields</h3>
                                    <p className="text-sm text-muted-foreground">Adiciona campos de vencedor em quote_items</p>
                                </div>
                                <Button
                                    onClick={() => copyToClipboard(migration1, 1)}
                                    variant={copiedStep === 1 ? "default" : "outline"}
                                >
                                    {copiedStep === 1 ? (
                                        <>
                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                            Copiado!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copiar SQL
                                        </>
                                    )}
                                </Button>
                            </div>
                            <pre className="bg-gray-50 border rounded-lg p-4 text-xs overflow-x-auto max-h-96">
                                <code>{migration1}</code>
                            </pre>
                        </TabsContent>

                        <TabsContent value="migration2" className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold">Migration 2: Purchase Orders</h3>
                                    <p className="text-sm text-muted-foreground">Cria tabelas, funções, triggers e RLS</p>
                                </div>
                                <Button
                                    onClick={() => copyToClipboard(migration2, 2)}
                                    variant={copiedStep === 2 ? "default" : "outline"}
                                >
                                    {copiedStep === 2 ? (
                                        <>
                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                            Copiado!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copiar SQL
                                        </>
                                    )}
                                </Button>
                            </div>
                            <pre className="bg-gray-50 border rounded-lg p-4 text-xs overflow-x-auto max-h-96">
                                <code>{migration2}</code>
                            </pre>
                        </TabsContent>

                        <TabsContent value="verification" className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold">Verificação</h3>
                                    <p className="text-sm text-muted-foreground">Confirme que tudo foi aplicado corretamente</p>
                                </div>
                                <Button
                                    onClick={() => copyToClipboard(verification, 3)}
                                    variant={copiedStep === 3 ? "default" : "outline"}
                                >
                                    {copiedStep === 3 ? (
                                        <>
                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                            Copiado!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copiar SQL
                                        </>
                                    )}
                                </Button>
                            </div>
                            <pre className="bg-gray-50 border rounded-lg p-4 text-xs overflow-x-auto max-h-96">
                                <code>{verification}</code>
                            </pre>
                        </TabsContent>
                    </Tabs>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-semibold text-green-900 mb-2">✅ Após Aplicar</h4>
                        <ul className="text-sm text-green-800 space-y-1">
                            <li>✅ Seleção de vencedores funcionará corretamente</li>
                            <li>✅ Purchase Orders estarão disponíveis</li>
                            <li>✅ Geração automática de números de PO (PO-20251220-NNNN)</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
