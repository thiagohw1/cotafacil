import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { PurchaseOrderWithItems } from '@/types/purchase-orders';

// Estilos do PDF
const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontSize: 9,
        fontFamily: 'Helvetica',
        color: '#333',
    },
    // Header Grid System
    headerContainer: {
        flexDirection: 'row',
        paddingBottom: 5,
        marginBottom: 5,
        justifyContent: 'space-between',
    },
    column: {
        flexDirection: 'column',
        flex: 1,
    },
    // Standardizing labels and values
    label: {
        fontSize: 8,
        color: '#292929ff',
        marginTop: 3,
        textTransform: 'uppercase',
    },
    value: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#000',
    },
    valueSmall: {
        fontSize: 8,
        color: '#333',
    },

    // Fixed missing styles
    section: {
        marginBottom: 5,
    },
    tableCell: {
        fontSize: 8,
        color: '#333',
    },

    // Table Styles
    table: {
        marginTop: 5,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#ccccccff',
        borderBottom: '1 solid #ccc',
        padding: 5,
        alignItems: 'center',
    },
    tableHeaderCell: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#333',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: '1 solid #eee',
        padding: 4,
        alignItems: 'center',
    },
    tableRowAlt: {
        flexDirection: 'row',
        borderBottom: '1 solid #eee',
        backgroundColor: '#fafafa',
        padding: 5,
        alignItems: 'center',
    },

    // Column Widths
    colProduct: { width: '35%' },
    colPkg: { width: '10%' },
    colQty: { width: '10%', textAlign: 'right' },
    colPriceUn: { width: '15%', textAlign: 'right' },
    colPricePkg: { width: '15%', textAlign: 'right' },
    colTotal: { width: '15%', textAlign: 'right' },

    // Totals Section
    totalsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 15,
    },
    totalsBox: {
        width: '40%',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 3,
        paddingVertical: 2,
    },
    totalRowFinal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 5,
        paddingTop: 5,
        borderTop: '1 solid #000',
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 30,
        right: 30,
        textAlign: 'center',
        borderTop: '1 solid #eee',
        paddingTop: 10,
    },
    footerText: {
        fontSize: 7,
        color: '#999',
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
                {/* Compact Header Grid */}
                <View style={styles.headerContainer}>
                    {/* Column 1: PO Info */}
                    <View style={styles.column}>
                        <Text style={styles.label}>Pedido de Compra</Text>
                        <Text style={styles.value}>#{po.po_number}</Text>

                        <Text style={styles.label}>Status</Text>
                        <Text style={styles.value}>{getStatusLabel(po.status)}</Text>

                        <Text style={styles.label}>Data Criação</Text>
                        <Text style={styles.value}>{formatDate(po.created_at)}</Text>
                    </View>

                    {/* Column 2: Supplier Info */}
                    <View style={styles.column}>
                        <Text style={styles.label}>Fornecedor</Text>
                        <Text style={styles.value}>{po.supplier?.name || `ID #${po.supplier_id}`}</Text>
                        {po.supplier?.email && <Text style={styles.valueSmall}>{po.supplier.email}</Text>}

                        <Text style={styles.label}>Responsável (Autor)</Text>
                        <Text style={styles.value}>{po.creator_profile?.full_name || po.creator_profile?.email || 'N/A'}</Text>

                        {po.quote && (
                            <>
                                <Text style={styles.label}>Referência Cotação</Text>
                                <Text style={styles.value}>#{po.quote.id} - {po.quote.title}</Text>
                            </>
                        )}
                    </View>

                    {/* Column 3: Summary & Logistics */}
                    <View style={styles.column}>
                        <Text style={styles.label}>Resumo</Text>
                        <Text style={styles.value}>{po.items.length} Itens</Text>

                        {po.expected_delivery_date && (
                            <>
                                <Text style={styles.label}>Entrega Esperada</Text>
                                <Text style={styles.value}>{formatDate(po.expected_delivery_date)}</Text>
                            </>
                        )}

                        <Text style={[styles.label, { marginTop: 10 }]}>Valor Total</Text>
                        <Text style={[styles.value, { fontSize: 11 }]}>{formatCurrency(po.total_amount)}</Text>
                    </View>
                </View>

                {/* Author Info */}
                {po.creator_profile && (
                    <View style={[styles.section, { marginBottom: 5 }]}>
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
                                <Text style={{ fontSize: 9 }}>
                                    <Text style={{ color: '#888', fontSize: 8 }}>#{item.product_id} </Text>
                                    {item.product?.name || `Produto #${item.product_id}`}
                                    {item.product?.unit && <Text style={{ color: '#888', fontSize: 8 }}> {item.product.unit}</Text>}
                                </Text>
                                {item.notes && <Text style={{ fontSize: 7, color: '#666', fontStyle: 'italic', marginTop: 1 }}>{item.notes}</Text>}
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

                            <Text style={[styles.valueSmall, styles.colPriceUn]}>
                                {item.package && item.package.multiplier > 1
                                    ? formatCurrency(item.unit_price / item.package.multiplier)
                                    : formatCurrency(item.unit_price)
                                }
                            </Text>

                            <Text style={[styles.valueSmall, styles.colPricePkg]}>{formatCurrency(item.unit_price)}</Text>

                            <Text style={[styles.valueSmall, styles.colTotal, { fontWeight: 'bold' }]}>{formatCurrency(item.total_price)}</Text>
                        </View>
                    ))}
                </View>

                {/* Totals Section */}
                <View style={styles.totalsContainer}>
                    <View style={styles.totalsBox}>
                        <View style={styles.totalRow}>
                            <Text style={styles.label}>Subtotal</Text>
                            <Text style={styles.value}>{formatCurrency(po.subtotal)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={styles.label}>Impostos</Text>
                            <Text style={styles.value}>{formatCurrency(po.tax_amount)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={styles.label}>Frete</Text>
                            <Text style={styles.value}>{formatCurrency(po.shipping_cost)}</Text>
                        </View>
                        <View style={styles.totalRowFinal}>
                            <Text style={[styles.value, { fontSize: 10 }]}>TOTAL</Text>
                            <Text style={[styles.value, { fontSize: 10 }]}>{formatCurrency(po.total_amount)}</Text>
                        </View>
                    </View>
                </View>

                {/* Notes */}
                {po.notes && (
                    <View style={{ marginTop: 20, paddingTop: 10, borderTop: '1 solid #eee' }}>
                        <Text style={[styles.label, { marginBottom: 2 }]}>Observações</Text>
                        <Text style={{ fontSize: 9, color: '#444' }}>{po.notes}</Text>
                    </View>
                )}

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</Text>
                </View>
            </Page>
        </Document>
    );
}
