import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Loader2, TrendingUp, TrendingDown, Minus, Search, Filter, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

interface PriceRecord {
    id: number;
    product_id: number;
    product_name: string;
    supplier_id: number;
    supplier_name: string;
    price: number;
    package_unit: string | null;
    recorded_at: string;
    source_quote_id: number | null;
}

interface Product {
    id: number;
    name: string;
    packages: {
        unit: string;
        is_default: boolean;
    }[];
}

interface Supplier {
    id: number;
    name: string;
}

interface ChartData {
    date: string;
    [supplierName: string]: string | number;
}

export default function PriceHistory() {
    const { tenantId } = useTenant();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<PriceRecord[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    // Filters
    const [selectedProduct, setSelectedProduct] = useState<string>("");
    const [selectedSupplier, setSelectedSupplier] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");

    // Chart data
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [chartSuppliers, setChartSuppliers] = useState<string[]>([]);

    useEffect(() => {
        if (tenantId) {
            fetchData();
        }
    }, [tenantId]);

    useEffect(() => {
        if (selectedProduct && records.length > 0) {
            generateChartData();
        }
    }, [selectedProduct, records]);

    const fetchData = async () => {
        if (!tenantId) return;
        setLoading(true);

        // Fetch products and suppliers for filters
        const [productsRes, suppliersRes] = await Promise.all([
            supabase
                .from("products")
                .select("id, name, product_packages(unit, is_default)")
                .eq("tenant_id", tenantId)
                .eq("active", true)
                .order("name"),
            supabase
                .from("suppliers")
                .select("id, name")
                .eq("tenant_id", tenantId)
                .eq("active", true)
                .order("name"),
        ]);

        setProducts(productsRes.data || []);
        setSuppliers(suppliersRes.data || []);

        // Fetch price history
        const { data: historyData, error } = await supabase
            .from("price_history")
            .select(`
        id,
        product_id,
        supplier_id,
        price,
        recorded_at,
        source_quote_id
      `)
            .eq("tenant_id", tenantId)
            .order("recorded_at", { ascending: false })
            .limit(500);

        if (error) {
            console.error("Error fetching price history:", error);
        }

        if (historyData) {
            // Create lookup maps for faster access
            const productMap = new Map(productsRes.data?.map(p => [p.id, p]) || []);
            const supplierMap = new Map(suppliersRes.data?.map(s => [s.id, s.name]) || []);

            const mapped: PriceRecord[] = historyData.map((r: any) => {
                const product = productMap.get(r.product_id);
                const defaultPackage = product?.product_packages?.find((p: any) => p.is_default) || product?.product_packages?.[0];

                return {
                    id: r.id,
                    product_id: r.product_id,
                    product_name: product?.name || "Produto removido",
                    supplier_id: r.supplier_id,
                    supplier_name: supplierMap.get(r.supplier_id) || "Fornecedor removido",
                    price: r.price,
                    package_unit: defaultPackage?.unit || null,
                    recorded_at: r.recorded_at,
                    source_quote_id: r.source_quote_id,
                };
            });
            setRecords(mapped);
        }

        setLoading(false);
    };

    const generateChartData = () => {
        if (!selectedProduct || selectedProduct === "all") {
            setChartData([]);
            setChartSuppliers([]);
            return;
        }


        const productId = parseInt(selectedProduct);
        const productRecords = records.filter((r) => r.product_id === productId);

        // Group by date and supplier
        const dateMap: Record<string, Record<string, number>> = {};
        const supplierSet = new Set<string>();

        productRecords.forEach((r) => {
            const date = format(new Date(r.recorded_at), "dd/MM/yy");
            if (!dateMap[date]) dateMap[date] = {};
            dateMap[date][r.supplier_name] = r.price;
            supplierSet.add(r.supplier_name);
        });

        // Convert to chart format
        const data: ChartData[] = Object.entries(dateMap)
            .map(([date, suppliers]) => ({
                date,
                ...suppliers,
            }))
            .reverse(); // Oldest first for chart

        setChartData(data);
        setChartSuppliers(Array.from(supplierSet));
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    const getPriceVariation = (productId: number, supplierId: number): { change: number; trend: "up" | "down" | "stable" } | null => {
        const productRecords = records
            .filter((r) => r.product_id === productId && r.supplier_id === supplierId)
            .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

        if (productRecords.length < 2) return null;

        const current = productRecords[0].price;
        const previous = productRecords[1].price;
        const change = ((current - previous) / previous) * 100;

        if (Math.abs(change) < 0.5) return { change: 0, trend: "stable" };
        return { change, trend: change > 0 ? "up" : "down" };
    };

    const filteredRecords = records.filter((r) => {
        if (selectedProduct && selectedProduct !== "all" && r.product_id !== parseInt(selectedProduct)) return false;
        if (selectedSupplier && selectedSupplier !== "all" && r.supplier_id !== parseInt(selectedSupplier)) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (
                r.product_name.toLowerCase().includes(term) ||
                r.supplier_name.toLowerCase().includes(term)
            );
        }
        return true;
    });

    const exportToCSV = () => {
        const headers = ["Produto", "Fornecedor", "Preço", "Embalagem", "Data", "Cotação"];
        const rows = filteredRecords.map((r) => [
            r.product_name,
            r.supplier_name,
            formatCurrency(r.price),
            r.package_unit || "-",
            format(new Date(r.recorded_at), "dd/MM/yyyy HH:mm"),
            r.source_quote_id || "-",
        ]);

        const csv = [headers, ...rows].map((row) => row.join(";")).join("\n");
        const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `historico-precos-${format(new Date(), "yyyy-MM-dd")}.csv`;
        link.click();
    };

    const CHART_COLORS = [
        "#22c55e", // green
        "#3b82f6", // blue
        "#f59e0b", // amber
        "#ef4444", // red
        "#8b5cf6", // violet
        "#06b6d4", // cyan
        "#ec4899", // pink
        "#84cc16", // lime
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <Header
                title="Histórico de Preços"
                description="Acompanhe a evolução dos preços por produto e fornecedor"
                actions={
                    <Button variant="outline" onClick={exportToCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar CSV
                    </Button>
                }
            />

            <div className="p-6 space-y-6 animate-fade-in">
                {/* Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filtros
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label>Buscar</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Produto ou fornecedor..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Produto</Label>
                                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos os produtos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        {products.map((p) => (
                                            <SelectItem key={p.id} value={p.id.toString()}>
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Fornecedor</Label>
                                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos os fornecedores" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        {suppliers.map((s) => (
                                            <SelectItem key={s.id} value={s.id.toString()}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>&nbsp;</Label>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        setSelectedProduct("all");
                                        setSelectedSupplier("all");
                                        setSearchTerm("");
                                    }}
                                >
                                    Limpar Filtros
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Chart */}
                {selectedProduct && selectedProduct !== "all" && chartData.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5" />
                                Evolução de Preço - {products.find((p) => p.id.toString() === selectedProduct)?.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="date" className="text-xs" />
                                        <YAxis
                                            tickFormatter={(value) => `R$ ${value.toFixed(0)}`}
                                            className="text-xs"
                                        />
                                        <Tooltip
                                            formatter={(value: number) => formatCurrency(value)}
                                            labelClassName="font-medium"
                                        />
                                        <Legend />
                                        {chartSuppliers.map((supplier, index) => (
                                            <Line
                                                key={supplier}
                                                type="monotone"
                                                dataKey={supplier}
                                                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                                                strokeWidth={2}
                                                dot={{ r: 4 }}
                                                activeDot={{ r: 6 }}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Registros de Preço ({filteredRecords.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {filteredRecords.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Nenhum registro de preço encontrado.</p>
                                <p className="text-sm mt-1">
                                    Os preços são salvos automaticamente ao encerrar cotações com vencedores definidos.
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead>Fornecedor</TableHead>
                                        <TableHead>Preço</TableHead>
                                        <TableHead>Variação</TableHead>
                                        <TableHead>Embalagem</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Cotação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRecords.slice(0, 100).map((record) => {
                                        const variation = getPriceVariation(record.product_id, record.supplier_id);
                                        return (
                                            <TableRow key={record.id}>
                                                <TableCell className="font-medium">{record.product_name}</TableCell>
                                                <TableCell>{record.supplier_name}</TableCell>
                                                <TableCell className="font-medium">{formatCurrency(record.price)}</TableCell>
                                                <TableCell>
                                                    {variation ? (
                                                        <div className="flex items-center gap-1">
                                                            {variation.trend === "up" && (
                                                                <TrendingUp className="h-4 w-4 text-destructive" />
                                                            )}
                                                            {variation.trend === "down" && (
                                                                <TrendingDown className="h-4 w-4 text-success" />
                                                            )}
                                                            {variation.trend === "stable" && (
                                                                <Minus className="h-4 w-4 text-muted-foreground" />
                                                            )}
                                                            <span
                                                                className={
                                                                    variation.trend === "up"
                                                                        ? "text-destructive"
                                                                        : variation.trend === "down"
                                                                            ? "text-success"
                                                                            : "text-muted-foreground"
                                                                }
                                                            >
                                                                {variation.change !== 0
                                                                    ? `${variation.change > 0 ? "+" : ""}${variation.change.toFixed(1)}%`
                                                                    : "Estável"}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {record.package_unit || "-"}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {format(new Date(record.recorded_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {record.source_quote_id ? `#${record.source_quote_id}` : "-"}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                        {filteredRecords.length > 100 && (
                            <p className="text-center text-sm text-muted-foreground mt-4">
                                Exibindo 100 de {filteredRecords.length} registros. Use os filtros para refinar a busca.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
