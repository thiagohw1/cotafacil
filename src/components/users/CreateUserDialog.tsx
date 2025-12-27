
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CreateUserDialogProps {
    onUserCreated: () => void;
}

export function CreateUserDialog({ onUserCreated }: CreateUserDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
        role: "buyer",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRoleChange = (val: string) => {
        setFormData((prev) => ({ ...prev, role: val }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke("create-user", {
                body: formData,
            });

            if (error) throw error;

            toast({
                title: "Usuário criado com sucesso",
                description: `O usuário ${formData.email} foi criado.`,
            });

            setOpen(false);
            setFormData({ fullName: "", email: "", password: "", role: "buyer" });
            onUserCreated();
        } catch (err: any) {
            console.error("Error creating user:", err);

            let description = err.message || "Ocorreu um erro inesperado";

            if (err.context && typeof err.context.json === 'function') {
                try {
                    const errorContext = await err.context.json();
                    console.log("Edge Function Response:", errorContext);
                    if (errorContext && errorContext.error) {
                        description = errorContext.error;
                    }
                } catch (e) {
                    console.error("Failed to parse error context", e);
                }
            }

            console.log("FINAL ERROR DESCRIPTION:", description);

            toast({
                title: "Erro ao criar usuário",
                description: description,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Usuário
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Criar Novo Usuário</DialogTitle>
                    <DialogDescription>
                        Adicione um novo usuário ao seu time. Ele receberá um email de confirmação.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Nome Completo</Label>
                        <Input
                            id="fullName"
                            name="fullName"
                            placeholder="Ex: João Silva"
                            value={formData.fullName}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="joao@exemplo.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Senha Provisória</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="********"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            minLength={6}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="role">Função</Label>
                        <Select value={formData.role} onValueChange={handleRoleChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione uma função" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="buyer">Comprador</SelectItem>
                                <SelectItem value="supplier">Fornecedor</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Criar Usuário
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
