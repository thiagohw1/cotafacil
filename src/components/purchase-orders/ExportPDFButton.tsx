import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { POPDFTemplate } from '@/templates/POPDFTemplate';
import { PurchaseOrderWithItems } from '@/types/purchase-orders';
import { useToast } from '@/hooks/use-toast';

interface ExportPDFButtonProps {
    purchaseOrder: PurchaseOrderWithItems;
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg';
}

export function ExportPDFButton({ purchaseOrder, variant = 'outline', size = 'default' }: ExportPDFButtonProps) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleExportPDF = async () => {
        try {
            setLoading(true);

            // Gerar o PDF
            const blob = await pdf(<POPDFTemplate po={purchaseOrder} />).toBlob();

            // Criar link para download
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `PO_${purchaseOrder.po_number}.pdf`;

            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Limpar URL
            URL.revokeObjectURL(url);

            toast({
                title: 'PDF gerado com sucesso!',
                description: `Purchase Order #${purchaseOrder.po_number} exportado`,
            });
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            toast({
                title: 'Erro ao gerar PDF',
                description: 'Ocorreu um erro ao exportar o documento',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            onClick={handleExportPDF}
            disabled={loading}
            variant={variant}
            size={size}
        >
            {loading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando PDF...
                </>
            ) : (
                <>
                    <FileDown className="mr-2 h-4 w-4" />
                    Exportar PDF
                </>
            )}
        </Button>
    );
}
