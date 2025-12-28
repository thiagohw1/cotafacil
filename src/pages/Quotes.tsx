import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Eye, Copy, Trash2, Package, Users, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAuth } from "@/hooks/useAuth";

interface Quote {
  id: number;
  title: string;
  description: string | null;
  status: string;
  deadline_at: string | null;
  created_at: string;
  created_by: string;
  creator_name?: string;
  items_count?: number;
  suppliers_invited_count?: number;
  suppliers_responded_count?: number;
  quote_items?: {
    product: {
      category: {
        name: string;
      } | null;
    };
  }[];
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
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  // Create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newQuoteData, setNewQuoteData] = useState({
    title: "",
    deadline_at: "",
  });

  useKeyboardShortcuts({
    onNew: () => setCreateModalOpen(true),
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (tenantId) {
      fetchQuotes();
    }
  }, [tenantId, debouncedSearch, statusFilter, page]);

  const fetchQuotes = async () => {
    if (!tenantId) return;
    setLoading(true);

    // Use the view to get statistics
    let query = supabase
      .from("quotes_list_view" as any)
      .select("*, quote_items(product:products(category:categories(name)))", { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (search) {
      // Search across title, products, and suppliers using the aggregated columns from the view
      query = query.or(`title.ilike.%${search}%,product_names.ilike.%${search}%,supplier_names.ilike.%${search}%`);
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
      let quotesData = (data as Quote[]) || [];

      // Fetch creator names
      const userIds = [...new Set(quotesData.map(q => q.created_by).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        quotesData = quotesData.map(q => ({
          ...q,
          creator_name: profileMap.get(q.created_by || "") || "-"
        }));
      }

      setQuotes(quotesData);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const handleView = (quote: Quote) => {
    navigate(`/quotes/${quote.id}`);
  };

  const handleCreateQuote = async () => {
    if (!tenantId || !newQuoteData.title.trim()) return;
    setCreating(true);

    try {
      const { data, error } = await supabase
        .from("quotes")
        .insert({
          tenant_id: tenantId,
          title: newQuoteData.title,
          deadline_at: newQuoteData.deadline_at || null,
          status: "draft",
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Cotação criada!",
        description: "Redirecionando para edição...",
      });

      setCreateModalOpen(false);
      setNewQuoteData({ title: "", deadline_at: "" });
      navigate(`/quotes/${data.id}`);
    } catch (error: any) {
      toast({
        title: "Erro ao criar cotação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
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
        created_by: user?.id,
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
    navigate(`/quotes/${newQuote.id}`);
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
      .update({
        deleted_at: new Date().toISOString(),
        status: "cancelled", // Ensure status change allows update if trigger exists
        title: `${selectedQuote.title}_deleted_${Date.now()}`
      })
      .eq("id", selectedQuote.id);

    if (error) {
      console.error("Error deleting quote:", error);
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

  const CATEGORY_COLORS: Record<string, string> = {
    "flv": "bg-green-500",
    "hortifruti": "bg-green-500",
    "frutas": "bg-green-500",
    "legumes": "bg-green-500",
    "verduras": "bg-green-500",

    "açougue": "bg-red-500",
    "acougue": "bg-red-500",
    "carnes": "bg-red-500",
    "bovinos": "bg-red-500",
    "aves": "bg-red-500",
    "suínos": "bg-red-500",

    "congelados": "bg-blue-400",
    "frios": "bg-blue-300",
    "laticínios": "bg-yellow-400",
    "laticinios": "bg-yellow-400",
    "queijos": "bg-yellow-400",

    "mercearia": "bg-amber-500",
    "alimentos": "bg-amber-500",
    "grãos": "bg-amber-600",

    "bebidas": "bg-purple-500",
    "limpeza": "bg-cyan-500",
    "higiene": "bg-pink-500",
    "padaria": "bg-orange-400",
    "pães": "bg-orange-400",
    "outros": "bg-gray-400"
  };

  const tailWindColors = [
    "bg-red-400", "bg-orange-400", "bg-amber-400", "bg-yellow-400", "bg-lime-400",
    "bg-green-400", "bg-emerald-400", "bg-teal-400", "bg-cyan-400", "bg-sky-400",
    "bg-blue-400", "bg-indigo-400", "bg-violet-400", "bg-purple-400", "bg-fuchsia-400",
    "bg-pink-400", "bg-rose-400"
  ];

  const getCategoryColor = (category: string) => {
    if (!category) return CATEGORY_COLORS["outros"];

    const normalized = category.toLowerCase().trim();
    // Check direct mapping
    if (CATEGORY_COLORS[normalized]) return CATEGORY_COLORS[normalized];

    // Check if any key is contained in the category name
    const foundKey = Object.keys(CATEGORY_COLORS).find(key => normalized.includes(key));
    if (foundKey) return CATEGORY_COLORS[foundKey];

    // Hash fallback
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % tailWindColors.length;
    return tailWindColors[index];
  };

  const getCategoryDistribution = (quote: Quote) => {
    if (!quote.quote_items || quote.quote_items.length === 0) return [];

    const counts: Record<string, number> = {};
    const total = quote.quote_items.length;

    quote.quote_items.forEach(item => {
      const category = item.product?.category?.name || "Sem Categoria";
      counts[category] = (counts[category] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count);
  };

  const columns: Column<Quote>[] = [

    {
      key: "title",
      header: "Título",
      render: (item) => {
        const dateStr = format(new Date(item.created_at), "ddMMyyyy");
        const quoteCode = `CO-${dateStr}-${item.id}`;

        return (
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{quoteCode}</span>
            <span className="text-xs text-muted-foreground">{item.title}</span>
          </div>
        );
      }
    },
    {
      key: "type",
      header: "Tipo",
      className: "w-30 py-0",
      render: (item) => {
        const distribution = getCategoryDistribution(item);
        if (distribution.length === 0) return <span className="text-muted-foreground">-</span>;

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-muted">
                  {distribution.map((dist, idx) => (
                    <div
                      key={idx}
                      className={cn("h-full", getCategoryColor(dist.name))}
                      style={{ width: `${dist.percentage}%` }}
                    />
                  ))}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex flex-col gap-1 text-xs">
                  {distribution.map((dist, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", getCategoryColor(dist.name))} />
                      <span>{dist.count} itens {dist.name}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
    },
    {
      key: "items_count",
      header: "Produtos",
      className: "w-[100px] text-center",
      render: (item) => (
        <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
          <Package className="h-4 w-4" />
          <span className="text-sm font-medium">{item.items_count || 0}</span>
        </div>
      )
    },
    {
      key: "suppliers_invited_count",
      header: "Fornecedores",
      className: "w-[140px] text-center",
      render: (item) => {
        const invited = item.suppliers_invited_count || 0;
        const responded = item.suppliers_responded_count || 0;
        return (
          <div className="flex items-center justify-center gap-2">
            <div className="flex flex-col items-end leading-none">
              <span className="text-sm font-semibold">{responded}<span className="text-muted-foreground font-normal">/{invited}</span></span>
              <span className="text-[10px] text-muted-foreground uppercase">Resp.</span>
            </div>
          </div>
        )
      }
    },
    {
      key: "creator",
      header: "Comprador",
      className: "hidden md:table-cell",
      render: (item) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{item.creator_name || "-"}</span>
        </div>
      )
    },
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
          <Button onClick={() => setCreateModalOpen(true)}>
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
            placeholder="Buscar por título, produtos ou fornecedores..."
            className="w-96"
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

      {/* Create Quote Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Cotação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-title">Título da Cotação <span className="text-destructive">*</span></Label>
              <Input
                id="new-title"
                placeholder="Ex: Cotação de Materiais de Escritório"
                value={newQuoteData.title}
                onChange={(e) => setNewQuoteData({ ...newQuoteData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-deadline">Prazo (Opcional)</Label>
              <Input
                id="new-deadline"
                type="datetime-local"
                value={newQuoteData.deadline_at}
                onChange={(e) => setNewQuoteData({ ...newQuoteData, deadline_at: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateQuote} disabled={creating || !newQuoteData.title.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Cotação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
