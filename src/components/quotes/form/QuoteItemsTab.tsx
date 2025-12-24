import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Package } from "lucide-react";
import { QuoteItem, Product } from "../../../types/quote";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface QuoteItemsTabProps {
    items: QuoteItem[];
    products: Product[];
    isEditing: boolean;
    onRemoveItem: (id: number) => void;
    onUpdateItem: (itemId: number, updates: Partial<QuoteItem>) => void;
    onImportList?: () => void;
    loading?: boolean;
}

export function QuoteItemsTab({
    items,
    products,
    isEditing,
    onRemoveItem,
    onUpdateItem,
    onImportList,
    loading
}: QuoteItemsTabProps) {
    const [editingCell, setEditingCell] = useState<{ itemId: number; field: 'package' | 'quantity' } | null>(null);

    return (
        <div className="space-y-6">
            <div className="border rounded-md overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">Código</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead className="min-w-[150px]">Embalagem</TableHead>
                            <TableHead className="min-w-[100px]">Quantidade</TableHead>
                            <TableHead className="w-[50px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Package className="h-8 w-8 opacity-50" />
                                        <p>Nenhum item adicionado à cotação.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => {
                                // Look up the full product to get packages
                                const fullProduct = products.find(p => p.id === item.product_id);
                                const productPackages = fullProduct?.packages || [];
                                const isEditingPackage = editingCell?.itemId === item.id && editingCell?.field === 'package';
                                const isEditingQuantity = editingCell?.itemId === item.id && editingCell?.field === 'quantity';

                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {item.product_id}
                                        </TableCell>
                                        <TableCell className="font-medium min-w-[150px]">
                                            {item.product?.name || fullProduct?.name}
                                        </TableCell>
                                        <TableCell
                                            onDoubleClick={() => item.id && setEditingCell({ itemId: item.id!, field: 'package' })}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        >
                                            {isEditingPackage ? (
                                                <Select
                                                    value={item.package_id?.toString() || "standard"}
                                                    onValueChange={(val) => {
                                                        const packageId = val === "standard" ? null : parseInt(val);
                                                        if (item.id) onUpdateItem(item.id, { package_id: packageId });
                                                        setEditingCell(null);
                                                    }}
                                                    open={true}
                                                    onOpenChange={(open) => !open && setEditingCell(null)}
                                                    disabled={loading}
                                                >
                                                    <SelectTrigger className="w-[100px]">
                                                        <SelectValue placeholder="Padrão" />
                                                    </SelectTrigger>
                                                    <SelectContent>

                                                        {productPackages.map(pkg => (
                                                            <SelectItem key={pkg.id} value={pkg.id.toString()}>
                                                                {pkg.unit}-{pkg.multiplier}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span className="flex items-center w-[100px]">
                                                    {item.package
                                                        ? `${item.package.unit}-${item.package.multiplier}`
                                                        : "Unidade-1"}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onDoubleClick={() => item.id && setEditingCell({ itemId: item.id!, field: 'quantity' })}
                                        >
                                            {isEditingQuantity ? (
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    autoFocus
                                                    defaultValue={item.requested_qty || ""}
                                                    className="w-[100px]"
                                                    onBlur={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        if (item.id && val !== item.requested_qty) {
                                                            onUpdateItem(item.id, { requested_qty: val });
                                                        }
                                                        setEditingCell(null);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    disabled={loading}
                                                />
                                            ) : (
                                                <span className="flex items-center w-[100px]">
                                                    {item.requested_qty}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => item.id && onRemoveItem(item.id)}
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                disabled={loading}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
            {onImportList && (
                <div className="flex justify-end">
                    <Button variant="outline" onClick={onImportList}>
                        Importar Lista
                    </Button>
                </div>
            )}
        </div>
    );
}

