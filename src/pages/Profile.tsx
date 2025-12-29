import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Bell, Shield } from "lucide-react";

interface NotificationSettings {
    email_on_quote_response: boolean;
    email_on_quote_close: boolean;
    email_digest: boolean;
}

export default function Profile() {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const [profileData, setProfileData] = useState({
        full_name: "",
        email: "",
    });

    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
        email_on_quote_response: true,
        email_on_quote_close: true,
        email_digest: false,
    });

    useEffect(() => {
        if (profile) {
            fetchData();
        }
    }, [profile]);

    const fetchData = async () => {
        setLoading(true);

        setProfileData({
            full_name: profile?.full_name || "",
            email: profile?.email || "",
        });

        const savedNotificationSettings = localStorage.getItem(`notification_settings_${user?.id}`);
        if (savedNotificationSettings) {
            setNotificationSettings(JSON.parse(savedNotificationSettings));
        }

        setLoading(false);
    };

    const handleSaveProfile = async () => {
        if (!user) return;
        setSaving(true);

        const { error } = await supabase
            .from("profiles")
            .update({ full_name: profileData.full_name })
            .eq("user_id", user.id);

        if (error) {
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive",
            });
        } else {
            toast({ title: "Perfil atualizado" });
        }
        setSaving(false);
    };

    const handleSaveNotificationSettings = () => {
        localStorage.setItem(`notification_settings_${user?.id}`, JSON.stringify(notificationSettings));
        toast({ title: "Preferências de notificação salvas" });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <Header title="Meu Perfil" description="Gerencie suas informações pessoais e preferências" />

            <div className="p-6 animate-fade-in">
                <Tabs defaultValue="personal" className="space-y-6">
                    <TabsList className="grid grid-cols-3 w-full max-w-2xl">
                        <TabsTrigger value="personal" className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Dados Pessoais
                        </TabsTrigger>
                        <TabsTrigger value="notifications" className="flex items-center gap-2">
                            <Bell className="h-4 w-4" />
                            Notificações
                        </TabsTrigger>
                        <TabsTrigger value="security" className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Segurança
                        </TabsTrigger>
                    </TabsList>

                    {/* Personal Info */}
                    <TabsContent value="personal" className="space-y-6 max-w-2xl">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <User className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle>Informações Pessoais</CardTitle>
                                        <CardDescription>Seus dados de perfil</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="full_name">Nome Completo</Label>
                                        <Input
                                            id="full_name"
                                            value={profileData.full_name}
                                            onChange={(e) =>
                                                setProfileData({ ...profileData, full_name: e.target.value })
                                            }
                                            placeholder="Seu nome"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">E-mail</Label>
                                        <Input
                                            id="email"
                                            value={profileData.email}
                                            disabled
                                            className="bg-muted"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={handleSaveProfile} disabled={saving}>
                                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Salvar Perfil
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Notifications */}
                    <TabsContent value="notifications" className="space-y-6 max-w-2xl">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <Bell className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle>Preferências de Notificação</CardTitle>
                                        <CardDescription>Configure como você deseja ser notificado</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                                    <div>
                                        <p className="font-medium">E-mail ao receber resposta</p>
                                        <p className="text-sm text-muted-foreground">
                                            Notificar quando um fornecedor enviar proposta
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notificationSettings.email_on_quote_response}
                                        onCheckedChange={(checked) =>
                                            setNotificationSettings({
                                                ...notificationSettings,
                                                email_on_quote_response: checked,
                                            })
                                        }
                                        disabled
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                                    <div>
                                        <p className="font-medium">E-mail ao encerrar cotação</p>
                                        <p className="text-sm text-muted-foreground">
                                            Receber resumo quando a cotação for encerrada
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notificationSettings.email_on_quote_close}
                                        onCheckedChange={(checked) =>
                                            setNotificationSettings({
                                                ...notificationSettings,
                                                email_on_quote_close: checked,
                                            })
                                        }
                                        disabled
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                                    <div>
                                        <p className="font-medium">Resumo diário por e-mail</p>
                                        <p className="text-sm text-muted-foreground">
                                            Receber um resumo diário das atividades
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notificationSettings.email_digest}
                                        onCheckedChange={(checked) =>
                                            setNotificationSettings({
                                                ...notificationSettings,
                                                email_digest: checked,
                                            })
                                        }
                                        disabled
                                    />
                                </div>

                                <p className="text-sm text-muted-foreground text-center py-4">
                                    ⚠️ Notificações por e-mail estarão disponíveis em breve
                                </p>

                                <div className="flex justify-end">
                                    <Button onClick={handleSaveNotificationSettings} disabled>
                                        Salvar Preferências
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Security */}
                    <TabsContent value="security" className="space-y-6 max-w-2xl">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-warning/10">
                                        <Shield className="h-5 w-5 text-warning" />
                                    </div>
                                    <div>
                                        <CardTitle>Segurança</CardTitle>
                                        <CardDescription>Gerenciamento de senha e acesso</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Para alterar sua senha, utilize o recurso de redefinição de senha na tela de login.
                                </p>
                                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                                    <div>
                                        <p className="font-medium">Autenticação</p>
                                        <p className="text-sm text-muted-foreground">Último acesso: Hoje</p>
                                    </div>
                                    <Button variant="outline" size="sm" disabled>
                                        Alterar Senha
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
