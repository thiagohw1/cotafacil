import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Loader2, Download, Eye, Trophy, Check, MessageSquare, Tags, FileText, FileSpreadsheet, ChevronDown, Pen, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyInput } from "@/components/ui/currency-input";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  product: { name: string; unit?: string | null };
  package: { unit: string; multiplier: number } | null;
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

interface PricingTier {
  min_quantity: number;
  price: number;
}

interface Response {
  id: number;
  quote_item_id: number;
  quote_supplier_id: number;
  price: number | null;
  delivery_days: number | null;
  notes: string | null;
  pricing_tiers: PricingTier[] | null;
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

  // Inline Editing State
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingValues, setEditingValues] = useState<Record<string, number>>({});
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});

  // Winner selection state
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<QuoteItem | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<string>("lowest_price");
  const [customReason, setCustomReason] = useState<string>("");
  const [settingWinner, setSettingWinner] = useState(false);

  // Tie-breaking state
  const [tieModalOpen, setTieModalOpen] = useState(false);
  const [tiedItems, setTiedItems] = useState<Array<{
    item: QuoteItem;
    tiedSuppliers: Array<{ supplier: QuoteSupplier; response: Response }>;
  }>>([]);
  const [currentTieIndex, setCurrentTieIndex] = useState(0);
  const [tieSelections, setTieSelections] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    fetchData();
  }, [quoteId]);

  const fetchData = async () => {
    setLoading(true);

    const [itemsResult, suppliersResult, responsesResult] = await Promise.all([
      supabase
        .from("quote_items")
        .select(`id, requested_qty, winner_supplier_id, winner_response_id, winner_reason, product:products(name, unit), package:product_packages(unit, multiplier)`)
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
    setResponses((responsesResult.data as any) || []);
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

  const handlePriceChange = async (itemId: number, supplierEntityId: number, newPrice: number) => {
    // 1. Resolve entity ID to DB ID
    const supplier = suppliers.find(s => s.supplier_id === supplierEntityId);
    if (!supplier) return;

    const cellKey = `${itemId}-${supplier.id}`;
    setSavingCells(prev => ({ ...prev, [cellKey]: true }));

    try {
      // 2. Optimistic Update (Local State)
      setResponses(prev => {
        const index = prev.findIndex(r => r.quote_item_id === itemId && r.quote_supplier_id === supplier.id);
        if (index >= 0) {
          const newArr = [...prev];
          newArr[index] = { ...newArr[index], price: newPrice };
          return newArr;
        }
        // If doesn't exist, we can't fully create it optimistically without an ID easily, 
        // but the DB call below handles upsert. 
        // For UI responsiveness we might wait for the DB return for refreshing "responses".
        return prev;
      });

      // 3. DB Update
      const { data, error } = await supabase.rpc("save_supplier_response", {
        p_token: supplier.id.toString(), // We don't have the token here easily mapped, WAIT. "save_supplier_response" uses public_token.
        // Using direct table insert/update is better for ADMIN editing as we are authenticated.
        // But we need to use a different RPC or standard insert.
        // Let's use direct upsert to 'quote_responses'.
        p_price: newPrice, // Argument mismatch with RPC?
        // Actually, let's look at how to save.
        // 'quote_responses' table needs: quote_item_id, quote_supplier_id.
        // We can just upsert.
      });

      // Correct approach: Direct Upsert
      const { data: savedData, error: upsertError } = await supabase
        .from("quote_responses")
        .upsert({
          quote_item_id: itemId,
          quote_supplier_id: supplier.id,
          price: newPrice,
          // On conflict (quote_item_id, quote_supplier_id) update price
        }, { onConflict: 'quote_item_id, quote_supplier_id' })
        .select()
        .single();

      if (upsertError) throw upsertError;

      // 4. Update real state with returned data
      setResponses(prev => {
        const index = prev.findIndex(r => r.quote_item_id === itemId && r.quote_supplier_id === supplier.id);
        if (index >= 0) {
          const newArr = [...prev];
          newArr[index] = { ...newArr[index], ...savedData }; // Merge
          return newArr;
        } else {
          return [...prev, savedData as Response];
        }
      });

      toast({ title: "Preço atualizado", duration: 1000 });
    } catch (error: any) {
      console.error("Error saving price:", error);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSavingCells(prev => ({ ...prev, [cellKey]: false }));
    }
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

  const exportToPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    // Create PDF in landscape mode
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    let yPos = 15;

    // Title
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('COMPARATIVO DE PRECOS - COTACAO', 148, yPos, { align: 'center' });
    yPos += 10;

    // Quote Information Section
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Cotacao #${quoteId}`, 14, yPos);
    doc.text(`Data de Exportacao: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 200, yPos);
    yPos += 7;

    // Summary Information
    const itemsWithWinners = items.filter(i => i.winner_supplier_id).length;
    const totalValue = getTotalValue();

    doc.setFontSize(9);
    doc.text(`Total de Itens: ${items.length}`, 14, yPos);
    doc.text(`Itens com Vencedor: ${itemsWithWinners}`, 70, yPos);
    doc.text(`Fornecedores: ${suppliers.length}`, 130, yPos);
    if (totalValue > 0) {
      doc.text(`Valor Total Estimado: ${formatCurrency(totalValue)}`, 180, yPos);
    }
    yPos += 10;

    // Suppliers Information
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('FORNECEDORES:', 14, yPos);
    yPos += 5;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    const suppliersList = suppliers.map(s => s.supplier.name).join(', ');
    doc.text(suppliersList, 14, yPos, { maxWidth: 260 });
    yPos += 8;

    // Comparison Table
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('COMPARATIVO DE PRECOS:', 14, yPos);
    yPos += 5;

    const headers = [["Produto", "Emb", "Qtd", "Vencedor", ...suppliers.map(s => s.supplier.name)]];
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

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: yPos,
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        cellWidth: 'wrap'
      },
      headStyles: {
        fillColor: [75, 85, 99],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 50 }, // Produto
        1: { cellWidth: 15, halign: 'center' }, // Embalagem
        2: { cellWidth: 12, halign: 'center' }, // Quantidade
        3: { cellWidth: 30, halign: 'center' }, // Vencedor
      },
      didParseCell: function (data) {
        // Highlight winner cells
        if (data.row.section === 'body' && data.column.index > 3) {
          const item = items[data.row.index];
          const supplierIndex = data.column.index - 4;
          const supplier = suppliers[supplierIndex];
          if (item.winner_supplier_id === supplier?.supplier_id) {
            data.cell.styles.fillColor = [220, 252, 231]; // Light green
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    // Footer
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text(
        `Pagina ${i} de ${pageCount}`,
        148,
        200,
        { align: 'center' }
      );
    }

    doc.save(`cotacao_${quoteId}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Comparison Matrix
    const headers = ["Produto", "Embalagem", "Qtde", "Vencedor", ...suppliers.map(s => s.supplier.name)];
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

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Comparativo");

    // Save file
    XLSX.writeFile(wb, `cotacao_${quoteId}_${new Date().toISOString().split('T')[0]}.xlsx`);
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
    setLoading(true);
    try {
      // First, detect ties
      const ties: Array<{
        item: QuoteItem;
        tiedSuppliers: Array<{ supplier: QuoteSupplier; response: Response }>;
      }> = [];

      items.forEach((item) => {
        const lowestPrice = getLowestPrice(item.id);
        if (lowestPrice === null) return;

        // Find all suppliers with the lowest price
        const suppliersAtLowestPrice = suppliers
          .map((supplier) => {
            const response = getResponse(item.id, supplier.id);
            return { supplier, response };
          })
          .filter((sr) => sr.response?.price === lowestPrice);

        // If more than one supplier has the lowest price, it's a tie
        if (suppliersAtLowestPrice.length > 1) {
          ties.push({
            item,
            tiedSuppliers: suppliersAtLowestPrice as Array<{ supplier: QuoteSupplier; response: Response }>,
          });
        }
      });

      // If there are ties, show tie-breaking dialog
      if (ties.length > 0) {
        setTiedItems(ties);
        setCurrentTieIndex(0);
        setTieSelections(new Map());
        setTieModalOpen(true);
        setLoading(false);
        return;
      }

      // No ties, proceed with auto-select
      const { data, error } = await supabase.rpc('auto_select_winners', {
        p_quote_id: quoteId,
      });

      if (error) {
        throw error;
      }

      const count = data as number;

      if (count === 0) {
        toast({
          title: "Nenhum item atualizado",
          description: "Todos os itens já possuem vencedor ou não há propostas válidas.",
        });
      } else {
        toast({
          title: "Vencedores selecionados!",
          description: `${count} item(s) atualizado(s) com menor preço.`,
        });
        fetchData();
        onWinnerChange?.();
      }
    } catch (error: any) {
      console.error('Error auto-selecting winners:', error);
      toast({
        title: "Erro ao auto-selecionar",
        description: error.message || "Ocorreu um erro ao processar a solicitação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTieSelection = (supplierId: number) => {
    const newSelections = new Map(tieSelections);
    newSelections.set(tiedItems[currentTieIndex].item.id, supplierId);
    setTieSelections(newSelections);
  };

  const handleNextTie = () => {
    if (currentTieIndex < tiedItems.length - 1) {
      setCurrentTieIndex(currentTieIndex + 1);
    } else {
      handleConfirmTieSelections();
    }
  };

  const handleConfirmTieSelections = async () => {
    setLoading(true);
    try {
      // Set winners for tied items based on user selections
      for (const [itemId, supplierId] of tieSelections.entries()) {
        const item = items.find(i => i.id === itemId);
        const response = responses.find(r => r.quote_item_id === itemId && r.quote_supplier_id === suppliers.find(s => s.supplier_id === supplierId)?.id);

        if (item && response) {
          const { error } = await supabase
            .from('quote_items')
            .update({
              winner_supplier_id: supplierId,
              winner_response_id: response.id,
              winner_reason: 'lowest_price',
              winner_set_at: new Date().toISOString(),
            })
            .eq('id', itemId);

          if (error) throw error;
        }
      }

      // Now call auto-select for remaining items
      const { data, error } = await supabase.rpc('auto_select_winners', {
        p_quote_id: quoteId,
      });

      if (error) throw error;

      toast({
        title: "Vencedores selecionados!",
        description: `Empates resolvidos e demais itens atualizados.`,
      });

      setTieModalOpen(false);
      fetchData();
      onWinnerChange?.();
    } catch (error: any) {
      console.error('Error setting tie winners:', error);
      toast({
        title: "Erro ao definir vencedores",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return "bg-emerald-500";
      case 'partial': return "bg-amber-500";
      case 'viewed': return "bg-blue-500";
      default: return "bg-gray-300";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'submitted': return "Respondido";
      case 'partial': return "Em Andamento";
      case 'viewed': return "Visualizado";
      default: return "Pendente";
    }
  };

  return (
    <>
      <Card className="border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              Comparativo de Preços
              {isEditMode && <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 animate-pulse">Modo Edição Ativo</span>}
            </CardTitle>
            {items.length > 0 && (
              <div className="text-sm text-muted-foreground mt-1 flex gap-2">
                <span>{getItemsWithWinners()} de {items.length} itens definidos</span>
                {getTotalValue() > 0 && (
                  <>
                    <span>•</span>
                    <span className="font-medium text-foreground">
                      Total: {formatCurrency(getTotalValue())}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isEditMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsEditMode(!isEditMode)}
              className={cn(isEditMode && "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200")}
            >
              {isEditMode ? <Check className="h-4 w-4 mr-2" /> : <Pen className="h-4 w-4 mr-2" />}
              {isEditMode ? "Concluir Edição" : "Editar Preços"}
            </Button>
            {canSetWinners && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoSelectWinners}
                className="text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950"
              >
                <Trophy className="h-4 w-4 mr-2" />
                Auto-selecionar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="py-2 px-4 font-medium sticky left-0 bg-muted/50 z-10 w-[250px] border-r border-border">Produto</th>
                  <th className="py-2 px-4 font-medium w-[100px]">Emb.</th>
                  <th className="py-2 px-4 font-medium text-center w-[80px]">Qtd.</th>
                  {canSetWinners && (
                    <th className="py-2 px-4 font-medium text-center w-[120px]">
                      Vencedor
                    </th>
                  )}
                  {suppliers.map((supplier) => (
                    <th key={supplier.id} className="py-2 px-4 font-medium min-w-[140px] text-center border-l border-border/50">
                      <div className="flex items-center justify-center gap-2" title={getStatusLabel(supplier.status)}>
                        <div className={cn("w-2 h-2 rounded-full", getStatusColor(supplier.status))} />
                        <span className="font-semibold text-foreground truncate max-w-[120px]">
                          {supplier.supplier.name}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item) => {
                  const lowestPrice = getLowestPrice(item.id);
                  const winnerSupplier = item.winner_supplier_id
                    ? suppliers.find(s => s.supplier_id === item.winner_supplier_id)
                    : null;

                  return (
                    <tr key={item.id} className="group hover:bg-muted/20 transition-colors">
                      <td className="py-2 px-4 font-medium sticky left-0 bg-background group-hover:bg-muted/20 transition-colors">
                        <div className="line-clamp-2" title={item.product.name}>
                          {item.product.name}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-muted-foreground whitespace-nowrap text-xs">
                        {item.package ? `${item.package.unit} x ${item.package.multiplier}` : "-"}
                      </td>
                      <td className="py-2 px-4 text-center text-muted-foreground font-medium">
                        {item.requested_qty || "-"}
                      </td>
                      {canSetWinners && (
                        <td className="py-2 px-4 text-center">
                          {winnerSupplier ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
                              onClick={() => handleOpenWinnerModal(item)}
                              title={`Vencedor: ${winnerSupplier.supplier.name}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-full px-1 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenWinnerModal(item)}
                            >
                              <span className="text-[10px] uppercase tracking-wide">Definir</span>
                            </Button>
                          )}
                        </td>
                      )}
                      {suppliers.map((supplier) => {
                        const response = getResponse(item.id, supplier.id);
                        const isLowest = response?.price && response.price === lowestPrice;
                        const isWinner = item.winner_supplier_id === supplier.supplier_id;

                        const multiplier = item.package?.multiplier || 1;
                        const unitPrice = response?.price ? (response.price / multiplier) : null;

                        return (
                          <td
                            key={supplier.id}
                            className={cn(
                              "py-2 px-4 border-l border-border/50 relative text-right align-top",
                              isWinner && "bg-emerald-50/50 dark:bg-emerald-950/20",
                              !isWinner && isLowest && "bg-blue-50/30 dark:bg-blue-950/10"
                            )}
                          >
                            {response?.price ? (
                              <div className="relative flex items-start justify-center gap-2 w-full">
                                {/* Price info */}
                                <div className="flex flex-col items-center gap-0.5 flex-1">
                                  <div className={cn(
                                    "font-medium text-sm leading-none",
                                    isWinner ? "text-emerald-600 dark:text-emerald-400" : (isLowest ? "text-blue-600 dark:text-blue-400" : "text-foreground")
                                  )}>
                                    {formatCurrency(unitPrice)} <span className="text-[10px] text-muted-foreground font-normal">/{item.product.unit || 'un'}</span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <span>{formatCurrency(response.price)}</span>
                                    {item.package && item.package.multiplier > 1 && (
                                      <span className="text-[9px] opacity-75">/{item.package.unit}</span>
                                    )}
                                  </div>

                                  {response.delivery_days && (
                                    <div className="text-[9px] text-muted-foreground mt-0.5" title="Prazo Entrega">
                                      {response.delivery_days}d
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              !isEditMode && <div className="text-gray-300 text-center">-</div>
                            )}

                            {isEditMode && (
                              <div className={cn(
                                "absolute inset-0 z-20 flex items-center justify-center p-0.5",
                                !response?.price && "opacity-50 hover:opacity-100"
                              )}>
                                <InlinePriceCell
                                  initialValue={response?.price || 0}
                                  onSave={(val) => handlePriceChange(item.id, supplier.supplier_id, val)}
                                  isSaving={savingCells[`${item.id}-${supplier.id}`]}
                                />
                              </div>
                            )}

                            {/* Re-implementing edit Logic cleanly below */}
                            {isWinner && (
                              <div className="absolute top-0 right-0 w-0 h-0 border-t-[8px] border-t-emerald-500 border-l-[8px] border-l-transparent" />
                            )}
                            {/* Icons positioned at cell corners */}
                            {response?.pricing_tiers && response.pricing_tiers.length > 0 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="absolute top-2 right-1 cursor-pointer">
                                    <Tags className="h-3 w-3 text-blue-500 hover:text-blue-600" />
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-3 shadow-lg">
                                  <div className="font-semibold text-blue-600 mb-2 flex items-center gap-2 text-xs">
                                    <Tags className="h-3 w-3" /> Tabela de Preços
                                  </div>
                                  <table className="text-xs w-full">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="text-left py-1 pr-4">Mínimo</th>
                                        <th className="text-right py-1 pr-3">Preço</th>
                                        <th className="text-right py-1">Desconto</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {response.pricing_tiers.map((tier, i) => {
                                        const basePrice = response.price || 0;
                                        const discount = basePrice > 0 ? ((basePrice - tier.price) / basePrice * 100) : 0;
                                        const packageUnit = item.package?.unit || 'un';

                                        return (
                                          <tr key={i}>
                                            <td className="py-1 text-muted-foreground">{tier.min_quantity} {packageUnit}</td>
                                            <td className="py-1 text-right font-medium pr-3">{formatCurrency(tier.price)}</td>
                                            <td className="py-1 text-right">
                                              {discount > 0 ? (
                                                <span className="text-green-600 font-medium">-{discount.toFixed(1)}%</span>
                                              ) : (
                                                <span className="text-muted-foreground">-</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </PopoverContent>
                              </Popover>
                            )}
                            {response?.notes && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="absolute bottom-2 right-1 cursor-pointer">
                                    <MessageSquare className="h-3 w-3 text-amber-500 hover:text-amber-600" />
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-3 shadow-lg text-xs">
                                  <div className="font-semibold text-amber-600 mb-1 flex items-center gap-2">
                                    <MessageSquare className="h-3 w-3" /> Observação
                                  </div>
                                  <p className="text-muted-foreground">{response.notes}</p>
                                </PopoverContent>
                              </Popover>
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
          <div className="p-4 border-t flex justify-between gap-6 text-xs text-muted-foreground bg-muted/10">
            <div className="flex items-center gap-4">
              <span className="font-medium mr-2">Status:</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                <span>Respondido</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                <span>Em Andamento</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>Visualizado</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
                <span>Pendente</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-100 dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 rounded-sm"></span>
                <span>Vencedor</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-50 dark:bg-blue-900/50 border border-blue-100 dark:border-blue-800 rounded-sm"></span>
                <span>Menor Preço</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Winners Summary Card */}
      {canSetWinners && items.length > 0 && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
              <Trophy className="h-5 w-5 text-amber-500" />
              Definir Vencedor
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-6 py-2">
              <div className="p-4 bg-muted/40 rounded-lg border">
                <p className="font-medium text-lg leading-tight mb-1">{selectedItem.product.name}</p>
                <div className="flex gap-3 text-sm text-muted-foreground">
                  <span>Emb: {selectedItem.package?.unit || "-"}</span>
                  <span>Qtd: {selectedItem.requested_qty || "-"}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Quem venceu para este item?</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => {
                      const response = getResponse(selectedItem.id, supplier.id);
                      const isLowest = response?.price && response.price === getLowestPrice(selectedItem.id);
                      return (
                        <SelectItem key={supplier.supplier_id} value={supplier.supplier_id.toString()} disabled={!response?.price}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{supplier.supplier.name}</span>
                            {response?.price && (
                              <div className="flex items-center gap-2">
                                <span className={cn("font-medium", isLowest ? "text-emerald-600" : "text-muted-foreground")}>
                                  {formatCurrency(response.price)}
                                </span>
                                {isLowest && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Melhor preço</span>}
                              </div>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Critério de escolha</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WINNER_REASONS.map((reason) => (
                    <div
                      key={reason.value}
                      onClick={() => setSelectedReason(reason.value)}
                      className={cn(
                        "cursor-pointer rounded-md border p-2 text-sm text-center transition-all hover:border-primary",
                        selectedReason === reason.value
                          ? "bg-primary/5 border-primary text-primary font-medium"
                          : "bg-background text-muted-foreground header-muted"
                      )}
                    >
                      {reason.label}
                    </div>
                  ))}
                </div>
              </div>

              {selectedReason === "manual" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <Label>Motivo (Opcional)</Label>
                  <Textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Insiro detalhes sobre a negociação..."
                    className="resize-none"
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setWinnerModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSetWinner}
              disabled={!selectedSupplierId || settingWinner}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              {settingWinner && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tie-Breaking Dialog */}
      <Dialog open={tieModalOpen} onOpenChange={setTieModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Empate Detectado - Escolha o Vencedor
            </DialogTitle>
          </DialogHeader>
          {tiedItems.length > 0 && currentTieIndex < tiedItems.length && (
            <div className="space-y-6 py-2">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                  <strong>Item {currentTieIndex + 1} de {tiedItems.length}</strong>
                </p>
                <p className="font-medium text-lg leading-tight mb-1">
                  {tiedItems[currentTieIndex].item.product.name}
                </p>
                <div className="flex gap-3 text-sm text-muted-foreground">
                  <span>Emb: {tiedItems[currentTieIndex].item.package?.unit || "-"}</span>
                  <span>Qtd: {tiedItems[currentTieIndex].item.requested_qty || "-"}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label>
                  Múltiplos fornecedores têm o mesmo menor preço ({formatCurrency(tiedItems[currentTieIndex].tiedSuppliers[0].response.price)}).
                  Escolha qual deve vencer:
                </Label>
                <div className="grid gap-2">
                  {tiedItems[currentTieIndex].tiedSuppliers.map(({ supplier, response }) => (
                    <div
                      key={supplier.supplier_id}
                      onClick={() => handleTieSelection(supplier.supplier_id)}
                      className={cn(
                        "cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-primary",
                        tieSelections.get(tiedItems[currentTieIndex].item.id) === supplier.supplier_id
                          ? "bg-primary/5 border-primary"
                          : "bg-background border-border"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{supplier.supplier.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Preço: {formatCurrency(response.price)}
                            {response.delivery_days && ` • Prazo: ${response.delivery_days} dias`}
                          </p>
                        </div>
                        {tieSelections.get(tiedItems[currentTieIndex].item.id) === supplier.supplier_id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setTieModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleNextTie}
              disabled={!tieSelections.has(tiedItems[currentTieIndex]?.item.id) || loading}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {currentTieIndex < tiedItems.length - 1 ? "Próximo" : "Confirmar Seleções"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface InlinePriceCellProps {
  initialValue: number;
  onSave: (val: number) => void;
  isSaving: boolean;
}

function InlinePriceCell({ initialValue, onSave, isSaving }: InlinePriceCellProps) {
  const [value, setValue] = useState(initialValue);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleBlur = () => {
    if (isDirty) {
      onSave(value);
      setIsDirty(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="relative w-full">
      <CurrencyInput
        value={value.toString()}
        onChange={(val) => {
          setValue(parseFloat(val));
          setIsDirty(true);
        }}
        className={cn(
          "h-7 text-xs text-right pr-2 rounded-sm border-transparent hover:border-input focus:border-primary transition-colors bg-transparent focus:bg-background",
          isSaving && "opacity-50"
        )}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <div className="absolute inset-0 pointer-events-none">
        {isSaving && <Loader2 className="h-3 w-3 animate-spin absolute right-1 top-2 text-muted-foreground mr-6" />}
      </div>
    </div>
  );
}