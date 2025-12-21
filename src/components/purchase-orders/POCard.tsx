import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { POStatusBadge } from './POStatusBadge';
import { PurchaseOrder } from '@/types/purchase-orders';
import { Eye, Building2, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface POCardProps {
    purchaseOrder: PurchaseOrder;
}

export function POCard({ purchaseOrder }: POCardProps) {
    const navigate = useNavigate();

    const handleViewDetails = () => {
        navigate(`/purchase-orders/${purchaseOrder.id}`);
    };

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <CardTitle className="text-lg font-semibold">
                            {purchaseOrder.po_number}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(purchaseOrder.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </div>
                    </div>
                    <POStatusBadge status={purchaseOrder.status} />
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Fornecedor */}
                <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                        {purchaseOrder.supplier?.name || `Fornecedor #${purchaseOrder.supplier_id}`}
                    </span>
                </div>

                {/* Total */}
                <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-lg">
                        {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                        }).format(purchaseOrder.total_amount)}
                    </span>
                </div>

                {/* Data de entrega esperada */}
                {purchaseOrder.expected_delivery_date && (
                    <div className="text-xs text-muted-foreground">
                        Entrega prevista: {format(new Date(purchaseOrder.expected_delivery_date), "dd/MM/yyyy")}
                    </div>
                )}

                {/* Notas (preview) */}
                {purchaseOrder.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {purchaseOrder.notes}
                    </p>
                )}

                {/* Botão de ação */}
                <div className="pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleViewDetails}
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalhes
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
