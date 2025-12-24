import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Users, Plus, Copy, Check } from "lucide-react";
import { QuoteSupplier, Supplier } from "@/types/quote";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { useState } from "react";

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
