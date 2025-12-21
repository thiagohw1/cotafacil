import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, DollarSign, ShoppingCart } from 'lucide-react';

interface WinnersSummaryProps {
    itemsWithWinners: number;
    totalItems: number;
    totalValue: number;
    onGeneratePO?: () => void;
    canGeneratePO?: boolean;
}

export function WinnersSummary({
    itemsWithWinners,
    totalItems,
    totalValue,
    onGeneratePO,
    canGeneratePO = false
}: WinnersSummaryProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const percentage = totalItems > 0 ? Math.round((itemsWithWinners / totalItems) * 100) : 0;
    const isComplete = itemsWithWinners === totalItems && totalItems > 0;

    return (
        <Card className={isComplete ? 'border-success bg-success/5' : ''}>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className={isComplete ? 'h-5 w-5 text-success' : 'h-5 w-5 text-warning'} />
                    Resumo de Vencedores
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Progress */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                            {itemsWithWinners} de {totalItems} itens selecionados
                        </span>
                        <span className="text-sm text-muted-foreground">{percentage}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${isComplete ? 'bg-success' : 'bg-warning'}`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                </div>

                {/* Total Value */}
                {totalValue > 0 && (
                    <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">Valor Total Estimado:</span>
                        </div>
                        <span className="text-lg font-bold">{formatCurrency(totalValue)}</span>
                    </div>
                )}

                {/* Status Message */}
                <div className="text-sm">
                    {isComplete ? (
                        <>
                            <p className="text-success font-medium mb-2">
                                ✓ Todos os itens têm vencedores selecionados!
                            </p>
                            {canGeneratePO && onGeneratePO && (
                                <p className="text-muted-foreground">
                                    Você pode gerar Purchase Orders para os fornecedores vencedores.
                                </p>
                            )}
                        </>
                    ) : itemsWithWinners === 0 ? (
                        <p className="text-muted-foreground">
                            Nenhum vencedor selecionado ainda. Use o botão "Auto-selecionar" ou escolha manualmente.
                        </p>
                    ) : (
                        <p className="text-warning">
                            {totalItems - itemsWithWinners} {totalItems - itemsWithWinners === 1 ? 'item ainda precisa' : 'itens ainda precisam'} de um vencedor.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
