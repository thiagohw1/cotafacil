import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePurchaseOrder } from '@/hooks/usePurchaseOrders';
import { POStatusBadge } from '@/components/purchase-orders/POStatusBadge';
import { AddPOItemForm } from '@/components/purchase-orders/AddPOItemForm';
import { EditPOItemModal } from '@/components/purchase-orders/EditPOItemModal';
import { ExportPDFButton } from '@/components/purchase-orders/ExportPDFButton';
import { SendEmailModal } from '@/components/purchase-orders/SendEmailModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ArrowLeft,
    Building2,
    Calendar,
    FileText,
    Trash2,
    Send,
    CheckCircle,
    Ban,
    Edit,
    Trash,
    Mail,
    DollarSign,
    Info,
    ArrowUpRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { POStatus, PurchaseOrderItem } from '@/types/purchase-orders';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function PurchaseOrderView() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { purchaseOrder, loading, updateStatus, deletePurchaseOrder, refetch } = usePurchaseOrder(Number(id));
    const { toast } = useToast();

    const [editingItem, setEditingItem] = useState<PurchaseOrderItem | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [emailModalOpen, setEmailModalOpen] = useState(false);

    const handleStatusChange = async (newStatus: POStatus) => {
        if (confirm(`Alterar status para "${newStatus}" ? `)) {
            await updateStatus(newStatus);
        }
    };

    const handleDelete = async () => {
        if (confirm('Tem certeza que deseja excluir este Purchase Order? Esta ação não pode ser desfeita.')) {
            const success = await deletePurchaseOrder();
            if (success) {
                navigate('/purchase-orders');
            }
        }
    };

    const handleDeleteItem = async (itemId: number) => {
        if (!confirm('Tem certeza que deseja remover este item?')) return;

        const { error } = await supabase
            .from('purchase_order_items')
            .delete()
            .eq('id', itemId);

        if (error) {
            toast({
                title: 'Erro ao remover item',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Item removido!',
                description: 'O item foi removido e os totais foram recalculados',
            });
            refetch(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    if (loading) {
        return (
            <div className="container mx-auto p-6 max-w-5xl">
                <Skeleton className="h-8 w-64 mb-6" />
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!purchaseOrder) {
        return (
            <div className="container mx-auto p-6 max-w-5xl">
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                        <p className="text-red-800 text-center">
                            Purchase Order não encontrado
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            {/* Header */}
            {/* Header Unificado & Compacto */}
            <Card className="mb-6">
                <CardHeader className="pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => navigate('/purchase-orders')}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <h1 className="text-2xl font-bold tracking-tight">{purchaseOrder.po_number}</h1>
                                <POStatusBadge status={purchaseOrder.status} />
                            </div>
                        </div>
                        {/* Total Value Highlight - Top Right */}
                        <div className="flex flex-col items-end">
                            <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Valor Total</span>
                            <span className="text-3xl font-bold text-primary">
                                {formatCurrency(purchaseOrder.total_amount)}
                            </span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
                        {/* Col 1: Fornecedor */}
                        <div className="flex flex-col space-y-2 border-l-4 border-primary/20 pl-3">
                            <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                                <Building2 className="h-3 w-3" /> Fornecedor
                            </span>
                            <div>
                                <p className="font-semibold text-base leading-tight">
                                    {purchaseOrder.supplier?.name || `Fornecedor #${purchaseOrder.supplier_id}`}
                                </p>
                                {purchaseOrder.supplier?.email && (
                                    <a href={`mailto:${purchaseOrder.supplier.email}`} className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mt-1">
                                        <Mail className="h-3 w-3" /> {purchaseOrder.supplier.email}
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Col 2: Datas */}
                        <div className="flex flex-col space-y-2 border-l-4 border-primary/20 pl-3">
                            <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                                <Calendar className="h-3 w-3" /> Datas
                            </span>
                            <div className="space-y-1">
                                <p className="text-sm">
                                    <span className="text-muted-foreground">Emissão: </span>
                                    <span className="font-medium">{format(new Date(purchaseOrder.created_at), "dd/MM/yyyy")}</span>
                                </p>
                                {purchaseOrder.expected_delivery_date && (
                                    <p className="text-sm">
                                        <span className="text-muted-foreground">Entrega: </span>
                                        <span className="font-medium">{format(new Date(purchaseOrder.expected_delivery_date), 'dd/MM/yyyy')}</span>
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Col 3: Referência / Cotação */}
                        <div className="flex flex-col space-y-2 border-l-4 border-primary/20 pl-3">
                            <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                                <FileText className="h-3 w-3" /> Referência
                            </span>
                            <div className="space-y-2">
                                {purchaseOrder.quote ? (
                                    <div className="group flex items-center gap-2 text-sm font-medium cursor-pointer hover:text-primary transition-colors" onClick={() => navigate(`/quotes/${purchaseOrder.quote_id}`)}>
                                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                                        {purchaseOrder.quote.title}
                                    </div>
                                ) : (
                                    <span className="text-sm text-muted-foreground italic">Sem cotação vinculada</span>
                                )}
                                {purchaseOrder.notes && (
                                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md italic border">
                                        "{purchaseOrder.notes}"
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Col 4: Ações Rápidas (Compact) */}
                        <div className="flex flex-col space-y-2 border-l-4 border-primary/20 pl-3 md:col-span-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                                <Info className="h-3 w-3" /> Status
                            </span>
                            <div className="flex flex-col gap-1">
                                <span className="text-sm text-muted-foreground">
                                    Itens: <span className="font-medium text-foreground">{purchaseOrder.items.length}</span>
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    Impostos: <span className="font-medium text-foreground">{formatCurrency(purchaseOrder.tax_amount)}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Formulário para Adicionar Itens (apenas em draft) */}
            {purchaseOrder.status === 'draft' && (
                <div className="mb-6">
                    <AddPOItemForm
                        poId={purchaseOrder.id}
                        existingItems={purchaseOrder.items}
                        onSuccess={() => {
                            refetch(false);
                            toast({
                                title: 'Totais atualizados',
                                description: 'Os totais do PO foram recalculados automaticamente',
                            });
                        }}
                    />
                </div>
            )}

            {/* Itens do PO */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Itens do Pedido</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead className="text-right">Quantidade</TableHead>
                                <TableHead className="text-right">Preço Unitário</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                {purchaseOrder.status === 'draft' && (
                                    <TableHead className="text-right">Ações</TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {purchaseOrder.items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={purchaseOrder.status === 'draft' ? 5 : 4} className="text-center text-muted-foreground py-8">
                                        {purchaseOrder.status === 'draft'
                                            ? 'Nenhum item adicionado ainda. Use o formulário acima para adicionar produtos.'
                                            : 'Nenhum item neste pedido.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                purchaseOrder.items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">
                                                    {item.product?.name || `Produto #${item.product_id}`}
                                                    {item.package && ` (${item.package.multiplier && item.package.multiplier > 1 ? `${item.package.unit}-${item.package.multiplier}` : item.package.unit})`}
                                                </p>
                                                {item.notes && (
                                                    <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">{item.qty}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(item.total_price)}</TableCell>
                                        {purchaseOrder.status === 'draft' && (
                                            <TableCell className="text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditingItem(item);
                                                            setEditModalOpen(true);
                                                        }}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteItem(item.id)}
                                                    >
                                                        <Trash className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {/* Totais */}
                    <div className="mt-6 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Subtotal:</span>
                            <span>{formatCurrency(purchaseOrder.subtotal)}</span>
                        </div>
                        {purchaseOrder.tax_amount > 0 && (
                            <div className="flex justify-between text-sm">
                                <span>Impostos:</span>
                                <span>{formatCurrency(purchaseOrder.tax_amount)}</span>
                            </div>
                        )}
                        {purchaseOrder.shipping_cost > 0 && (
                            <div className="flex justify-between text-sm">
                                <span>Frete:</span>
                                <span>{formatCurrency(purchaseOrder.shipping_cost)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-lg font-bold pt-2 border-t">
                            <span>Total:</span>
                            <span>{formatCurrency(purchaseOrder.total_amount)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Ações */}
            <Card>
                <CardHeader>
                    <CardTitle>Ações</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {/* Botão de Exportar PDF - disponível para todos os status */}
                        <ExportPDFButton purchaseOrder={purchaseOrder} />

                        <Button variant="outline" onClick={() => setEmailModalOpen(true)}>
                            <Mail className="h-4 w-4 mr-2" />
                            Enviar por Email
                        </Button>

                        {/* Ações por status */}
                        {purchaseOrder.status === 'draft' && (
                            <Button onClick={() => handleStatusChange('sent')}>
                                <Send className="h-4 w-4 mr-2" />
                                Enviar PO
                            </Button>
                        )}
                        {purchaseOrder.status === 'sent' && (
                            <Button onClick={() => handleStatusChange('confirmed')}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Confirmar Recebimento
                            </Button>
                        )}
                        {(purchaseOrder.status === 'draft' || purchaseOrder.status === 'sent') && (
                            <Button
                                variant="destructive"
                                onClick={() => handleStatusChange('cancelled')}
                            >
                                <Ban className="h-4 w-4 mr-2" />
                                Cancelar PO
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={handleDelete}
                            className="ml-auto"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Modal de Edição de Item */}
            <EditPOItemModal
                item={editingItem}
                open={editModalOpen}
                onOpenChange={setEditModalOpen}
                onSuccess={() => {
                    setEditModalOpen(false);
                    refetch(false);
                    toast({
                        title: 'Totais atualizados',
                        description: 'O PO foi recalculado com os novos valores',
                    });
                }}
            />

            {/* Modal de Envio de Email */}
            <SendEmailModal
                purchaseOrder={purchaseOrder}
                open={emailModalOpen}
                onOpenChange={setEmailModalOpen}
            />
        </div>
    );
}
