import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AddPOItemFormProps {
    poId: number;
    onSuccess: () => void;
}

export function AddPOItemForm({ poId, onSuccess }: AddPOItemFormProps) {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [packages, setPackages] = useState<any[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        product_id: '',
        package_id: '',
        qty: '',
        unit_price: '',
        notes: '',
    });

    // Carregar produtos ao montar
    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        setLoadingProducts(true);
        console.log('🔍 Carregando produtos...');

        const { data, error } = await supabase
            .from('products')
            .select('id, name')
            .order('name');

        console.log('📊 Resultado produtos:', { data, error });

        if (error) {
            console.error('❌ Erro detalhado:', error);
        }

        if (!error && data) {
            setProducts(data);
            console.log('✅ Produtos carregados:', data.length);
        }
        setLoadingProducts(false);
    };

    const loadPackages = async (productId: number) => {
        const { data } = await supabase
            .from('product_packages')
            .select('id, unit')
            .eq('product_id', productId);

        setPackages(data || []);
    };

    const handleProductChange = (productId: string) => {
        setFormData({ ...formData, product_id: productId, package_id: '' });
        if (productId) {
            loadPackages(parseInt(productId));
        } else {
            setPackages([]);
        }
    };

    const calculateTotal = () => {
        const qty = parseFloat(formData.qty) || 0;
        const price = parseFloat(formData.unit_price) || 0;
        return qty * price;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.product_id || !formData.qty || !formData.unit_price) {
            toast({
                title: 'Campos obrigatórios',
                description: 'Preencha produto, quantidade e preço unitário',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);

        const total = calculateTotal();

        // @ts-ignore - Schema mismatch between types.ts and actual DB
        const { error } = await supabase
            .from('purchase_order_items')
            .insert({
                po_id: poId,
                product_id: parseInt(formData.product_id),
                package_id: formData.package_id ? parseInt(formData.package_id) : null,
                qty: parseFloat(formData.qty),
                unit_price: parseFloat(formData.unit_price),
                total_price: total,
                quote_item_id: null, // Allow manual items
                notes: formData.notes || null,
            });

        if (error) {
            toast({
                title: 'Erro ao adicionar item',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Item adicionado!',
                description: 'Item adicionado ao Purchase Order com sucesso',
            });

            // Resetar form
            setFormData({
                product_id: '',
                package_id: '',
                qty: '',
                unit_price: '',
                notes: '',
            });
            setPackages([]);

            onSuccess();
        }

        setLoading(false);
    };

    const total = calculateTotal();

    return (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 bg-gray-50 space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Plus className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Adicionar Item ao Pedido</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Produto */}
                <div className="space-y-2">
                    <Label htmlFor="product">Produto *</Label>
                    {loadingProducts ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando...
                        </div>
                    ) : (
                        <Select
                            value={formData.product_id}
                            onValueChange={handleProductChange}
                        >
                            <SelectTrigger id="product">
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id.toString()}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Embalagem */}
                <div className="space-y-2">
                    <Label htmlFor="package">Embalagem</Label>
                    <Select
                        value={formData.package_id}
                        onValueChange={(value) => setFormData({ ...formData, package_id: value })}
                        disabled={!formData.product_id || packages.length === 0}
                    >
                        <SelectTrigger id="package">
                            <SelectValue placeholder={packages.length === 0 ? "Sem embalagens" : "Selecione..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {packages.map((pkg) => (
                                <SelectItem key={pkg.id} value={pkg.id.toString()}>
                                    {pkg.unit}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Quantidade */}
                <div className="space-y-2">
                    <Label htmlFor="qty">Quantidade *</Label>
                    <Input
                        id="qty"
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
                    <Label htmlFor="unit_price">Preço Unit. *</Label>
                    <Input
                        id="unit_price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.unit_price}
                        onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                        placeholder="R$ 0,00"
                    />
                </div>
            </div>

            {/* Observações e Total */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Informações adicionais..."
                        rows={2}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Total do Item</Label>
                    <div className="text-2xl font-bold text-primary">
                        R$ {total.toFixed(2).replace('.', ',')}
                    </div>
                </div>
            </div>

            {/* Botão */}
            <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Item
                </Button>
            </div>
        </form>
    );
}
