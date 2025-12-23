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

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    deadline_at: "",
    status: "draft" as "draft" | "open" | "closed" | "cancelled",
  });

  const [items, setItems] = useState<QuoteItem[]>([]);
  const [quoteSuppliers, setQuoteSuppliers] = useState<QuoteSupplier[]>([]);

  const [newItem, setNewItem] = useState({
    product_id: "",
    package_id: "",
    requested_qty: "",
  });


  const [selectedListId, setSelectedListId] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"open" | "close" | "cancel">(
    "open"
  );

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
          ? new Date(quote.deadline_at).toISOString().slice(0, 16)
          : "",
        status: quote.status,
      });
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
      deadline_at: formData.deadline_at || null,
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
      toast({ title: "Cotação salva" });
      if (!isEditing && quoteId) {
        navigate(`/quotes/${quoteId}`);
      }
    }

    setSaving(false);
  };

  const handleAddItem = async () => {
    if (!id || !newItem.product_id) return;
    const quoteId = parseInt(id);

    // Check for duplicate product
    const isDuplicate = items.some(
      item => item.product_id === parseInt(newItem.product_id)
    );

    if (isDuplicate) {
      const productName = products.find(p => p.id === parseInt(newItem.product_id))?.name || 'Produto';
      toast({
        title: 'Produto duplicado',
        description: `${productName} já foi adicionado a esta cotação. Remova o item existente antes de adicionar novamente.`,
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from("quote_items").insert({
      quote_id: quoteId,
      product_id: parseInt(newItem.product_id),
      package_id: newItem.package_id ? parseInt(newItem.package_id) : null,
      requested_qty: newItem.requested_qty
        ? parseFloat(newItem.requested_qty)
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
      setNewItem({ product_id: "", package_id: "", requested_qty: "" });
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

  const handleOpenImportModal = async () => {
    if (!selectedListId) return;
    const listId = parseInt(selectedListId);

    const { data: listItems } = await supabase
      .from("product_list_items")
      .select("product_id, preferred_package_id, default_qty")
      .eq("list_id", listId);

    if (listItems && listItems.length > 0) {
      // Map list items with product info
      const importItems: ImportListItem[] = listItems.map((item) => {
        const product = products.find((p) => p.id === item.product_id);
        const defaultPackage = product?.packages.find((pkg) => pkg.is_default);
        return {
          product_id: item.product_id,
          product_name: product?.name || "Produto não encontrado",
          package_id: item.preferred_package_id || defaultPackage?.id || null,
          requested_qty: item.default_qty?.toString() || "",
          packages: product?.packages || [],
        };
      });
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
      toast({ title: "Lista importada" });
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
    toast({ title: "Link copiado!" });
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

    // If closing the quote, create snapshot and save price history
    if (confirmAction === "close") {
      try {
        // Create snapshot
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
          description: "Snapshot e histórico de preços foram salvos."
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
                description: `${emailCount} fornecedores foram notificados.`
              });
            } else {
              toast({ title: "Status atualizado" });
            }
          } else {
            toast({ title: "Status atualizado" });
          }
        } catch (mailErr) {
          console.error("Error sending emails:", mailErr);
          toast({
            title: "Status atualizado, mas houve erro no envio de e-mails",
            variant: "destructive"
          });
        }
      } else {
        toast({ title: "Status atualizado" });
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
        description={isEditing ? formData.title : "Preencha os dados da cotação"}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/quotes")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
            {isEditing && formData.status === "draft" && (
              <Button
                variant="default"
                className="bg-success hover:bg-success/90"
                onClick={() => handleStatusChange("open")}
              >
                <Send className="h-4 w-4 mr-2" />
                Abrir Cotação
              </Button>
            )}
            {isEditing && formData.status === "open" && (
              <Button
                variant="default"
                className="bg-warning hover:bg-warning/90"
                onClick={() => handleStatusChange("close")}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Encerrar
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6 animate-fade-in">
        {isEditing && (
          <div className="flex items-center gap-2">
            <StatusBadge status={formData.status as any} />
            {formData.status === "closed" && (
              <Button
                variant="default"
                className="bg-success hover:bg-success/90"
                onClick={() => setPOModalOpen(true)}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Gerar Purchase Orders
              </Button>
            )}
            {formData.status !== "cancelled" && formData.status !== "draft" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => handleStatusChange("cancel")}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancelar Cotação
              </Button>
            )}
          </div>
        )}

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
              <CardHeader>
                <CardTitle>Informações da Cotação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título</Label>
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
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Prazo</Label>
                    <Input
                      id="deadline"
                      type="datetime-local"
                      value={formData.deadline_at}
                      onChange={(e) =>
                        setFormData({ ...formData, deadline_at: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Descrição (opcional)"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {isEditing && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Itens da Cotação</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <QuoteItemsTab
                    items={items}
                    products={products}
                    isEditing={isEditing}
                    newItem={newItem}
                    setNewItem={setNewItem}
                    onAddItem={handleAddItem}
                    onRemoveItem={handleRemoveItem}
                    onImportList={() => setImportModalOpen(true)}
                    loading={saving}
                  />
                </CardContent>
              </Card>
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
