import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { ImportListItem, ProductList } from "@/types/quote";

interface QuoteImportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productLists: ProductList[];
    selectedListId: string;
    setSelectedListId: (id: string) => void;
    importListItems: ImportListItem[];
    onOpenImportModal: () => void;
    onConfirmImport: () => void;
    onUpdateImportItem: (index: number, field: "package_id" | "requested_qty", value: string) => void;
    importingList: boolean;
}

export function QuoteImportModal({
    open,
    onOpenChange,
    productLists,
    selectedListId,
    setSelectedListId,
    importListItems,
    onOpenImportModal,
    onConfirmImport,
    onUpdateImportItem,
    importingList
}: QuoteImportModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Importar Lista de Produtos</DialogTitle>
                </DialogHeader>

                <div className="flex items-end gap-4 py-4">
                    <div className="flex-1 space-y-2">
                        <label className="text-sm font-medium">Selecione uma lista</label>
                        <Select value={selectedListId} onValueChange={setSelectedListId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                {productLists.map((list) => (
                                    <SelectItem key={list.id} value={list.id.toString()}>
                                        {list.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={onOpenImportModal} disabled={!selectedListId}>
                        Carregar Itens
                    </Button>
                </div>

                {importListItems.length > 0 && (
                    <div className="flex-1 overflow-y-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead>Embalagem</TableHead>
                                    <TableHead className="w-32">Quantidade</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {importListItems.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{item.product_name}</TableCell>
                                        <TableCell>
                                            {item.packages.length > 0 ? (
                                                <Select
                                                    value={item.package_id?.toString() || ""}
                                                    onValueChange={(value) =>
                                                        onUpdateImportItem(index, "package_id", value)
                                                    }
                                                >
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Padrão" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="">Padrão</SelectItem>
                                                        {item.packages.map((pkg) => (
                                                            <SelectItem key={pkg.id} value={pkg.id.toString()}>
                                                                {pkg.unit} ({pkg.multiplier}x)
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">Unidade</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="h-8"
                                                value={item.requested_qty}
                                                onChange={(e) =>
                                                    onUpdateImportItem(index, "requested_qty", e.target.value)
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={onConfirmImport}
                        disabled={importListItems.length === 0 || importingList}
                    >
                        {importingList && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Importação
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
