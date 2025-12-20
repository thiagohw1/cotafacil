import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  fullName: z.string().optional(),
});

export default function Auth() {
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = authSchema.parse(formData);

      if (isLogin) {
        const { error } = await signIn(validated.email, validated.password);
        if (error) {
          toast({
            title: "Erro ao entrar",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        const { error } = await signUp(
          validated.email,
          validated.password,
          validated.fullName
        );
        if (error) {
          toast({
            title: "Erro ao criar conta",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Conta criada!",
            description: "Você já pode fazer login.",
          });
          setIsLogin(true);
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Dados inválidos",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-2xl bg-sidebar-primary flex items-center justify-center mx-auto mb-8">
            <FileText className="w-10 h-10 text-sidebar-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-sidebar-foreground mb-4">
            CotaFácil
          </h1>
          <p className="text-lg text-sidebar-foreground/70">
            Sistema de cotação online inteligente. Gerencie suas compras de
            forma simples e eficiente.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">CotaFácil</h1>
          </div>

          <div className="bg-card rounded-xl border p-8">
            <h2 className="text-2xl font-semibold mb-2">
              {isLogin ? "Bem-vindo de volta" : "Criar conta"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {isLogin
                ? "Entre com suas credenciais para acessar"
                : "Preencha os dados para criar sua conta"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="Seu nome"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLogin ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline"
              >
                {isLogin
                  ? "Não tem conta? Criar agora"
                  : "Já tem conta? Fazer login"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
