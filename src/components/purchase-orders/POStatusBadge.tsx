import { Badge } from '@/components/ui/badge';
import { POStatus, PO_STATUS_LABELS, PO_STATUS_COLORS } from '@/types/purchase-orders';

interface POStatusBadgeProps {
    status: POStatus;
    className?: string;
}

export function POStatusBadge({ status, className = '' }: POStatusBadgeProps) {
    return (
        <Badge
            variant="outline"
            className={`${PO_STATUS_COLORS[status]} ${className}`}
        >
            {PO_STATUS_LABELS[status]}
        </Badge>
    );
}
