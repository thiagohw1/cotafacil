import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileText, Save, Send, Loader2, Clock, CheckCircle, MessageSquare, Tags, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencyInput } from "@/components/ui/currency-input";

interface QuoteItem {
  id: number;
  product: { name: string };
  package: { unit: string; multiplier: number } | null;
  requested_qty: number | null;
}

interface PricingTier {
  min_quantity: number;
  price: number;
}

interface QuoteResponse {
  quote_item_id: number;
  price: string;
  notes: string;
  pricing_tiers: PricingTier[];
}

interface QuoteData {
  quote_supplier_id: number;
  quote_id: number;
  supplier_id: number;
  status: string;
  submitted_at: string | null;
  quote_status: string;
  quote_title: string;
  quote_description: string | null;
  quote_deadline: string | null;
  supplier_name?: string;
}

export default function SupplierQuote() {
  const { token } = useParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [tierModalOpen, setTierModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [responses, setResponses] = useState<Record<number, QuoteResponse>>({});
  const [deliveryDays, setDeliveryDays] = useState<string>("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (token) {
      fetchQuoteData();
    }
  }, [token]);

  const fetchQuoteData = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc("get_public_quote_data", { p_token: token });

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("Cotação não encontrada");
      }

      // The new RPC returns a JSON object with all the data
      // We need to cast it to our types or map it
      const result = data as any;

      const quoteInfo = result.quote;
      const supplierData = result.supplier;
      const quoteItems = result.items;
      const existingResponses = result.responses;

      setQuoteData({
        ...quoteInfo,
        supplier_name: supplierData?.name || "Fornecedor",
      });

      // Map items to match QuoteItem interface
      // The RPC returns items with product name and package info nested
      const mappedItems: QuoteItem[] = quoteItems.map((item: any) => ({
        id: item.id,
        product: item.product,
        package: item.package,
        requested_qty: item.requested_qty
      }));

      setItems(mappedItems);

      const responsesMap: Record<number, QuoteResponse> = {};
      let existingDeliveryDays = "";

      if (existingResponses && Array.isArray(existingResponses)) {
        existingResponses.forEach((r: any) => {
          responsesMap[r.quote_item_id] = {
            quote_item_id: r.quote_item_id,
            price: r.price?.toString() || "",
            notes: r.notes || "",
            pricing_tiers: Array.isArray(r.pricing_tiers) ? r.pricing_tiers : [],
          };
          if (!existingDeliveryDays && r.delivery_days) {
            existingDeliveryDays = r.delivery_days.toString();
          }
        });
      }

      setResponses(responsesMap);
      setDeliveryDays(existingDeliveryDays);
    } catch (error: any) {
      console.error("Error fetching quote:", error);
      toast({
        title: "Cotação não encontrada",
        description: "O link pode estar incorreto ou expirado.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateResponse = (itemId: number, field: string, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quote_item_id: itemId,
        [field]: value,
      },
    }));
  };

  const handleUpdateTiers = (itemId: number, tiers: PricingTier[]) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quote_item_id: itemId,
        pricing_tiers: tiers,
      },
    }));
  };

  const parseNumber = (value: string) => {
    if (!value) return null;
    return parseFloat(value.replace(",", "."));
  };

  const handleSave = async () => {
    if (!quoteData || !token) return;
    setSaving(true);

    const responsesToSave = Object.values(responses).filter(
      (r) => r.price || r.notes || (r.pricing_tiers && r.pricing_tiers.length > 0)
    );

    let hasError = false;
    for (const response of responsesToSave) {
      const { data, error } = await supabase.rpc("save_supplier_response", {
        p_token: token,
        p_quote_item_id: response.quote_item_id,
        p_price: parseNumber(response.price),
        p_min_qty: null,
        p_delivery_days: deliveryDays ? parseInt(deliveryDays) : null,
        p_notes: response.notes || null,
        p_pricing_tiers: response.pricing_tiers && response.pricing_tiers.length > 0 ? response.pricing_tiers : null
      });

      if (error || data === false) {
        console.error("Error saving response:", error);
        hasError = true;
        break;
      }
    }

    if (hasError) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as respostas. Verifique os dados ou tente novamente.",
        variant: "destructive",
      });
    } else {
      setLastSaved(new Date());
      toast({ title: "Salvo com sucesso", variant: "success" });
    }
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!quoteData || !token) return;
    setSubmitting(true);

    await handleSave();

    const { data, error } = await supabase.rpc("submit_supplier_quote", {
      p_token: token,
    });

    if (error || data === false) {
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar a cotação. A cotação pode estar expirada.",
        variant: "destructive",
      });
    } else {
      const isUpdate = !!quoteData?.submitted_at;
      toast({
        title: isUpdate ? "Preços atualizados com sucesso!" : "Cotação enviada com sucesso!",
        variant: "success"
      });
      fetchQuoteData();
    }
    setSubmitting(false);
  };

  const openNotesModal = (itemId: number) => {
    setSelectedItemId(itemId);
    setNotesModalOpen(true);
  };

  const isExpired =
    quoteData?.quote_deadline && new Date(quoteData.quote_deadline) < new Date();
  const isClosed = quoteData?.quote_status !== "open";
  const isSubmitted = !!quoteData?.submitted_at;
  const isDisabled = isExpired || isClosed;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!quoteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Cotação não encontrada</h2>
            <p className="text-muted-foreground">
              O link pode estar incorreto ou a cotação foi removida.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Modern Sticky Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none tracking-tight">CotaFácil</h1>
              <p className="text-xs text-muted-foreground font-medium">Portal do Fornecedor</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{quoteData.supplier_name}</p>
              <p className="text-xs text-muted-foreground mt-1">Fornecedor Convidado</p>
            </div>
            <div className="h-8 w-8 bg-muted rounded-full flex items-center justify-center sm:hidden">
              <span className="text-xs font-medium">{quoteData.supplier_name?.charAt(0)}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Quote Info Card - Clean & Modern */}
        <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
          <Card className="shadow-sm border-none ring-1 ring-border">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-2xl font-bold tracking-tight">{quoteData.quote_title}</CardTitle>
                    <StatusBadge status={quoteData.quote_status as any} />
                  </div>
                  {quoteData.quote_description && (
                    <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
                      {quoteData.quote_description}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-md border border-transparent">
                  <Clock className="h-4 w-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">Prazo para Envio</span>
                    <span className="font-medium">
                      {quoteData.quote_deadline
                        ? format(new Date(quoteData.quote_deadline), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : "Sem prazo definido"
                      }
                    </span>
                  </div>
                </div>

                {isSubmitted && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 text-green-700 rounded-md border border-green-100">
                    <CheckCircle className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-semibold text-green-600">Status do Envio</span>
                      <span className="font-medium">
                        Enviado em {format(new Date(quoteData.submitted_at!), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Condições Gerais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="delivery-days" className="text-xs uppercase text-muted-foreground font-semibold">
                    Prazo de Entrega (em dias)
                  </Label>
                  <Input
                    id="delivery-days"
                    type="number"
                    min="0"
                    placeholder="Ex: 5"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(e.target.value)}
                    disabled={isDisabled}
                    className="bg-muted/30"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isDisabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3 text-amber-800">
            <Clock className="h-5 w-5 flex-shrink-0" />
            <p className="font-medium text-sm">
              {isExpired
                ? "O prazo para envio desta cotação expirou. Não é mais possível enviar propostas."
                : "Esta cotação foi encerrada e não aceita mais respostas."}
            </p>
          </div>
        )}

        <Card className="shadow-sm border-none ring-1 ring-border overflow-hidden">
          <CardHeader className="bg-muted/30 border-b py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Tags className="h-4 w-4 text-muted-foreground" />
                Itens da Cotação
              </CardTitle>
              <div className="text-xs text-muted-foreground font-medium bg-background px-3 py-1 rounded-full border">
                {items.length} {items.length === 1 ? 'item' : 'itens'} listados
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[30%] font-semibold">Produto</TableHead>
                    <TableHead className="w-[10%] font-semibold">Embalagem</TableHead>
                    <TableHead className="w-[10%] font-semibold text-center">Qtd. Sol.</TableHead>
                    <TableHead className="w-[20%] font-semibold">Preço Emb.</TableHead>
                    <TableHead className="w-[20%] font-semibold">Preço Unit.</TableHead>
                    <TableHead className="w-[5%] text-center">Cond.</TableHead>
                    <TableHead className="w-[5%] text-center">Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const multiplier = item.package?.multiplier || 1;
                    const packagePrice = responses[item.id]?.price || "";
                    const unitPrice = packagePrice ? (parseFloat(packagePrice) / multiplier).toFixed(2) : "";
                    const hasTiers = responses[item.id]?.pricing_tiers?.length > 0;
                    const hasNotes = !!responses[item.id]?.notes;

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="font-medium text-foreground py-4">
                          {item.product.name}
                        </TableCell>
                        <TableCell>
                          {item.package ? (
                            <div className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                              {item.package.unit}
                              {item.package.multiplier > 1 && `-${item.package.multiplier}`}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-mono text-sm bg-muted/50 px-2 py-1 rounded">{item.requested_qty || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <CurrencyInput
                            value={packagePrice}
                            onChange={(value) => updateResponse(item.id, "price", value)}
                            disabled={isDisabled}
                            className="bg-background border-input focus:ring-2 focus:ring-primary/20 w-36 transition-all"
                            placeholder="0,00"
                          />
                        </TableCell>
                        <TableCell>
                          <CurrencyInput
                            value={unitPrice}
                            onChange={(value) => {
                              if (!value) {
                                updateResponse(item.id, "price", "");
                                return;
                              }
                              const newPackagePrice = (parseFloat(value) * multiplier).toFixed(2);
                              updateResponse(item.id, "price", newPackagePrice);
                            }}
                            disabled={isDisabled}
                            className="bg-muted/20 text-muted-foreground w-36"
                            placeholder="0,00"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant={hasTiers ? "secondary" : "ghost"}
                            size="icon"
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setTierModalOpen(true);
                            }}
                            disabled={isDisabled}
                            className={`h-9 w-9 rounded-full ${hasTiers ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground"}`}
                            title="Condições de Preço"
                          >
                            <Tags className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant={hasNotes ? "secondary" : "ghost"}
                            size="icon"
                            onClick={() => openNotesModal(item.id)}
                            disabled={isDisabled}
                            className={`h-9 w-9 rounded-full ${hasNotes ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" : "text-muted-foreground"}`}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Modern Card View */}
            <div className="md:hidden divide-y divide-border">
              {items.map((item) => {
                const multiplier = item.package?.multiplier || 1;
                const packagePrice = responses[item.id]?.price || "";
                const unitPrice = packagePrice ? (parseFloat(packagePrice) / multiplier).toFixed(2) : "";
                const hasTiers = responses[item.id]?.pricing_tiers?.length > 0;
                const hasNotes = !!responses[item.id]?.notes;

                return (
                  <div key={item.id} className="p-4 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-base leading-tight">{item.product.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {item.package ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                              {item.package.unit}
                              {item.package.multiplier > 1 && ` x${item.package.multiplier}`}
                            </span>
                          ) : (
                            <span>Unidade</span>
                          )}
                          <span>•</span>
                          <span>Qtd: {item.requested_qty || "-"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openNotesModal(item.id)}
                          disabled={isDisabled}
                          className={`h-8 w-8 ${hasNotes ? "text-yellow-600 bg-yellow-50" : "text-muted-foreground"}`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Preço Embalagem</label>
                        <CurrencyInput
                          value={packagePrice}
                          onChange={(value) => updateResponse(item.id, "price", value)}
                          disabled={isDisabled}
                          className="h-10 border-input"
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Preço Unitário</label>
                        <CurrencyInput
                          value={unitPrice}
                          onChange={(value) => {
                            if (!value) {
                              updateResponse(item.id, "price", "");
                              return;
                            }
                            const newPackagePrice = (parseFloat(value) * multiplier).toFixed(2);
                            updateResponse(item.id, "price", newPackagePrice);
                          }}
                          disabled={isDisabled}
                          className="h-10 bg-muted/20"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedItemId(item.id);
                        setTierModalOpen(true);
                      }}
                      disabled={isDisabled}
                      className={`w-full text-xs h-9 ${hasTiers ? "border-primary text-primary bg-primary/5" : "text-muted-foreground"}`}
                    >
                      <Tags className="h-3 w-3 mr-2" />
                      {hasTiers ? `${responses[item.id]?.pricing_tiers.length} condições ativas` : "Adicionar Condições Especiais"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {!isDisabled && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t z-50">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                {lastSaved ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    Salvo às {format(lastSaved, "HH:mm:ss", { locale: ptBR })}
                  </>
                ) : (
                  "Alterações não salvas"
                )}
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 sm:flex-none border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Rascunho
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 sm:flex-none bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isSubmitted ? "Atualizar Proposta" : "Enviar Proposta Final"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Dialog open={notesModalOpen} onOpenChange={setNotesModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Observações do Item</DialogTitle>
            <DialogDescription>
              Adicione observações específicas para este item da cotação.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="item-notes">Observações</Label>
            <Textarea
              id="item-notes"
              value={selectedItemId ? responses[selectedItemId]?.notes || "" : ""}
              onChange={(e) =>
                selectedItemId &&
                updateResponse(selectedItemId, "notes", e.target.value)
              }
              placeholder="Informe detalhes adicionais sobre este item..."
              rows={4}
              disabled={isDisabled}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setNotesModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tierModalOpen} onOpenChange={setTierModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Condições de Preço por Quantidade</DialogTitle>
            <DialogDescription>
              Defina preços diferenciados baseados na quantidade adquirida.
            </DialogDescription>
          </DialogHeader>
          <PricingTiersForm
            tiers={selectedItemId ? responses[selectedItemId]?.pricing_tiers || [] : []}
            onChange={(tiers) => selectedItemId && handleUpdateTiers(selectedItemId, tiers)}
            disabled={isDisabled}
            basePrice={selectedItemId ? parseFloat(responses[selectedItemId]?.price || "0") : 0}
          />
          <DialogFooter>
            <Button onClick={() => setTierModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PricingTiersForm({ tiers, onChange, disabled, basePrice }: { tiers: PricingTier[], onChange: (t: PricingTier[]) => void, disabled: boolean, basePrice: number }) {
  const [newQty, setNewQty] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const handleAdd = () => {
    if (!newQty || !newPrice) return;
    const qty = parseFloat(newQty);
    const price = parseFloat(newPrice);
    if (qty <= 0 || price < 0) return;

    onChange([...tiers, { min_quantity: qty, price }]);
    setNewQty("");
    setNewPrice("");
  };

  const handleRemove = (index: number) => {
    onChange(tiers.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Adicione condições para preços diferenciados baseados na quantidade comprada.
        {basePrice > 0 && <p className="mt-1">Preço base: {basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
      </div>

      {!disabled && (
        <div className="flex gap-2 items-end">
          <div className="space-y-1 flex-1">
            <Label>A partir de (Qtde)</Label>
            <Input type="number" value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="Ex: 10" />
          </div>
          <div className="space-y-1 flex-1">
            <Label>Novo Preço Unit.</Label>
            <Input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Ex: 8,90" />
          </div>
          <Button onClick={handleAdd} disabled={!newQty || !newPrice}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Qtde Mín.</TableHead>
              <TableHead>Preço Unit.</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                  Nenhuma condição adicionada.
                </TableCell>
              </TableRow>
            ) : (
              tiers.sort((a, b) => a.min_quantity - b.min_quantity).map((tier, idx) => (
                <TableRow key={idx}>
                  <TableCell>{tier.min_quantity}</TableCell>
                  <TableCell>
                    {tier.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    {basePrice > 0 && tier.price < basePrice && <span className="text-xs text-green-600 ml-1">(-{Math.round((1 - tier.price / basePrice) * 100)}%)</span>}
                  </TableCell>
                  <TableCell>
                    {!disabled && (
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(idx)} className="text-destructive h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}