import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  FileText,
  Package,
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  Trophy,
  Timer,
  Percent,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import { format, differenceInHours, addDays, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  openQuotes: number;
  closedQuotes: number;
  activeSuppliers: number;
  totalProducts: number;
  responseRate: number;
  avgResponseTime: number;
}

interface Quote {
  id: number;
  title: string;
  status: string;
  deadline_at: string | null;
  created_at: string;
}

interface QuoteWithSuppliers extends Quote {
  supplierCount: number;
  submittedCount: number;
}

interface SupplierStats {
  name: string;
  responseCount: number;
  responseRate: number;
}

interface ProductStats {
  name: string;
  quoteCount: number;
}

interface MonthlyTrend {
  month: string;
  quotes: number;
  responses: number;
}

export default function Dashboard() {
  const { tenantId } = useTenant();
  const [stats, setStats] = useState<Stats>({
    openQuotes: 0,
    closedQuotes: 0,
    activeSuppliers: 0,
    totalProducts: 0,
    responseRate: 0,
    avgResponseTime: 0,
  });
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([]);
  const [expiringQuotes, setExpiringQuotes] = useState<Quote[]>([]);
  const [lowParticipation, setLowParticipation] = useState<QuoteWithSuppliers[]>([]);
  const [topSuppliers, setTopSuppliers] = useState<SupplierStats[]>([]);
  const [topProducts, setTopProducts] = useState<ProductStats[]>([]);
  const [responseStats, setResponseStats] = useState<{ name: string; value: number; color: string }[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      fetchDashboardData();
    }
  }, [tenantId]);

  const fetchDashboardData = async () => {
    if (!tenantId) return;
    setLoading(true);

    try {
      // Fetch basic stats
      const [quotesResult, suppliersResult, productsResult] = await Promise.all([
        supabase.from("quotes").select("id, title, status, deadline_at, created_at").eq("tenant_id", tenantId).is("deleted_at", null),
        supabase.from("suppliers").select("id").eq("tenant_id", tenantId).eq("active", true).is("deleted_at", null),
        supabase.from("products").select("id").eq("tenant_id", tenantId).eq("active", true).is("deleted_at", null),
      ]);

      const quotes = quotesResult.data || [];
      const openQuotes = quotes.filter((q) => q.status === "open").length;
      const closedQuotes = quotes.filter((q) => q.status === "closed").length;

      // Recent quotes (last 5)
      const sortedQuotes = [...quotes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRecentQuotes(sortedQuotes.slice(0, 5));

      // Expiring quotes (within 72 hours)
      const now = new Date();
      const in72Hours = addDays(now, 3);
      const expiring = quotes.filter((q) => {
        if (q.status !== "open" || !q.deadline_at) return false;
        const deadline = new Date(q.deadline_at);
        return deadline > now && deadline <= in72Hours;
      });
      setExpiringQuotes(expiring);

      // Get quote suppliers data for participation analysis
      const { data: quoteSuppliers } = await supabase
        .from("quote_suppliers")
        .select("quote_id, status, supplier_id, submitted_at, invited_at");

      let responseRate = 0;
      let avgResponseTime = 0;

      // Calculate response stats
      if (quoteSuppliers && quoteSuppliers.length > 0) {
        const submitted = quoteSuppliers.filter((qs) => qs.status === "submitted").length;
        const partial = quoteSuppliers.filter((qs) => qs.status === "partial").length;
        const pending = quoteSuppliers.filter((qs) => qs.status === "invited" || qs.status === "viewed").length;
        
        responseRate = Math.round((submitted / quoteSuppliers.length) * 100);
        
        // Calculate average response time
        const responseTimes = quoteSuppliers
          .filter((qs) => qs.status === "submitted" && qs.submitted_at && qs.invited_at)
          .map((qs) => differenceInHours(new Date(qs.submitted_at!), new Date(qs.invited_at)));
        
        if (responseTimes.length > 0) {
          avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
        }
        
        setResponseStats([
          { name: "Enviados", value: submitted, color: "hsl(var(--success))" },
          { name: "Parciais", value: partial, color: "hsl(var(--warning))" },
          { name: "Pendentes", value: pending, color: "hsl(var(--muted-foreground))" },
        ]);

        // Low participation (open quotes with < 2 submissions)
        const openQuoteIds = quotes.filter((q) => q.status === "open").map((q) => q.id);
        const participationMap = new Map<number, { total: number; submitted: number }>();
        
        openQuoteIds.forEach((id) => {
          participationMap.set(id, { total: 0, submitted: 0 });
        });

        quoteSuppliers.forEach((qs) => {
          if (participationMap.has(qs.quote_id)) {
            const current = participationMap.get(qs.quote_id)!;
            current.total++;
            if (qs.status === "submitted") current.submitted++;
          }
        });

        const lowPart = quotes
          .filter((q) => q.status === "open")
          .map((q) => ({
            ...q,
            supplierCount: participationMap.get(q.id)?.total || 0,
            submittedCount: participationMap.get(q.id)?.submitted || 0,
          }))
          .filter((q) => q.submittedCount < 2 && q.supplierCount > 0);
        
        setLowParticipation(lowPart);

        // Top suppliers by response count with rate
        const supplierStats = new Map<number, { responses: number; invites: number }>();
        quoteSuppliers.forEach((qs) => {
          const current = supplierStats.get(qs.supplier_id) || { responses: 0, invites: 0 };
          current.invites++;
          if (qs.status === "submitted") current.responses++;
          supplierStats.set(qs.supplier_id, current);
        });

        const { data: suppliersData } = await supabase
          .from("suppliers")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null);

        const topSuppliersData = Array.from(supplierStats.entries())
          .map(([id, stats]) => ({
            name: suppliersData?.find((s) => s.id === id)?.name || `Fornecedor ${id}`,
            responseCount: stats.responses,
            responseRate: stats.invites > 0 ? Math.round((stats.responses / stats.invites) * 100) : 0,
          }))
          .sort((a, b) => b.responseCount - a.responseCount)
          .slice(0, 5);

        setTopSuppliers(topSuppliersData);
      }

      setStats({
        openQuotes,
        closedQuotes,
        activeSuppliers: suppliersResult.data?.length || 0,
        totalProducts: productsResult.data?.length || 0,
        responseRate,
        avgResponseTime,
      });

      // Monthly trend (last 6 months)
      const last6Months: MonthlyTrend[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        
        const monthQuotes = quotes.filter((q) => {
          const created = new Date(q.created_at);
          return created >= monthStart && created <= monthEnd;
        }).length;

        const monthResponses = quoteSuppliers?.filter((qs) => {
          if (!qs.submitted_at) return false;
          const submitted = new Date(qs.submitted_at);
          return submitted >= monthStart && submitted <= monthEnd;
        }).length || 0;

        last6Months.push({
          month: format(monthDate, "MMM", { locale: ptBR }),
          quotes: monthQuotes,
          responses: monthResponses,
        });
      }
      setMonthlyTrend(last6Months);

      // Top quoted products
      const { data: quoteItems } = await supabase
        .from("quote_items")
        .select("product_id, quote_id");

      if (quoteItems) {
        const productCount = new Map<number, number>();
        quoteItems.forEach((item) => {
          productCount.set(item.product_id, (productCount.get(item.product_id) || 0) + 1);
        });

        const { data: productsData } = await supabase
          .from("products")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null);

        const topProductsData = Array.from(productCount.entries())
          .map(([id, count]) => ({
            name: productsData?.find((p) => p.id === id)?.name || `Produto ${id}`,
            quoteCount: count,
          }))
          .sort((a, b) => b.quoteCount - a.quoteCount)
          .slice(0, 6);

        setTopProducts(topProductsData);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Cotações Abertas",
      value: stats.openQuotes,
      icon: FileText,
      color: "text-success",
      bgColor: "bg-success/10",
      trend: null,
    },
    {
      title: "Cotações Encerradas",
      value: stats.closedQuotes,
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/10",
      trend: null,
    },
    {
      title: "Taxa de Resposta",
      value: `${stats.responseRate}%`,
      icon: Percent,
      color: "text-info",
      bgColor: "bg-info/10",
      trend: stats.responseRate >= 70 ? "up" : stats.responseRate >= 40 ? null : "down",
    },
    {
      title: "Fornecedores Ativos",
      value: stats.activeSuppliers,
      icon: Users,
      color: "text-chart-5",
      bgColor: "bg-chart-5/10",
      trend: null,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Dashboard" description="Visão geral do sistema" />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardContent className="p-6">
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Dashboard" description="Visão geral do sistema" />

      <div className="p-6 space-y-6 animate-fade-in">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => (
            <Card key={stat.title} className="stat-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-3xl font-semibold">{stat.value}</p>
                      {stat.trend === "up" && (
                        <ArrowUpRight className="h-5 w-5 text-success" />
                      )}
                      {stat.trend === "down" && (
                        <ArrowDownRight className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Produtos Cadastrados</p>
                  <p className="text-2xl font-semibold">{stats.totalProducts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-info/10">
                  <Timer className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tempo Médio de Resposta</p>
                  <p className="text-2xl font-semibold">
                    {stats.avgResponseTime > 0 ? `${stats.avgResponseTime}h` : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-warning/10">
                  <AlertTriangle className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cotações Vencendo</p>
                  <p className="text-2xl font-semibold">{expiringQuotes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Tendência Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {monthlyTrend.some((m) => m.quotes > 0 || m.responses > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrend}>
                    <defs>
                      <linearGradient id="colorQuotes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorResponses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--info))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--info))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="quotes"
                      name="Cotações"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorQuotes)"
                    />
                    <Area
                      type="monotone"
                      dataKey="responses"
                      name="Respostas"
                      stroke="hsl(var(--info))"
                      fillOpacity={1}
                      fill="url(#colorResponses)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Dados insuficientes para exibir tendência
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Products Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Produtos Mais Cotados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {topProducts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={150} 
                        className="text-xs"
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="quoteCount"
                        name="Cotações"
                        fill="hsl(var(--primary))"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Nenhum produto cotado ainda
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Response Stats Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Respostas de Fornecedores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {responseStats.some((s) => s.value > 0) ? (
                  <>
                    <ResponsiveContainer width="100%" height="80%">
                      <PieChart>
                        <Pie
                          data={responseStats}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {responseStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-4">
                      {responseStats.map((item) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-sm text-muted-foreground">
                            {item.name} ({item.value})
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Nenhum fornecedor convidado ainda
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Suppliers */}
        {topSuppliers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                Fornecedores com Mais Respostas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {topSuppliers.map((supplier, index) => (
                  <div
                    key={supplier.name}
                    className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <span className={`text-2xl font-bold ${index === 0 ? 'text-warning' : index === 1 ? 'text-muted-foreground/80' : index === 2 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                      #{index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{supplier.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {supplier.responseCount} respostas
                        </p>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-success/10 text-success">
                          {supplier.responseRate}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Quotes & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Quotes */}
          <Card>
            <CardHeader>
              <CardTitle>Últimas Cotações</CardTitle>
            </CardHeader>
            <CardContent>
              {recentQuotes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma cotação encontrada</p>
                  <Link
                    to="/quotes/new"
                    className="text-primary hover:underline text-sm mt-2 inline-block"
                  >
                    Criar primeira cotação
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentQuotes.map((quote) => (
                    <Link
                      key={quote.id}
                      to={`/quotes/${quote.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                    >
                      <div>
                        <p className="font-medium">{quote.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>
                            {format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          {quote.deadline_at && (
                            <>
                              <span>•</span>
                              <span>
                                Prazo: {format(new Date(quote.deadline_at), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={quote.status as any} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Alertas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Expiring Quotes */}
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="h-4 w-4 text-warning" />
                  <p className="text-sm font-medium">Cotações vencendo em 72h</p>
                </div>
                {expiringQuotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma cotação com prazo próximo
                  </p>
                ) : (
                  <div className="space-y-2">
                    {expiringQuotes.slice(0, 3).map((q) => (
                      <Link
                        key={q.id}
                        to={`/quotes/${q.id}`}
                        className="flex items-center justify-between text-sm hover:bg-warning/10 p-2 rounded transition-colors"
                      >
                        <span className="text-warning font-medium">{q.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(q.deadline_at!), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Low Participation */}
              <div className="p-4 rounded-lg bg-info/10 border border-info/20">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-info" />
                  <p className="text-sm font-medium">Baixa participação</p>
                </div>
                {lowParticipation.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Todas as cotações têm boa participação
                  </p>
                ) : (
                  <div className="space-y-2">
                    {lowParticipation.slice(0, 3).map((q) => (
                      <Link
                        key={q.id}
                        to={`/quotes/${q.id}`}
                        className="flex items-center justify-between text-sm hover:bg-info/10 p-2 rounded transition-colors"
                      >
                        <span className="text-info font-medium">{q.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {q.submittedCount}/{q.supplierCount} respostas
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
