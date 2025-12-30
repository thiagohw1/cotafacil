import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { PurchaseOrderWithItems } from '@/types/purchase-orders';

// Estilos do PDF
const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontSize: 9,
        fontFamily: 'Helvetica',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        borderBottom: '1 solid #0066cc',
        paddingBottom: 8,
    },
    headerCol: {
        flexDirection: 'column',
    },
    poNumber: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0066cc',
    },
    label: {
        fontSize: 8,
        color: '#666',
        marginTop: 2,
    },
    value: {
        fontSize: 9,
        color: '#333',
        fontWeight: 'bold',
    },
    section: {
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#333',
        borderBottom: '1 solid #eee',
        paddingBottom: 2,
    },
    infoGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    infoItem: {
        flex: 1,
    },
    table: {
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f3f4f6',
        borderBottom: '1 solid #ddd',
        padding: 6,
        alignItems: 'center',
    },
    tableHeaderCell: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#444',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: '1 solid #eee',
        padding: 6,
        alignItems: 'center',
    },
    tableRowAlt: {
        flexDirection: 'row',
        borderBottom: '1 solid #eee',
        backgroundColor: '#fafafa',
        padding: 6,
        alignItems: 'center',
    },
    // Columns - Adjusted widths for 6 columns
    colProduct: { width: '30%' },
    colPkg: { width: '10%' },
    colQty: { width: '10%', textAlign: 'right' },
    colPriceUn: { width: '15%', textAlign: 'right' },
    colPricePkg: { width: '15%', textAlign: 'right' },
    colTotal: { width: '20%', textAlign: 'right' },

    tableCell: {
        fontSize: 9,
        color: '#333',
    },
    productName: {
        fontSize: 9,
    },
    productMeta: {
        fontSize: 8,
        color: '#666',
    },
    totals: {
        marginTop: 15,
        alignSelf: 'flex-end',
        width: '40%',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    totalLabel: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#666',
    },
    totalValue: {
        fontSize: 9,
        textAlign: 'right',
    },
    grandTotal: {
        borderTop: '1 solid #0066cc',
        paddingTop: 4,
        marginTop: 4,
    },
    grandTotalLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#0066cc',
    },
    grandTotalValue: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#0066cc',
    },
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 30,
        right: 30,
        textAlign: 'center',
        color: '#999',
        fontSize: 7,
        borderTop: '1 solid #eee',
        paddingTop: 8,
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
                {/* Header Compacto */}
                <View style={styles.headerRow}>
                    <View style={[styles.headerCol, { flex: 2 }]}>
                        <Text style={styles.poNumber}>PO #{po.po_number}</Text>
                        <Text style={styles.label}>
                            Status: <Text style={{ color: '#000' }}>{getStatusLabel(po.status)}</Text>
                        </Text>
                    </View>

                    <View style={[styles.headerCol, { flex: 2 }]}>
                        <Text style={styles.label}>Fornecedor</Text>
                        <Text style={styles.value}>{po.supplier?.name || `Fornecedor #${po.supplier_id}`}</Text>
                        {po.supplier?.email && <Text style={{ fontSize: 8, color: '#666' }}>{po.supplier.email}</Text>}
                    </View>

                    <View style={[styles.headerCol, { flex: 1, alignItems: 'flex-end' }]}>
                        <Text style={styles.label}>Emissão</Text>
                        <Text style={styles.value}>{formatDate(po.created_at)}</Text>
                    </View>

                    {po.expected_delivery_date && (
                        <View style={[styles.headerCol, { flex: 1, alignItems: 'flex-end' }]}>
                            <Text style={styles.label}>Entrega</Text>
                            <Text style={styles.value}>{formatDate(po.expected_delivery_date)}</Text>
                        </View>
                    )}
                </View>

                {/* Author Info */}
                {po.creator_profile && (
                    <View style={[styles.section, { marginBottom: 15 }]}>
                        <Text style={{ fontSize: 8, color: '#888' }}>
                            Criado por: <Text style={{ color: '#555' }}>{po.creator_profile.full_name || po.creator_profile.email}</Text>
                        </Text>
                    </View>
                )}

                {/* Tabela de Itens */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, styles.colProduct]}>Produto</Text>
                        <Text style={[styles.tableHeaderCell, styles.colPkg]}>Emb.</Text>
                        <Text style={[styles.tableHeaderCell, styles.colQty]}>Qtd</Text>
                        <Text style={[styles.tableHeaderCell, styles.colPriceUn]}>Preço Un.</Text>
                        <Text style={[styles.tableHeaderCell, styles.colPricePkg]}>Preço Emb.</Text>
                        <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
                    </View>

                    {po.items.map((item, index) => (
                        <View key={item.id} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                            <View style={styles.colProduct}>
                                <Text style={styles.productName}>
                                    <Text style={{ color: '#888', fontSize: 8 }}>#{item.product_id} </Text>
                                    {item.product?.name || `Produto #${item.product_id}`}
                                    {item.product?.unit && <Text style={{ color: '#888', fontSize: 8 }}> ({item.product.unit})</Text>}
                                </Text>
                                {item.notes && <Text style={{ fontSize: 8, color: '#666', fontStyle: 'italic', marginTop: 1 }}>{item.notes}</Text>}
                            </View>

                            <View style={styles.colPkg}>
                                <Text style={styles.tableCell}>
                                    {item.package
                                        ? (item.package.multiplier > 1 ? `${item.package.unit}-${item.package.multiplier}` : item.package.unit)
                                        : '-'
                                    }
                                </Text>
                            </View>

                            <Text style={[styles.tableCell, styles.colQty]}>{item.qty}</Text>

                            <Text style={[styles.tableCell, styles.colPriceUn]}>
                                {item.package && item.package.multiplier > 1
                                    ? formatCurrency(item.unit_price / item.package.multiplier)
                                    : formatCurrency(item.unit_price)
                                }
                            </Text>

                            <Text style={[styles.tableCell, styles.colPricePkg]}>{formatCurrency(item.unit_price)}</Text>

                            <Text style={[styles.tableCell, styles.colTotal, { fontWeight: 'bold' }]}>{formatCurrency(item.total_price)}</Text>
                        </View>
                    ))}
                </View>

                {/* Totais */}
                <View style={styles.totals}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal</Text>
                        <Text style={styles.totalValue}>{formatCurrency(po.subtotal)}</Text>
                    </View>
                    {po.tax_amount > 0 && (
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Impostos</Text>
                            <Text style={styles.totalValue}>{formatCurrency(po.tax_amount)}</Text>
                        </View>
                    )}
                    {po.shipping_cost > 0 && (
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Frete</Text>
                            <Text style={styles.totalValue}>{formatCurrency(po.shipping_cost)}</Text>
                        </View>
                    )}
                    <View style={[styles.totalRow, styles.grandTotal]}>
                        <Text style={styles.grandTotalLabel}>TOTAL</Text>
                        <Text style={styles.grandTotalValue}>{formatCurrency(po.total_amount)}</Text>
                    </View>
                </View>

                {/* Observações - Footer interno */}
                {po.notes && (
                    <View style={{ marginTop: 20, paddingTop: 10, borderTop: '1 solid #eee' }}>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 2 }}>Observações:</Text>
                        <Text style={{ fontSize: 9, color: '#555' }}>{po.notes}</Text>
                    </View>
                )}

                {/* Footer Página */}
                <View style={styles.footer}>
                    <Text>Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</Text>
                </View>
            </Page>
        </Document>
    );
}
