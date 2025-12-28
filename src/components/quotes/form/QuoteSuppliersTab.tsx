import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Users, Plus, Copy, Check } from "lucide-react";
import { QuoteSupplier, Supplier } from "@/types/quote";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

interface QuoteSuppliersTabProps {
    quoteSuppliers: QuoteSupplier[];
    suppliers: Supplier[];
    onAddSuppliers: (ids: number[]) => void;
    onRemoveSupplier: (id: number) => void;
    onCopyLink: (token: string) => void;
    loading?: boolean;
    quoteStatus: string;
}

export function QuoteSuppliersTab({
    quoteSuppliers,
    suppliers,
    onAddSuppliers,
    onRemoveSupplier,
    onCopyLink,
    loading,
    quoteStatus
}: QuoteSuppliersTabProps) {
    const [copiedId, setCopiedId] = useState<number | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Filter suppliers
    const availableSuppliers = suppliers.filter(
        (s) => !quoteSuppliers.some((qs) => qs.supplier_id === s.id)
    );

    const filteredSuppliers = availableSuppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectSupplier = (id: number) => {
        onAddSuppliers([id]);
        setSearchTerm("");
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
                handleSelectSupplier(filteredSuppliers[selectedIndex].id);
            }
        } else if (e.key === "Escape") {
            setSearchOpen(false);
        }
    };

    // Auto-scroll to selected item
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

    const handleCopy = (id: number, token: string) => {
        onCopyLink(token);
        setCopiedId(id);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col space-y-4">
                <div className="flex items-end gap-4 p-4 border rounded-lg bg-muted/30">
                    <div className="flex-1 space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Adicionar Fornecedor
                        </label>
                        <div className="relative">
                            <Popover open={searchOpen && filteredSuppliers.length > 0 && searchTerm.length > 0}>
                                <PopoverTrigger asChild>
                                    <div className="relative">
                                        <Input
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setSearchOpen(true);
                                                setSelectedIndex(0);
                                            }}
                                            onKeyDown={handleKeyDown}
                                            onFocus={() => setSearchOpen(true)}
                                            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                                            placeholder="Buscar fornecedor por nome ou email..."
                                            className="w-full"
                                            disabled={loading}
                                            autoComplete="off"
                                        />
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="p-0 w-[500px]"
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
                                                onClick={() => handleSelectSupplier(supplier.id)}
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
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>

                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fornecedor</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quoteSuppliers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Users className="h-8 w-8 opacity-50" />
                                            <p>Nenhum fornecedor convidado.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                quoteSuppliers.map((qs) => (
                                    <TableRow key={qs.id}>
                                        <TableCell>
                                            <div className="font-medium">{qs.supplier?.name}</div>
                                            <div className="text-xs text-muted-foreground">{qs.supplier?.email}</div>
                                        </TableCell>
                                        <TableCell>
                                            {(() => {
                                                const getStatusConfig = (status: string) => {
                                                    switch (status) {
                                                        case 'submitted':
                                                            return { label: 'Respondido', className: "bg-emerald-500 hover:bg-green-600 text-white border-transparent dark:bg-green-900 dark:text-white dark:hover:bg-green-800" };
                                                        case 'partial':
                                                            return { label: 'Em Andamento', className: "bg-yellow-500 hover:bg-yellow-600 text-white border-transparent dark:bg-yellow-900 dark:text-white dark:hover:bg-yellow-800" };
                                                        case 'viewed':
                                                            return { label: 'Visualizado', className: "bg-blue-500 hover:bg-blue-600 text-white border-transparent dark:bg-blue-900 dark:text-white dark:hover:bg-blue-800" };
                                                        default:
                                                            return { label: 'Pendente', className: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-transparent" };
                                                    }
                                                };
                                                const config = getStatusConfig(qs.status);
                                                return (
                                                    <Badge variant="outline" className={config.className}>
                                                        {config.label}
                                                    </Badge>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            {qs.public_token && quoteStatus !== 'draft' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleCopy(qs.id, qs.public_token)}
                                                    title="Copiar Link"
                                                    className={copiedId === qs.id ? "text-green-500 hover:text-green-600" : ""}
                                                >
                                                    {copiedId === qs.id ? (
                                                        <Check className="h-4 w-4" />
                                                    ) : (
                                                        <Copy className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onRemoveSupplier(qs.id)}
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                title="Remover"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
