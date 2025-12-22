import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { PurchaseOrderWithItems } from '@/types/purchase-orders';

// Estilos do PDF
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: 'Helvetica',
    },
    header: {
        marginBottom: 20,
        borderBottom: '2 solid #0066cc',
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0066cc',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 12,
        color: '#666',
    },
    section: {
        marginTop: 15,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
        borderBottom: '1 solid #ddd',
        paddingBottom: 4,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    label: {
        width: '30%',
        fontWeight: 'bold',
        color: '#555',
    },
    value: {
        width: '70%',
        color: '#333',
    },
    table: {
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#0066cc',
        color: 'white',
        padding: 8,
        fontWeight: 'bold',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: '1 solid #ddd',
        padding: 8,
    },
    tableRowAlt: {
        flexDirection: 'row',
        borderBottom: '1 solid #ddd',
        backgroundColor: '#f9f9f9',
        padding: 8,
    },
    col1: { width: '40%' },
    col2: { width: '20%', textAlign: 'right' },
    col3: { width: '20%', textAlign: 'right' },
    col4: { width: '20%', textAlign: 'right' },
    totals: {
        marginTop: 20,
        marginLeft: '60%',
    },
    totalRow: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    totalLabel: {
        width: '50%',
        fontWeight: 'bold',
        textAlign: 'right',
        paddingRight: 10,
    },
    totalValue: {
        width: '50%',
        textAlign: 'right',
    },
    grandTotal: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0066cc',
        borderTop: '2 solid #0066cc',
        paddingTop: 5,
        marginTop: 5,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        color: '#999',
        fontSize: 8,
        borderTop: '1 solid #ddd',
        paddingTop: 10,
    },
    statusBadge: {
        padding: '4 8',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    statusDraft: {
        backgroundColor: '#f3f4f6',
        color: '#374151',
    },
    statusSent: {
        backgroundColor: '#dbeafe',
        color: '#1e40af',
    },
    statusConfirmed: {
        backgroundColor: '#dcfce7',
        color: '#166534',
    },
});

interface POPDFTemplateProps {
    po: PurchaseOrderWithItems;
}

export function POPDFTemplate({ po }: POPDFTemplateProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            draft: 'Rascunho',
            sent: 'Enviado',
            confirmed: 'Confirmado',
            delivered: 'Entregue',
            cancelled: 'Cancelado',
        };
        return labels[status] || status;
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Cabeçalho */}
                <View style={styles.header}>
                    <Text style={styles.title}>PURCHASE ORDER</Text>
                    <Text style={styles.subtitle}>Pedido de Compra #{po.po_number}</Text>
                </View>

                {/* Informações do PO */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Informações do Pedido</Text>

                    <View style={styles.row}>
                        <Text style={styles.label}>Status:</Text>
                        <Text style={styles.value}>{getStatusLabel(po.status)}</Text>
                    </View>

                    <View style={styles.row}>
                        <Text style={styles.label}>Data de Criação:</Text>
                        <Text style={styles.value}>{formatDate(po.created_at)}</Text>
                    </View>

                    {po.expected_delivery_date && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Entrega Esperada:</Text>
                            <Text style={styles.value}>{formatDate(po.expected_delivery_date)}</Text>
                        </View>
                    )}
                </View>

                {/* Fornecedor */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Fornecedor</Text>

                    <View style={styles.row}>
                        <Text style={styles.label}>Nome:</Text>
                        <Text style={styles.value}>{po.supplier?.name || `Fornecedor #${po.supplier_id}`}</Text>
                    </View>

                    {po.supplier?.email && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Email:</Text>
                            <Text style={styles.value}>{po.supplier.email}</Text>
                        </View>
                    )}
                </View>

                {/* Tabela de Itens */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Itens do Pedido</Text>

                    <View style={styles.table}>
                        {/* Header */}
                        <View style={styles.tableHeader}>
                            <Text style={styles.col1}>Produto</Text>
                            <Text style={styles.col2}>Qtd</Text>
                            <Text style={styles.col3}>Preço Unit.</Text>
                            <Text style={styles.col4}>Total</Text>
                        </View>

                        {/* Rows */}
                        {po.items.map((item, index) => (
                            <View
                                key={item.id}
                                style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                            >
                                <Text style={styles.col1}>
                                    {item.product?.name || `Produto #${item.product_id}`}
                                    {item.package && ` (${item.package.multiplier && item.package.multiplier > 1 ? `${item.package.unit}-${item.package.multiplier}` : item.package.unit})`}
                                    {item.notes && `\n${item.notes}`}
                                </Text>
                                <Text style={styles.col2}>{item.qty}</Text>
                                <Text style={styles.col3}>{formatCurrency(item.unit_price)}</Text>
                                <Text style={styles.col4}>{formatCurrency(item.total_price)}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Totais */}
                <View style={styles.totals}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal:</Text>
                        <Text style={styles.totalValue}>{formatCurrency(po.subtotal)}</Text>
                    </View>

                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Impostos:</Text>
                        <Text style={styles.totalValue}>{formatCurrency(po.tax_amount)}</Text>
                    </View>

                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Frete:</Text>
                        <Text style={styles.totalValue}>{formatCurrency(po.shipping_cost)}</Text>
                    </View>

                    <View style={[styles.totalRow, styles.grandTotal]}>
                        <Text style={styles.totalLabel}>TOTAL:</Text>
                        <Text style={styles.totalValue}>{formatCurrency(po.total_amount)}</Text>
                    </View>
                </View>

                {/* Observações */}
                {po.notes && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Observações</Text>
                        <Text>{po.notes}</Text>
                    </View>
                )}

                {/* Footer */}
                <View style={styles.footer}>
                    <Text>Documento gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</Text>
                    <Text>Este é um documento oficial de Purchase Order</Text>
                </View>
            </Page>
        </Document>
    );
}
