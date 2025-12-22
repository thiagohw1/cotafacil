import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Users, Link as LinkIcon, Plus } from "lucide-react";
import { QuoteSupplier, Supplier } from "@/types/quote";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";

interface QuoteSuppliersTabProps {
    quoteSuppliers: QuoteSupplier[];
    suppliers: Supplier[];
    onAddSuppliers: (ids: number[]) => void;
    onRemoveSupplier: (id: number) => void;
    onCopyLink: (token: string) => void;
    loading?: boolean;
}

export function QuoteSuppliersTab({
    quoteSuppliers,
    suppliers,
    onAddSuppliers,
    onRemoveSupplier,
    onCopyLink,
    loading
}: QuoteSuppliersTabProps) {
    // Filter suppliers that are not already in the quote
    const availableSuppliers = suppliers.filter(
        (s) => !quoteSuppliers.some((qs) => qs.supplier_id === s.id)
    );

    const supplierOptions = availableSuppliers.map((s) => ({
        value: s.id.toString(),
        label: s.name,
    }));

    const handleSelectSupplier = (value: string) => {
        if (value) {
            onAddSuppliers([parseInt(value)]);
        }
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
                        <Combobox
                            options={supplierOptions}
                            value=""
                            onValueChange={handleSelectSupplier}
                            placeholder="Selecione um fornecedor para adicionar..."
                            searchPlaceholder="Buscar fornecedor..."
                            emptyText="Nenhum fornecedor disponível."
                            disabled={loading}
                            className="w-full"
                        />
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
                                            <Badge variant={qs.status === 'responded' ? 'default' : 'secondary'}>
                                                {qs.status === 'responded' ? 'Respondido' : 'Pendente'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            {qs.public_token && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => onCopyLink(qs.public_token)}
                                                    title="Copiar Link"
                                                >
                                                    <LinkIcon className="h-4 w-4" />
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
