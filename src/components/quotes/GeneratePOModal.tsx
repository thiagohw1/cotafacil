import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, ShoppingCart, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Supplier {
    id: number;
    name: string;
    itemCount: number;
    totalValue: number;
}

interface GeneratePOModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quoteId: number;
    suppliers: Supplier[];
    onSuccess?: () => void;
}

export function GeneratePOModal({
    open,
    onOpenChange,
    quoteId,
    suppliers,
    onSuccess,
}: GeneratePOModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
    const [deliveryAddress, setDeliveryAddress] = useState("");
    const [paymentTerms, setPaymentTerms] = useState("");
    const [notes, setNotes] = useState("");

    const handleGenerate = async () => {
        if (!selectedSupplier) {
            toast({
                title: "Fornecedor não selecionado",
                description: "Selecione um fornecedor para gerar o pedido.",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await supabase.rpc("create_purchase_order_from_quote", {
                p_quote_id: quoteId,
                p_supplier_id: selectedSupplier,
                p_delivery_address: deliveryAddress || null,
                p_payment_terms: paymentTerms || null,
                p_notes: notes || null,
            });

            if (error) throw error;

            toast({
                title: "Pedido criado com sucesso!",
                description: `PO #${data} foi gerado.`,
            });

            onOpenChange(false);
            onSuccess?.();
        } catch (err: any) {
            console.error("Error creating PO:", err);
            toast({
                title: "Erro ao criar pedido",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Gerar Pedido de Compra
                    </DialogTitle>
                    <DialogDescription>
                        Selecione o fornecedor e preencha informações adicionais para gerar o pedido.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Supplier Selection */}
                    <div className="space-y-2">
                        <Label>Fornecedor *</Label>
                        <div className="grid gap-2">
                            {suppliers.length === 0 ? (
                                <div className="flex items-center gap-2 p-4 rounded-lg border border-warning bg-warning/10 text-warning">
                                    <AlertCircle className="h-5 w-5" />
                                    <p className="text-sm">Nenhum fornecedor com itens vencedores encontrado.</p>
                                </div>
                            ) : (
                                suppliers.map((supplier) => (
                                    <button
                                        key={supplier.id}
                                        onClick={() => setSelectedSupplier(supplier.id)}
                                        className={`p-4 rounded-lg border-2 text-left transition-colors ${selectedSupplier === supplier.id
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/50"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium">{supplier.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {supplier.itemCount} {supplier.itemCount === 1 ? "item" : "itens"}
                                                </p>
                                            </div>
                                            <p className="text-lg font-semibold">{formatCurrency(supplier.totalValue)}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Delivery Address */}
                    <div className="space-y-2">
                        <Label htmlFor="delivery">Endereço de Entrega</Label>
                        <Textarea
                            id="delivery"
                            placeholder="Digite o endereço de entrega..."
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {/* Payment Terms */}
                    <div className="space-y-2">
                        <Label htmlFor="payment">Condições de Pagamento</Label>
                        <Input
                            id="payment"
                            placeholder="Ex: 30 dias, boleto bancário"
                            value={paymentTerms}
                            onChange={(e) => setPaymentTerms(e.target.value)}
                        />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Observações</Label>
                        <Textarea
                            id="notes"
                            placeholder="Informações adicionais..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleGenerate} disabled={loading || !selectedSupplier}>
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Gerar Pedido
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
