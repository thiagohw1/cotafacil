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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { createPurchaseOrder } from '@/lib/purchase-order-helpers';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface CreatePOModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function CreatePOModal({ open, onOpenChange, onSuccess }: CreatePOModalProps) {
    const [loading, setLoading] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        supplier_id: '',
        notes: '',
        expected_delivery_date: '',
    });

    // Carregar fornecedores quando o modal abre
    const handleOpenChange = (newOpen: boolean) => {
        console.log('🚀 [FUNÇÃO CHAMADA!] newOpen =', newOpen, 'suppliers.length =', suppliers.length);
        onOpenChange(newOpen);
    };

    // Carregar fornecedores automaticamente quando modal abre
    useEffect(() => {
        if (open && suppliers.length === 0) {
            console.log('📦 [useEffect] Modal ABERTO, carregando fornecedores...');
            loadSuppliers();
        }
    }, [open]);

    const loadSuppliers = async () => {
        setLoadingSuppliers(true);
        console.log('🔍 [CARREGANDO] Iniciando query...');

        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*');

            console.log('📊 [RESULTADO]', {
                count: data?.length,
                fornecedores: data?.map(s => s.name),
                erro: error
            });

            if (error) {
                console.error('❌ [ERRO]', error);
                toast({
                    title: 'Erro ao carregar fornecedores',
                    description: error.message,
                    variant: 'destructive',
                });
                setSuppliers([]);
            } else {
                console.log('✅ [SUCESSO] Fornecedores:', data);
                setSuppliers(data || []);

                if (data && data.length > 0) {
                    toast({
                        title: `✅ ${data.length} fornecedor(es) carregado(s)`,
                    });
                }
            }
        } catch (err: any) {
            console.error('❌ [EXCEÇÃO]', err);
            setSuppliers([]);
        }

        setLoadingSuppliers(false);
    };

    const handleSubmit = async () => {
        if (!formData.supplier_id) {
            toast({
                title: 'Fornecedor obrigatório',
                description: 'Selecione um fornecedor para criar o PO',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);

        const { data, error } = await createPurchaseOrder({
            supplier_id: parseInt(formData.supplier_id),
            notes: formData.notes || undefined,
            expected_delivery_date: formData.expected_delivery_date || undefined,
        });

        if (error) {
            toast({
                title: 'Erro ao criar Purchase Order',
                description: error.message,
                variant: 'destructive',
            });
        } else if (data) {
            toast({
                title: 'Purchase Order criado!',
                description: `PO ${data.po_number} criado com sucesso`,
            });

            // Resetar form
            setFormData({
                supplier_id: '',
                notes: '',
                expected_delivery_date: '',
            });

            onOpenChange(false);
            onSuccess?.();

            // Navegar para página de detalhes
            navigate(`/purchase-orders/${data.id}`);
        }

        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Criar Purchase Order Manual</DialogTitle>
                    <DialogDescription>
                        Criar um novo PO manualmente. Você poderá adicionar itens depois.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Fornecedor */}
                    <div className="space-y-2">
                        <Label htmlFor="supplier">Fornecedor *</Label>
                        {loadingSuppliers ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Carregando fornecedores...
                            </div>
                        ) : (
                            <>
                                <Select
                                    value={formData.supplier_id}
                                    onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                                >
                                    <SelectTrigger id="supplier">
                                        <SelectValue placeholder="Selecione um fornecedor..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground text-center">
                                                Nenhum fornecedor encontrado
                                            </div>
                                        ) : (
                                            suppliers.map((supplier) => (
                                                <SelectItem key={supplier.id} value={supplier.id.toString()}>
                                                    {supplier.name}
                                                    {supplier.deleted_at && (
                                                        <span className="text-xs text-red-500 ml-2">(Excluído)</span>
                                                    )}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                {suppliers.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1">
                                        ⚠️ Nenhum fornecedor encontrado. Verifique o console do navegador (F12) para mais detalhes.
                                    </p>
                                )}
                                {suppliers.length > 0 && (
                                    <p className="text-xs text-green-600 mt-1">
                                        ✓ {suppliers.length} fornecedor(es) disponível(is)
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* Data de entrega esperada */}
                    <div className="space-y-2">
                        <Label htmlFor="delivery_date">Data de Entrega Esperada</Label>
                        <Input
                            id="delivery_date"
                            type="date"
                            value={formData.expected_delivery_date}
                            onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                        />
                    </div>

                    {/* Observações */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Observações</Label>
                        <Textarea
                            id="notes"
                            placeholder="Informações adicionais sobre o pedido..."
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                        />
                    </div>

                    <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p>💡 <strong>Dica:</strong> Após criar o PO, você será direcionado para a página de detalhes onde poderá adicionar os itens do pedido.</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !formData.supplier_id}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Criar Purchase Order
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
