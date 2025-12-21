import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PurchaseOrderItem } from '@/types/purchase-orders';

interface EditPOItemModalProps {
    item: PurchaseOrderItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function EditPOItemModal({ item, open, onOpenChange, onSuccess }: EditPOItemModalProps) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        qty: '',
        unit_price: '',
        notes: '',
    });

    // Atualizar form quando item mudar
    useEffect(() => {
        if (item) {
            setFormData({
                qty: item.qty.toString(),
                unit_price: item.unit_price.toString(),
                notes: item.notes || '',
            });
        }
    }, [item]);

    const calculateTotal = () => {
        const qty = parseFloat(formData.qty) || 0;
        const price = parseFloat(formData.unit_price) || 0;
        return qty * price;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!item) return;

        if (!formData.qty || !formData.unit_price) {
            toast({
                title: 'Campos obrigatórios',
                description: 'Preencha quantidade e preço unitário',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);

        const total = calculateTotal();

        const { error } = await supabase
            .from('purchase_order_items')
            .update({
                qty: parseFloat(formData.qty),
                unit_price: parseFloat(formData.unit_price),
                total_price: total,
                notes: formData.notes || null,
            })
            .eq('id', item.id);

        if (error) {
            toast({
                title: 'Erro ao atualizar item',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Item atualizado!',
                description: 'Alterações salvas com sucesso',
            });

            onSuccess();
            onOpenChange(false);
        }

        setLoading(false);
    };

    const total = calculateTotal();

    if (!item) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Editar Item</DialogTitle>
                    <DialogDescription>
                        Altere a quantidade, preço ou observações do item.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Info do Produto (readonly) */}
                        <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm font-medium">Produto #{item.product_id}</p>
                            {item.notes && (
                                <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                            )}
                        </div>

                        {/* Quantidade */}
                        <div className="space-y-2">
                            <Label htmlFor="edit_qty">Quantidade *</Label>
                            <Input
                                id="edit_qty"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={formData.qty}
                                onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                                placeholder="0"
                            />
                        </div>

                        {/* Preço Unitário */}
                        <div className="space-y-2">
                            <Label htmlFor="edit_price">Preço Unitário *</Label>
                            <Input
                                id="edit_price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.unit_price}
                                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                                placeholder="R$ 0,00"
                            />
                        </div>

                        {/* Observações */}
                        <div className="space-y-2">
                            <Label htmlFor="edit_notes">Observações</Label>
                            <Textarea
                                id="edit_notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Informações adicionais..."
                                rows={3}
                            />
                        </div>

                        {/* Total Calculado */}
                        <div className="bg-primary/10 p-3 rounded">
                            <p className="text-sm font-medium text-muted-foreground">Total do Item</p>
                            <p className="text-2xl font-bold text-primary">
                                R$ {total.toFixed(2).replace('.', ',')}
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
