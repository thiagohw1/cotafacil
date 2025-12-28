import { useState, useEffect, useRef } from 'react';
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Loader2, Plus, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/useTenant";

interface AddPOItemFormProps {
    poId: number;
    existingItems?: any[]; // Existing PO items to check for duplicates
    onSuccess: () => void;
}

export function AddPOItemForm({ poId, existingItems = [], onSuccess }: AddPOItemFormProps) {
    const { tenantId } = useTenant();
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [packages, setPackages] = useState<any[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const { toast } = useToast();

    // Search State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const qtyRef = useRef<HTMLInputElement>(null);
    const priceRef = useRef<HTMLInputElement>(null);
    const [showNotes, setShowNotes] = useState(false);

    const [formData, setFormData] = useState({
        product_id: '',
        package_id: '',
        qty: '',
        unit_price: '',
        notes: '',
    });

    // Load categories on mount
    useEffect(() => {
        if (tenantId) {
            fetchCategories();
        }
    }, [tenantId]);

    // Debounce search
    useEffect(() => {
        setProducts([]);
        setSelectedIndex(0);

        if (!searchTerm) return;

        const timer = setTimeout(() => {
            fetchProducts(searchTerm);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm, tenantId, categories]);

    const fetchCategories = async () => {
        const { data } = await supabase
            .from("categories")
            .select("id, name, parent_id")
            .order("name");

        setCategories(data || []);
    };

    const fetchProducts = async (term: string) => {
        if (!tenantId) return;
        setLoadingProducts(true);

        // Smart category search logic
        const isCategorySearch = term.trim().startsWith("//");

        let query = supabase
            .from("products")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .eq("active", true)
            .is("deleted_at", null)
            .order("name")
            .limit(20);

        if (isCategorySearch) {
            const categoryTerm = term.trim().substring(2).toLowerCase();
            const aliases: Record<string, string[]> = {
                "flv": ["frutas", "legumes", "verduras", "hortifruti", "flv"],
                "carnes": ["carnes", "bovinos", "suínos", "aves", "açougue", "suinos", "acougue"],
            };

            const targetNames = aliases[categoryTerm] || [categoryTerm];

            // 1. Find root categories
            const matchingRoots = categories.filter(c =>
                targetNames.some(name => c.name.toLowerCase().includes(name))
            );

            // 2. Recursive children
            const validCategoryIds = new Set<number>();
            const addCategoryAndChildren = (parentId: number) => {
                validCategoryIds.add(parentId);
                const children = categories.filter(c => c.parent_id === parentId);
                children.forEach(child => addCategoryAndChildren(child.id));
            };
            matchingRoots.forEach(root => addCategoryAndChildren(root.id));

            if (validCategoryIds.size > 0) {
                query = query.in("category_id", Array.from(validCategoryIds));
            } else {
                query = query.eq("id", -1); // No match
            }
        } else {
            query = query.ilike("name", `%${term}%`);
        }

        const { data, error } = await query;
        if (!error && data) {
            setProducts(data);
            if (data.length > 0) setSearchOpen(true);
        }
        setLoadingProducts(false);
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

    const handleSelectProduct = (product: any) => {
        setFormData({ ...formData, product_id: product.id.toString(), package_id: '' });
        setSearchTerm(product.name);
        setSearchOpen(false);
        loadPackages(product.id);
        // Focus Qty after small delay to ensure state update / render
        setTimeout(() => {
            qtyRef.current?.focus();
        }, 100);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % products.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + products.length) % products.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (products.length > 0 && searchOpen) {
                handleSelectProduct(products[selectedIndex]);
            }
        } else if (e.key === "Escape") {
            setSearchOpen(false);
        }
    };

    const loadPackages = async (productId: number) => {
        const { data, error } = await supabase
            .from('product_packages')
            .select('id, unit, multiplier, is_default')
            .eq('product_id', productId)
            .order('is_default', { ascending: false });

        if (error) {
            console.error('Error loading packages:', error);
        }

        setPackages(data || []);

        // Auto-select default package
        const defaultPkg = data?.find(pkg => pkg.is_default);

        if (defaultPkg) {
            setFormData(prev => ({ ...prev, package_id: defaultPkg.id.toString() }));
        } else {
            setFormData(prev => ({ ...prev, package_id: '' }));
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

        // Check for duplicate product
        const isDuplicate = existingItems.some(
            item => item.product_id === parseInt(formData.product_id)
        );

        if (isDuplicate) {
            const productName = products.find(p => p.id === parseInt(formData.product_id))?.name || 'Produto';
            toast({
                title: 'Produto duplicado',
                description: `${productName} já foi adicionado a este pedido. Edite o item existente ao invés de adicionar novamente.`,
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
            setSearchTerm("");
            setShowNotes(false);

            // Focus Search Input again for rapid entry
            setTimeout(() => {
                searchRef.current?.focus();
            }, 300);

            onSuccess();
        }

        setLoading(false);
    };

    const total = calculateTotal();

    return (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 bg-card text-card-foreground space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Plus className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Adicionar Item ao Pedido</h3>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-end gap-2 w-full">
                    {/* Produto (Flex 1 - Ocupa o espaço restante) */}
                    <div className="flex-1 space-y-1">
                        <Label htmlFor="product-search" className="text-xs">Produto</Label>
                        <div className="relative">
                            <Popover open={searchOpen && products.length > 0}>
                                <PopoverTrigger asChild>
                                    <div>
                                        <Input
                                            id="product-search"
                                            ref={searchRef}
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                // Reset if text changed significantly from selection?
                                                // Ideally we just search. If they pick, we set ID.
                                            }}
                                            onKeyDown={handleKeyDown}
                                            onFocus={() => {
                                                if (products.length > 0) setSearchOpen(true);
                                            }}
                                            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                                            placeholder="Digite para buscar (ex: //carnes)..."
                                            className="w-full"
                                            autoComplete="off"
                                        />
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="p-0 w-[400px]"
                                    align="start"
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                >
                                    <div
                                        ref={listRef}
                                        className="max-h-[300px] overflow-y-auto modern-scrollbar p-1"
                                    >
                                        {loadingProducts && (
                                            <div className="p-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Buscando...
                                            </div>
                                        )}
                                        {!loadingProducts && products.length === 0 && (
                                            <div className="p-2 text-center text-sm text-muted-foreground">
                                                Nenhum produto encontrado.
                                            </div>
                                        )}
                                        {products.map((product, index) => (
                                            <div
                                                key={product.id}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm rounded-sm transition-colors",
                                                    selectedIndex === index ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                                                )}
                                                onClick={() => handleSelectProduct(product)}
                                                onMouseEnter={() => setSelectedIndex(index)}
                                            >
                                                <span className="font-medium truncate flex-1">
                                                    {product.name}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Embalagem */}
                    <div className="w-[100px] space-y-1">
                        <Label htmlFor="package" className="text-xs">Emb.</Label>
                        <Select
                            key={`package-${formData.product_id}-${packages.length}`}
                            value={formData.package_id}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, package_id: value }))}
                            disabled={!formData.product_id || packages.length === 0}
                        >
                            <SelectTrigger id="package" className="h-9 px-2">
                                <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                                {packages.map((pkg) => (
                                    <SelectItem key={pkg.id} value={pkg.id.toString()}>
                                        {pkg.multiplier && pkg.multiplier > 1 ? `${pkg.unit}-${pkg.multiplier}` : pkg.unit}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Quantidade */}
                    <div className="w-[80px] space-y-1">
                        <Label htmlFor="qty" className="text-xs">Qtd.</Label>
                        <Input
                            id="qty"
                            ref={qtyRef}
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={formData.qty}
                            onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    priceRef.current?.focus();
                                }
                            }}
                            placeholder="0"
                            className="h-9 px-2"
                        />
                    </div>

                    {/* Preço Unitário */}
                    <div className="w-[100px] space-y-1">
                        <Label htmlFor="unit_price" className="text-xs">Preço</Label>
                        <Input
                            id="unit_price"
                            ref={priceRef}
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.unit_price}
                            onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                            onKeyDown={(e) => {
                                // Allow default form submit on Enter
                            }}
                            placeholder="0,00"
                            className="h-9 px-2"
                        />
                    </div>

                    {/* Total (Display) */}
                    <div className="w-[80px] space-y-1 pb-2 flex justify-end">
                        <span className="text-sm font-bold text-primary whitespace-nowrap">
                            {total > 0 ? `R$ ${total.toFixed(2).replace('.', ',')}` : '-'}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 pb-[1px]">
                        <Button
                            type="button"
                            variant={showNotes || formData.notes ? "secondary" : "ghost"}
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setShowNotes(!showNotes)}
                            title="Observações"
                        >
                            <MessageSquare className={cn("h-4 w-4", (showNotes || formData.notes) && "text-primary")} />
                        </Button>

                        <Button type="submit" disabled={loading} size="sm" className="h-9 px-3">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            <span className="ml-1 hidden sm:inline">Add</span>
                        </Button>
                    </div>
                </div>

                {/* Observações Expandable */}
                {showNotes && (
                    <div className="w-full animate-in slide-in-from-top-2 fade-in duration-200">
                        <Input
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Observações do item..."
                            className="h-9 text-sm"
                            autoFocus
                        />
                    </div>
                )}
            </div>
        </form>
    );
}
