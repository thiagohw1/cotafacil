import { supabase } from '@/integrations/supabase/client';

/**
 * Helper para obter o tenant_id do usuário autenticado
 */
export async function getCurrentTenantId(): Promise<number | null> {
    try {
        const { data: userData } = await supabase.auth.getUser();

        if (!userData.user) {
            return null;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('user_id', userData.user.id)
            .single();

        return profile?.tenant_id || null;
    } catch (error) {
        console.error('Erro ao obter tenant_id:', error);
        return null;
    }
}

/**
 * Helper para criar Purchase Order com tenant_id automático
 * 
 * Uso:
 * const po = await createPurchaseOrder({
 *   supplier_id: 1,
 *   notes: 'Meu PO'
 * });
 */
export async function createPurchaseOrder(data: {
    supplier_id: number;
    quote_id?: number;
    notes?: string;
    internal_notes?: string;
    expected_delivery_date?: string;
}) {
    const tenantId = await getCurrentTenantId();

    if (!tenantId) {
        throw new Error('Usuário não autenticado ou sem tenant');
    }

    return await supabase
        .from('purchase_orders')
        .insert({
            ...data,
            tenant_id: tenantId,
            po_number: '' // Será gerado automaticamente
        })
        .select()
        .single();
}

/**
 * Helper para adicionar item ao Purchase Order
 */
export async function addPurchaseOrderItem(data: {
    po_id: number;
    product_id: number;
    package_id?: number;
    qty: number;
    unit_price: number;
    quote_item_id?: number;
    quote_response_id?: number;
    notes?: string;
    delivery_days?: number;
}) {
    // Calcular total_price
    const total_price = Number(data.qty) * Number(data.unit_price);

    return await supabase
        .from('purchase_order_items')
        .insert({
            ...data,
            total_price
        })
        .select()
        .single();
}

/**
 * Exemplo de uso completo:
 * 
 * // Criar PO
 * const { data: po } = await createPurchaseOrder({
 *   supplier_id: 1,
 *   notes: 'Pedido mensal'
 * });
 * 
 * // Adicionar itens
 * await addPurchaseOrderItem({
 *   po_id: po.id,
 *   product_id: 1,
 *   qty: 10,
 *   unit_price: 5.50
 * });
 */
