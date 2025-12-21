import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle, Package, Building2, DollarSign } from 'lucide-react';
import { generatePOsFromQuote, validateQuoteForPO } from '@/lib/generatePOsFromQuote';
import { useNavigate } from 'react-router-dom';

interface GeneratePOModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quoteId: number;
    quoteNumber: string;
}

export function GeneratePOModal({ open, onOpenChange, quoteId, quoteNumber }: GeneratePOModalProps) {
    const [loading, setLoading] = useState(false);
    const [validating, setValidating] = useState(false);
    const [validation, setValidation] = useState<any>(null);
    const [result, setResult] = useState<any>(null);
    const navigate = useNavigate();

    // Validar quando o modal abrir
    const handleOpenChange = async (newOpen: boolean) => {
        onOpenChange(newOpen);

        if (newOpen) {
            setValidating(true);
            setResult(null);
            const validationResult = await validateQuoteForPO(quoteId);
            setValidation(validationResult);
            setValidating(false);
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        const generateResult = await generatePOsFromQuote(quoteId);
        setResult(generateResult);
        setLoading(false);
    };

    const handleViewPO = (poId: number) => {
        navigate(`/purchase-orders/${poId}`);
        onOpenChange(false);
    };

    const handleViewAllPOs = () => {
        navigate('/purchase-orders');
        onOpenChange(false);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Gerar Purchase Orders</DialogTitle>
                    <DialogDescription>
                        Cotação: {quoteNumber}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Validação */}
                    {validating && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="ml-2">Verificando cotação...</span>
                        </div>
                    )}

                    {validation && !result && !validating && (
                        <>
                            {validation.valid ? (
                                <Alert>
                                    <CheckCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        {validation.message}
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        {validation.message}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {validation.valid && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-blue-900 mb-2">
                                        O que será criado:
                                    </h4>
                                    <ul className="text-sm text-blue-800 space-y-1">
                                        <li>• Um Purchase Order para cada fornecedor vencedor</li>
                                        <li>• Números de PO gerados automaticamente</li>
                                        <li>• Todos os itens agrupados por fornecedor</li>
                                        <li>• Status inicial: Rascunho (Draft)</li>
                                    </ul>
                                </div>
                            )}
                        </>
                    )}

                    {/* Resultado */}
                    {result && (
                        <>
                            {result.success ? (
                                <div className="space-y-4">
                                    <Alert>
                                        <CheckCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            {result.pos.length} Purchase Order(s) criado(s) com sucesso!
                                        </AlertDescription>
                                    </Alert>

                                    {/* Lista de POs criados */}
                                    <div className="space-y-2">
                                        {result.pos.map((po: any) => (
                                            <div
                                                key={po.po_id}
                                                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-lg">{po.po_number}</p>
                                                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                                            <Building2 className="h-4 w-4" />
                                                            {po.supplier_name}
                                                        </div>
                                                        <div className="flex items-center gap-4 mt-2 text-sm">
                                                            <div className="flex items-center gap-1">
                                                                <Package className="h-4 w-4 text-muted-foreground" />
                                                                <span>{po.items_count} {po.items_count === 1 ? 'item' : 'itens'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 font-semibold">
                                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                                {formatCurrency(po.total_amount)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleViewPO(po.po_id)}
                                                    >
                                                        Ver Detalhes
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        {result.error}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter>
                    {!result && !validating && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleGenerate}
                                disabled={loading || !validation?.valid}
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Gerar Purchase Orders
                            </Button>
                        </>
                    )}

                    {result?.success && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Fechar
                            </Button>
                            <Button onClick={handleViewAllPOs}>
                                Ver Todos os POs
                            </Button>
                        </>
                    )}

                    {result && !result.success && (
                        <Button onClick={() => onOpenChange(false)}>
                            Fechar
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
