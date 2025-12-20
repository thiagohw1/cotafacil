import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface Props {
  participations: QuoteParticipation[];
  getStatusBadge: (status: string) => React.ReactNode;
}

export function SupplierQuoteHistoryTable({ participations, getStatusBadge }: Props) {
  const navigate = useNavigate();

  const getQuoteStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      draft: { className: "bg-muted text-muted-foreground", label: "Rascunho" },
      open: { className: "bg-success/10 text-success", label: "Aberta" },
      closed: { className: "bg-warning/10 text-warning", label: "Encerrada" },
      cancelled: { className: "bg-destructive/10 text-destructive", label: "Cancelada" },
    };
    const config = variants[status] || { className: "bg-muted", label: status };
    return <Badge className={config.className} variant="outline">{config.label}</Badge>;
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (participations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Este fornecedor ainda não participou de nenhuma cotação.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cotação</TableHead>
          <TableHead>Status Cotação</TableHead>
          <TableHead>Status Resposta</TableHead>
          <TableHead>Convidado em</TableHead>
          <TableHead>Enviado em</TableHead>
          <TableHead className="text-center">Itens</TableHead>
          <TableHead className="text-right">Preço Médio</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {participations.map((p) => (
          <TableRow key={p.quote_id}>
            <TableCell className="font-medium">{p.quote_title}</TableCell>
            <TableCell>{getQuoteStatusBadge(p.quote_status)}</TableCell>
            <TableCell>{getStatusBadge(p.status)}</TableCell>
            <TableCell>
              {format(new Date(p.invited_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </TableCell>
            <TableCell>
              {p.submitted_at
                ? format(new Date(p.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                : "-"}
            </TableCell>
            <TableCell className="text-center">
              <span className="font-medium">{p.items_responded}</span>
              <span className="text-muted-foreground">/{p.total_items}</span>
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatCurrency(p.avg_price)}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/quotes/${p.quote_id}`)}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
