import { useState, useEffect, useRef } from 'react';
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
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover';
import { cn } from "@/lib/utils";
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

    // Search state
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedTerm, setDebouncedTerm] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    const { toast } = useToast();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        supplier_id: '',
        notes: '',
        expected_delivery_date: '',
    });

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const filteredSuppliers = suppliers.filter(s => {
        if (!debouncedTerm) return false;
        return (
            s.name.toLowerCase().includes(debouncedTerm.toLowerCase()) ||
            s.email?.toLowerCase().includes(debouncedTerm.toLowerCase())
        );
    });

    const handleSelectSupplier = (supplier: any) => {
        setFormData({ ...formData, supplier_id: supplier.id.toString() });
        setSearchTerm(supplier.name);
        setSearchOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % filteredSuppliers.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + filteredSuppliers.length) % filteredSuppliers.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (filteredSuppliers.length > 0) {
                handleSelectSupplier(filteredSuppliers[selectedIndex]);
            }
        } else if (e.key === "Escape") {
            setSearchOpen(false);
        }
    };

    // Auto-scroll logic
    useEffect(() => {
        if (selectedIndex >= 0 && listRef.current) {
            const list = listRef.current;
            const item = list.children[selectedIndex] as HTMLElement;
            if (item) {
                const listTop = list.scrollTop;
                const listBottom = listTop + list.clientHeight;
                const itemTop = item.offsetTop;
                const itemBottom = itemTop + item.clientHeight;

                if (itemTop < listTop) {
                    list.scrollTop = itemTop;
                } else if (itemBottom > listBottom) {
                    list.scrollTop = itemBottom - list.clientHeight;
                }
            }
        }
    }, [selectedIndex]);

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

        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .order('name'); // ensure ordered

            if (error) {
                console.error('❌ [ERRO]', error);
                toast({
                    title: 'Erro ao carregar fornecedores',
                    description: error.message,
                    variant: 'destructive',
                });
                setSuppliers([]);
            } else {
                setSuppliers(data || []);
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
                        <Label htmlFor="supplier-search">Fornecedor *</Label>
                        {loadingSuppliers ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Carregando fornecedores...
                            </div>
                        ) : (
                            <Popover open={searchOpen && filteredSuppliers.length > 0}>
                                <PopoverTrigger asChild>
                                    <div className="relative">
                                        <Input
                                            id="supplier-search"
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setSearchOpen(true);
                                                setSelectedIndex(0);
                                                // Clear ID if typing implies change
                                                if (formData.supplier_id && e.target.value !== suppliers.find(s => s.id.toString() === formData.supplier_id)?.name) {
                                                    setFormData(prev => ({ ...prev, supplier_id: '' }));
                                                }
                                            }}
                                            onKeyDown={handleKeyDown}
                                            onFocus={() => setSearchOpen(true)}
                                            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                                            placeholder="Buscar fornecedor por nome ou email..."
                                            className="w-full"
                                            autoComplete="off"
                                        />
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="p-0 w-[450px]"
                                    align="start"
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                >
                                    <div
                                        ref={listRef}
                                        className="max-h-[300px] overflow-y-auto modern-scrollbar p-1"
                                    >
                                        {filteredSuppliers.map((supplier, index) => (
                                            <div
                                                key={supplier.id}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm rounded-sm transition-colors",
                                                    selectedIndex === index ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                                                )}
                                                onClick={() => handleSelectSupplier(supplier)}
                                                onMouseEnter={() => setSelectedIndex(index)}
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden w-full">
                                                    <span className="text-xs text-muted-foreground shrink-0 font-mono bg-muted/50 px-1 rounded">
                                                        {supplier.id}
                                                    </span>
                                                    <div className="flex flex-col flex-1 overflow-hidden">
                                                        <span className="font-medium truncate">
                                                            {supplier.name}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground truncate">
                                                            {supplier.email}
                                                        </span>
                                                    </div>
                                                    {supplier.deleted_at && (
                                                        <span className="text-xs text-red-500 ml-2">(Excluído)</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
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
