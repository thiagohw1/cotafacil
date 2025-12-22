import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    FlaskConical,
    ShoppingCart,
    Users,
    Database,
    ArrowRight,
    Play,
    Mail
} from "lucide-react";
import { mailService } from "@/services/mailService";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function TestsAndSimulations() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();

    const handleTestEmail = async () => {
        if (!user?.email) {
            toast({ title: "Erro", description: "Você precisa estar logado e ter um e-mail.", variant: "destructive" });
            return;
        }

        toast({ title: "Enviando e-mail de teste..." });

        const result = await mailService.sendEmail({
            to: [user.email],
            subject: "Teste de Notificação Cotafácil",
            html: "<h1>Funciona!</h1><p>Esta é uma mensagem de teste enviada pela Edge Function.</p>"
        });

        if (result.success) {
            toast({ title: "Sucesso!", description: "E-mail enviado! Verifique sua caixa de entrada (ou logs)." });
        } else {
            toast({ title: "Erro ao enviar", description: "Verifique o console para detalhes.", variant: "destructive" });
        }
    };

    const tools = [
        {
            title: "Simulador de Purchase Orders",
            description: "Cria um cenário completo de teste (produtos, fornecedores, cotação) e gera POs automaticamente.",
            icon: ShoppingCart,
            path: "/simulate-po",
            color: "text-blue-500",
        },
        {
            title: "Teste de Fornecedores",
            description: "Ferramenta para testar a busca e gestão de fornecedores isoladamente.",
            icon: Users,
            path: "/test-suppliers",
            color: "text-green-500",
        },
        {
            title: "Teste de Migrações",
            description: "Verifica o estado atual das migrações e testa a aplicação de scripts SQL.",
            icon: Database,
            path: "/test-migrations",
            color: "text-orange-500",
        },
        {
            title: "Aplicar Migrações",
            description: "Interface para aplicação direta de migrações pendentes no banco de dados.",
            icon: Play,
            path: "/apply-migrations",
            color: "text-red-500",
        },
    ];

    return (
        <div className="container mx-auto p-8 max-w-7xl animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <FlaskConical className="h-8 w-8 text-primary" />
                    Central de Testes e Simulações
                </h1>
                <p className="text-muted-foreground mt-2 text-lg">
                    Ferramentas de desenvolvimento para validação de fluxos e funcionalidades do sistema.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Email Test Card */}
                <Card className="hover:shadow-lg transition-shadow border-indigo-200 bg-indigo-50/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                            <Mail className="h-6 w-6 text-indigo-500" />
                            Teste de Notificação
                        </CardTitle>
                        <CardDescription className="text-base min-h-[50px]">
                            Dispara um e-mail de teste para o seu usuário logado via Edge Function.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleTestEmail} className="w-full bg-indigo-600 hover:bg-indigo-700">
                            <Mail className="mr-2 h-4 w-4" />
                            Enviar E-mail de Teste
                        </Button>
                    </CardContent>
                </Card>

                {tools.map((tool) => (
                    <Card key={tool.path} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(tool.path)}>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                            <CardTitle className="text-xl font-semibold">
                                {tool.title}
                            </CardTitle>
                            <tool.icon className={`h-6 w-6 ${tool.color}`} />
                        </CardHeader>
                        <CardContent>
                            <CardDescription className="text-base mb-4 min-h-[50px]">
                                {tool.description}
                            </CardDescription>
                            <Button variant="outline" className="w-full group">
                                Acessar Ferramenta
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
