import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    Loader2,
    TrendingDown,
    Trophy,
    Clock,
    BarChart3,
    PieChart,
    Download,
    DollarSign,
    Package,
    Users,
    FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart as RechartsPieChart,
    Pie,
    Cell,
} from "recharts";

interface SavingsData {
    quote_id: number;
    quote_title: string;
    total_value: number;
    lowest_total: number;
    highest_total: number;
    savings: number;
    savings_percent: number;
}

interface SupplierRanking {
    supplier_id: number;
    supplier_name: string;
    wins: number;
    participations: number;
    win_rate: number;
    avg_response_time_hours: number;
    total_value: number;
}

interface QuoteStats {
    total_quotes: number;
    closed_quotes: number;
    total_items: number;
    total_suppliers: number;
    avg_suppliers_per_quote: number;
    avg_items_per_quote: number;
}

interface MonthlyData {
    month: string;
    quotes: number;
    value: number;
}

export default function Reports() {
    const { tenantId } = useTenant();
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState("6"); // months

    // Report data
    const [savingsData, setSavingsData] = useState<SavingsData[]>([]);
    const [supplierRanking, setSupplierRanking] = useState<SupplierRanking[]>([]);
    const [quoteStats, setQuoteStats] = useState<QuoteStats | null>(null);
    const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);

    // Summary stats
    const [totalSavings, setTotalSavings] = useState(0);
    const [avgSavingsPercent, setAvgSavingsPercent] = useState(0);

    useEffect(() => {
        if (tenantId) {
            fetchReportData();
        }
    }, [tenantId, period]);

    const fetchReportData = async () => {
        if (!tenantId) return;
        setLoading(true);

        const startDate = startOfMonth(subMonths(new Date(), parseInt(period)));

        // Fetch closed quotes with items and responses
        const { data: quotesData, error: quotesError } = await supabase
            .from("quotes")
            .select(`
                id,
                title,
                created_at,
                quote_items(
                    id,
                    requested_qty,
                    product_id
                ),
                quote_suppliers(
                    id,
                    supplier_id,
                    status,
                    invited_at,
                    submitted_at,
                    suppliers(name)
                )
            `)
            .eq("tenant_id", tenantId)
            .eq("status", "closed")
            .gte("created_at", startDate.toISOString())
            .order("created_at", { ascending: false });

        if (quotesError) {
            console.error("Error fetching quotes:", quotesError);
            setLoading(false);
            return;
        }


        if (quotesData) {
            processQuotesData(quotesData);
        }

        // Fetch general stats
        const [totalQuotesRes, closedQuotesRes, totalItemsRes, totalSuppliersRes] = await Promise.all([
            supabase
                .from("quotes")
                .select("id", { count: "exact" })
                .eq("tenant_id", tenantId)
                .gte("created_at", startDate.toISOString()),
            supabase
                .from("quotes")
                .select("id", { count: "exact" })
                .eq("tenant_id", tenantId)
                .eq("status", "closed")
                .gte("created_at", startDate.toISOString()),
            supabase
                .from("quote_items")
                .select("id", { count: "exact" })
                .in(
                    "quote_id",
                    (quotesData || []).map((q: any) => q.id)
                ),
            supabase
                .from("quote_suppliers")
                .select("id", { count: "exact" })
                .in(
                    "quote_id",
                    (quotesData || []).map((q: any) => q.id)
                ),
        ]);

        const totalQuotes = totalQuotesRes.count || 0;
        const closedQuotes = closedQuotesRes.count || 0;
        const totalItems = totalItemsRes.count || 0;
        const totalSuppliers = totalSuppliersRes.count || 0;

        setQuoteStats({
            total_quotes: totalQuotes,
            closed_quotes: closedQuotes,
            total_items: totalItems,
            total_suppliers: totalSuppliers,
            avg_suppliers_per_quote: closedQuotes > 0 ? totalSuppliers / closedQuotes : 0,
            avg_items_per_quote: closedQuotes > 0 ? totalItems / closedQuotes : 0,
        });

        setLoading(false);
    };

    const processQuotesData = (quotes: any[]) => {
        const savings: SavingsData[] = [];
        const supplierWins: Record<number, { name: string; wins: number; participations: number; value: number; responseTimes: number[] }> = {};
        const monthlyMap: Record<string, { quotes: number; value: number }> = {};

        quotes.forEach((quote) => {
            const monthKey = format(new Date(quote.created_at), "yyyy-MM");
            if (!monthlyMap[monthKey]) {
                monthlyMap[monthKey] = { quotes: 0, value: 0 };
            }
            monthlyMap[monthKey].quotes++;

            // Process suppliers for participation stats
            quote.quote_suppliers?.forEach((qs: any) => {
                const supplierId = qs.supplier_id;
                const supplierName = qs.suppliers?.name || "Desconhecido";

                if (!supplierWins[supplierId]) {
                    supplierWins[supplierId] = { name: supplierName, wins: 0, participations: 0, value: 0, responseTimes: [] };
                }

                if (qs.status === "submitted" || qs.status === "partial") {
                    supplierWins[supplierId].participations++;

                    // Calculate response time
                    if (qs.invited_at && qs.submitted_at) {
                        const invited = new Date(qs.invited_at);
                        const submitted = new Date(qs.submitted_at);
                        const hours = (submitted.getTime() - invited.getTime()) / (1000 * 60 * 60);
                        supplierWins[supplierId].responseTimes.push(hours);
                    }
                }
            });

            // For now, just count items - detailed savings requires winner data
            const itemCount = quote.quote_items?.length || 0;
            if (itemCount > 0) {
                savings.push({
                    quote_id: quote.id,
                    quote_title: quote.title,
                    total_value: 0,
                    lowest_total: 0,
                    highest_total: 0,
                    savings: 0,
                    savings_percent: 0,
                });
            }
        });


        setSavingsData(savings);

        // Calculate total savings
        const totalSav = savings.reduce((acc, s) => acc + s.savings, 0);
        const avgPercent = savings.length > 0
            ? savings.reduce((acc, s) => acc + s.savings_percent, 0) / savings.length
            : 0;
        setTotalSavings(totalSav);
        setAvgSavingsPercent(avgPercent);

        // Process supplier ranking
        const ranking: SupplierRanking[] = Object.entries(supplierWins)
            .map(([id, data]) => ({
                supplier_id: parseInt(id),
                supplier_name: data.name,
                wins: data.wins,
                participations: data.participations,
                win_rate: data.participations > 0 ? (data.wins / data.participations) * 100 : 0,
                avg_response_time_hours:
                    data.responseTimes.length > 0
                        ? data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length
                        : 0,
                total_value: data.value,
            }))
            .filter((s) => s.participations > 0)
            .sort((a, b) => b.wins - a.wins);

        setSupplierRanking(ranking);

        // Process monthly data
        const monthly: MonthlyData[] = Object.entries(monthlyMap)
            .map(([month, data]) => ({
                month: format(new Date(month + "-01"), "MMM/yy", { locale: ptBR }),
                quotes: data.quotes,
                value: data.value,
            }))
            .sort((a, b) => a.month.localeCompare(b.month));

        setMonthlyData(monthly);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    const formatHours = (hours: number) => {
        if (hours < 1) return `${Math.round(hours * 60)} min`;
        if (hours < 24) return `${hours.toFixed(1)}h`;
        return `${(hours / 24).toFixed(1)} dias`;
    };

    const CHART_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

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
                title="Relatórios"
                description="Análise de cotações, economia e desempenho de fornecedores"
                actions={
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Label className="text-sm">Período:</Label>
                            <Select value={period} onValueChange={setPeriod}>
                                <SelectTrigger className="w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 mês</SelectItem>
                                    <SelectItem value="3">3 meses</SelectItem>
                                    <SelectItem value="6">6 meses</SelectItem>
                                    <SelectItem value="12">12 meses</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                }
            />

            <div className="p-6 space-y-6 animate-fade-in">
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-success/10">
                                    <TrendingDown className="h-6 w-6 text-success" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Economia Total</p>
                                    <p className="text-2xl font-bold text-success">{formatCurrency(totalSavings)}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Média: {avgSavingsPercent.toFixed(1)}% por cotação
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-primary/10">
                                    <FileText className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Cotações Encerradas</p>
                                    <p className="text-2xl font-bold">{quoteStats?.closed_quotes || 0}</p>
                                    <p className="text-xs text-muted-foreground">
                                        de {quoteStats?.total_quotes || 0} total
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-info/10">
                                    <Package className="h-6 w-6 text-info" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Itens Cotados</p>
                                    <p className="text-2xl font-bold">{quoteStats?.total_items || 0}</p>
                                    <p className="text-xs text-muted-foreground">
                                        ~{quoteStats?.avg_items_per_quote.toFixed(1) || 0} por cotação
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-warning/10">
                                    <Users className="h-6 w-6 text-warning" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Fornecedores Ativos</p>
                                    <p className="text-2xl font-bold">{supplierRanking.length}</p>
                                    <p className="text-xs text-muted-foreground">
                                        ~{quoteStats?.avg_suppliers_per_quote.toFixed(1) || 0} por cotação
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-2 gap-6">
                    {/* Monthly Quotes Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Cotações por Mês
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {monthlyData.length > 0 ? (
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={monthlyData}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                            <XAxis dataKey="month" className="text-xs" />
                                            <YAxis className="text-xs" />
                                            <Tooltip
                                                formatter={(value: number, name: string) =>
                                                    name === "value" ? formatCurrency(value) : value
                                                }
                                            />
                                            <Legend />
                                            <Bar dataKey="quotes" name="Cotações" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                                    Sem dados no período selecionado
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Supplier Wins Pie Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PieChart className="h-5 w-5" />
                                Vitórias por Fornecedor
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {supplierRanking.length > 0 ? (
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RechartsPieChart>
                                            <Pie
                                                data={supplierRanking.slice(0, 6)}
                                                dataKey="wins"
                                                nameKey="supplier_name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                                labelLine={false}
                                            >
                                                {supplierRanking.slice(0, 6).map((_, index) => (
                                                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </RechartsPieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                                    Sem dados no período selecionado
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Supplier Ranking Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-warning" />
                            Ranking de Fornecedores
                        </CardTitle>
                        <CardDescription>
                            Desempenho dos fornecedores baseado em vitórias e tempo de resposta
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {supplierRanking.length > 0 ? (
                            <div className="space-y-3">
                                {supplierRanking.slice(0, 10).map((supplier, index) => (
                                    <div
                                        key={supplier.supplier_id}
                                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0
                                                    ? "bg-warning/20 text-warning"
                                                    : index === 1
                                                        ? "bg-muted text-muted-foreground"
                                                        : index === 2
                                                            ? "bg-orange-500/20 text-orange-600"
                                                            : "bg-muted/50 text-muted-foreground"
                                                    }`}
                                            >
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="font-medium">{supplier.supplier_name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {supplier.participations} participações
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8 text-sm">
                                            <div className="text-center">
                                                <p className="font-bold text-success text-lg">{supplier.wins}</p>
                                                <p className="text-muted-foreground">vitórias</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="font-medium">{supplier.win_rate.toFixed(0)}%</p>
                                                <p className="text-muted-foreground">taxa</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="font-medium flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {formatHours(supplier.avg_response_time_hours)}
                                                </p>
                                                <p className="text-muted-foreground">resposta</p>
                                            </div>
                                            <div className="text-center min-w-[100px]">
                                                <p className="font-medium">{formatCurrency(supplier.total_value)}</p>
                                                <p className="text-muted-foreground">total</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Nenhum dado de fornecedor encontrado no período.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Savings by Quote */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-success" />
                            Economia por Cotação
                        </CardTitle>
                        <CardDescription>
                            Diferença entre o maior e menor preço de cada cotação
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {savingsData.length > 0 ? (
                            <div className="space-y-2">
                                {savingsData.slice(0, 10).map((quote) => (
                                    <div
                                        key={quote.quote_id}
                                        className="flex items-center justify-between p-3 rounded-lg border"
                                    >
                                        <div>
                                            <p className="font-medium">{quote.quote_title}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Cotação #{quote.quote_id}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-6 text-sm">
                                            <div className="text-right">
                                                <p className="text-muted-foreground">Valor Final</p>
                                                <p className="font-medium">{formatCurrency(quote.total_value)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-muted-foreground">Maior Proposta</p>
                                                <p className="font-medium text-destructive/70">{formatCurrency(quote.highest_total)}</p>
                                            </div>
                                            <div className="text-right min-w-[120px]">
                                                <p className="text-muted-foreground">Economia</p>
                                                <p className="font-bold text-success">
                                                    {formatCurrency(quote.savings)} ({quote.savings_percent.toFixed(1)}%)
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Nenhuma cotação encerrada encontrada no período.</p>
                                <p className="text-sm mt-1">
                                    Encerre cotações com vencedores definidos para ver a economia gerada.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
