import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, UserCog, CheckCircle2, Trash2, Settings } from "lucide-react";
import { ManagePermissionsDialog } from "@/components/users/ManagePermissionsDialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import type { Permission } from "@/hooks/usePermissions";



interface UserPermission {
    id: string;
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
    const [selectedUser, setSelectedUser] = useState<UserPermission | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

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
                            id: user.id,
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
                        id: user.id,
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
                    <div className="flex gap-2">
                        <CreateUserDialog onUserCreated={fetchUsers} />
                        <Button variant="outline" onClick={fetchUsers} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Atualizar
                        </Button>
                    </div>
                }
            />

            {/* Users Table */}
            <div className="p-6 space-y-6 animate-fade-in">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Usuários e Permissões</CardTitle>
                                <CardDescription>
                                    Gerencie o acesso dos usuários do seu time.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuário</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow key={user.user_id}>
                                            <TableCell>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium flex items-center gap-2">
                                                            {user.full_name || "Sem nome"}
                                                            {user.user_id === currentUser?.id && (
                                                                <Badge variant="outline" className="text-xs">Você</Badge>
                                                            )}
                                                        </span>
                                                        <span className="text-sm text-muted-foreground">{user.email}</span>
                                                    </div>
                                                    <Badge variant="secondary" className="capitalize ml-4">
                                                        {user.role === 'admin' ? 'Administrador' : user.role === 'buyer' ? 'Comprador' : 'Fornecedor'}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setDialogOpen(true);
                                                        }}
                                                        disabled={user.role === 'admin'}
                                                        title="Configurar Permissões"
                                                    >
                                                        <Settings className="h-4 w-4" />
                                                    </Button>

                                                    {user.user_id !== currentUser?.id && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteUser(user.user_id)}
                                                            className="text-destructive hover:text-destructive/90"
                                                            title="Remover Usuário"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {users.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={2} className="h-24 text-center">
                                                Nenhum usuário encontrado.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <ManagePermissionsDialog
                user={selectedUser}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                tenantId={tenantId}
                onSave={fetchUsers}
            />
        </div>
    );
}
