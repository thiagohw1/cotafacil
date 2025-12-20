import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Loader2, FileText, Eye, Printer, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PurchaseOrder {
    id: number;
    po_number: string;
    quote_id: number;
    supplier_id: number;
    status: string;
    total_value: number;
    created_at: string;
    supplier_name?: string;
    quote_title?: string;
}

const STATUS_CONFIG = {
    draft: { label: "Rascunho", variant: "secondary" as const },
    sent: { label: "Enviado", variant: "default" as const },
    confirmed: { label: "Confirmado", variant: "default" as const },
    cancelled: { label: "Cancelado", variant: "destructive" as const },
};

export default function PurchaseOrders() {
    const navigate = useNavigate();
    const { tenantId } = useTenant();
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);

    useEffect(() => {
        if (tenantId) {
            fetchOrders();
        }
    }, [tenantId]);

    const fetchOrders = async () => {
        if (!tenantId) return;
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from("purchase_orders")
                .select(`
          *,
          suppliers(name),
          quotes(title)
        `)
                .eq("tenant_id", tenantId)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const mapped = (data || []).map((po: any) => ({
                ...po,
                supplier_name: po.suppliers?.name,
                quote_title: po.quotes?.title,
            }));

            setOrders(mapped);
        } catch (err: any) {
            console.error("Error fetching POs:", err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

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
                title="Pedidos de Compra"
                description="Gerenciar pedidos de compra gerados a partir de cotações"
                actions={
                    <Button onClick={() => navigate("/quotes")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Cotação
                    </Button>
                }
            />

            <div className="p-6 animate-fade-in">
                <Card>
                    <CardHeader>
                        <CardTitle>Lista de Pedidos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {orders.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                                <p className="text-muted-foreground">Nenhum pedido de compra encontrado.</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Gere pedidos a partir de cotações encerradas.
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Número PO</TableHead>
                                        <TableHead>Fornecedor</TableHead>
                                        <TableHead>Cotação</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Valor Total</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.map((po) => {
                                        const statusConfig = STATUS_CONFIG[po.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
                                        return (
                                            <TableRow key={po.id}>
                                                <TableCell className="font-medium">{po.po_number}</TableCell>
                                                <TableCell>{po.supplier_name || "-"}</TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {po.quote_title || `#${po.quote_id}`}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">{formatCurrency(po.total_value)}</TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {format(new Date(po.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button size="sm" variant="outline">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="sm" variant="outline">
                                                            <Printer className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
