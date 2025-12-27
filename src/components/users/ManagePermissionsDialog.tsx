import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Permission } from "@/hooks/usePermissions";

interface User {
    id: string; // profile id
    user_id: string; // auth id
    full_name: string | null;
    email: string;
    role: string;
}

interface ManagePermissionsDialogProps {
    user: User | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tenantId: string | number | null;
    onSave?: () => void;
}

// Reuse the permissions list from Permissions.tsx or centralize it later
const AVAILABLE_PERMISSIONS: { id: Permission; label: string; description: string }[] = [
    { id: "create_quote", label: "Criar Cotações", description: "Criar novas cotações" },
    { id: "edit_quote", label: "Editar Cotações", description: "Modificar cotações existentes" },
    { id: "view_prices", label: "Ver Preços", description: "Visualizar valores das propostas" },
    { id: "close_quote", label: "Encerrar Cotações", description: "Finalizar processos de cotação" },
    { id: "delete_quote", label: "Deletar Cotações", description: "Remover cotações" },
    { id: "manage_products", label: "Gerenciar Produtos", description: "CRUD de produtos" },
    { id: "manage_suppliers", label: "Gerenciar Fornecedores", description: "CRUD de fornecedores" },
    { id: "view_reports", label: "Ver Relatórios", description: "Acessar relatórios e analytics" },
    { id: "view_purchase_orders", label: "Ver Pedidos de Compra", description: "Visualizar pedidos de compra" },
    { id: "create_purchase_order", label: "Criar Pedidos de Compra", description: "Gerar novos pedidos de compra" },
    { id: "edit_purchase_order", label: "Editar Pedidos de Compra", description: "Modificar pedidos em rascunho" },
    { id: "send_purchase_order", label: "Enviar Pedidos de Compra", description: "Enviar pedidos para fornecedores" },
    { id: "delete_purchase_order", label: "Deletar Pedidos de Compra", description: "Remover pedidos de compra" },
    { id: "manage_users", label: "Gerenciar Usuários", description: "Adicionar/remover usuários" },
];

export function ManagePermissionsDialog({ user, open, onOpenChange, tenantId, onSave }: ManagePermissionsDialogProps) {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [role, setRole] = useState<string>("buyer");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();
    const { user: currentUser } = useAuth();

    useEffect(() => {
        if (open && user && tenantId) {
            fetchPermissions();
            setRole(user.role);
        } else {
            setPermissions([]);
        }
    }, [open, user, tenantId]);

    const fetchPermissions = async () => {
        if (!user || !tenantId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("user_permissions")
                .select("permission")
                .eq("user_id", user.user_id)
                .eq("tenant_id", tenantId);

            if (error) throw error;
            setPermissions(data.map((p) => p.permission as Permission));
        } catch (error: any) {
            console.error("Error fetching permissions:", error);
            toast({
                title: "Erro ao carregar permissões",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (permId: Permission, isChecked: boolean) => {
        if (!user || !tenantId || !currentUser) return;

        // Optimistic update
        setPermissions(prev =>
            isChecked ? [...prev, permId] : prev.filter(p => p !== permId)
        );

        // We process updates individually for immediate feedback, or we could batch save on close.
        // Given the requirement "ao selecionar... abre-se essa tela", immediate save feels cleaner or a "Save" button.
        // User screenshot implies toggles. Let's do immediate save but handle errors.

        // Correction: Ideally this should be a form save to avoid too many requests? 
        // But the previous implementation was toggle-based. Let's stick to toggle-based for now 
        // to minimize friction, but maybe add a debouncer or just handle it silently unless error.

        // Actually, for a dialog, a "Save Changes" button is usually better to prevent accidental edits.
        // However, the user said "ao selecionar a opção para adicionar ou remover privilégios abre-se essa tela".
        // Let's implement active toggling inside the dialog for simplicity with the previous pattern,
        // but since we are refactoring, let's make it robust.
        // Decision: Immediate toggle API call to keep state in sync with backend, showing a small saving indicator if needed
        // OR better: local state and a "Save" button.

        // Let's go with: Local state + Save button. It's safer and fewer requests.
    };

    const handleSave = async () => {
        if (!user || !tenantId || !currentUser) return;
        setSaving(true);
        try {
            // Update Role if changed
            if (role !== user.role) {
                const { error: roleError } = await supabase
                    .from("user_roles")
                    .update({ role: role })
                    .eq("user_id", user.user_id);

                if (roleError) throw roleError;
            }

            // First, delete all existing permissions for this user/tenant
            // Or smarter: calculate diff.
            // Deleting all is risky if concurrent edits, but simplest for this scope.
            // Better: Get current DB state, diff, apply changes.

            // For simplicity and robustness given Supabase limits:
            // 1. Fetch current (already have in `permissions` state? No, that's desired).
            // Actually, deleting all and re-inserting is a common pattern for junction tables if not huge.

            // Let's do: Delete All -> Insert All.
            const { error: deleteError } = await supabase
                .from("user_permissions")
                .delete()
                .eq("user_id", user.user_id)
                .eq("tenant_id", tenantId);

            if (deleteError) throw deleteError;

            if (permissions.length > 0) {
                const { error: insertError } = await supabase
                    .from("user_permissions")
                    .insert(
                        permissions.map(p => ({
                            user_id: user.user_id,
                            tenant_id: tenantId,
                            permission: p,
                            created_by: currentUser.id
                        }))
                    );
                if (insertError) throw insertError;
            }

            toast({ title: "Permissões atualizadas com sucesso" });
            onOpenChange(false);
            if (onSave) onSave();
        } catch (error: any) {
            console.error("Error saving permissions:", error);
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Gerenciar Permissões</DialogTitle>
                    <DialogDescription>
                        {user?.full_name} ({user?.email}) - {user?.role === 'admin' ? 'Administrador' : user?.role === 'buyer' ? 'Comprador' : 'Fornecedor'}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-8 flex justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : user?.role === 'admin' ? (
                    <div className="py-4 text-center text-muted-foreground">
                        Administradores possuem acesso total ao sistema.
                    </div>
                ) : (
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label>Função do Usuário</Label>
                            <Select value={role} onValueChange={setRole} disabled={loading || saving}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="buyer">Comprador</SelectItem>
                                    <SelectItem value="supplier">Fornecedor</SelectItem>
                                    {/* Admin shouldn't ideally downgrade themselves easily here or maybe yes? Let's leave admin out for now if they are editing others */}
                                    <SelectItem value="admin">Administrador</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                A função define o nível base de acesso. Permissões adicionais podem ser configuradas abaixo.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Permissões Adicionais</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {AVAILABLE_PERMISSIONS.map((perm) => (
                                    <div key={perm.id} className="flex items-start space-x-3 space-y-0">
                                        <Checkbox
                                            id={perm.id}
                                            checked={permissions.includes(perm.id)}
                                            onCheckedChange={(checked) => handleToggle(perm.id, checked as boolean)}
                                        />
                                        <div className="space-y-1 leading-none">
                                            <Label htmlFor={perm.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                                {perm.label}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                {perm.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={saving || loading || user?.role === 'admin'}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Alterações
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
