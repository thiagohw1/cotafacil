import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  supplierId: number;
}

interface PriceDataPoint {
  date: string;
  quote: string;
  price: number;
}

interface ProductOption {
  id: number;
  name: string;
}

export function PriceVariationChart({ supplierId }: Props) {
  const { tenantId } = useTenant();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      fetchProductsWithPrices();
    }
  }, [tenantId, supplierId]);

  useEffect(() => {
    if (selectedProduct) {
      fetchPriceHistory(Number(selectedProduct));
    }
  }, [selectedProduct]);

  const fetchProductsWithPrices = async () => {
    if (!tenantId) return;
    setLoading(true);

    // Get all quote_suppliers for this supplier
    const { data: quoteSuppliers } = await supabase
      .from("quote_suppliers")
      .select("id, quote_id")
      .eq("supplier_id", supplierId);

    if (!quoteSuppliers || quoteSuppliers.length === 0) {
      setLoading(false);
      return;
    }

    const quoteSupplierIds = quoteSuppliers.map(qs => qs.id);

    // Get all responses from this supplier
    const { data: responses } = await supabase
      .from("quote_responses")
      .select(`
        quote_item_id,
        quote_items!inner (
          product_id,
          products!inner (
            id,
            name,
            tenant_id
          )
        )
      `)
      .in("quote_supplier_id", quoteSupplierIds);

    if (!responses) {
      setLoading(false);
      return;
    }

    // Get unique products
    const productMap = new Map<number, string>();
    responses.forEach((r: any) => {
      const product = r.quote_items?.products;
      if (product && product.tenant_id === tenantId) {
        productMap.set(product.id, product.name);
      }
    });

    const productList = Array.from(productMap.entries()).map(([id, name]) => ({ id, name }));
    setProducts(productList);

    if (productList.length > 0) {
      setSelectedProduct(String(productList[0].id));
    }

    setLoading(false);
  };

  const fetchPriceHistory = async (productId: number) => {
    if (!tenantId) return;

    // Get all quote_suppliers for this supplier
    const { data: quoteSuppliers } = await supabase
      .from("quote_suppliers")
      .select(`
        id,
        quote_id,
        quotes!inner (
          id,
          title,
          created_at,
          tenant_id
        )
      `)
      .eq("supplier_id", supplierId)
      .eq("quotes.tenant_id", tenantId)
      .order("quotes(created_at)", { ascending: true });

    if (!quoteSuppliers) return;

    const pricePoints: PriceDataPoint[] = [];

    for (const qs of quoteSuppliers) {
      // Get the quote item for this product in this quote
      const { data: quoteItems } = await supabase
        .from("quote_items")
        .select("id")
        .eq("quote_id", qs.quote_id)
        .eq("product_id", productId);

      if (!quoteItems || quoteItems.length === 0) continue;

      // Get the response
      const { data: response } = await supabase
        .from("quote_responses")
        .select("price, filled_at")
        .eq("quote_supplier_id", qs.id)
        .eq("quote_item_id", quoteItems[0].id)
        .single();

      if (response && response.price !== null) {
        pricePoints.push({
          date: format(new Date((qs.quotes as any).created_at), "dd/MM/yy", { locale: ptBR }),
          quote: (qs.quotes as any).title,
          price: Number(response.price),
        });
      }
    }

    setPriceData(pricePoints);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            Este fornecedor ainda não cotou nenhum produto.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Variação de Preços por Produto</CardTitle>
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione um produto" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {priceData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum histórico de preços encontrado para este produto.
          </div>
        ) : priceData.length === 1 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">Apenas uma cotação encontrada:</p>
            <p className="text-2xl font-semibold">{formatCurrency(priceData[0].price)}</p>
            <p className="text-sm text-muted-foreground mt-1">{priceData[0].quote}</p>
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Preço"]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return payload[0].payload.quote;
                    }
                    return label;
                  }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="price"
                  name="Preço"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {priceData.length > 1 && (
          <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Menor Preço</p>
              <p className="text-lg font-semibold text-success">
                {formatCurrency(Math.min(...priceData.map(d => d.price)))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Maior Preço</p>
              <p className="text-lg font-semibold text-destructive">
                {formatCurrency(Math.max(...priceData.map(d => d.price)))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Variação</p>
              <p className="text-lg font-semibold text-warning">
                {(((Math.max(...priceData.map(d => d.price)) - Math.min(...priceData.map(d => d.price))) / Math.min(...priceData.map(d => d.price))) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
