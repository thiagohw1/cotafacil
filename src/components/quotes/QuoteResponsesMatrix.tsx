import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Loader2, Download, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface QuoteItem {
  id: number;
  product: { name: string };
  package: { unit: string } | null;
  requested_qty: number | null;
}

interface QuoteSupplier {
  id: number;
  supplier: { name: string };
  status: string;
  submitted_at: string | null;
}

interface Response {
  quote_item_id: number;
  quote_supplier_id: number;
  price: number | null;
  min_qty: number | null;
  delivery_days: number | null;
  notes: string | null;
  filled_at: string | null;
}

interface Props {
  quoteId: number;
}

export function QuoteResponsesMatrix({ quoteId }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [suppliers, setSuppliers] = useState<QuoteSupplier[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);

  useEffect(() => {
    fetchData();
  }, [quoteId]);

  const fetchData = async () => {
    setLoading(true);

    const [itemsResult, suppliersResult, responsesResult] = await Promise.all([
      supabase
        .from("quote_items")
        .select(`id, requested_qty, product:products(name), package:product_packages(unit)`)
        .eq("quote_id", quoteId)
        .order("sort_order"),
      supabase
        .from("quote_suppliers")
        .select(`id, status, submitted_at, supplier:suppliers(name)`)
        .eq("quote_id", quoteId),
      supabase
        .from("quote_responses")
        .select("*")
        .eq("quote_id", quoteId),
    ]);

    setItems((itemsResult.data as any) || []);
    setSuppliers((suppliersResult.data as any) || []);
    setResponses(responsesResult.data || []);
    setLoading(false);
  };

  const getResponse = (itemId: number, supplierId: number): Response | undefined => {
    return responses.find(
      (r) => r.quote_item_id === itemId && r.quote_supplier_id === supplierId
    );
  };

  const getLowestPrice = (itemId: number): number | null => {
    const itemResponses = responses.filter(
      (r) => r.quote_item_id === itemId && r.price && r.price > 0
    );
    if (itemResponses.length === 0) return null;
    return Math.min(...itemResponses.map((r) => r.price!));
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const exportToCSV = () => {
    const headers = ["Produto", "Embalagem", "Qtde", ...suppliers.map((s) => s.supplier.name)];
    const rows = items.map((item) => {
      const row = [
        item.product.name,
        item.package?.unit || "-",
        item.requested_qty?.toString() || "-",
      ];
      suppliers.forEach((supplier) => {
        const response = getResponse(item.id, supplier.id);
        row.push(response?.price ? formatCurrency(response.price) : "-");
      });
      return row;
    });

    const csv = [headers, ...rows].map((row) => row.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cotacao-${quoteId}-respostas.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum fornecedor foi adicionado a esta cotação.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Comparativo de Preços</CardTitle>
        <Button variant="outline" size="sm" onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-3 font-medium sticky left-0 bg-muted/50">
                  Produto
                </th>
                <th className="text-left py-3 px-3 font-medium">Emb.</th>
                <th className="text-left py-3 px-3 font-medium">Qtde</th>
                {suppliers.map((supplier) => (
                  <th key={supplier.id} className="text-center py-3 px-3 font-medium min-w-[150px]">
                    <div className="flex flex-col items-center gap-1">
                      <span>{supplier.supplier.name}</span>
                      <StatusBadge status={supplier.status as any} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const lowestPrice = getLowestPrice(item.id);
                return (
                  <tr key={item.id} className="border-b hover:bg-muted/30">
                    <td className="py-3 px-3 font-medium sticky left-0 bg-card">
                      {item.product.name}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {item.package?.unit || "-"}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {item.requested_qty || "-"}
                    </td>
                    {suppliers.map((supplier) => {
                      const response = getResponse(item.id, supplier.id);
                      const isLowest = response?.price && response.price === lowestPrice;
                      return (
                        <td
                          key={supplier.id}
                          className={cn(
                            "py-3 px-3 text-center",
                            isLowest && "bg-success/10"
                          )}
                        >
                          {response?.price ? (
                            <div className="space-y-1">
                              <span
                                className={cn(
                                  "font-medium",
                                  isLowest && "text-success"
                                )}
                              >
                                {formatCurrency(response.price)}
                              </span>
                              {response.min_qty && (
                                <div className="text-xs text-muted-foreground">
                                  Mín: {response.min_qty}
                                </div>
                              )}
                              {response.delivery_days && (
                                <div className="text-xs text-muted-foreground">
                                  {response.delivery_days} dias
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-success/20 border border-success/30" />
            <span>Menor preço</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}