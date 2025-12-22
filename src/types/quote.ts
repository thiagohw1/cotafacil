export interface QuoteItem {
    id?: number;
    product_id: number;
    package_id: number | null;
    requested_qty: number | null;
    notes: string | null;
    product?: { name: string };
    package?: { unit: string; multiplier?: number } | null;
}

export interface QuoteSupplier {
    id: number;
    supplier_id: number;
    public_token: string;
    status: string;
    supplier?: { name: string; email: string };
}

export interface Product {
    id: number;
    name: string;
    packages: { id: number; unit: string; multiplier: number; is_default: boolean }[];
}

export interface Supplier {
    id: number;
    name: string;
    email: string;
}

export interface ProductList {
    id: number;
    name: string;
}

export interface ImportListItem {
    product_id: number;
    product_name: string;
    package_id: number | null;
    requested_qty: string;
    packages: { id: number; unit: string; multiplier: number; is_default: boolean }[];
}
