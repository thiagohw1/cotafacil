import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
    PurchaseOrder,
    PurchaseOrderWithItems,
    PurchaseOrderFilters,
    POStatus
} from '@/types/purchase-orders';
import { getCurrentTenantId, createPurchaseOrder as createPOHelper } from '@/lib/purchase-order-helpers';

export function usePurchaseOrders(filters?: PurchaseOrderFilters) {
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchPurchaseOrders = async () => {
        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from('purchase_orders')
                .select(`
          *,
          supplier:suppliers(id, name, email),
          quote:quotes(id, title)
        `)
                .order('created_at', { ascending: false });

            // Aplicar filtros
            if (filters?.status && filters.status.length > 0) {
                query = query.in('status', filters.status);
            }

            if (filters?.supplier_id) {
                query = query.eq('supplier_id', filters.supplier_id);
            }

            if (filters?.date_from) {
                query = query.gte('created_at', filters.date_from);
            }

            if (filters?.date_to) {
                query = query.lte('created_at', filters.date_to);
            }

            if (filters?.search) {
                query = query.ilike('po_number', `%${filters.search}%`);
            }

            const { data: poData, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            // Manual Join with Profiles (created_by -> profiles.user_id)
            let enrichedData: PurchaseOrder[] = (poData || []) as PurchaseOrder[];

            const userIds = Array.from(new Set(poData?.map(po => po.created_by).filter(Boolean)));

            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('user_id, full_name, email')
                    .in('user_id', userIds);

                const profileMap = new Map(profiles?.map(p => [p.user_id, p]));

                enrichedData = enrichedData.map(po => ({
                    ...po,
                    creator_profile: po.created_by ? profileMap.get(po.created_by) : undefined
                }));
            }

            setPurchaseOrders(enrichedData);
        } catch (err: any) {
            setError(err.message);
            toast({
                title: 'Erro ao carregar Purchase Orders',
                description: err.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPurchaseOrders();
    }, [JSON.stringify(filters)]);

    return {
        purchaseOrders,
        loading,
        error,
        refetch: fetchPurchaseOrders,
    };
}

export function usePurchaseOrder(id: number) {
    const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderWithItems | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchPurchaseOrder = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            setError(null);

            // Buscar PO com itens
            const { data: poData, error: poError } = await supabase
                .from('purchase_orders')
                .select(`
          *,
          supplier:suppliers(id, name, email),
          quote:quotes(id, title)
        `)
                .eq('id', id)
                .single();

            if (poError) throw poError;

            // Buscar itens do PO (pode estar vazio se for PO manual novo)
            const { data: itemsData, error: itemsError } = await supabase
                .from('purchase_order_items')
                .select(`
                    *,
                    product:products(id, name),
                    package:product_packages(id, unit, multiplier)
                `)
                .eq('po_id', id);

            // Se deu erro, só loga mas não quebra (PO pode não ter itens ainda)
            if (itemsError) {
                console.warn('Aviso ao buscar itens:', itemsError);
            }

            // Buscar profile do criador
            let creatorProfile = undefined;
            if (poData?.created_by) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, email')
                    .eq('user_id', poData.created_by)
                    .single();

                if (profile) {
                    creatorProfile = profile;
                }
            }

            setPurchaseOrder({
                ...(poData as any), // Schema mismatch with types.ts
                items: (itemsData || []) as any,
                creator_profile: creatorProfile
            } as PurchaseOrderWithItems);
        } catch (err: any) {
            setError(err.message);
            toast({
                title: 'Erro ao carregar Purchase Order',
                description: err.message,
                variant: 'destructive',
            });
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchPurchaseOrder();
        }
    }, [id]);

    const updateStatus = async (newStatus: POStatus) => {
        try {
            const { error: updateError } = await supabase
                .from('purchase_orders')
                .update({ status: newStatus })
                .eq('id', id);

            if (updateError) throw updateError;

            toast({
                title: 'Status atualizado',
                description: `PO ${purchaseOrder?.po_number} atualizado para ${newStatus}`,
            });

            await fetchPurchaseOrder();
        } catch (err: any) {
            toast({
                title: 'Erro ao atualizar status',
                description: err.message,
                variant: 'destructive',
            });
        }
    };

    const deletePurchaseOrder = async () => {
        try {
            const { error: deleteError } = await supabase
                .from('purchase_orders')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            toast({
                title: 'Purchase Order excluído',
                description: `PO ${purchaseOrder?.po_number} foi excluído com sucesso`,
            });

            return true;
        } catch (err: any) {
            toast({
                title: 'Erro ao excluir Purchase Order',
                description: err.message,
                variant: 'destructive',
            });
            return false;
        }
    };

    return {
        purchaseOrder,
        loading,
        error,
        refetch: fetchPurchaseOrder,
        updateStatus,
        deletePurchaseOrder,
    };
}
