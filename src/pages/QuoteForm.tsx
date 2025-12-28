import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QuoteResponsesMatrix } from "@/components/quotes/QuoteResponsesMatrix";
import {
  Save,
  Send,
  Loader2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  BarChart3,
  ShoppingCart,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { GeneratePOModal } from "@/components/quotes/GeneratePOModal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { mailService } from "@/services/mailService";
import {
  QuoteItem,
  Product,
  Supplier,
  ProductList,
  QuoteSupplier,
  ImportListItem
} from "@/types/quote";
import { QuoteItemsTab } from "@/components/quotes/form/QuoteItemsTab";
import { QuoteSuppliersTab } from "@/components/quotes/form/QuoteSuppliersTab";
import { QuoteImportModal } from "@/components/quotes/form/QuoteImportModal";
import { QuoteItemAdder } from "@/components/quotes/form/QuoteItemAdder";


export default function QuoteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productLists, setProductLists] = useState<ProductList[]>([]);

  const [creatorName, setCreatorName] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    deadline_at: "",
    status: "draft" as "draft" | "open" | "closed" | "cancelled",
    created_at: "",
  });

  const [items, setItems] = useState<QuoteItem[]>([]);
  const [quoteSuppliers, setQuoteSuppliers] = useState<QuoteSupplier[]>([]);

  const [selectedListId, setSelectedListId] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"open" | "close" | "cancel">(
    "open"
  );

  const [validationErrorOpen, setValidationErrorOpen] = useState(false);
  const [undecidedItemsList, setUndecidedItemsList] = useState<string[]>([]);

  useKeyboardShortcuts({
    onSave: () => handleSave(),
  });

  // Import list modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importListItems, setImportListItems] = useState<ImportListItem[]>([]);
  const [importingList, setImportingList] = useState(false);

  // PO generation modal state
  interface POSupplier {
    id: number;
    name: string;
    itemCount: number;
    totalValue: number;
  }
  const [poModalOpen, setPOModalOpen] = useState(false);
  const [poSuppliers, setPOSuppliers] = useState<POSupplier[]>([]);

  useEffect(() => {
    if (tenantId) {
      fetchData();
    }
  }, [tenantId, id]);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);

    await Promise.all([fetchProducts(), fetchSuppliers(), fetchProductLists()]);

    if (id) {
      await fetchQuote();
    }

    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, product_packages(id, unit, multiplier, is_default)")
      .eq("tenant_id", tenantId!)
      .eq("active", true)
      .is("deleted_at", null)
      .order("name");

    setProducts(
      data?.map((p) => ({
        id: p.id,
        name: p.name,
        packages: p.product_packages || [],
      })) || []
    );
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase
      .from("suppliers")
      .select("id, name, email")
      .eq("tenant_id", tenantId!)
      .eq("active", true)
      .is("deleted_at", null)
      .order("name");

    setSuppliers(data || []);
  };

  const fetchProductLists = async () => {
    const { data } = await supabase
      .from("product_lists")
      .select("id, name")
      .eq("tenant_id", tenantId!)
      .is("deleted_at", null)
      .order("name");

    setProductLists(data || []);
  };

  const fetchQuote = async () => {
    if (!id) return;
    const quoteId = parseInt(id);

    const { data: quote } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (quote) {
      setFormData({
        title: quote.title,
        description: quote.description || "",
        deadline_at: quote.deadline_at
          ? (() => {
            const date = new Date(quote.deadline_at);
            return new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
              .toISOString()
              .slice(0, 16);
          })()
          : "",
        status: quote.status,
        created_at: quote.created_at || "",
      });

      if (quote.created_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", quote.created_by)
          .single();

        if (profile) {
          setCreatorName(profile.full_name || "");
        }
      }
    }

    const { data: quoteItems, error: quoteItemsError } = await supabase
      .from("quote_items")
      .select(
        `
        id,
        product_id,
        package_id,
        requested_qty,
        notes,
        product:products(name),
        package:product_packages(unit, multiplier),
        winner_supplier_id,
        winner_response:quote_responses!quote_items_winner_response_id_fkey(price)
      `
      )
      .eq("quote_id", quoteId)
      .order("sort_order");

    if (quoteItemsError) console.error("fetchQuote - quoteItems error:", quoteItemsError);

    setItems((quoteItems as any) || []);

    const { data: quoteSuppliersData } = await supabase
      .from("quote_suppliers")
      .select(
        `
        id,
        supplier_id,
        public_token,
        status,
        supplier:suppliers(name, email)
      `
      )
      .eq("quote_id", quoteId);

    setQuoteSuppliers((quoteSuppliersData as any) || []);
  };

  useEffect(() => {
    const suppliersMap = new Map();

    if (items.length && quoteSuppliers.length) {
      items.forEach((item: any) => {
        if (item.winner_supplier_id) {
          const supplier = quoteSuppliers.find((s: any) => s.supplier_id === item.winner_supplier_id);
          if (supplier) {
            const current = suppliersMap.get(supplier.supplier_id) || {
              id: supplier.supplier_id,
              name: supplier.supplier.name,
              itemCount: 0,
              totalValue: 0
            };

            current.itemCount++;
            if (item.winner_response?.price) {
              current.totalValue += item.winner_response.price * (item.requested_qty || 1);
            }

            suppliersMap.set(supplier.supplier_id, current);
          }
        }
      });
    }

    setPOSuppliers(Array.from(suppliersMap.values()));
  }, [items, quoteSuppliers]);



  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);

    const payload = {
      tenant_id: tenantId,
      title: formData.title,
      description: formData.description || null,
      deadline_at: formData.deadline_at
        ? new Date(formData.deadline_at).toISOString()
        : null,
      status: formData.status,
    };

    let quoteId = id ? parseInt(id) : null;
    let error;

    if (isEditing && id) {
      const result = await supabase
        .from("quotes")
        .update(payload)
        .eq("id", parseInt(id));
      error = result.error;
    } else {
      const result = await supabase
        .from("quotes")
        .insert(payload)
        .select()
        .single();
      error = result.error;
      if (result.data) {
        quoteId = result.data.id;
      }
    }

    if (error) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Cotação salva", variant: "success" });
      if (!isEditing && quoteId) {
        navigate(`/quotes/${quoteId}`);
      }
    }

    setSaving(false);
  };

  const handleAddItem = async (item: { product_id: string; package_id: string; requested_qty: string }) => {
    if (!id || !item.product_id) return;
    const quoteId = parseInt(id);

    // Check for duplicate product
    const isDuplicate = items.some(
      existingItem => existingItem.product_id === parseInt(item.product_id)
    );

    if (isDuplicate) {
      const productName = products.find(p => p.id === parseInt(item.product_id))?.name || 'Produto';
      toast({
        title: 'Produto duplicado',
        description: `${productName} já foi adicionado a esta cotação. Remova o item existente antes de adicionar novamente.`,
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from("quote_items").insert({
      quote_id: quoteId,
      product_id: parseInt(item.product_id),
      package_id: item.package_id ? parseInt(item.package_id) : null,
      requested_qty: item.requested_qty
        ? parseFloat(item.requested_qty)
        : null,
      sort_order: items.length,
    });

    if (error) {
      toast({
        title: "Erro ao adicionar item",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchQuote();
    }
  };

  const handleRemoveItem = async (itemId: number) => {
    const { error } = await supabase
      .from("quote_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Erro ao remover item",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchQuote();
    }
  };

  const handleUpdateItem = async (itemId: number, updates: Partial<QuoteItem>) => {
    // Optimistic update
    setItems(items.map(item => item.id === itemId ? { ...item, ...updates } : item));

    const { error } = await supabase
      .from("quote_items")
      .update(updates)
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Erro ao atualizar item",
        description: error.message,
        variant: "destructive",
      });
      fetchQuote(); // Revert on error
    } else {
      toast({
        title: "Item atualizado",
        duration: 1500,
        variant: "success"
      });
      // Optionally refetch or keep optimistic state if simple
      // fetchQuote(); 
    }
  };

  const handleOpenImportModal = async () => {
    if (!selectedListId) return;
    const listId = parseInt(selectedListId);

    const { data: listItems } = await supabase
      .from("product_list_items")
      .select("product_id, preferred_package_id, default_qty")
      .eq("list_id", listId);

    if (listItems && listItems.length > 0) {
      // Map list items with product info
      // Map list items with product info, skipping invalid products
      const importItems: ImportListItem[] = [];
      let skippedCount = 0;

      listItems.forEach((item) => {
        const product = products.find((p) => p.id === item.product_id);

        if (!product) {
          skippedCount++;
          return;
        }

        const validPackage = product.packages.find((pkg) => pkg.id === item.preferred_package_id);
        const defaultPackage = product.packages.find((pkg) => pkg.is_default);

        importItems.push({
          product_id: item.product_id,
          product_name: product.name,
          package_id: validPackage ? validPackage.id : (defaultPackage?.id || null),
          requested_qty: item.default_qty?.toString() || "",
          packages: product.packages || [],
        });
      });

      if (skippedCount > 0) {
        toast({
          title: "Alguns itens foram ignorados",
          description: `${skippedCount} produtos da lista não foram encontrados ou estão inativos.`,
          variant: "warning",
        });
      }

      setImportListItems(importItems);
      setImportModalOpen(true);
    } else {
      toast({
        title: "Lista vazia",
        description: "A lista selecionada não possui itens.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmImport = async () => {
    if (!id) return;
    const quoteId = parseInt(id);

    // Check if all items have quantity
    const hasEmptyQty = importListItems.some((item) => !item.requested_qty || parseFloat(item.requested_qty) <= 0);
    if (hasEmptyQty) {
      toast({
        title: "Quantidade obrigatória",
        description: "Informe a quantidade para todos os itens antes de importar.",
        variant: "destructive",
      });
      return;
    }

    setImportingList(true);

    const { error } = await supabase.from("quote_items").insert(
      importListItems.map((item, index) => ({
        quote_id: quoteId,
        product_id: item.product_id,
        package_id: item.package_id,
        requested_qty: parseFloat(item.requested_qty),
        sort_order: items.length + index,
      }))
    );

    if (error) {
      toast({
        title: "Erro ao importar lista",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Lista importada", variant: "success" });
      setSelectedListId("");
      setImportModalOpen(false);
      setImportListItems([]);
      fetchQuote();
    }
    setImportingList(false);
  };

  const updateImportItem = (index: number, field: "package_id" | "requested_qty", value: string) => {
    setImportListItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, [field]: field === "package_id" ? (value ? parseInt(value) : null) : value }
          : item
      )
    );
  };

  const handleAddSuppliers = async (supplierIds: number[]) => {
    if (!id || supplierIds.length === 0) return;
    const quoteId = parseInt(id);

    const newSuppliers = supplierIds.filter(
      (id) => !quoteSuppliers.some((qs) => qs.supplier_id === id)
    );

    if (newSuppliers.length === 0) {
      toast({
        title: "Fornecedores já adicionados",
        description: "Todos os fornecedores selecionados já estão na lista.",
      });
      return;
    }

    const { error } = await supabase.from("quote_suppliers").insert(
      newSuppliers.map((supplierId) => ({
        quote_id: quoteId,
        supplier_id: supplierId,
      }))
    );

    if (error) {
      toast({
        title: "Erro ao adicionar fornecedores",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Fornecedores adicionados",
        description: `${newSuppliers.length} fornecedor(es) adicionado(s) com sucesso.`,
        variant: "success"
      });
      fetchQuote();
    }
  };

  const handleRemoveSupplier = async (supplierId: number) => {
    const { error } = await supabase
      .from("quote_suppliers")
      .delete()
      .eq("id", supplierId);

    if (error) {
      toast({
        title: "Erro ao remover fornecedor",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchQuote();
    }
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/supplier/quote/${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copiado!", variant: "success" });
  };

  const handleStatusChange = (action: "open" | "close" | "cancel") => {
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!id) return;
    const quoteId = parseInt(id);

    const statusMap: Record<string, "open" | "closed" | "cancelled"> = {
      open: "open",
      close: "closed",
      cancel: "cancelled",
    };

    const newStatus = statusMap[confirmAction];

    // If closing the quote, perform validation checks
    if (confirmAction === "close") {
      try {
        // 1. Fetch available responses to validate winners
        const { data: responses } = await supabase
          .from("quote_responses")
          .select("id, quote_item_id, quote_supplier_id, price")
          .gt("price", 0); // Only consider valid prices

        if (responses) {
          const undecidedItems: string[] = [];
          const autoSelectUpdates: PromiseLike<any>[] = [];

          // Check each item
          items.forEach((item) => {
            // If already has a winner, skip
            if (item.winner_supplier_id) return;

            // Get valid responses for this item
            const itemResponses = responses.filter(r => r.quote_item_id === item.id);

            if (itemResponses.length === 0) {
              // No responses - ignore or warn? For now ignore.
              return;
            }

            if (itemResponses.length === 1) {
              // Auto-select the only option
              const winnerResponse = itemResponses[0];
              const supplier = quoteSuppliers.find(qs => qs.id === winnerResponse.quote_supplier_id);

              if (supplier) {
                console.log(`Auto-selecting item ${item.product.name} (ID: ${item.id})`);
                autoSelectUpdates.push(
                  supabase
                    .from("quote_items")
                    .update({
                      winner_supplier_id: supplier.supplier_id,
                      winner_response_id: winnerResponse.id,
                      winner_reason: "lowest_price", // Default reason
                      winner_set_at: new Date().toISOString(),
                    })
                    .eq("id", item.id)
                    .then()
                );
              }
            } else {
              // Multiple options and no winner selected
              undecidedItems.push(item.product.name);
            }
          });

          // Block if there are conflicts
          if (undecidedItems.length > 0) {
            setConfirmOpen(false);
            setUndecidedItemsList(undecidedItems);
            setValidationErrorOpen(true);
            return;
          }

          // Apply auto-selections if any
          if (autoSelectUpdates.length > 0) {
            await Promise.all(autoSelectUpdates);
            toast({
              title: "Seleção automática",
              description: `${autoSelectUpdates.length} itens com oferta única foram selecionados automaticamente.`,
              variant: "default",
            });
          }
        }

        // Proceed to create snapshot
        const { error: snapshotError } = await supabase.rpc("create_quote_snapshot", {
          p_quote_id: quoteId,
        });

        if (snapshotError) {
          console.error("Error creating snapshot:", snapshotError);
        }

        // Save price history for winners
        const { error: historyError } = await supabase.rpc("save_price_history_from_quote", {
          p_quote_id: quoteId,
        });

        if (historyError) {
          console.error("Error saving price history:", historyError);
        }
      } catch (err) {
        console.error("Error in post-close operations:", err);
      }
    }

    const { error } = await supabase
      .from("quotes")
      .update({ status: newStatus })
      .eq("id", quoteId);

    if (error) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    } else {
      if (confirmAction === "close") {
        toast({
          title: "Cotação encerrada!",
          description: "Snapshot e histórico de preços foram salvos.",
          variant: "success"
        });
      } else if (confirmAction === "open") {
        try {
          // Fetch fresh suppliers data to ensure we have tokens
          const { data: suppliersData } = await supabase
            .from("quote_suppliers")
            .select(`
              id,
              public_token,
              supplier:suppliers(name, email)
            `)
            .eq("quote_id", quoteId);

          if (suppliersData && suppliersData.length > 0) {
            let emailCount = 0;
            const baseUrl = window.location.origin;

            await Promise.all(
              suppliersData.map(async (qs: any) => {
                if (qs.supplier?.email && qs.public_token) {
                  const link = `${baseUrl}/supplier/quote/${qs.public_token}`;
                  const html = mailService.generateQuoteInvitation(
                    formData.title,
                    qs.supplier.name,
                    link,
                    formData.description
                  );

                  await mailService.sendEmail({
                    to: [qs.supplier.email],
                    subject: `Convite para Cotação: ${formData.title}`,
                    html
                  });
                  emailCount++;
                }
              })
            );

            if (emailCount > 0) {
              toast({
                title: "Status atualizado e e-mails enviados",
                description: `${emailCount} fornecedores foram notificados.`,
                variant: "success"
              });
            } else {
              toast({ title: "Status atualizado", variant: "success" });
            }
          } else {
            toast({ title: "Status atualizado", variant: "success" });
          }
        } catch (mailErr) {
          console.error("Error sending emails:", mailErr);
          toast({
            title: "Status atualizado, mas houve erro no envio de e-mails",
            variant: "destructive"
          });
        }
      } else {
        toast({ title: "Status atualizado", variant: "success" });
      }
      fetchQuote();
    }
    setConfirmOpen(false);
  };

  const actionLabels = {
    open: { title: "Abrir cotação", desc: "Isso permitirá que fornecedores enviem suas propostas." },
    close: { title: "Encerrar cotação", desc: "Isso impedirá novos envios de propostas." },
    cancel: { title: "Cancelar cotação", desc: "A cotação será marcada como cancelada." },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title={isEditing ? "Editar Cotação" : "Nova Cotação"}
        description={isEditing && formData.status !== 'draft' ?
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={formData.status as any} />
            <span className="text-muted-foreground">•</span>
            <span>{formData.title}</span>
          </div>
          : (isEditing ? formData.title : "Preencha os dados da cotação")
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/quotes")} className="h-8">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="h-8 gap-2 px-3">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar
            </Button>

            {isEditing && formData.status === "draft" && (
              <Button
                variant="default"
                className="bg-success hover:bg-success/90 h-8 gap-2 px-3"
                onClick={() => handleStatusChange("open")}
                title="Abrir Cotação"
              >
                <Send className="h-4 w-4" />
                Abrir Cotação
              </Button>
            )}

            {isEditing && formData.status === "open" && (
              <Button
                onClick={() => handleStatusChange("close")}
                className="gap-2 bg-yellow-600 hover:bg-yellow-700 text-white h-8"
              >
                <CheckCircle className="h-4 w-4" />
                Encerrar
              </Button>
            )}

            {isEditing && formData.status === "closed" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange("open")}
                  className="gap-2 h-8"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reabrir
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPOModalOpen(true)}
                  className="gap-2 h-8"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Gerar Pedido
                </Button>
              </>
            )}

            {isEditing && formData.status !== "cancelled" && formData.status !== "draft" && (
              <Button
                variant="destructive"
                onClick={() => handleStatusChange("cancel")}
                className="gap-2 h-8"
              >
                <XCircle className="h-4 w-4" />
                Cancelar
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6 animate-fade-in">
        <Tabs defaultValue="data">
          <TabsList>
            <TabsTrigger value="data">Detalhes</TabsTrigger>
            {isEditing && (
              <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
            )}
            {isEditing && formData.status !== "draft" && (
              <TabsTrigger value="responses" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Respostas
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="data" className="space-y-6 mt-6">
            <Card>
              <div className="grid grid-cols-12 gap-6 p-6">
                <div className="col-span-12 md:col-span-5 space-y-2">
                  <Label htmlFor="title">Título da Cotação</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Título da cotação"
                    required
                  />
                </div>

                {isEditing && (
                  <>
                    <div className="col-span-6 md:col-span-2 space-y-2">
                      <Label>Data de Criação</Label>
                      <div className="h-10 flex items-center px-3 border rounded-md bg-muted text-sm text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                        {formData.created_at ? new Date(formData.created_at).toLocaleDateString() : "-"}
                      </div>
                    </div>

                    <div className="col-span-6 md:col-span-2 space-y-2">
                      <Label>Quem Criou</Label>
                      <div className="h-10 flex items-center px-3 border rounded-md bg-muted text-sm text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                        {creatorName || "Sistema"}
                      </div>
                    </div>
                  </>
                )}

                <div className="col-span-12 md:col-span-3 space-y-2">
                  <Label htmlFor="deadline">Prazo da Cotação</Label>
                  <div className="flex gap-2">
                    <Input
                      id="deadline-date"
                      type="date"
                      value={formData.deadline_at ? formData.deadline_at.split('T')[0] : ""}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        if (!newDate) {
                          setFormData({ ...formData, deadline_at: "" });
                          return;
                        }
                        const currentTime = formData.deadline_at ? formData.deadline_at.split('T')[1] : "12:00";
                        setFormData({ ...formData, deadline_at: `${newDate}T${currentTime}` });
                      }}
                      className="flex-1"
                    />
                    <Input
                      id="deadline-time"
                      type="time"
                      value={formData.deadline_at ? formData.deadline_at.split('T')[1] : ""}
                      onChange={(e) => {
                        const newTime = e.target.value;
                        const currentDate = formData.deadline_at ? formData.deadline_at.split('T')[0] : "";
                        if (currentDate) {
                          setFormData({ ...formData, deadline_at: `${currentDate}T${newTime}` });
                        }
                      }}
                      disabled={!formData.deadline_at}
                      className="w-24"
                    />
                  </div>
                </div>
              </div>

            </Card>

            {isEditing && (
              <>
                <div className="mb-4">
                  <QuoteItemAdder
                    products={products}
                    onAddItem={handleAddItem}
                    loading={saving}
                  />
                </div>

                {/* <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Itens da Cotação</CardTitle>
                    </div>
                  </CardHeader> */}
                {/* <CardContent> */}
                <QuoteItemsTab
                  items={items}
                  products={products}
                  isEditing={isEditing}
                  onRemoveItem={handleRemoveItem}
                  onUpdateItem={handleUpdateItem}
                  onImportList={() => setImportModalOpen(true)}
                  loading={saving}
                />
                {/* </CardContent> */}

              </>
            )}
          </TabsContent>

          {isEditing && (
            <TabsContent value="suppliers" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Fornecedores Convidados</CardTitle>
                </CardHeader>
                <CardContent>
                  <QuoteSuppliersTab
                    quoteSuppliers={quoteSuppliers}
                    suppliers={suppliers}
                    onAddSuppliers={handleAddSuppliers}
                    onRemoveSupplier={handleRemoveSupplier}
                    onCopyLink={copyLink}
                    loading={saving}
                    quoteStatus={formData.status}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isEditing && formData.status !== "draft" && (
            <TabsContent value="responses" className="mt-6">
              <QuoteResponsesMatrix
                quoteId={parseInt(id!)}
                quoteStatus={formData.status}
                onWinnerChange={fetchQuote}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={actionLabels[confirmAction].title}
        description={actionLabels[confirmAction].desc}
        onConfirm={confirmStatusChange}
        variant={confirmAction === "cancel" ? "destructive" : "default"}
      />

      <AlertDialog open={validationErrorOpen} onOpenChange={setValidationErrorOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Atenção: Ação Necessária</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                <div className="mt-2">
                  <p className="mb-3 font-medium text-foreground">
                    Não é possível encerrar a cotação pois existem itens com múltiplas ofertas sem um vencedor definido.
                  </p>
                  <p className="mb-2">Por favor, defina o vencedor para os seguintes itens:</p>
                  <div className="bg-muted p-3 rounded-md max-h-[150px] overflow-y-auto mb-3">
                    <ul className="list-disc pl-4 space-y-1">
                      {undecidedItemsList.map((name, i) => (
                        <li key={i} className="text-sm font-medium">{name}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-muted-foreground">
                    Acesse a aba <strong>Respostas</strong> e selecione os vencedores antes de encerrar.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setValidationErrorOpen(false)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuoteImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        productLists={productLists}
        selectedListId={selectedListId}
        setSelectedListId={setSelectedListId}
        importListItems={importListItems}
        onOpenImportModal={handleOpenImportModal}
        onConfirmImport={handleConfirmImport}
        onUpdateImportItem={updateImportItem}
        importingList={importingList}
      />

      <GeneratePOModal
        quoteId={id ? parseInt(id) : 0}
        open={poModalOpen}
        onOpenChange={setPOModalOpen}
        suppliers={poSuppliers}
      />
    </div>
  );
}
