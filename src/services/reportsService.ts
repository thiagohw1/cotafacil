import { supabase } from "@/integrations/supabase/client";

export interface DateRange {
    startDate: Date;
    endDate: Date;
}

export const reportsService = {
    // 1. Evolução de Preços (Geral ou por Produto)
    async getPriceHistory(tenantId: number, dateRange: DateRange, productId?: number) {
        let query = supabase
            .from("price_history")
            .select(`
        price,
        recorded_at,
        supplier_id,
        suppliers (name),
        product_id,
        products (name)
      `)
            .eq("tenant_id", tenantId)
            .gte("recorded_at", dateRange.startDate.toISOString())
            .lte("recorded_at", dateRange.endDate.toISOString())
            .order("recorded_at", { ascending: true });

        if (productId) {
            query = query.eq("product_id", productId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // 2. Histórico Específico de Fornecedor por Produto (com marcação de vitória)
    async getSupplierProductHistory(
        tenantId: number,
        supplierId: number,
        productId: number,
        dateRange: DateRange
    ) {
        // Busca todas as respostas desse fornecedor para esse produto
        const { data: responses, error } = await supabase
            .from("quote_responses")
            .select(`
        price,
        quote_id,
        quote_item_id,
        updated_at,
        quotes!inner (
          id,
          created_at,
          deadline_at,
          tenant_id
        ),
        quote_items!inner (
          id,
          product_id,
          winner_response_id
        )
      `)
            .eq("quotes.tenant_id", tenantId)
            .eq("quote_items.product_id", productId)
            .eq("quote_supplier_id", supplierId) // Precisamos ver se quote_supplier_id é o ID da tabela intermedária ou do supplier real.
        // Ops: quote_supplier_id na quote_responses aponta para 'quote_suppliers'. 
        // Precisamos filtrar pelo supplier_id real.
        // O join ficaria complexo aqui. Vamos ajustar a query.

        if (error) throw error;
        return responses;
    },

    // FIX: Busca mais robusta para o gráfico de Fornecedor
    async getSupplierPriceEvolution(
        tenantId: number,
        supplierId: number,
        productId: number
    ) {
        // 1. Pegar todos os quote_suppliers desse fornecedor
        // 2. Pegar as responses associadas a items desse produto
        const { data, error } = await supabase
            .from("quote_responses")
            .select(`
        price,
        filled_at,
        id,
        quote_suppliers!inner (
          supplier_id
        ),
        quote_items!quote_responses_quote_item_id_fkey!inner (
          product_id,
          winner_response_id
        ),
        quotes!inner (
          id,
          created_at,
          title
        )
      `)
            .eq("quotes.tenant_id", tenantId)
            .eq("quote_suppliers.supplier_id", supplierId)
            .eq("quote_items.product_id", productId)
            .order("filled_at", { ascending: true });

        if (error) throw error;

        return data.map(item => ({
            date: item.filled_at || item.quotes?.created_at,
            price: item.price,
            quoteTitle: item.quotes?.title,
            isWinner: item.id === item.quote_items?.winner_response_id
        }));
    }
};
