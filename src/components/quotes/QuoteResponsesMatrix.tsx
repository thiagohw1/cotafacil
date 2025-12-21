import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Loader2, Download, Eye, Trophy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { WinnersSummary } from "./WinnersSummary";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface QuoteItem {
  id: number;
  product: { name: string };
  package: { unit: string } | null;
  requested_qty: number | null;
  winner_supplier_id: number | null;
  winner_response_id: number | null;
  winner_reason: string | null;
}

interface QuoteSupplier {
  id: number;
  supplier_id: number;
  supplier: { name: string };
  status: string;
  submitted_at: string | null;
}

interface Response {
  id: number;
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
  quoteStatus?: string;
  onWinnerChange?: () => void;
}

const WINNER_REASONS = [
  { value: "lowest_price", label: "Menor Preço" },
  { value: "best_delivery", label: "Melhor Prazo de Entrega" },
  { value: "preferred_supplier", label: "Fornecedor Preferencial" },
  { value: "best_quality", label: "Melhor Qualidade" },
  { value: "negotiated", label: "Negociação Especial" },
  { value: "manual", label: "Decisão Manual" },
];

export function QuoteResponsesMatrix({ quoteId, quoteStatus, onWinnerChange }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [suppliers, setSuppliers] = useState<QuoteSupplier[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);

  // Winner selection state
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<QuoteItem | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<string>("lowest_price");
  const [customReason, setCustomReason] = useState<string>("");
  const [settingWinner, setSettingWinner] = useState(false);

  useEffect(() => {
    fetchData();
  }, [quoteId]);

  const fetchData = async () => {
    setLoading(true);

    const [itemsResult, suppliersResult, responsesResult] = await Promise.all([
      supabase
        .from("quote_items")
        .select(`id, requested_qty, winner_supplier_id, winner_response_id, winner_reason, product:products(name), package:product_packages(unit)`)
        .eq("quote_id", quoteId)
        .order("sort_order"),
      supabase
        .from("quote_suppliers")
        .select(`id, supplier_id, status, submitted_at, supplier:suppliers(name)`)
        .eq("quote_id", quoteId),
      supabase
        .from("quote_responses")
        .select(`
          *,
          quote_supplier:quote_suppliers!inner(quote_id)
        `)
        .eq("quote_supplier.quote_id", quoteId),
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

  const getResponseBySupplierEntityId = (itemId: number, supplierEntityId: number): Response | undefined => {
    const quoteSupplier = suppliers.find(s => s.supplier_id === supplierEntityId);
    if (!quoteSupplier) return undefined;
    return getResponse(itemId, quoteSupplier.id);
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
    const headers = ["Produto", "Embalagem", "Qtde", "Vencedor", ...suppliers.map((s) => s.supplier.name)];
    const rows = items.map((item) => {
      const winnerSupplier = item.winner_supplier_id
        ? suppliers.find(s => s.supplier_id === item.winner_supplier_id)?.supplier.name || "-"
        : "-";
      const row = [
        item.product.name,
        item.package?.unit || "-",
        item.requested_qty?.toString() || "-",
        winnerSupplier,
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

  const handleOpenWinnerModal = (item: QuoteItem) => {
    setSelectedItem(item);
    // Pre-select the current winner if exists
    if (item.winner_supplier_id) {
      setSelectedSupplierId(item.winner_supplier_id.toString());
      setSelectedReason(item.winner_reason || "manual");
    } else {
      // Pre-select the lowest price supplier
      const lowestPrice = getLowestPrice(item.id);
      if (lowestPrice) {
        const lowestResponse = responses.find(
          r => r.quote_item_id === item.id && r.price === lowestPrice
        );
        if (lowestResponse) {
          const lowestSupplier = suppliers.find(s => s.id === lowestResponse.quote_supplier_id);
          if (lowestSupplier) {
            setSelectedSupplierId(lowestSupplier.supplier_id.toString());
          }
        }
      }
      setSelectedReason("lowest_price");
    }
    setCustomReason("");
    setWinnerModalOpen(true);
  };

  const handleSetWinner = async () => {
    if (!selectedItem || !selectedSupplierId) return;

    setSettingWinner(true);

    const supplierId = parseInt(selectedSupplierId);
    const response = getResponseBySupplierEntityId(selectedItem.id, supplierId);

    const reason = selectedReason === "manual" && customReason
      ? customReason
      : WINNER_REASONS.find(r => r.value === selectedReason)?.label || selectedReason;

    const { error } = await supabase
      .from("quote_items")
      .update({
        winner_supplier_id: supplierId,
        winner_response_id: response?.id || null,
        winner_reason: reason,
        winner_set_at: new Date().toISOString(),
      })
      .eq("id", selectedItem.id);

    if (error) {
      toast({
        title: "Erro ao definir vencedor",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Vencedor definido com sucesso!" });
      setWinnerModalOpen(false);
      fetchData();
      onWinnerChange?.();
    }

    setSettingWinner(false);
  };

  const handleAutoSelectWinners = async () => {
    // Auto-select winners based on lowest price for all items without a winner
    const updates: Promise<any>[] = [];

    for (const item of items) {
      if (item.winner_supplier_id) continue; // Skip items with existing winner

      const lowestPrice = getLowestPrice(item.id);
      if (!lowestPrice) continue;

      const lowestResponse = responses.find(
        r => r.quote_item_id === item.id && r.price === lowestPrice
      );
      if (!lowestResponse) continue;

      const lowestSupplier = suppliers.find(s => s.id === lowestResponse.quote_supplier_id);
      if (!lowestSupplier) continue;

      updates.push(
        supabase
          .from("quote_items")
          .update({
            winner_supplier_id: lowestSupplier.supplier_id,
            winner_response_id: lowestResponse.id,
            winner_reason: "Menor Preço (Automático)",
            winner_set_at: new Date().toISOString(),
          })
          .eq("id", item.id)
      );
    }

    if (updates.length === 0) {
      toast({
        title: "Nenhum item para atualizar",
        description: "Todos os itens já possuem vencedor ou não há propostas.",
      });
      return;
    }

    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);

    if (hasError) {
      toast({
        title: "Erro ao auto-selecionar",
        description: "Alguns itens não puderam ser atualizados.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Vencedores selecionados!",
        description: `${updates.length} itens atualizados com menor preço.`
      });
      fetchData();
      onWinnerChange?.();
    }
  };

  const getItemsWithWinners = () => items.filter(i => i.winner_supplier_id).length;
  const getTotalValue = () => {
    return items.reduce((acc, item) => {
      if (!item.winner_supplier_id) return acc;
      const response = getResponseBySupplierEntityId(item.id, item.winner_supplier_id);
      if (!response?.price) return acc;
      return acc + (response.price * (item.requested_qty || 1));
    }, 0);
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

  const canSetWinners = quoteStatus === "open" || quoteStatus === "closed";

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Comparativo de Preços</CardTitle>
            {items.length > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                {getItemsWithWinners()} de {items.length} itens com vencedor definido
                {getTotalValue() > 0 && (
                  <span className="ml-2 font-medium text-foreground">
                    • Total: {formatCurrency(getTotalValue())}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canSetWinners && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoSelectWinners}
                className="text-success border-success/50 hover:bg-success/10"
              >
                <Trophy className="h-4 w-4 mr-2" />
                Auto-selecionar Menores Preços
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
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
                  {canSetWinners && (
                    <th className="text-center py-3 px-3 font-medium min-w-[120px]">
                      <div className="flex items-center justify-center gap-1">
                        <Trophy className="h-4 w-4 text-warning" />
                        Vencedor
                      </div>
                    </th>
                  )}
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
                  const winnerSupplier = item.winner_supplier_id
                    ? suppliers.find(s => s.supplier_id === item.winner_supplier_id)
                    : null;

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
                      {canSetWinners && (
                        <td className="py-3 px-3 text-center">
                          {winnerSupplier ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-success hover:text-success/80 gap-1"
                              onClick={() => handleOpenWinnerModal(item)}
                            >
                              <Check className="h-4 w-4" />
                              <span className="max-w-[80px] truncate">{winnerSupplier.supplier.name}</span>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenWinnerModal(item)}
                            >
                              <Trophy className="h-4 w-4 mr-1" />
                              Definir
                            </Button>
                          )}
                        </td>
                      )}
                      {suppliers.map((supplier) => {
                        const response = getResponse(item.id, supplier.id);
                        const isLowest = response?.price && response.price === lowestPrice;
                        const isWinner = item.winner_supplier_id === supplier.supplier_id;
                        return (
                          <td
                            key={supplier.id}
                            className={cn(
                              "py-3 px-3 text-center transition-colors",
                              isWinner && "bg-success/20 ring-2 ring-success/50 ring-inset",
                              !isWinner && isLowest && "bg-success/10"
                            )}
                          >
                            {response?.price ? (
                              <div className="space-y-1">
                                <span
                                  className={cn(
                                    "font-medium",
                                    isWinner && "text-success font-semibold",
                                    !isWinner && isLowest && "text-success"
                                  )}
                                >
                                  {formatCurrency(response.price)}
                                </span>
                                {isWinner && (
                                  <div className="flex items-center justify-center gap-1 text-xs text-success font-semibold">
                                    <Trophy className="h-3.5 w-3.5 fill-warning text-warning" />
                                    Vencedor
                                  </div>
                                )}
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
              <div className="w-4 h-4 rounded bg-success/20 ring-2 ring-success/50" />
              <span>Vencedor</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-success/10 border border-success/30" />
              <span>Menor preço</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Winners Summary Card */}
      {canSetWinners && items.length > 0 && (
        <div className="mt-6">
          <WinnersSummary
            itemsWithWinners={getItemsWithWinners()}
            totalItems={items.length}
            totalValue={getTotalValue()}
            canGeneratePO={quoteStatus === 'closed'}
          />
        </div>
      )}

      {/* Winner Selection Modal */}
      <Dialog open={winnerModalOpen} onOpenChange={setWinnerModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-warning" />
              Definir Vencedor
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedItem.product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedItem.package?.unit || "Sem embalagem"} • Qtde: {selectedItem.requested_qty || "-"}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Fornecedor Vencedor</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fornecedor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => {
                      const response = getResponse(selectedItem.id, supplier.id);
                      const isLowest = response?.price && response.price === getLowestPrice(selectedItem.id);
                      return (
                        <SelectItem key={supplier.supplier_id} value={supplier.supplier_id.toString()}>
                          <div className="flex items-center gap-2">
                            <span>{supplier.supplier.name}</span>
                            {response?.price && (
                              <span className={cn("text-sm", isLowest && "text-success font-medium")}>
                                ({formatCurrency(response.price)})
                              </span>
                            )}
                            {isLowest && <span className="text-xs text-success">★ Menor</span>}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Motivo da Escolha</Label>
                <Select value={selectedReason} onValueChange={setSelectedReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WINNER_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedReason === "manual" && (
                <div className="space-y-2">
                  <Label>Descreva o motivo</Label>
                  <Textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Descreva o motivo da escolha..."
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWinnerModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSetWinner}
              disabled={!selectedSupplierId || settingWinner}
              className="bg-success hover:bg-success/90"
            >
              {settingWinner && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Trophy className="h-4 w-4 mr-2" />
              Confirmar Vencedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}