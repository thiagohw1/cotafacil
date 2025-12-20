import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, Clock, FileText, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PriceVariationChart } from "@/components/suppliers/PriceVariationChart";
import { SupplierQuoteHistoryTable } from "@/components/suppliers/SupplierQuoteHistoryTable";

interface Supplier {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  contact_name: string | null;
}

interface QuoteParticipation {
  quote_id: number;
  quote_title: string;
  quote_status: string;
  invited_at: string;
  submitted_at: string | null;
  status: string;
  total_items: number;
  items_responded: number;
  avg_price: number | null;
}

interface Stats {
  total_participations: number;
  submitted_count: number;
  avg_response_time_hours: number | null;
  total_items_quoted: number;
}

export default function SupplierHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [participations, setParticipations] = useState<QuoteParticipation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId && id) {
      fetchSupplierData();
    }
  }, [tenantId, id]);

  const fetchSupplierData = async () => {
    if (!tenantId || !id) return;
    setLoading(true);

    // Fetch supplier details
    const { data: supplierData, error: supplierError } = await supabase
      .from("suppliers")
      .select("id, name, email, phone, contact_name")
      .eq("id", Number(id))
      .eq("tenant_id", tenantId)
      .single();

    if (supplierError) {
      toast({
        title: "Erro ao carregar fornecedor",
        description: supplierError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setSupplier(supplierData);

    // Fetch quote participations
    const { data: participationsData, error: participationsError } = await supabase
      .from("quote_suppliers")
      .select(`
        id,
        quote_id,
        invited_at,
        submitted_at,
        status,
        quotes!inner (
          id,
          title,
          status,
          tenant_id
        )
      `)
      .eq("supplier_id", Number(id))
      .eq("quotes.tenant_id", tenantId)
      .order("invited_at", { ascending: false });

    if (participationsError) {
      console.error("Error fetching participations:", participationsError);
    }

    // For each participation, get response stats
    const participationsWithStats: QuoteParticipation[] = [];

    for (const p of (participationsData || [])) {
      // Get total items in quote
      const { count: totalItems } = await supabase
        .from("quote_items")
        .select("*", { count: "exact", head: true })
        .eq("quote_id", p.quote_id);

      // Get responses from this supplier for this quote
      const { data: responses } = await supabase
        .from("quote_responses")
        .select("price")
        .eq("quote_supplier_id", p.id);

      const itemsResponded = responses?.length || 0;
      const prices = responses?.filter(r => r.price !== null).map(r => Number(r.price)) || [];
      const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

      participationsWithStats.push({
        quote_id: p.quote_id,
        quote_title: (p.quotes as any).title,
        quote_status: (p.quotes as any).status,
        invited_at: p.invited_at,
        submitted_at: p.submitted_at,
        status: p.status,
        total_items: totalItems || 0,
        items_responded: itemsResponded,
        avg_price: avgPrice,
      });
    }

    setParticipations(participationsWithStats);

    // Calculate stats
    const submittedParticipations = participationsWithStats.filter(p => p.status === "submitted");
    const responseTimes = submittedParticipations
      .filter(p => p.submitted_at)
      .map(p => {
        const invited = new Date(p.invited_at).getTime();
        const submitted = new Date(p.submitted_at!).getTime();
        return (submitted - invited) / (1000 * 60 * 60); // hours
      });

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : null;

    const totalItemsQuoted = participationsWithStats.reduce((sum, p) => sum + p.items_responded, 0);

    setStats({
      total_participations: participationsWithStats.length,
      submitted_count: submittedParticipations.length,
      avg_response_time_hours: avgResponseTime,
      total_items_quoted: totalItemsQuoted,
    });

    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      invited: { variant: "secondary", label: "Convidado" },
      viewed: { variant: "outline", label: "Visualizado" },
      partial: { variant: "default", label: "Parcial" },
      submitted: { variant: "default", label: "Enviado" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Carregando..." />
        <div className="p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="min-h-screen">
        <Header title="Fornecedor não encontrado" />
        <div className="p-6">
          <Button variant="outline" onClick={() => navigate("/suppliers")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title={`Histórico: ${supplier.name}`}
        description={supplier.email}
        actions={
          <Button variant="outline" onClick={() => navigate("/suppliers")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        }
      />

      <div className="p-6 space-y-6 animate-fade-in">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cotações Participadas</p>
                  <p className="text-2xl font-semibold">{stats?.total_participations || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cotações Enviadas</p>
                  <p className="text-2xl font-semibold">{stats?.submitted_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tempo Médio de Resposta</p>
                  <p className="text-2xl font-semibold">
                    {stats?.avg_response_time_hours
                      ? `${Math.round(stats.avg_response_time_hours)}h`
                      : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <Package className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Itens Cotados</p>
                  <p className="text-2xl font-semibold">{stats?.total_items_quoted || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="participations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="participations">Participações em Cotações</TabsTrigger>
            <TabsTrigger value="price-history">Variação de Preços</TabsTrigger>
          </TabsList>

          <TabsContent value="participations">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Participações</CardTitle>
              </CardHeader>
              <CardContent>
                <SupplierQuoteHistoryTable
                  participations={participations}
                  getStatusBadge={getStatusBadge}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="price-history">
            <PriceVariationChart supplierId={Number(id)} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
