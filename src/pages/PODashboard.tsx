import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
    Package,
    Clock,
    CheckCircle,
    DollarSign,
    TrendingUp,
    Building2,
    FileText
} from 'lucide-react';
import { PurchaseOrder, PO_STATUS_LABELS, POStatus } from '@/types/purchase-orders';

interface POStats {
    total: number;
    byStatus: Record<string, number>;
    totalValue: number;
    thisMonth: number;
    thisMonthValue: number;
    topSuppliers: { name: string; count: number; value: number }[];
}

export default function PODashboard() {
    const [stats, setStats] = useState<POStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);

        try {
            // Buscar todos os POs
            const { data, error: allError } = await supabase
                .from('purchase_orders')
                .select('*');

            if (allError) throw allError;

            // Cast para PurchaseOrder[]
            const allPOs = (data || []) as unknown as PurchaseOrder[];

            // Calcular estatísticas
            const total = allPOs.length;

            // Por status
            const byStatus: Record<string, number> = {};
            allPOs.forEach(po => {
                const status = po.status || 'unknown';
                byStatus[status] = (byStatus[status] || 0) + 1;
            });

            // Valor total
            const totalValue = allPOs.reduce((sum, po) => sum + (Number(po.subtotal) || 0), 0);

            // Este mês
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const thisMonthPOs = allPOs.filter(po =>
                new Date(po.created_at) >= startOfMonth
            );

            const thisMonth = thisMonthPOs.length;
            const thisMonthValue = thisMonthPOs.reduce((sum, po) => sum + (Number(po.subtotal) || 0), 0);

            // Top fornecedores (simplificado)
            const supplierStats: Record<number, { count: number; value: number }> = {};
            allPOs.forEach(po => {
                if (!po.supplier_id) return;

                if (!supplierStats[po.supplier_id]) {
                    supplierStats[po.supplier_id] = { count: 0, value: 0 };
                }
                supplierStats[po.supplier_id].count++;
                supplierStats[po.supplier_id].value += Number(po.subtotal) || 0;
            });

            // Buscar nomes dos fornecedores
            const supplierIds = Object.keys(supplierStats).map(Number);
            let topSuppliers: { name: string; count: number; value: number }[] = [];

            if (supplierIds.length > 0) {
                const { data: suppliers } = await supabase
                    .from('suppliers')
                    .select('id, name')
                    .in('id', supplierIds);

                topSuppliers = Object.entries(supplierStats)
                    .map(([id, stats]) => ({
                        name: suppliers?.find(s => s.id === Number(id))?.name || `Fornecedor #${id}`,
                        count: stats.count,
                        value: stats.value,
                    }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5);
            }

            setStats({
                total,
                byStatus,
                totalValue,
                thisMonth,
                thisMonthValue,
                topSuppliers,
            });
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        } finally {
            setLoading(false);
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
            <div className="container mx-auto p-6 max-w-7xl">
                <Skeleton className="h-10 w-64 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
                <Skeleton className="h-64" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Dashboard de Compras</h1>
                <p className="text-muted-foreground">
                    Visão geral dos seus Purchase Orders
                </p>
            </div>

            {/* KPIs Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total de POs
                        </CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.total || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats?.thisMonth || 0} este mês
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Valor Total
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats?.totalValue || 0)}</div>
                        <p className="text-xs text-muted-foreground">
                            {formatCurrency(stats?.thisMonthValue || 0)} este mês
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Em Andamento
                        </CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {(stats?.byStatus?.draft || 0) + (stats?.byStatus?.sent || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stats?.byStatus?.draft || 0} rascunhos, {stats?.byStatus?.sent || 0} enviados
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Confirmados
                        </CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {(stats?.byStatus?.confirmed || 0) + (stats?.byStatus?.delivered || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stats?.byStatus?.delivered || 0} entregues
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Status Breakdown e Top Fornecedores */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            POs por Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {Object.entries(stats?.byStatus || {}).map(([status, count]) => (
                                <div key={status} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${status === 'draft' ? 'bg-gray-400' :
                                            status === 'sent' ? 'bg-blue-500' :
                                                status === 'confirmed' ? 'bg-green-500' :
                                                    status === 'delivered' ? 'bg-purple-500' :
                                                        'bg-red-500'
                                            }`} />
                                        <span>{PO_STATUS_LABELS[status as keyof typeof PO_STATUS_LABELS] || status}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-32 bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full ${status === 'draft' ? 'bg-gray-400' :
                                                    status === 'sent' ? 'bg-blue-500' :
                                                        status === 'confirmed' ? 'bg-green-500' :
                                                            status === 'delivered' ? 'bg-purple-500' :
                                                                'bg-red-500'
                                                    }`}
                                                style={{ width: `${(count / (stats?.total || 1)) * 100}%` }}
                                            />
                                        </div>
                                        <span className="font-semibold w-8 text-right">{count}</span>
                                    </div>
                                </div>
                            ))}
                            {Object.keys(stats?.byStatus || {}).length === 0 && (
                                <p className="text-muted-foreground text-center py-4">
                                    Nenhum PO criado ainda
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Top Fornecedores */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Top 5 Fornecedores
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats?.topSuppliers?.map((supplier, index) => (
                                <div key={supplier.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                            index === 1 ? 'bg-gray-100 text-gray-600' :
                                                index === 2 ? 'bg-orange-100 text-orange-700' :
                                                    'bg-slate-100 text-slate-600'
                                            }`}>
                                            {index + 1}
                                        </span>
                                        <div>
                                            <p className="font-medium">{supplier.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {supplier.count} pedidos
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">{formatCurrency(supplier.value)}</p>
                                    </div>
                                </div>
                            ))}
                            {(!stats?.topSuppliers || stats.topSuppliers.length === 0) && (
                                <p className="text-muted-foreground text-center py-4">
                                    Nenhum fornecedor encontrado
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
