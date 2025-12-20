import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Eye, Copy, Trash2, Package, Users, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface Quote {
  id: number;
  title: string;
  description: string | null;
  status: string;
  deadline_at: string | null;
  created_at: string;
}

interface QuoteSummary {
  quote: Quote;
  itemsCount: number;
  suppliersCount: number;
  items: { product_name: string; package_unit: string | null; requested_qty: number | null }[];
  suppliers: { name: string; status: string }[];
}

export default function Quotes() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Summary modal state
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [quoteSummary, setQuoteSummary] = useState<QuoteSummary | null>(null);

  useKeyboardShortcuts({
    onNew: () => navigate("/quotes/new"),
  });

  useEffect(() => {
    if (tenantId) {
      fetchQuotes();
    }
  }, [tenantId, search, statusFilter, page]);

  const fetchQuotes = async () => {
    if (!tenantId) return;
    setLoading(true);

    let query = supabase
      .from("quotes")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.ilike("title", `%${search}%`);
    }

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter as "draft" | "open" | "closed" | "cancelled");
    }

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      toast({
        title: "Erro ao carregar cotações",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setQuotes(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const handleView = (quote: Quote) => {
    navigate(`/quotes/${quote.id}`);
  };

  const handleShowSummary = async (quote: Quote) => {
    setSummaryModalOpen(true);
    setSummaryLoading(true);
    setQuoteSummary(null);

    // Fetch items and suppliers for summary
    const [itemsResult, suppliersResult] = await Promise.all([
      supabase
        .from("quote_items")
        .select("product:products(name), package:product_packages(unit), requested_qty")
        .eq("quote_id", quote.id),
      supabase
        .from("quote_suppliers")
        .select("status, supplier:suppliers(name)")
        .eq("quote_id", quote.id),
    ]);

    const items = (itemsResult.data || []).map((item: any) => ({
      product_name: item.product?.name || "Produto não encontrado",
      package_unit: item.package?.unit || null,
      requested_qty: item.requested_qty,
    }));

    const suppliers = (suppliersResult.data || []).map((qs: any) => ({
      name: qs.supplier?.name || "Fornecedor não encontrado",
      status: qs.status,
    }));

    setQuoteSummary({
      quote,
      itemsCount: items.length,
      suppliersCount: suppliers.length,
      items,
      suppliers,
    });
    setSummaryLoading(false);
  };

  const handleDuplicate = async (quote: Quote) => {
    if (!tenantId) return;

    const { data: newQuote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        tenant_id: tenantId,
        title: `${quote.title} (Cópia)`,
        status: "draft",
      })
      .select()
      .single();

    if (quoteError) {
      toast({
        title: "Erro ao duplicar",
        description: quoteError.message,
        variant: "destructive",
      });
      return;
    }

    // Copy items
    const { data: items } = await supabase
      .from("quote_items")
      .select("product_id, package_id, requested_qty, notes, sort_order")
      .eq("quote_id", quote.id);

    if (items && items.length > 0) {
      await supabase.from("quote_items").insert(
        items.map((item) => ({
          ...item,
          quote_id: newQuote.id,
        }))
      );
    }

    toast({ title: "Cotação duplicada" });
    fetchQuotes();
  };

  const handleDelete = (quote: Quote) => {
    setSelectedQuote(quote);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedQuote) return;
    setDeleting(true);

    const { error } = await supabase
      .from("quotes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", selectedQuote.id);

    if (error) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Cotação excluída" });
      setDeleteOpen(false);
      fetchQuotes();
    }
    setDeleting(false);
  };

  const columns: Column<Quote>[] = [
    { key: "title", header: "Título" },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status as any} />,
    },
    {
      key: "deadline_at",
      header: "Prazo",
      render: (item) =>
        item.deadline_at
          ? format(new Date(item.deadline_at), "dd/MM/yyyy HH:mm", {
            locale: ptBR,
          })
          : "-",
    },
    {
      key: "created_at",
      header: "Criada em",
      render: (item) =>
        format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR }),
    },
    {
      key: "actions",
      header: "",
      className: "w-32",
      render: (item) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            title="Visualizar resumo"
            onClick={(e) => {
              e.stopPropagation();
              handleShowSummary(item);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDuplicate(item);
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <Header
        title="Cotações"
        description="Gerencie suas solicitações de cotação"
        actions={
          <Button onClick={() => navigate("/quotes/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Cotação
          </Button>
        }
      />

      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar cotações..."
            className="w-80"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="open">Aberta</SelectItem>
              <SelectItem value="closed">Encerrada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={quotes}
          loading={loading}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          onRowClick={handleView}
          emptyMessage="Nenhuma cotação encontrada"
        />
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir cotação"
        description={`Tem certeza que deseja excluir a cotação "${selectedQuote?.title}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="destructive"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />

      {/* Quote Summary Modal */}
      <Dialog open={summaryModalOpen} onOpenChange={setSummaryModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resumo da Cotação</DialogTitle>
          </DialogHeader>
          {summaryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : quoteSummary ? (
            <div className="space-y-6">
              {/* Quote info */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{quoteSummary.quote.title}</h3>
                <div className="flex items-center gap-4">
                  <StatusBadge status={quoteSummary.quote.status as any} />
                  {quoteSummary.quote.deadline_at && (
                    <span className="text-sm text-muted-foreground">
                      Prazo: {format(new Date(quoteSummary.quote.deadline_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
                {quoteSummary.quote.description && (
                  <p className="text-sm text-muted-foreground">{quoteSummary.quote.description}</p>
                )}
              </div>

              {/* Items summary */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <h4 className="font-medium">Itens ({quoteSummary.itemsCount})</h4>
                </div>
                {quoteSummary.items.length > 0 ? (
                  <div className="rounded-lg border divide-y max-h-40 overflow-y-auto">
                    {quoteSummary.items.map((item, index) => (
                      <div key={index} className="p-2 flex justify-between text-sm">
                        <span>{item.product_name}</span>
                        <span className="text-muted-foreground">
                          {item.requested_qty || "-"} {item.package_unit || ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum item adicionado</p>
                )}
              </div>

              {/* Suppliers summary */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h4 className="font-medium">Fornecedores ({quoteSummary.suppliersCount})</h4>
                </div>
                {quoteSummary.suppliers.length > 0 ? (
                  <div className="rounded-lg border divide-y max-h-40 overflow-y-auto">
                    {quoteSummary.suppliers.map((supplier, index) => (
                      <div key={index} className="p-2 flex justify-between items-center text-sm">
                        <span>{supplier.name}</span>
                        <StatusBadge status={supplier.status as any} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum fornecedor adicionado</p>
                )}
              </div>

              {/* Action button */}
              <div className="flex justify-end pt-2">
                <Button onClick={() => {
                  setSummaryModalOpen(false);
                  navigate(`/quotes/${quoteSummary.quote.id}`);
                }}>
                  Abrir Cotação
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
