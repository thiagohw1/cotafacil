// Purchase Order Types

export type POStatus = 'draft' | 'sent' | 'confirmed' | 'delivered' | 'cancelled';

export interface PurchaseOrder {
    id: number;
    tenant_id: number;
    quote_id?: number | null;
    po_number: string;
    supplier_id: number;
    status: POStatus;
    subtotal: number;
    tax_amount: number;
    shipping_cost: number;
    total_amount: number;
    notes?: string | null;
    internal_notes?: string | null;
    expected_delivery_date?: string | null;
    actual_delivery_date?: string | null;
    created_at: string;
    updated_at: string;
    created_by?: string | null;
    updated_by?: string | null;
    deleted_at?: string | null;

    // Relations (when joined)
    supplier?: {
        id: number;
        name: string;
        email?: string;
    };
    quote?: {
        id: number;
        title: string;
    };
    creator_profile?: {
        full_name: string | null;
        email: string;
    };
}

export interface PurchaseOrderItem {
    id: number;
    po_id: number;
    product_id: number;
    package_id?: number;
    quote_item_id?: number;
    quote_response_id?: number;
    qty: number;
    unit_price: number;
    total_price: number;
    delivery_days?: number;
    notes?: string;
    created_at: string;
    updated_at: string;

    // Relations (when joined)
    product?: {
        id: number;
        name: string;
        code?: string;
    };
    package?: {
        id: number;
        name: string;
    };
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
    items: PurchaseOrderItem[];
}

// DTOs para criação
export interface CreatePurchaseOrderDTO {
    supplier_id: number;
    quote_id?: number;
    notes?: string;
    internal_notes?: string;
    expected_delivery_date?: string;
}

export interface CreatePurchaseOrderItemDTO {
    po_id: number;
    product_id: number;
    package_id?: number;
    quote_item_id?: number;
    quote_response_id?: number;
    qty: number;
    unit_price: number;
    notes?: string;
    delivery_days?: number;
}

// Filtros para listagem
export interface PurchaseOrderFilters {
    status?: POStatus[];
    supplier_id?: number;
    date_from?: string;
    date_to?: string;
    search?: string; // Por número de PO
}

// Status labels e cores
export const PO_STATUS_LABELS: Record<POStatus, string> = {
    draft: 'Rascunho',
    sent: 'Enviado',
    confirmed: 'Confirmado',
    delivered: 'Entregue',
    cancelled: 'Cancelado'
};

export const PO_STATUS_COLORS: Record<POStatus, string> = {
    draft: 'bg-gray-100 text-gray-800 border-gray-200',
    sent: 'bg-blue-100 text-blue-800 border-blue-200',
    confirmed: 'bg-green-100 text-green-800 border-green-200',
    delivered: 'bg-purple-100 text-purple-800 border-purple-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200'
};
