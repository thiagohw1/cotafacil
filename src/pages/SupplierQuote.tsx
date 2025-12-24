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
  min_qty: string;
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

    const { data: quoteInfo, error: quoteError } = await supabase
      .rpc("get_quote_by_token", { p_token: token });

    if (quoteError || !quoteInfo || quoteInfo.length === 0) {
      toast({
        title: "Cotação não encontrada",
        description: "O link pode estar incorreto ou expirado.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const info = quoteInfo[0];

    const { data: supplierData } = await supabase
      .from("suppliers")
      .select("name")
      .eq("id", info.supplier_id)
      .single();

    await supabase.rpc("update_supplier_access", { p_token: token });

    setQuoteData({
      ...info,
      supplier_name: supplierData?.name || "Fornecedor",
    });

    const { data: quoteItems } = await supabase
      .from("quote_items")
      .select(`
        id,
        requested_qty,
        product:products(name),
        package:product_packages(unit, multiplier)
      `)
      .eq("quote_id", info.quote_id)
      .order("sort_order");

    setItems((quoteItems as any) || []);

    const { data: existingResponses } = await supabase
      .from("quote_responses")
      .select("*")
      .eq("quote_supplier_id", info.quote_supplier_id);

    const responsesMap: Record<number, QuoteResponse> = {};
    let existingDeliveryDays = "";

    if (existingResponses) {
      existingResponses.forEach((r) => {
        responsesMap[r.quote_item_id] = {
          quote_item_id: r.quote_item_id,
          price: r.price?.toString() || "",
          min_qty: r.min_qty?.toString() || "",
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

    setLoading(false);
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
      (r) => r.price || r.min_qty || r.notes || (r.pricing_tiers && r.pricing_tiers.length > 0)
    );

    let hasError = false;
    for (const response of responsesToSave) {
      const { data, error } = await supabase.rpc("save_supplier_response", {
        p_token: token,
        p_quote_item_id: response.quote_item_id,
        p_price: parseNumber(response.price),
        p_min_qty: parseNumber(response.min_qty),
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
      toast({ title: "Cotação enviada com sucesso!", variant: "success" });
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
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">CotaFácil</h1>
                <p className="text-sm text-muted-foreground">
                  Portal do Fornecedor
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium">{quoteData.supplier_name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl sm:text-2xl">{quoteData.quote_title}</CardTitle>
                {quoteData.quote_description && (
                  <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                    {quoteData.quote_description}
                  </p>
                )}
              </div>
              <StatusBadge status={quoteData.quote_status as any} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-4 sm:gap-6 text-sm">
              {quoteData.quote_deadline && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Prazo:{" "}
                    {format(new Date(quoteData.quote_deadline), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                  {isExpired && (
                    <span className="text-destructive font-medium">
                      (Expirado)
                    </span>
                  )}
                </div>
              )}
              {isSubmitted && (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    Enviado em{" "}
                    {format(
                      new Date(quoteData.submitted_at!),
                      "dd/MM/yyyy HH:mm",
                      { locale: ptBR }
                    )}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto pt-2 sm:pt-0 border-t sm:border-t-0 mt-2 sm:mt-0">
                <Label htmlFor="delivery-days" className="whitespace-nowrap">Prazo de entrega (dias):</Label>
                <Input
                  id="delivery-days"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(e.target.value)}
                  disabled={isDisabled}
                  className="w-24"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isDisabled && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <p className="text-warning font-medium">
                {isExpired
                  ? "O prazo para envio desta cotação expirou."
                  : "Esta cotação foi encerrada e não aceita mais respostas."}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Itens para Cotação</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Produto</th>
                    <th className="text-left py-3 px-2 font-medium">Emb.</th>
                    <th className="text-left py-3 px-2 font-medium">Qtde Sol.</th>
                    <th className="text-left py-3 px-2 font-medium">Preço</th>
                    <th className="text-left py-3 px-2 font-medium">Qtde Mín.</th>
                    <th className="text-left py-3 px-2 font-medium w-24">Condições</th>
                    <th className="text-left py-3 px-2 font-medium w-12">Obs</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3 px-2 font-medium">
                        {item.product.name}
                      </td>
                      <td className="py-3 px-2">
                        {item.package
                          ? `${item.package.unit}${item.package.multiplier > 1 ? `-${item.package.multiplier}` : ""}`
                          : "-"}
                      </td>
                      <td className="py-3 px-2">{item.requested_qty || "-"}</td>
                      <td className="py-3 px-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={responses[item.id]?.price || ""}
                          onChange={(e) =>
                            updateResponse(item.id, "price", e.target.value)
                          }
                          disabled={isDisabled}
                          className="w-28"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={responses[item.id]?.min_qty || ""}
                          onChange={(e) =>
                            updateResponse(item.id, "min_qty", e.target.value)
                          }
                          disabled={isDisabled}
                          className="w-24"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItemId(item.id);
                            setTierModalOpen(true);
                          }}
                          disabled={isDisabled}
                          className={responses[item.id]?.pricing_tiers?.length > 0 ? "text-primary" : "text-muted-foreground"}
                          title="Condições de Preço"
                        >
                          <Tags className="h-4 w-4 mr-1" />
                          {responses[item.id]?.pricing_tiers?.length > 0 ? "Sim" : "Não"}
                        </Button>
                      </td>
                      <td className="py-3 px-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openNotesModal(item.id)}
                          disabled={isDisabled}
                          className={responses[item.id]?.notes ? "text-primary" : "text-muted-foreground"}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 p-4">
              {items.map((item) => (
                <div key={item.id} className="bg-card border rounded-lg p-4 space-y-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{item.product.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {item.package
                          ? `${item.package.unit}${item.package.multiplier > 1 ? `-${item.package.multiplier}` : ""}`
                          : "Unidade"}{" "}
                        • Solic: {item.requested_qty || "-"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openNotesModal(item.id)}
                      disabled={isDisabled}
                      className={responses[item.id]?.notes ? "text-primary" : "text-muted-foreground"}
                    >
                      <MessageSquare className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Preço Unit.</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={responses[item.id]?.price || ""}
                        onChange={(e) =>
                          updateResponse(item.id, "price", e.target.value)
                        }
                        disabled={isDisabled}
                        className="h-10 text-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Qtd. Mín.</label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={responses[item.id]?.min_qty || ""}
                        onChange={(e) =>
                          updateResponse(item.id, "min_qty", e.target.value)
                        }
                        disabled={isDisabled}
                        className="h-10 text-lg"
                      />
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedItemId(item.id);
                      setTierModalOpen(true);
                    }}
                    disabled={isDisabled}
                    className={`w-full ${responses[item.id]?.pricing_tiers?.length > 0 ? "border-primary text-primary" : "text-muted-foreground"}`}
                  >
                    <Tags className="h-4 w-4 mr-2" />
                    {responses[item.id]?.pricing_tiers?.length > 0
                      ? `${responses[item.id]?.pricing_tiers.length} condições definidas`
                      : "Adicionar Condições de Preço"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {!isDisabled && (
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 border-t sm:border-t-0 sm:p-0 sm:bg-transparent sm:static z-10 -mx-4 sm:mx-0 shadow-md sm:shadow-none">
            <div className="text-sm text-muted-foreground hidden sm:block">
              {lastSaved && (
                <span>
                  Último salvamento:{" "}
                  {format(lastSaved, "HH:mm:ss", { locale: ptBR })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button variant="outline" onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none">
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                <span className="sm:hidden">Salvar</span>
                <span className="hidden sm:inline">Salvar Rascunho</span>
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1 sm:flex-none">
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar
              </Button>
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