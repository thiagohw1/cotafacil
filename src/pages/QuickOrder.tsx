import { useState, useEffect, useRef } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Minus, Package, Trash2, FileText, ArrowLeft, X, Check, Truck, Loader2, MoreVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/ui/data-table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- Types ---

interface ProductPackage {
    id: number;
    unit: string;
    multiplier: number;
    is_default: boolean;
}

interface Product {
    id: number;
    name: string;
    brand: string | null;
    unit: string | null;
    product_packages: ProductPackage[];
}

interface Supplier {
    id: number;
    name: string;
}

// DB-structure safe item
interface OrderItem {
    id: string; // UUID of the item record
    quick_order_id: string;
    product_id: number;
    supplier_id: number | null;
    package_id: number | null;
    quantity: number;
    unit_price: number; // Base unit price
    total_price: number;
    product: Product; // Joined
    selectedPackage?: ProductPackage | null; // Derived/Joined logic
}

interface QuickOrderType {
    id: string; // UUID
    name: string | null;
    created_at: string;
    status: string;
    total_amount: number | null;
    total_items: number | null;
}

interface ProductList {
    id: number;
    name: string;
    product_list_items: {
        product_id: number;
        preferred_package_id: number | null;
        default_qty: number | null;
    }[];
}

// --- Main Component ---

export default function QuickOrder() {
    const { tenantId } = useTenant();
    const { toast } = useToast();
    const [viewMode, setViewMode] = useState<"list" | "create">("list");

    // --- List Mode State ---
    const [orders, setOrders] = useState<QuickOrderType[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    // --- Create/Edit Mode State ---
    const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
    const [orderName, setOrderName] = useState("");
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    const [summaryOpen, setSummaryOpen] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // --- Modals State ---
    const [searchModalOpen, setSearchModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [newOrderModalTitleOpen, setNewOrderModalTitleOpen] = useState(false);
    const [creatingOrder, setCreatingOrder] = useState(false);

    // --- Offline / Sync State ---
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const pendingOpsRef = useRef<any[]>([]);

    // --- Initialization ---
    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); processQueue(); };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [currentOrderId]); // Process queue depends on order ID context

    useEffect(() => {
        if (tenantId) {
            fetchSuppliers();
        }
    }, [tenantId]);

    useEffect(() => {
        if (tenantId && viewMode === "list") {
            fetchOrders();
        }
    }, [tenantId, viewMode]);

    // Load Items & Queue
    useEffect(() => {
        if (currentOrderId && viewMode === "create") {
            // Load queue from LS
            const savedQueue = localStorage.getItem(`quick_order_ops_${currentOrderId}`);
            if (savedQueue) {
                pendingOpsRef.current = JSON.parse(savedQueue);
            } else {
                pendingOpsRef.current = [];
            }
            // Load items
            loadOrderItems(currentOrderId);
            // Try sync if online
            if (navigator.onLine) processQueue();
        }
    }, [currentOrderId, viewMode]);

    // --- Fetchers ---

    const fetchOrders = async () => {
        if (!navigator.onLine) return; // Can't list offline yet (unless we cache list)
        setLoadingOrders(true);
        const { data, error } = await supabase
            .from("quick_orders")
            .select("id, name, created_at, status, total_amount, total_items")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false });

        if (error) {
            toast({ title: "Erro ao carregar pedidos", description: error.message, variant: "destructive" });
        } else {
            setOrders(data as any);
        }
        setLoadingOrders(false);
    };

    const fetchSuppliers = async () => {
        if (!navigator.onLine) return;
        const { data } = await supabase
            .from("suppliers")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .eq("active", true)
            .order("name");
        if (data) setSuppliers(data);
    };



    const loadOrderItems = async (orderId: string) => {
        setLoadingItems(true);
        // If offline, we might want to rely on what we have in memory + queue if we persisted full state. 
        // For now, assuming "Session Persistence" or "Optimistic" during session. 
        // Real cache would need IndexedDB or similar. 
        // We will try to fetch if online.

        if (!navigator.onLine) {
            setLoadingItems(false);
            return;
        }

        const { data, error } = await supabase
            .from("quick_order_items")
            .select(`
                id, quick_order_id, product_id, supplier_id, package_id, quantity, unit_price, total_price,
                product:products (id, name, brand, unit, product_packages(id, unit, multiplier, is_default))
            `)
            .eq("quick_order_id", orderId);
        // .order("created_at"); 

        if (error) {
            toast({ title: "Erro ao carregar itens", description: error.message, variant: "destructive" });
        } else {
            // Apply any pending local Ops to the fetched data to ensure consistency?
            // Simpler strategy: Use fetched data as base, relying on processQueue to have been largely successful or about to run.
            // If we have a lot of pending, fetch might be stale.
            // Let's just load what DB has.
            const formatted: OrderItem[] = data.map((item: any) => {
                const pkg = item.package_id
                    ? item.product.product_packages.find((p: any) => p.id === item.package_id)
                    : null;
                return { ...item, selectedPackage: pkg };
            });
            setOrderItems(formatted);
        }
        setLoadingItems(false);
    }

    // --- Offline Logic ---

    const addToQueue = (op: any) => {
        pendingOpsRef.current.push(op);
        localStorage.setItem(`quick_order_ops_${currentOrderId}`, JSON.stringify(pendingOpsRef.current));
        if (isOnline) processQueue();
    };

    const processQueue = async () => {
        if (isSyncing || pendingOpsRef.current.length === 0 || !currentOrderId) return;
        setIsSyncing(true);

        const queue = [...pendingOpsRef.current];
        let failed = false;

        // Process sequentially
        for (let i = 0; i < queue.length; i++) {
            const op = queue[i];
            try {
                // Execute DB Call
                if (op.type === 'INSERT') {
                    const { error } = await supabase.from('quick_order_items').insert(op.payload);
                    if (error) throw error;
                } else if (op.type === 'UPDATE') {
                    const { error } = await supabase.from('quick_order_items').update(op.payload).eq('id', op.id);
                    if (error) throw error;
                } else if (op.type === 'DELETE') {
                    const { error } = await supabase.from('quick_order_items').delete().eq('id', op.id);
                    if (error) throw error;
                }

                // Success: Remove from Reference Queue locally
                pendingOpsRef.current.shift();
                localStorage.setItem(`quick_order_ops_${currentOrderId}`, JSON.stringify(pendingOpsRef.current));
            } catch (err) {
                console.error("Sync failed for op", op, err);
                failed = true;
                break; // Stop processing on error to maintain order
            }
        }

        setIsSyncing(false);
        // If we processed items, trigger a header recalculation (lazy way)
        if (!failed) {
            // ideally calculate from local items, but we can try to re-fetch totals if online
        }
    };

    // --- Actions ---

    const handleStartNewOrder = () => {
        if (!isOnline) {
            toast({ title: "Você está offline", description: "Precisa de internet para criar um novo pedido.", variant: "warning" });
            return;
        }
        setOrderName("");
        setNewOrderModalTitleOpen(true);
    };

    const handleConfirmNewOrder = async () => {
        if (!orderName.trim()) {
            toast({ title: "Digite um nome para o pedido", variant: "destructive" });
            return;
        }
        if (!tenantId) return;

        setCreatingOrder(true);
        try {
            const { data, error } = await supabase
                .from("quick_orders")
                .insert({
                    tenant_id: tenantId,
                    name: orderName,
                    status: 'draft',
                    total_items: 0,
                    total_amount: 0
                })
                .select()
                .single();

            if (error) throw error;

            setCurrentOrderId(data.id);
            setOrderItems([]);
            setViewMode("create");
            setNewOrderModalTitleOpen(false);
            toast({ title: "Pedido criado!", variant: "success" });
        } catch (err: any) {
            toast({ title: "Erro ao criar pedido", description: err.message, variant: "destructive" });
        } finally {
            setCreatingOrder(false);
        }
    };

    const handleOpenExistingOrder = (order: QuickOrderType) => {
        setCurrentOrderId(order.id);
        setOrderName(order.name || "Pedido");
        setViewMode("create");
    };

    const updateOrderHeaderTotals = async (orderId: string, items: OrderItem[]) => {
        if (!isOnline) return; // Skip if offline, will update later/eventually
        const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);
        const totalAmount = items.reduce((acc, i) => acc + i.total_price, 0);

        await supabase
            .from("quick_orders")
            .update({ total_items: totalItems, total_amount: totalAmount })
            .eq("id", orderId);
    };

    // --- Item Logic (Auto-Save + Offline) ---

    const calculateTotal = (qty: number, unitPrice: number, pkg: ProductPackage | null) => {
        const multiplier = pkg?.multiplier || 1;
        return unitPrice * multiplier * qty; // unitPrice is BASE price
    };

    const addItemToOrder = async (product: Product, qty: number = 1, pkg: ProductPackage | null = null) => {
        if (!currentOrderId) return;

        const existing = orderItems.find(i => i.product_id === product.id);
        if (existing) {
            toast({ title: "Produto já na lista", description: "Atualize a quantidade.", variant: "warning" });
            return;
        }

        const defaultPkg = pkg || product.product_packages.find(p => p.is_default) || null;
        const unitPrice = 0;
        const total = calculateTotal(qty, unitPrice, defaultPkg);

        // Generate Client-Side ID (UUID v4-like)
        const newItemId = crypto.randomUUID();

        // Prepare Payload
        const payload = {
            id: newItemId,
            quick_order_id: currentOrderId,
            product_id: product.id,
            supplier_id: null,
            package_id: defaultPkg?.id || null,
            quantity: qty,
            unit_price: unitPrice,
            total_price: total
        };

        // Optimistic UI
        const newItem: OrderItem = {
            ...payload,
            product: product,
            selectedPackage: defaultPkg
        };
        setOrderItems(prev => [newItem, ...prev]);
        toast({ title: "Item adicionado", variant: "success", duration: 1000 });

        // Queue DB Op
        addToQueue({ type: 'INSERT', payload: payload });
        updateOrderHeaderTotals(currentOrderId, [newItem, ...orderItems]);
    };

    const updateOrderItem = async (itemId: string, updates: Partial<OrderItem>) => {
        const item = orderItems.find(i => i.id === itemId);
        if (!item) return;

        // Calculate New State
        let newQty = item.quantity;
        let newPrice = item.unit_price;
        let newPkg = item.selectedPackage;
        const payload: any = {};

        if (updates.quantity !== undefined) {
            payload.quantity = updates.quantity;
            newQty = updates.quantity;
        }
        if (updates.supplier_id !== undefined) payload.supplier_id = updates.supplier_id;

        if (updates.selectedPackage !== undefined) {
            newPkg = updates.selectedPackage;
            payload.package_id = newPkg ? newPkg.id : null;
        }

        if (updates.unit_price !== undefined) {
            payload.unit_price = updates.unit_price;
            newPrice = updates.unit_price;
        }

        const multiplier = newPkg?.multiplier || 1;
        payload.total_price = newPrice * multiplier * newQty;
        // payload.unit_price should already be set if updated, else item.unit_price is used by default logic but here we are explicit

        // Optimistic UI
        const updatedList = orderItems.map(i => i.id === itemId ? { ...i, ...updates, ...payload, selectedPackage: newPkg } : i);
        setOrderItems(updatedList);

        // Queue DB Op
        addToQueue({ type: 'UPDATE', id: itemId, payload: payload });
        updateOrderHeaderTotals(currentOrderId!, updatedList);
    };

    const removeOrderItem = async (itemId: string) => {
        // Optimistic UI
        const newItems = orderItems.filter(i => i.id !== itemId);
        setOrderItems(newItems);

        // Queue DB Op
        addToQueue({ type: 'DELETE', id: itemId });
        updateOrderHeaderTotals(currentOrderId!, newItems);
    };

    // --- PDF Logic ---
    const handleGeneratePDF = () => {
        const doc = new jsPDF();

        // Group by Supplier
        const groups = new Map<string, { supplierName: string, items: OrderItem[] }>();
        orderItems.forEach(item => {
            const sId = item.supplier_id ? item.supplier_id.toString() : "null";
            if (!groups.has(sId)) {
                const sName = item.supplier_id ? suppliers.find(s => s.id === item.supplier_id)?.name : "Sem Fornecedor";
                groups.set(sId, { supplierName: sName || "Indefinido", items: [] });
            }
            groups.get(sId)?.items.push(item);
        });

        let yPos = 15;
        doc.setFontSize(16); doc.text(`Resumo - ${orderName}`, 14, yPos); yPos += 10;

        groups.forEach((group) => {
            doc.setFontSize(12); doc.setFillColor(240, 240, 240); doc.rect(14, yPos - 5, 182, 8, 'F');
            doc.text(group.supplierName, 16, yPos); yPos += 5;

            const tableBody = group.items.map(item => [
                item.product.name,
                item.quantity.toString(),
                item.selectedPackage ? `${item.selectedPackage.unit} (x${item.selectedPackage.multiplier})` : (item.product.unit || "UN")
            ]);

            autoTable(doc, {
                startY: yPos, head: [['Produto', 'Qtd', 'Emb']], body: tableBody,
                theme: 'grid', headStyles: { fillColor: [66, 66, 66] }, margin: { top: yPos },
            });
            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 15;
        });
        doc.save(`pedido_${orderName.replace(/\s+/g, '_').toLowerCase()}.pdf`);
    };

    const handleCompleteOrder = async () => {
        if (!currentOrderId) return;
        if (!isOnline) {
            toast({ title: "Você está offline", description: "Conecte-se para concluir o pedido.", variant: "warning" });
            return;
        }

        const { error } = await supabase
            .from("quick_orders")
            .update({ status: 'completed' })
            .eq("id", currentOrderId);

        if (error) {
            toast({ title: "Erro ao concluir", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Pedido Concluído!", className: "bg-emerald-500 text-white" });
            setSummaryOpen(false);
            setViewMode("list");
        }
    };

    // --- Render ---

    const columns: Column<QuickOrderType>[] = [
        {
            key: "name",
            header: "Descrição",
            render: (item) => (
                <div className="font-medium cursor-pointer hover:underline text-emerald-700" onClick={() => handleOpenExistingOrder(item)}>
                    {item.name || `Pedido #${item.id.slice(0, 8)}`}
                </div>
            )
        },
        {
            key: "status",
            header: "Status",
            render: (item) => (
                <Badge variant={item.status === 'draft' ? 'outline' : 'default'} className={cn("uppercase text-[10px]", item.status === 'completed' && "bg-emerald-500 hover:bg-emerald-600")}>
                    {item.status === 'draft' ? 'Rascunho' : (item.status === 'completed' ? 'Concluído' : item.status)}
                </Badge>
            )
        },
        {
            key: "total_items",
            header: "Itens",
            render: (item) => item.total_items || 0
        },
        {
            key: "total_amount",
            header: "Total",
            render: (item) => item.total_amount ? `R$ ${item.total_amount.toFixed(2)}` : '-'
        },
        {
            key: "created_at",
            header: "Data",
            render: (item) => format(new Date(item.created_at), "dd/MM/yy", { locale: ptBR })
        },
    ];

    if (viewMode === "list") {
        return (
            <div className="pb-20 space-y-4">
                <Header
                    title="Pedidos Rápidos"
                    description="Gerencie seus pedidos de compra"
                    actions={
                        <Button onClick={handleStartNewOrder}>
                            <Plus className="mr-2 h-4 w-4" /> Novo Pedido
                        </Button>
                    }
                />
                <div className="container mx-auto p-4">
                    <DataTable
                        columns={columns}
                        data={orders}
                        loading={loadingOrders}
                    />
                </div>
                {/* Modal for New Order Name */}
                <Dialog open={newOrderModalTitleOpen} onOpenChange={setNewOrderModalTitleOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Pedido Rápido</DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            <Label>Nome do Pedido / Identificação</Label>
                            <Input
                                value={orderName}
                                onChange={e => setOrderName(e.target.value)}
                                placeholder="Ex: Reposição Semanal"
                                className="mt-2"
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setNewOrderModalTitleOpen(false)}>Cancelar</Button>
                            <Button onClick={handleConfirmNewOrder} disabled={creatingOrder}>
                                {creatingOrder ? <Loader2 className="animate-spin h-4 w-4" /> : "Iniciar"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        )
    }

    return (
        <div className="pb-20 space-y-4">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background border-b px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setViewMode("list")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold leading-tight">{orderName || "Novo Pedido"}</h1>
                        <div className="flex gap-2">
                            {!isOnline && <Badge variant="destructive" className="h-4 px-1 text-[10px]">Offline</Badge>}
                            {isSyncing && <Badge variant="secondary" className="h-4 px-1 text-[10px] animate-pulse">Sincronizando...</Badge>}
                            {isOnline && !isSyncing && pendingOpsRef.current.length > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px]">Pendentes: {pendingOpsRef.current.length}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                            {loadingItems ? <Loader2 className="h-3 w-3 animate-spin" /> : `${orderItems.length} itens`}
                            <span className="text-emerald-600 font-medium ml-2">Salvo Automático</span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {/* Desktop Actions */}
                    <div className="hidden md:flex gap-2">
                        <Button variant="outline" onClick={() => setSearchModalOpen(true)}>
                            <Search className="h-4 w-4 mr-2" />
                            Buscar Produtos
                        </Button>
                        <Button variant="outline" onClick={() => setImportModalOpen(true)}>
                            <FileText className="h-4 w-4 mr-2" />
                            Importar Lista
                        </Button>
                        <Button variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100" onClick={() => setSummaryOpen(true)}>
                            <Check className="h-4 w-4 mr-2" />
                            Resumo
                        </Button>
                    </div>

                    {/* Mobile Actions (Dropdown) */}
                    <div className="md:hidden">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSearchModalOpen(true)}>
                                    <Search className="h-4 w-4 mr-2" />
                                    Buscar Produtos
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setImportModalOpen(true)}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    Importar Lista
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSummaryOpen(true)}>
                                    <Check className="h-4 w-4 mr-2 text-emerald-600" />
                                    <span className="text-emerald-600">Resumo</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            <div className="container mx-auto p-4 space-y-3">
                {orderItems.length === 0 && !loadingItems && (
                    <div className="text-center py-20 text-muted-foreground flex flex-col items-center gap-4">
                        <ShoppingBagIcon size={48} className="opacity-20" />
                        <p>Carrinho vazio. Adicione produtos ou importe uma lista.</p>
                    </div>
                )}

                {/* Items */}
                {orderItems.map(item => (
                    <CartItemCard
                        key={item.id}
                        item={item}
                        suppliers={suppliers}
                        onUpdate={updateOrderItem}
                        onRemove={removeOrderItem}
                    />
                ))}
            </div>

            {/* Footer Removed */}

            {/* Summary Sheet */}
            <Sheet open={summaryOpen} onOpenChange={setSummaryOpen}>
                <SheetContent side="bottom" className="h-[90vh] flex flex-col">
                    <SheetHeader>
                        <SheetTitle>Resumo - {orderName}</SheetTitle>
                        <SheetDescription>Confira itens e fornecedores.</SheetDescription>
                    </SheetHeader>
                    <div className="py-4 overflow-y-auto max-h-[60vh] space-y-6 flex-1">
                        {/* Grouping Logic for Display */}
                        {Array.from(
                            orderItems.reduce((map, item) => {
                                const key = item.supplier_id || "null";
                                if (!map.has(key)) map.set(key, []);
                                map.get(key)!.push(item);
                                return map;
                            }, new Map<string | number, OrderItem[]>()).entries()
                        ).map(([key, items]) => {
                            const supplierName = key === "null" ? "Sem Fornecedor" : suppliers.find(s => s.id === key)?.name;
                            return (
                                <div key={key} className="space-y-2">
                                    <div className="flex items-center gap-2 font-semibold text-sm bg-muted p-2 rounded">
                                        <span>{supplierName}</span>
                                        <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
                                    </div>
                                    <div className="pl-4 space-y-2">
                                        {items.map(item => (
                                            <div key={item.id} className="flex justify-between text-sm py-1 border-b last:border-0 border-border/50">
                                                <span className="truncate flex-1 pr-2">{item.product.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span>{item.quantity}</span>
                                                    <span className="text-xs bg-muted px-1 rounded">
                                                        {item.selectedPackage ? item.selectedPackage.unit : (item.product.unit || "UN")}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <SheetFooter className="flex-col gap-2 mt-auto pb-8">
                        <Button variant="outline" className="w-full" onClick={handleGeneratePDF}>
                            <FileText className="mr-2 h-4 w-4" /> Baixar PDF
                        </Button>
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCompleteOrder}>
                            <Check className="mr-2 h-4 w-4" /> Concluir Pedido
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Modals */}
            <ProductSearchModal
                open={searchModalOpen}
                onOpenChange={setSearchModalOpen}
                products={products}
                onAdd={(product) => {
                    addItemToOrder(product);
                    setSearchModalOpen(false);
                }}
                onSearch={async (term) => {
                    const sanitized = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                    const { data } = await supabase
                        .from("products")
                        .select("id, name, brand, unit, product_packages(id, unit, multiplier, is_default)")
                        .eq("tenant_id", tenantId)
                        .eq("active", true)
                        .ilike("name_search", `%${sanitized}%`)
                        .limit(20);
                    if (data) setProducts(data as any);
                }}
            />

            <ImportListModal
                open={importModalOpen}
                onOpenChange={setImportModalOpen}
                tenantId={tenantId}
                onImport={(items) => {
                    items.forEach(item => {
                        addItemToOrder(item.product, item.qty, item.pkg);
                    });
                    setImportModalOpen(false);
                }}
            />
        </div>
    );
}

// --- Sub-Components ---

function CartItemCard({ item, suppliers, onUpdate, onRemove }: { item: OrderItem, suppliers: Supplier[], onUpdate: Function, onRemove: Function }) {
    const [openPkg, setOpenPkg] = useState(false);
    const [openSupp, setOpenSupp] = useState(false);

    // Calculations based on stored BASE Price
    const multiplier = item.selectedPackage?.multiplier || 1;
    // UI shows Package Price (Base * Multiplier)
    const packagePrice = item.unit_price * multiplier;
    // Total is calculated
    const totalPrice = packagePrice * item.quantity;

    const handlePackagePriceChange = (val: string) => {
        const pPrice = parseFloat(val) || 0;
        // Convert Package Price back to Base Price for storage
        const newBasePrice = pPrice / multiplier;
        onUpdate(item.id, { unit_price: newBasePrice });
    };

    const pkgLabel = item.selectedPackage
        ? `${item.selectedPackage.unit}-${item.selectedPackage.multiplier}`
        : (item.product.unit || "UN");

    return (
        <Card className="relative overflow-visible">
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive z-10"
                onClick={() => onRemove(item.id)}
            >
                <X className="h-3 w-3" />
            </Button>
            <CardContent className="p-3">
                {/* Header: Name + Unit + Package Selector + Supplier Icon */}
                <div className="pr-6 mb-3 flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                            <h3 className="font-medium text-sm">{item.product.name}</h3>
                            <div className="flex items-center text-xs gap-1">
                                <span className="text-muted-foreground bg-muted px-1 rounded">{item.product.unit || "UN"}</span>
                                {/* Packaging Trigger */}
                                <div className="relative inline-block">
                                    {!openPkg ? (
                                        <span
                                            className="cursor-pointer font-bold text-emerald-700 bg-emerald-50 px-1 rounded hover:underline hover:bg-emerald-100"
                                            onClick={() => { setOpenPkg(true); setOpenSupp(false); }}
                                        >
                                            {pkgLabel}
                                        </span>
                                    ) : (
                                        <div className="absolute top-0 left-0 z-50 min-w-[120px]">
                                            <Select
                                                open={openPkg}
                                                onOpenChange={setOpenPkg}
                                                value={item.package_id?.toString() || "std"}
                                                onValueChange={(val) => {
                                                    const pkg = val === "std" ? null : item.product.product_packages.find(p => p.id.toString() === val) || null;
                                                    onUpdate(item.id, { selectedPackage: pkg });
                                                    setOpenPkg(false);
                                                }}
                                            >
                                                <SelectTrigger className="h-7 text-xs w-full bg-background"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="std">{item.product.unit || "UN"} (x1)</SelectItem>
                                                    {item.product.product_packages.map(p => (
                                                        <SelectItem key={p.id} value={p.id.toString()}>{p.unit}-{p.multiplier}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {item.product.brand && <p className="text-[10px] text-muted-foreground">{item.product.brand}</p>}
                    </div>

                    {/* Supplier Icon Trigger */}
                    <div className="relative z-[9]">
                        {!openSupp ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-transparent"
                                onClick={() => { setOpenSupp(true); setOpenPkg(false); }}
                            >
                                <Truck className={cn("h-4 w-4", item.supplier_id ? "text-emerald-600 fill-emerald-100" : "text-muted-foreground")} />
                            </Button>
                        ) : (
                            <div className="absolute top-0 right-0 z-50 min-w-[160px]">
                                <Select
                                    open={openSupp}
                                    onOpenChange={setOpenSupp}
                                    value={item.supplier_id?.toString() || "null"}
                                    onValueChange={(val) => {
                                        onUpdate(item.id, { supplier_id: val === "null" ? null : parseInt(val) });
                                        setOpenSupp(false);
                                    }}
                                >
                                    <SelectTrigger className="h-7 text-xs w-full bg-background shadow-md"><SelectValue placeholder="Forn..." /></SelectTrigger>
                                    <SelectContent align="end">
                                        <SelectItem value="null">-- Sem Fornecedor --</SelectItem>
                                        {suppliers.map(s => (
                                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Prices Row */}
                <div className="grid grid-cols-3 gap-2 items-end mb-3">
                    <div>
                        <Label className="text-[10px] text-muted-foreground">Custo Un.</Label>
                        <div className="h-7 flex items-center text-xs text-muted-foreground px-2 bg-muted/50 rounded border border-transparent">
                            {item.unit_price > 0 ? `R$ ${item.unit_price.toFixed(2)}` : "-"}
                        </div>
                    </div>
                    <div>
                        <Label className="text-[10px] text-muted-foreground">Preço (Emb)</Label>
                        <Input
                            className="h-7 text-xs"
                            type="number"
                            placeholder="0.00"
                            value={packagePrice === 0 ? "" : packagePrice}
                            onChange={(e) => handlePackagePriceChange(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label className="text-[10px] text-muted-foreground">Total</Label>
                        <div className="h-7 flex items-center text-xs font-semibold px-2 bg-muted/50 rounded border border-transparent">
                            {totalPrice > 0 ? `R$ ${totalPrice.toFixed(2)}` : "-"}
                        </div>
                    </div>
                </div>

                {/* Quantity - Full Width Row */}
                <div className="flex items-center h-9 border rounded-md bg-background">
                    <Button variant="ghost" size="icon" className="h-full w-10 border-r rounded-none hover:bg-muted" onClick={() => onUpdate(item.id, { quantity: Math.max(0, item.quantity - 1) })}>
                        <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                        type="number"
                        className="flex-1 text-center border-none shadow-none h-full focus-visible:ring-0 rounded-none px-0 spin-button-none"
                        value={item.quantity.toString()}
                        onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            onUpdate(item.id, { quantity: val });
                        }}
                        onFocus={(e) => e.target.select()}
                    />
                    <Button variant="ghost" size="icon" className="h-full w-10 border-l rounded-none hover:bg-muted" onClick={() => onUpdate(item.id, { quantity: item.quantity + 1 })}>
                        <Plus className="h-3 w-3" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// Icons and Modals (reused)
function ShoppingBagIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
    )
}

function ProductSearchModal({ open, onOpenChange, products, onAdd, onSearch }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    products: Product[];
    onAdd: (p: Product) => void;
    onSearch: (term: string) => void;
}) {
    const [term, setTerm] = useState("");

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onSearch(term);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="p-0 gap-0 top-[20%] translate-y-0">
                <DialogTitle className="sr-only">Buscar Produtos</DialogTitle>
                <Command className="rounded-lg border shadow-md" shouldFilter={false}>
                    <CommandInput
                        placeholder="Buscar produtos (Enter)..."
                        value={term}
                        onValueChange={setTerm}
                        onKeyDown={handleKeyDown}
                    />
                    <CommandList>
                        <CommandGroup heading="Sugestões">
                            {products.map(product => (
                                <CommandItem key={product.id} onSelect={() => onAdd(product)}>
                                    <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                                    <div className="flex flex-col">
                                        <span>{product.name}</span>
                                        <div className="flex gap-2">
                                            {product.brand && <span className="text-xs text-muted-foreground">{product.brand}</span>}
                                            <span className="text-xs text-muted-foreground">{product.unit || "UN"}</span>
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </DialogContent>
        </Dialog>
    );
}

function ImportListModal({ open, onOpenChange, tenantId, onImport }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    tenantId: string | null;
    onImport: (items: { product: Product, qty: number, pkg: ProductPackage | null }[]) => void;
}) {
    const [lists, setLists] = useState<ProductList[]>([]);
    const [selectedListId, setSelectedListId] = useState<string>("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && tenantId) {
            supabase.from("product_lists").select("id, name, product_list_items(product_id, preferred_package_id, default_qty)").eq("tenant_id", tenantId)
                .then(({ data }) => setLists(data as any || []));
        }
    }, [open, tenantId]);

    const handleImport = async () => {
        if (!selectedListId) return;
        setLoading(true);
        const list = lists.find(l => l.id.toString() === selectedListId);
        if (!list) return;

        // Fetch product details for items in list
        const productIds = list.product_list_items.map(i => i.product_id);
        const { data: products } = await supabase
            .from("products")
            .select("id, name, brand, unit, product_packages(id, unit, multiplier, is_default)")
            .in("id", productIds);

        if (products) {
            const mappedItems = list.product_list_items.map(listItem => {
                const product = products.find(p => p.id === listItem.product_id);
                if (!product) return null;

                const pkg = listItem.preferred_package_id
                    ? product.product_packages.find(p => p.id === listItem.preferred_package_id) || null
                    : null;

                return {
                    product,
                    qty: listItem.default_qty || 1,
                    pkg
                };
            }).filter(i => i !== null);

            // @ts-ignore
            onImport(mappedItems);
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Importar de Lista</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <Select value={selectedListId} onValueChange={setSelectedListId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione uma lista..." />
                        </SelectTrigger>
                        <SelectContent>
                            {lists.map(list => (
                                <SelectItem key={list.id} value={list.id.toString()}>{list.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleImport} disabled={loading || !selectedListId}>
                        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Importar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
