import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { PurchaseOrder } from '@/types/purchase-orders';
import { useToast } from '@/hooks/use-toast';
import { PO_STATUS_LABELS } from '@/types/purchase-orders';

interface ExportExcelButtonProps {
    purchaseOrders: PurchaseOrder[];
}

export function ExportExcelButton({ purchaseOrders }: ExportExcelButtonProps) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const formatCurrency = (value: number) => {
        return `R$ ${value.toFixed(2).replace('.', ',')}`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const handleExportExcel = () => {
        try {
            setLoading(true);

            // Preparar dados para o Excel
            const excelData = purchaseOrders.map(po => ({
                'Número PO': po.po_number,
                'Status': PO_STATUS_LABELS[po.status] || po.status,
                'Fornecedor': po.supplier?.name || `#${po.supplier_id}`,
                'Data Criação': formatDate(po.created_at),
                'Entrega Esperada': po.expected_delivery_date ? formatDate(po.expected_delivery_date) : '-',
                'Subtotal': formatCurrency(po.subtotal),
                'Impostos': formatCurrency(po.tax_amount),
                'Frete': formatCurrency(po.shipping_cost),
                'Total': formatCurrency(po.total_amount),
                'Cotação': po.quote?.title || '-',
            }));

            // Criar workbook
            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Orders');

            // Ajustar largura das colunas
            const columnWidths = [
                { wch: 15 }, // Número PO
                { wch: 12 }, // Status
                { wch: 25 }, // Fornecedor
                { wch: 15 }, // Data Criação
                { wch: 15 }, // Entrega Esperada
                { wch: 15 }, // Subtotal
                { wch: 12 }, // Impostos
                { wch: 12 }, // Frete
                { wch: 15 }, // Total
                { wch: 20 }, // Cotação
            ];
            worksheet['!cols'] = columnWidths;

            // Gerar arquivo Excel
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // Salvar arquivo
            const fileName = `Purchase_Orders_${new Date().toISOString().split('T')[0]}.xlsx`;
            saveAs(blob, fileName);

            toast({
                title: 'Excel gerado com sucesso!',
                description: `${purchaseOrders.length} Purchase Orders exportados`,
            });
        } catch (error) {
            console.error('Erro ao gerar Excel:', error);
            toast({
                title: 'Erro ao gerar Excel',
                description: 'Ocorreu um erro ao exportar os dados',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            onClick={handleExportExcel}
            disabled={loading || purchaseOrders.length === 0}
            variant="outline"
            size="default"
        >
            {loading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando Excel...
                </>
            ) : (
                <>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar para Excel
                </>
            )}
        </Button>
    );
}
