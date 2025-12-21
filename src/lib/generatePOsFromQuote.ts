import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from './purchase-order-helpers';

interface QuoteItemWithWinner {
    id: number;
    quote_id: number;
    product_id: number;
    package_id?: number;
    winner_supplier_id: number;
    winner_response_id: number;
    qty: number;
    unit_price: number;
    product?: {
        id: number;
        name: string;
    };
}

interface GeneratedPO {
    po_id: number;
    po_number: string;
    supplier_id: number;
    supplier_name: string;
    items_count: number;
    total_amount: number;
}

/**
 * Gera Purchase Orders automaticamente a partir dos vencedores de uma cotação
 * Agrupa itens por fornecedor (um PO por fornecedor)
 */
export async function generatePOsFromQuote(quoteId: number): Promise<{
    success: boolean;
    pos?: GeneratedPO[];
    error?: string;
}> {
    try {
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Usuário não autenticado ou sem tenant' };
        }

        // 1. Buscar todos os itens da cotação que têm vencedores
        const { data: quoteItems, error: itemsError } = await supabase
            .from('quote_items')
            .select(`
        id,
        quote_id,
        product_id,
        package_id,
        winner_supplier_id,
        winner_response_id,
        product:products(id, name)
      `)
            .eq('quote_id', quoteId)
            .not('winner_supplier_id', 'is', null);

        if (itemsError) {
            return { success: false, error: `Erro ao buscar itens: ${itemsError.message}` };
        }

        if (!quoteItems || quoteItems.length === 0) {
            return { success: false, error: 'Nenhum item com vencedor selecionado encontrado' };
        }

        // 2. Buscar dados das respostas vencedoras (preços)
        const responseIds = quoteItems.map(item => item.winner_response_id);
        const { data: responses, error: responsesError } = await supabase
            .from('quote_responses')
            .select('id, quote_item_id, price, delivery_days')
            .in('id', responseIds);

        if (responsesError) {
            return { success: false, error: `Erro ao buscar respostas: ${responsesError.message}` };
        }

        // Criar mapa de respostas para fácil acesso
        const responsesMap = new Map(
            responses?.map(r => [r.id, r]) || []
        );

        // 3. Agrupar itens por fornecedor
        const itemsBySupplier = new Map<number, QuoteItemWithWinner[]>();

        for (const item of quoteItems as any[]) {
            const supplierId = item.winner_supplier_id;
            const response = responsesMap.get(item.winner_response_id);

            if (!response) continue;

            const itemWithPrice = {
                ...item,
                qty: 1, // Buscar quantidade real da quote_item se necessário
                unit_price: response.price,
                delivery_days: response.delivery_days,
            };

            if (!itemsBySupplier.has(supplierId)) {
                itemsBySupplier.set(supplierId, []);
            }
            itemsBySupplier.get(supplierId)!.push(itemWithPrice);
        }

        // 4. Criar um PO para cada fornecedor
        const generatedPOs: GeneratedPO[] = [];

        for (const [supplierId, items] of itemsBySupplier.entries()) {
            // Criar o PO
            const { data: newPO, error: poError } = await supabase
                .from('purchase_orders')
                .insert({
                    tenant_id: tenantId,
                    quote_id: quoteId,
                    supplier_id: supplierId,
                    po_number: '', // Será gerado pelo trigger
                    status: 'draft',
                    notes: `PO gerado automaticamente da cotação #${quoteId}`
                })
                .select(`
          id,
          po_number,
          supplier_id,
          total_amount,
          supplier:suppliers(name)
        `)
                .single();

            if (poError) {
                console.error('Erro ao criar PO:', poError);
                continue;
            }

            // Criar itens do PO
            const poItems = items.map(item => ({
                po_id: newPO.id,
                product_id: item.product_id,
                package_id: item.package_id,
                quote_item_id: item.id,
                quote_response_id: item.winner_response_id,
                qty: item.qty,
                unit_price: item.unit_price,
                total_price: item.qty * item.unit_price,
                delivery_days: item.delivery_days
            }));

            const { error: itemsInsertError } = await supabase
                .from('purchase_order_items')
                .insert(poItems);

            if (itemsInsertError) {
                console.error('Erro ao criar itens do PO:', itemsInsertError);
                // Deletar PO se falhar ao criar itens
                await supabase.from('purchase_orders').delete().eq('id', newPO.id);
                continue;
            }

            // Buscar PO atualizado com total calculado
            const { data: updatedPO } = await supabase
                .from('purchase_orders')
                .select('total_amount')
                .eq('id', newPO.id)
                .single();

            generatedPOs.push({
                po_id: newPO.id,
                po_number: newPO.po_number,
                supplier_id: supplierId,
                supplier_name: (newPO.supplier as any)?.name || 'Fornecedor',
                items_count: items.length,
                total_amount: updatedPO?.total_amount || 0
            });
        }

        if (generatedPOs.length === 0) {
            return { success: false, error: 'Nenhum PO foi criado. Verifique os dados.' };
        }

        return {
            success: true,
            pos: generatedPOs
        };

    } catch (error: any) {
        console.error('Erro ao gerar POs:', error);
        return {
            success: false,
            error: error.message || 'Erro desconhecido ao gerar Purchase Orders'
        };
    }
}

/**
 * Verifica se uma cotação está pronta para gerar POs
 */
export async function validateQuoteForPO(quoteId: number): Promise<{
    valid: boolean;
    message?: string;
    itemsWithWinners?: number;
    totalItems?: number;
}> {
    try {
        // Buscar todos os itens da cotação
        const { data: allItems, error: allError } = await supabase
            .from('quote_items')
            .select('id, winner_supplier_id')
            .eq('quote_id', quoteId);

        if (allError) {
            return { valid: false, message: `Erro ao verificar cotação: ${allError.message}` };
        }

        if (!allItems || allItems.length === 0) {
            return { valid: false, message: 'Cotação não possui itens' };
        }

        const itemsWithWinners = allItems.filter(item => item.winner_supplier_id !== null).length;
        const totalItems = allItems.length;

        if (itemsWithWinners === 0) {
            return {
                valid: false,
                message: 'Nenhum vencedor foi selecionado',
                itemsWithWinners,
                totalItems
            };
        }

        if (itemsWithWinners < totalItems) {
            return {
                valid: true,
                message: `${itemsWithWinners} de ${totalItems} itens têm vencedores. Deseja gerar PO apenas para estes itens?`,
                itemsWithWinners,
                totalItems
            };
        }

        return {
            valid: true,
            message: `Todos os ${totalItems} itens têm vencedores selecionados`,
            itemsWithWinners,
            totalItems
        };

    } catch (error: any) {
        return { valid: false, message: error.message };
    }
}
