import * as React from "react";
import { cn } from "@/lib/utils";

type StatusType = "draft" | "open" | "closed" | "cancelled" | "invited" | "viewed" | "partial" | "submitted" | "active" | "inactive";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  draft: {
    label: "Rascunho",
    className: "bg-muted text-muted-foreground",
  },
  open: {
    label: "Aberta",
    className: "bg-success/10 text-success border-success/20",
  },
  closed: {
    label: "Encerrada",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  cancelled: {
    label: "Cancelada",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  invited: {
    label: "Convidado",
    className: "bg-info/10 text-info border-info/20",
  },
  viewed: {
    label: "Visualizado",
    className: "bg-muted text-muted-foreground",
  },
  partial: {
    label: "Parcial",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  submitted: {
    label: "Enviado",
    className: "bg-success/10 text-success border-success/20",
  },
  active: {
    label: "Ativo",
    className: "bg-success/10 text-success border-success/20",
  },
  inactive: {
    label: "Inativo",
    className: "bg-muted text-muted-foreground",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}