import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export type Permission =
    | "create_quote"
    | "edit_quote"
    | "view_prices"
    | "close_quote"
    | "delete_quote"
    | "manage_users"
    | "manage_products"
    | "manage_suppliers"
    | "view_reports";

interface UsePermissionsReturn {
    permissions: Permission[];
    hasPermission: (permission: Permission) => boolean;
    isAdmin: boolean;
    loading: boolean;
    refreshPermissions: () => Promise<void>;
}

export function usePermissions(): UsePermissionsReturn {
    const { user, profile } = useAuth();
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);

    const isAdmin = profile?.role === "admin";

    const loadPermissions = async () => {
        if (!user || !profile?.tenant_id) {
            setPermissions([]);
            setLoading(false);
            return;
        }

        // Admins have all permissions
        if (isAdmin) {
            setPermissions([
                "create_quote",
                "edit_quote",
                "view_prices",
                "close_quote",
                "delete_quote",
                "manage_users",
                "manage_products",
                "manage_suppliers",
                "view_reports",
            ]);
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase.rpc("get_user_permissions", {
                p_user_id: user.id,
                p_tenant_id: profile.tenant_id,
            });

            if (error) {
                console.error("Error loading permissions:", error);
                setPermissions([]);
            } else {
                setPermissions((data || []).map((p: { permission: string }) => p.permission as Permission));
            }
        } catch (err) {
            console.error("Error loading permissions:", err);
            setPermissions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPermissions();
    }, [user, profile]);

    const hasPermission = (permission: Permission): boolean => {
        if (isAdmin) return true;
        return permissions.includes(permission);
    };

    return {
        permissions,
        hasPermission,
        isAdmin,
        loading,
        refreshPermissions: loadPermissions,
    };
}
