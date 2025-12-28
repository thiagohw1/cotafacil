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
import { reportsService } from "@/services/reportsService";
import { SupplierPriceHistoryChart } from "@/components/reports/SupplierPriceHistoryChart";

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

    // NOVO: Estados para o gráfico de Fornecedor
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
    const [availableProducts, setAvailableProducts] = useState<{ id: number; name: string }[]>([]);
    const [supplierHistoryData, setSupplierHistoryData] = useState<any[]>([]);

    // Summary stats
    const [totalSavings, setTotalSavings] = useState(0);
    const [avgSavingsPercent, setAvgSavingsPercent] = useState(0);

    useEffect(() => {
        if (tenantId) {
            fetchReportData();
            fetchProducts();
        }
    }, [tenantId, period]);

    // NOVO: Buscar dados do gráfico quando os filtros mudam
    useEffect(() => {
        if (tenantId && selectedSupplierId && selectedProductId) {
            fetchSupplierHistory();
        }
    }, [tenantId, selectedSupplierId, selectedProductId]);

    const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('id, name').order('name');
        if (data) setAvailableProducts(data);
    };

    const fetchSupplierHistory = async () => {
        if (!selectedSupplierId || !selectedProductId) return;

        try {
            // Importar dinamicamente ou usar o reportsService se já tiver importado
            // Mas como não importei lá em cima, vou fazer aqui ou importar.
            // MELHOR: Importar o reportsService no topo do arquivo.
            // Mas para este replace funcionar sem quebrar imports, vou usar o reportsService aqui se conseguir,
            // senão uso fetch direto.
            // Vou assumir que vou adicionar o import no próximo passo.
            // NOTE: reportsService is not defined in the provided context. Assuming it will be imported or defined elsewhere.
            // For now, I'll comment out the reportsService call to avoid a compilation error in this snippet.
            const data = await reportsService.getSupplierPriceEvolution(
                tenantId!,
                selectedSupplierId,
                selectedProductId
            );
            setSupplierHistoryData(data);
        } catch (error) {
            console.error("Erro ao buscar histórico:", error);
        }
    };

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
                    product_id,
                    winner_response_id,
                    winner_supplier_id
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
            .gte("created_at", startDate.toISOString()) // Removi filtro de closed para pegar mais dados de volume se quiser
            // Mas vou manter a query original para não quebrar o resto, apenas adicionei winner_response_id
            .order("created_at", { ascending: false });

        if (quotesError) {
            console.error("Error fetching quotes:", quotesError);
            setLoading(false);
            return;
        }


        if (quotesData) {
            // Fetch responses for these quotes to calculate savings
            const quoteIds = quotesData.map(q => q.id);
            const { data: responsesData } = await supabase
                .from("quote_responses")
                .select("quote_item_id, price, id")
                .in("quote_id", quoteIds);

            processQuotesData(quotesData, responsesData || []);
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

    const processQuotesData = (quotes: any[], responses: any[]) => {
        const savings: SavingsData[] = [];
        const supplierWins: Record<number, { name: string; wins: number; participations: number; value: number; responseTimes: number[] }> = {};
        const monthlyMap: Record<string, { quotes: number; value: number }> = {};

        // Helper to get responses for an item
        const getResponses = (itemId: number) => responses.filter(r => r.quote_item_id === itemId);

        quotes.forEach((quote) => {
            const monthKey = format(new Date(quote.created_at), "yyyy-MM");
            if (!monthlyMap[monthKey]) {
                monthlyMap[monthKey] = { quotes: 0, value: 0 };
            }
            monthlyMap[monthKey].quotes++;

            let quoteTotalValue = 0;
            let quoteLowestTotal = 0;
            let quoteHighestTotal = 0;
            let quoteSavings = 0;

            // Process suppliers for participation stats FIRST (to ensure all invited suppliers are in the map)
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

            // Process items for Wins and Savings
            const items = quote.quote_items || [];
            items.forEach((item: any) => {
                const itemResponses = getResponses(item.id);
                const validPrices = itemResponses.map((r: any) => r.price).filter((p: number) => p > 0);

                if (validPrices.length > 0) {
                    const minPrice = Math.min(...validPrices);
                    const maxPrice = Math.max(...validPrices);
                    const avgPrice = validPrices.reduce((a: number, b: number) => a + b, 0) / validPrices.length;

                    // If there is a winner
                    if (item.winner_response_id) {
                        const winnerRes = itemResponses.find((r: any) => r.id === item.winner_response_id);
                        if (winnerRes) {
                            const winPrice = winnerRes.price;
                            const quantity = item.requested_qty || 1;
                            const itemTotal = winPrice * quantity;

                            quoteTotalValue += itemTotal;
                            monthlyMap[monthKey].value += itemTotal;

                            // Calculate Savings: (Average - Winner) * Qty
                            // Only if we have multiple quotes to compare, otherwise 0 savings ?? 
                            // Or vs Max Price? User requested "Economia". Usually (Highest - Paid) or (Avg - Paid).
                            // Let's use Avg - Paid as a conservative "market savings" metric.
                            if (validPrices.length > 1 && avgPrice > winPrice) {
                                quoteSavings += (avgPrice - winPrice) * quantity;
                            }

                            // Track Supplier Win
                            if (item.winner_supplier_id) {
                                // Ensure supplier exists in map (might not be in quote_suppliers if added ad-hoc? Should be there though)
                                if (!supplierWins[item.winner_supplier_id]) {
                                    // If not found in participations (weird), init it.
                                    supplierWins[item.winner_supplier_id] = { name: "Fornecedor " + item.winner_supplier_id, wins: 0, participations: 1, value: 0, responseTimes: [] };
                                }
                                supplierWins[item.winner_supplier_id].wins++;
                                supplierWins[item.winner_supplier_id].value += itemTotal;
                            }
                        }
                    }

                    quoteLowestTotal += minPrice * (item.requested_qty || 1);
                    quoteHighestTotal += maxPrice * (item.requested_qty || 1);
                }
            });

            if (items.length > 0 && quoteTotalValue > 0) {
                savings.push({
                    quote_id: quote.id,
                    quote_title: quote.title,
                    total_value: quoteTotalValue,
                    lowest_total: quoteLowestTotal,
                    highest_total: quoteHighestTotal,
                    savings: quoteSavings,
                    savings_percent: quoteTotalValue > 0 ? (quoteSavings / quoteTotalValue) * 100 : 0,
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

                {/* ... existing charts ... */}

                {/* NOVO: Análise Detalhada de Fornecedor */}
                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-primary" />
                            Histórico de Preços por Fornecedor (Produto Específico)
                        </CardTitle>
                        <CardDescription>
                            Selecione um fornecedor e um produto para ver a evolução dos preços ofertados e vitórias.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-4 mb-6">
                            <div className="w-1/3">
                                <Label>Fornecedor</Label>
                                <Select onValueChange={(val) => setSelectedSupplierId(Number(val))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o fornecedor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {supplierRanking.map((s) => (
                                            <SelectItem key={s.supplier_id} value={s.supplier_id.toString()}>
                                                {s.supplier_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-1/3">
                                <Label>Produto</Label>
                                <Select onValueChange={(val) => setSelectedProductId(Number(val))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o produto" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableProducts.map((p) => (
                                            <SelectItem key={p.id} value={p.id.toString()}>
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {supplierHistoryData.length > 0 ? (
                            <SupplierPriceHistoryChart data={supplierHistoryData} />
                        ) : (
                            <div className="h-[300px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                                {selectedSupplierId && selectedProductId
                                    ? "Nenhum dado encontrado para esta combinação."
                                    : "Selecione um fornecedor e um produto para visualizar o gráfico."}
                            </div>
                        )}
                    </CardContent>
                </Card>

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
                        <div className="space-y-4">
                            {supplierRanking.map((supplier, index) => (
                                <div key={supplier.supplier_id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                                    <div className="flex items-center gap-4">
                                        <div className={`
                                            flex items-center justify-center w-8 h-8 rounded-full font-bold
                                            ${index === 0 ? "bg-warning/20 text-warning" :
                                                index === 1 ? "bg-muted-foreground/20 text-muted-foreground" :
                                                    index === 2 ? "bg-amber-700/20 text-amber-700" : "bg-muted text-muted-foreground"}
                                        `}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <p className="font-medium">{supplier.supplier_name}</p>
                                            <div className="flex gap-2 text-xs text-muted-foreground">
                                                <span>{supplier.wins} vitórias</span>
                                                <span>•</span>
                                                <span>{supplier.participations} part.</span>
                                                <span>•</span>
                                                <span>{formatCurrency(supplier.total_value)} total</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium">{formatHours(supplier.avg_response_time_hours)}</div>
                                        <div className="text-xs text-muted-foreground">tempo médio</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Savings by Quote */}
                <Card>
                    {/* ... content ... */}
                </Card>
            </div>
        </div>
    );
}
