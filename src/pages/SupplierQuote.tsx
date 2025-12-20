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
} from "@/components/ui/dialog";
import { FileText, Save, Send, Loader2, Clock, CheckCircle, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QuoteItem {
  id: number;
  product: { name: string };
  package: { unit: string } | null;
  requested_qty: number | null;
}

interface QuoteResponse {
  quote_item_id: number;
  price: string;
  min_qty: string;
  notes: string;
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

    // Usar a função para obter dados da cotação via token
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

    // Buscar nome do fornecedor
    const { data: supplierData } = await supabase
      .from("suppliers")
      .select("name")
      .eq("id", info.supplier_id)
      .single();

    // Atualizar last_access_at
    await supabase.rpc("update_supplier_access", { p_token: token });

    setQuoteData({
      ...info,
      supplier_name: supplierData?.name || "Fornecedor",
    });

    // Buscar itens da cotação
    const { data: quoteItems } = await supabase
      .from("quote_items")
      .select(`
        id,
        requested_qty,
        product:products(name),
        package:product_packages(unit)
      `)
      .eq("quote_id", info.quote_id)
      .order("sort_order");

    setItems((quoteItems as any) || []);

    // Buscar respostas existentes
    const { data: existingResponses } = await supabase
      .from("quote_responses")
      .select("*")
      .eq("quote_supplier_id", info.quote_supplier_id);

    const responsesMap: Record<number, QuoteResponse> = {};
    let existingDeliveryDays = "";
    existingResponses?.forEach((r) => {
      responsesMap[r.quote_item_id] = {
        quote_item_id: r.quote_item_id,
        price: r.price?.toString() || "",
        min_qty: r.min_qty?.toString() || "",
        notes: r.notes || "",
      };
      // Get delivery_days from first response (they should all be the same)
      if (!existingDeliveryDays && r.delivery_days) {
        existingDeliveryDays = r.delivery_days.toString();
      }
    });
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

  const handleSave = async () => {
    if (!quoteData || !token) return;
    setSaving(true);

    const responsesToSave = Object.values(responses).filter(
      (r) => r.price || r.min_qty || r.notes
    );

    let hasError = false;
    for (const response of responsesToSave) {
      const { data, error } = await supabase.rpc("save_supplier_response", {
        p_token: token,
        p_quote_item_id: response.quote_item_id,
        p_price: response.price ? parseFloat(response.price) : null,
        p_min_qty: response.min_qty ? parseFloat(response.min_qty) : null,
        p_delivery_days: deliveryDays ? parseInt(deliveryDays) : null,
        p_notes: response.notes || null,
      });

      if (error || data === false) {
        hasError = true;
        break;
      }
    }

    if (hasError) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as respostas. A cotação pode estar expirada.",
        variant: "destructive",
      });
    } else {
      setLastSaved(new Date());
      toast({ title: "Salvo com sucesso" });
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
      toast({ title: "Cotação enviada com sucesso!" });
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
      {/* Header */}
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

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Quote Info */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{quoteData.quote_title}</CardTitle>
                {quoteData.quote_description && (
                  <p className="text-muted-foreground mt-1">
                    {quoteData.quote_description}
                  </p>
                )}
              </div>
              <StatusBadge status={quoteData.quote_status as any} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6 text-sm">
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
              <div className="flex items-center gap-2 ml-auto">
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

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>Itens para Cotação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Produto</th>
                    <th className="text-left py-3 px-2 font-medium">Emb.</th>
                    <th className="text-left py-3 px-2 font-medium">Qtde Sol.</th>
                    <th className="text-left py-3 px-2 font-medium">Preço</th>
                    <th className="text-left py-3 px-2 font-medium">Qtde Mín.</th>
                    <th className="text-left py-3 px-2 font-medium w-12">Obs</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3 px-2 font-medium">
                        {item.product.name}
                      </td>
                      <td className="py-3 px-2">{item.package?.unit || "-"}</td>
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
          </CardContent>
        </Card>

        {/* Actions */}
        {!isDisabled && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {lastSaved && (
                <span>
                  Último salvamento:{" "}
                  {format(lastSaved, "HH:mm:ss", { locale: ptBR })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Rascunho
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar Cotação
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Notes Modal */}
      <Dialog open={notesModalOpen} onOpenChange={setNotesModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Observações do Item</DialogTitle>
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
    </div>
  );
}