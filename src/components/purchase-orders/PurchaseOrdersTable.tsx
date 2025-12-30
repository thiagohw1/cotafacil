import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { POStatusBadge } from './POStatusBadge';
import { PurchaseOrder } from '@/types/purchase-orders';
import {
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    MoreHorizontal,
    Eye,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface PurchaseOrdersTableProps {
    data: PurchaseOrder[];
    loading?: boolean;
}

type SortField = 'po_number' | 'supplier' | 'created_at' | 'status' | 'total_amount' | 'created_by';
type SortDirection = 'asc' | 'desc';

export function PurchaseOrdersTable({ data, loading }: PurchaseOrdersTableProps) {
    const navigate = useNavigate();
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortedData = () => {
        return [...data].sort((a, b) => {
            let aValue: any = a[sortField];
            let bValue: any = b[sortField];

            // Handle nested/special fields
            if (sortField === 'supplier') {
                aValue = a.supplier?.name || '';
                bValue = b.supplier?.name || '';
            }

            if (sortField === 'created_by') {
                aValue = a.creator_profile?.full_name || a.creator_profile?.email || '';
                bValue = b.creator_profile?.full_name || b.creator_profile?.email || '';
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const sortedData = getSortedData();
    const totalPages = Math.ceil(sortedData.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        return sortDirection === 'asc'
            ? <ChevronUp className="ml-2 h-4 w-4" />
            : <ChevronDown className="ml-2 h-4 w-4" />;
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Carregando dados...</div>;
    }

    if (data.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">Nenhum pedido encontrado.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('po_number')}
                            >
                                <div className="flex items-center">
                                    Número PO
                                    {renderSortIcon('po_number')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('supplier')}
                            >
                                <div className="flex items-center">
                                    Fornecedor
                                    {renderSortIcon('supplier')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('created_by')}
                            >
                                <div className="flex items-center">
                                    Criado Por
                                    {renderSortIcon('created_by')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('created_at')}
                            >
                                <div className="flex items-center">
                                    Data de Criação
                                    {renderSortIcon('created_at')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('status')}
                            >
                                <div className="flex items-center">
                                    Status
                                    {renderSortIcon('status')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 text-right"
                                onClick={() => handleSort('total_amount')}
                            >
                                <div className="flex items-center justify-end">
                                    Valor Total
                                    {renderSortIcon('total_amount')}
                                </div>
                            </TableHead>
                            <TableHead className="w-[100px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.map((po) => (
                            <TableRow
                                key={po.id}
                                className="hover:bg-muted/50 cursor-pointer"
                                onDoubleClick={() => navigate(`/purchase-orders/${po.id}`)}
                            >
                                <TableCell className="font-medium">
                                    {po.po_number}
                                </TableCell>
                                <TableCell>
                                    {po.supplier?.name || `Fornecedor #${po.supplier_id}`}
                                </TableCell>
                                <TableCell>
                                    {po.creator_profile?.full_name || po.creator_profile?.email || '-'}
                                </TableCell>
                                <TableCell>
                                    {format(new Date(po.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </TableCell>
                                <TableCell>
                                    <POStatusBadge status={po.status} />
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(po.total_amount)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Abrir menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                Ver Detalhes
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Mostrando {startIndex + 1} a {Math.min(startIndex + pageSize, sortedData.length)} de {sortedData.length} registros
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Anterior
                        </Button>
                        <span className="text-sm font-medium">
                            Página {currentPage} de {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Próximo
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
