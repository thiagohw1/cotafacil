import { Card, CardContent } from '@/components/ui/card';
import { Trophy, DollarSign } from 'lucide-react';

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
}: WinnersSummaryProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const isComplete = itemsWithWinners === totalItems && totalItems > 0;

    return (
        <Card className={isComplete ? 'border-success/50' : ''}>
            <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                    {/* Left side - Status */}
                    <div className="flex items-center gap-3">
                        <Trophy className={isComplete ? 'h-5 w-5 text-success' : 'h-5 w-5 text-warning'} />
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                    {itemsWithWinners} de {totalItems} itens
                                </span>
                                {isComplete && (
                                    <span className="text-xs text-success">✓ Completo</span>
                                )}
                            </div>
                            {!isComplete && itemsWithWinners > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {totalItems - itemsWithWinners} pendente{totalItems - itemsWithWinners !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right side - Total Value */}
                    {totalValue > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">{formatCurrency(totalValue)}</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
