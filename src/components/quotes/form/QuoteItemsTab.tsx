import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Package } from "lucide-react";
import { QuoteItem, Product } from "../../../types/quote";
import { Combobox } from "@/components/ui/combobox";

interface QuoteItemsTabProps {
    items: QuoteItem[];
    products: Product[];
    isEditing: boolean;
    newItem: {
        product_id: string;
        package_id: string;
        requested_qty: string;
    };
    setNewItem: (item: any) => void;
    onAddItem: () => void;
    onRemoveItem: (id: number) => void;
    onImportList?: () => void;
    loading?: boolean;
}

export function QuoteItemsTab({
    items,
    products,
    isEditing,
    newItem,
    setNewItem,
    onAddItem,
    onRemoveItem,
    onImportList,
    loading
}: QuoteItemsTabProps) {
    const selectedProduct = products.find(
        (p) => p.id.toString() === newItem.product_id
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-end bg-muted/30 p-4 rounded-lg border">
                <div className="w-full md:flex-1 space-y-2">
                    <label className="text-sm font-medium">Produto</label>
                    <Combobox
                        options={products.map(p => ({ value: p.id.toString(), label: p.name }))}
                        value={newItem.product_id}
                        onValueChange={(value) => {
                            const product = products.find(p => p.id.toString() === value);
                            const defaultPackage = product?.packages?.find(pkg => pkg.is_default);
                            setNewItem({
                                ...newItem,
                                product_id: value,
                                package_id: defaultPackage ? defaultPackage.id.toString() : ""
                            });
                        }}
                        placeholder="Selecione um produto"
                        searchPlaceholder="Buscar produto..."
                        emptyText="Nenhum produto encontrado"
                        className="w-full"
                    />
                </div>

                {selectedProduct && selectedProduct.packages.length > 0 && (
                    <div className="w-full md:w-48 space-y-2">
                        <label className="text-sm font-medium">Embalagem</label>
                        <Select
                            value={newItem.package_id || "standard"}
                            onValueChange={(value) =>
                                setNewItem({ ...newItem, package_id: value === "standard" ? "" : value })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Padrão" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="standard">Padrão (1 un)</SelectItem>
                                {selectedProduct.packages.map((pkg) => (
                                    <SelectItem key={pkg.id} value={pkg.id.toString()}>
                                        {pkg.unit}-{pkg.multiplier}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="w-full md:w-32 space-y-2">
                    <label className="text-sm font-medium">Quantidade</label>
                    <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={newItem.requested_qty}
                        onChange={(e) =>
                            setNewItem({ ...newItem, requested_qty: e.target.value })
                        }
                    />
                </div>

                <Button onClick={onAddItem} disabled={loading} className="w-full md:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                </Button>
                {onImportList && (
                    <Button variant="outline" onClick={onImportList} className="w-full md:w-auto">
                        Importar Lista
                    </Button>
                )}
            </div>

            <div className="border rounded-md overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Embalagem</TableHead>
                            <TableHead className="text-right">Quantidade</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Package className="h-8 w-8 opacity-50" />
                                        <p>Nenhum item adicionado à cotação.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium min-w-[150px]">
                                        {item.product?.name}
                                    </TableCell>
                                    <TableCell>
                                        {item.package
                                            ? `${item.package.unit}-${item.package.multiplier}`
                                            : "Unidade-1"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {item.requested_qty}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => item.id && onRemoveItem(item.id)}
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
    );
}
