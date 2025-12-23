import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, UserCog, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import type { Permission } from "@/hooks/usePermissions";

interface User {
    id: string;
    user_id: string;
    full_name: string | null;
    email: string;
    role: string;
}

interface UserPermission {
    user_id: string;
    email: string;
    full_name: string | null;
    role: string;
    permissions: Permission[];
}

const AVAILABLE_PERMISSIONS: { id: Permission; label: string; description: string }[] = [
    { id: "create_quote", label: "Criar Cotações", description: "Criar novas cotações" },
    { id: "edit_quote", label: "Editar Cotações", description: "Modificar cotações existentes" },
    { id: "view_prices", label: "Ver Preços", description: "Visualizar valores das propostas" },
    { id: "close_quote", label: "Encerrar Cotações", description: "Finalizar processos  de cotação" },
    { id: "delete_quote", label: "Deletar Cotações", description: "Remover cotações" },
    { id: "manage_users", label: "Gerenciar Usuários", description: "Adicionar/remover usuários" },
    { id: "manage_products", label: "Gerenciar Produtos", description: "CRUD de produtos" },
    { id: "manage_suppliers", label: "Gerenciar Fornecedores", description: "CRUD de fornecedores" },
    { id: "view_reports", label: "Ver Relatórios", description: "Acessar relatórios e analytics" },
    { id: "view_purchase_orders", label: "Ver Pedidos de Compra", description: "Visualizar pedidos de compra" },
    { id: "create_purchase_order", label: "Criar Pedidos de Compra", description: "Gerar novos pedidos de compra" },
    { id: "edit_purchase_order", label: "Editar Pedidos de Compra", description: "Modificar pedidos em rascunho" },
    { id: "send_purchase_order", label: "Enviar Pedidos de Compra", description: "Enviar pedidos para fornecedores" },
    { id: "delete_purchase_order", label: "Deletar Pedidos de Compra", description: "Remover pedidos de compra" },
];

export default function Permissions() {
    const { user: currentUser, profile } = useAuth();
    const { tenantId } = useTenant();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [users, setUsers] = useState<UserPermission[]>([]);

    const isAdmin = profile?.role === "admin";

    useEffect(() => {
        if (tenantId && isAdmin) {
            fetchUsers();
        } else if (!isAdmin) {
            setLoading(false);
        }
    }, [tenantId, isAdmin]);

    const fetchUsers = async () => {
        if (!tenantId) return;
        setLoading(true);

        try {
            // Fetch all users in tenant
            const { data: profilesData, error: profilesError } = await supabase
                .from("profiles")
                .select("id, user_id, full_name, email")
                .eq("tenant_id", tenantId);

            if (profilesError) throw profilesError;

            // Fetch roles for these users
            const userIds = profilesData.map(p => p.user_id);
            const { data: rolesData, error: rolesError } = await supabase
                .from("user_roles")
                .select("user_id, role")
                .in("user_id", userIds);

            if (rolesError) throw rolesError;

            const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]));

            // Fetch permissions for each user
            const usersWithPermissions: UserPermission[] = await Promise.all(
                (profilesData || []).map(async (user) => {
                    const role = rolesMap.get(user.user_id) || "buyer";

                    if (role === "admin") {
                        // Admins have all permissions
                        return {
                            user_id: user.user_id,
                            email: user.email,
                            full_name: user.full_name,
                            role: role,
                            permissions: AVAILABLE_PERMISSIONS.map((p) => p.id),
                        };
                    }

                    const { data: permsData } = await supabase
                        .from("user_permissions")
                        .select("permission")
                        .eq("user_id", user.user_id)
                        .eq("tenant_id", tenantId);

                    return {
                        user_id: user.user_id,
                        email: user.email,
                        full_name: user.full_name,
                        role: role,
                        permissions: (permsData || []).map((p) => p.permission as Permission),
                    };
                })
            );

            setUsers(usersWithPermissions);
        } catch (err: any) {
            console.error("Error fetching users:", err);
            toast({
                title: "Erro ao carregar usuários",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePermissionToggle = async (userId: string, permission: Permission, currentlyHas: boolean) => {
        if (!tenantId || !currentUser) return;

        setSaving(true);

        try {
            if (currentlyHas) {
                // Remove permission
                const { error } = await supabase
                    .from("user_permissions")
                    .delete()
                    .eq("user_id", userId)
                    .eq("tenant_id", tenantId)
                    .eq("permission", permission);

                if (error) throw error;
            } else {
                // Add permission
                const { error } = await supabase.from("user_permissions").insert({
                    user_id: userId,
                    tenant_id: tenantId,
                    permission,
                    created_by: currentUser.id,
                });

                if (error) throw error;
            }

            // Update local state
            setUsers((prev) =>
                prev.map((user) =>
                    user.user_id === userId
                        ? {
                            ...user,
                            permissions: currentlyHas
                                ? user.permissions.filter((p) => p !== permission)
                                : [...user.permissions, permission],
                        }
                        : user
                )
            );

            toast({
                title: currentlyHas ? "Permissão removida" : "Permissão concedida",
            });
        } catch (err: any) {
            toast({
                title: "Erro ao atualizar permissão",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        if (!tenantId || !currentUser) return;
        setSaving(true);

        try {
            // Check if user has a role entry
            const { data: existingRole } = await supabase
                .from("user_roles")
                .select("id")
                .eq("user_id", userId)
                .maybeSingle();

            if (existingRole) {
                const { error } = await supabase
                    .from("user_roles")
                    .update({ role: newRole })
                    .eq("user_id", userId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("user_roles")
                    .insert({ user_id: userId, role: newRole });
                if (error) throw error;
            }

            setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
            toast({ title: "Função atualizada com sucesso" });
        } catch (err: any) {
            toast({
                title: "Erro ao atualizar função",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!tenantId || !currentUser) return;
        if (!confirm("Tem certeza que deseja remover este usuário?")) return;

        setSaving(true);
        try {
            // Delete from profiles (cascading should handle others, but let's be safe)
            // Note: We can't delete from auth.users from client, so we just remove access to tenant
            const { error } = await supabase
                .from("profiles")
                .delete()
                .eq("user_id", userId)
                .eq("tenant_id", tenantId);

            if (error) throw error;

            setUsers(prev => prev.filter(u => u.user_id !== userId));
            toast({ title: "Usuário removido com sucesso" });
        } catch (err: any) {
            toast({
                title: "Erro ao remover usuário",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen">
                <Header title="Permissões" description="Gerenciar permissões de usuários" />
                <div className="p-6">
                    <Card>
                        <CardContent className="pt-12 pb-12 text-center">
                            <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-lg text-muted-foreground">
                                Apenas administradores podem gerenciar permissões.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <Header
                title="Permissões"
                description="Gerenciar permissões granulares de usuários"
                actions={
                    <Button variant="outline" onClick={fetchUsers} disabled={saving}>
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Atualizar
                    </Button>
                }
            />

            <div className="p-6 space-y-6 animate-fade-in">
                {/* Info Card */}
                <Card className="border-info/50 bg-info/5">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <Shield className="h-5 w-5 text-info mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium">Sistema de Permissões Granulares</p>
                                <p className="text-sm text-muted-foreground">
                                    Administradores têm todas as permissões automaticamente. Configure permissões específicas para
                                    usuários comuns.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Users List */}
                <div className="space-y-4">
                    {users.map((user) => (
                        <Card key={user.user_id} className={user.user_id === currentUser?.id ? "border-primary" : ""}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <UserCog className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">
                                                {user.full_name || user.email}
                                                {user.user_id === currentUser?.id && (
                                                    <Badge variant="outline" className="ml-2">
                                                        Você
                                                    </Badge>
                                                )}
                                            </CardTitle>
                                            <CardDescription>{user.email}</CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            className="h-9 w-[150px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            value={user.role}
                                            onChange={(e) => handleRoleChange(user.user_id, e.target.value)}
                                            disabled={saving || user.user_id === currentUser?.id}
                                        >
                                            <option value="admin">Administrador</option>
                                            <option value="buyer">Comprador</option>
                                            <option value="supplier">Fornecedor</option>
                                        </select>

                                        {user.user_id !== currentUser?.id && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteUser(user.user_id)}
                                                disabled={saving}
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent>
                                {user.role === "admin" ? (
                                    <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/50">
                                        <CheckCircle2 className="h-5 w-5 text-success" />
                                        <p className="text-sm text-muted-foreground">
                                            Este usuário tem todas as permissões como administrador.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {AVAILABLE_PERMISSIONS.map((perm) => {
                                            const hasPermission = user.permissions.includes(perm.id);
                                            return (
                                                <div key={perm.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                                                    <Checkbox
                                                        id={`${user.user_id}-${perm.id}`}
                                                        checked={hasPermission}
                                                        onCheckedChange={() => handlePermissionToggle(user.user_id, perm.id, hasPermission)}
                                                        disabled={saving}
                                                    />
                                                    <div className="space-y-1 leading-none">
                                                        <Label
                                                            htmlFor={`${user.user_id}-${perm.id}`}
                                                            className="text-sm font-medium cursor-pointer"
                                                        >
                                                            {perm.label}
                                                        </Label>
                                                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {users.length === 0 && (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <UserCog className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Nenhum usuário encontrado neste tenant.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
