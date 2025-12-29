import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { ModalForm } from "@/components/ui/modal-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export interface Category {
    id: number;
    name: string;
    parent_id: number | null;
    active: boolean;
    parent?: { name: string } | null;
}

interface CategoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categoryToEdit?: Category | null;
    parentOptions?: Category[];
    defaultParentId?: number | null;
    onSuccess: () => void;
}

export function CategoryModal({
    open,
    onOpenChange,
    categoryToEdit,
    parentOptions = [],
    defaultParentId = null,
    onSuccess,
}: CategoryModalProps) {
    const { tenantId } = useTenant();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        parent_id: "",
        active: true,
    });

    useEffect(() => {
        if (open) {
            if (categoryToEdit) {
                setFormData({
                    name: categoryToEdit.name,
                    parent_id: categoryToEdit.parent_id?.toString() || "",
                    active: categoryToEdit.active,
                });
            } else {
                setFormData({
                    name: "",
                    parent_id: defaultParentId?.toString() || "",
                    active: true
                });
            }
        }
    }, [open, categoryToEdit, defaultParentId]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!tenantId) return;
        setSaving(true);

        const payload = {
            tenant_id: tenantId,
            name: formData.name.replace(/(?:^|\s)\S/g, (char) => char.toUpperCase()),
            parent_id: formData.parent_id ? parseInt(formData.parent_id) : null,
            active: formData.active,
        };

        let error;

        if (categoryToEdit) {
            const result = await supabase
                .from("categories")
                .update(payload)
                .eq("id", categoryToEdit.id);
            error = result.error;
        } else {
            const result = await supabase.from("categories").insert(payload);
            error = result.error;
        }

        if (error) {
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive",
            });
        } else {
            const parentName = parentOptions.find(p => p.id.toString() === formData.parent_id)?.name;
            const description = parentName
                ? `Sucesso ao criar a classificação "${formData.name}" no setor de "${parentName}".`
                : `Sucesso ao criar a classificação "${formData.name}".`;

            toast({
                title: categoryToEdit ? "Categoria Atualizada" : "Sucesso!",
                description: description,
                variant: "success",
                duration: 3000,
            });
            onOpenChange(false);
            onSuccess();
        }
        setSaving(false);
    };

    useKeyboardShortcuts({
        onSave: () => {
            if (open) {
                handleSubmit();
            }
        },
    });

    return (
        <ModalForm
            open={open}
            onOpenChange={onOpenChange}
            title={categoryToEdit ? "Editar Categoria" : "Nova Categoria"}
            onSubmit={handleSubmit}
            loading={saving}
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="category_name">Nome</Label>
                    <Input
                        id="category_name"
                        value={formData.name}
                        onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="Nome da categoria"
                        required
                        className="capitalize"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="category_parent">Categoria Pai (opcional)</Label>
                    <Select
                        value={formData.parent_id || "none"}
                        onValueChange={(value) =>
                            setFormData({ ...formData, parent_id: value === "none" ? "" : value })
                        }
                    >
                        <SelectTrigger id="category_parent">
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {parentOptions.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id.toString()}>
                                    {cat.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center justify-between">
                    <Label htmlFor="category_active">Categoria ativa</Label>
                    <Switch
                        id="category_active"
                        checked={formData.active}
                        onCheckedChange={(checked) =>
                            setFormData({ ...formData, active: checked })
                        }
                    />
                </div>
            </div>
        </ModalForm>
    );
}
