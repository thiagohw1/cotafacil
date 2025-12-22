import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { PurchaseOrdersTable } from '@/components/purchase-orders/PurchaseOrdersTable';
import { CreatePOModal } from '@/components/purchase-orders/CreatePOModal';
import { ExportExcelButton } from '@/components/purchase-orders/ExportExcelButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Filter, PieChart } from 'lucide-react';
import { PurchaseOrderFilters, POStatus } from '@/types/purchase-orders';

export default function PurchaseOrdersList() {
    const navigate = useNavigate();
    const [filters, setFilters] = useState<PurchaseOrderFilters>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const { purchaseOrders, loading, error, refetch } = usePurchaseOrders(filters);

    const handleSearch = () => {
        setFilters({ ...filters, search: searchTerm });
    };

    const handleStatusFilter = (status: string) => {
        if (status === 'all') {
            setFilters({ ...filters, status: undefined });
        } else {
            setFilters({ ...filters, status: [status as POStatus] });
        }
    };

    const clearFilters = () => {
        setFilters({});
        setSearchTerm('');
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Purchase Orders</h1>
                    <p className="text-muted-foreground">
                        Gerencie seus pedidos de compra
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate('/purchase-orders/dashboard')}>
                        <PieChart className="h-4 w-4 mr-2" />
                        Dashboard
                    </Button>
                    <ExportExcelButton purchaseOrders={purchaseOrders} />
                    <Button onClick={() => setCreateModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo PO Manual
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Busca por número */}
                        <div className="md:col-span-2">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Buscar por número do PO..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <Button onClick={handleSearch} variant="secondary">
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Filtro de status */}
                        <div>
                            <Select onValueChange={handleStatusFilter} defaultValue="all">
                                <SelectTrigger>
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os Status</SelectItem>
                                    <SelectItem value="draft">Rascunho</SelectItem>
                                    <SelectItem value="sent">Enviado</SelectItem>
                                    <SelectItem value="confirmed">Confirmado</SelectItem>
                                    <SelectItem value="delivered">Entregue</SelectItem>
                                    <SelectItem value="cancelled">Cancelado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Limpar filtros */}
                        <div>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={clearFilters}
                            >
                                Limpar Filtros
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabela de Purchase Orders */}
            {error ? (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                        <p className="text-red-800 text-center">
                            Erro ao carregar Purchase Orders: {error}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <PurchaseOrdersTable data={purchaseOrders} loading={loading} />
            )}

            {/* Modal Criação Manual */}
            <CreatePOModal
                open={createModalOpen}
                onOpenChange={setCreateModalOpen}
                onSuccess={refetch}
            />
        </div>
    );
}
