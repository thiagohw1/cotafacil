import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { Loader2, Building, User, Bell, FileText, Shield, Database } from "lucide-react";

interface QuoteSettings {
  default_deadline_days: number;
  auto_select_lowest_price: boolean;
  require_min_suppliers: number;
  default_quote_message: string;
}

interface NotificationSettings {
  email_on_quote_response: boolean;
  email_on_quote_close: boolean;
  email_digest: boolean;
}

export default function Settings() {
  const { user, profile } = useAuth();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profileData, setProfileData] = useState({
    full_name: "",
    email: "",
  });

  const [tenantData, setTenantData] = useState({
    name: "",
    cnpj: "",
    address: "",
    phone: "",
  });

  // Quote settings (stored in localStorage for now, can be migrated to DB later)
  const [quoteSettings, setQuoteSettings] = useState<QuoteSettings>({
    default_deadline_days: 7,
    auto_select_lowest_price: true,
    require_min_suppliers: 3,
    default_quote_message:
      "Prezado fornecedor,\n\nConvidamos você a participar de nossa cotação. Por favor, informe seus melhores preços e condições.\n\nAtenciosamente.",
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

    if (profile?.tenant_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", profile.tenant_id)
        .single();

      if (tenant) {
        setTenantData({
          name: tenant.name,
          cnpj: "",
          address: "",
          phone: "",
        });
      }
    }

    // Load settings from localStorage
    const savedQuoteSettings = localStorage.getItem(`quote_settings_${tenantId}`);
    if (savedQuoteSettings) {
      setQuoteSettings(JSON.parse(savedQuoteSettings));
    }

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

  const handleSaveTenant = async () => {
    if (!profile?.tenant_id) return;
    setSaving(true);

    const { error } = await supabase
      .from("tenants")
      .update({ name: tenantData.name })
      .eq("id", profile.tenant_id);

    if (error) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Empresa atualizada" });
    }
    setSaving(false);
  };

  const handleSaveQuoteSettings = () => {
    localStorage.setItem(`quote_settings_${tenantId}`, JSON.stringify(quoteSettings));
    toast({ title: "Configurações de cotação salvas" });
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
      <Header title="Configurações" description="Gerencie seu perfil, empresa e preferências do sistema" />

      <div className="p-6 animate-fade-in">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Empresa
            </TabsTrigger>
            <TabsTrigger value="quotes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Cotações
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notificações
            </TabsTrigger>
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile" className="space-y-6 max-w-2xl">
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

            {/* Security Section */}
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

          {/* Company Settings */}
          <TabsContent value="company" className="space-y-6 max-w-2xl">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Dados da Empresa</CardTitle>
                    <CardDescription>Informações do seu negócio</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Nome da Empresa</Label>
                    <Input
                      id="company_name"
                      value={tenantData.name}
                      onChange={(e) =>
                        setTenantData({ ...tenantData, name: e.target.value })
                      }
                      placeholder="Nome da empresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={tenantData.cnpj}
                      onChange={(e) =>
                        setTenantData({ ...tenantData, cnpj: e.target.value })
                      }
                      placeholder="00.000.000/0000-00"
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Em breve</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={tenantData.address}
                    onChange={(e) =>
                      setTenantData({ ...tenantData, address: e.target.value })
                    }
                    placeholder="Endereço completo"
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Em breve</p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveTenant} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar Empresa
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Data Usage */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-info/10">
                    <Database className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <CardTitle>Uso de Dados</CardTitle>
                    <CardDescription>Estatísticas de armazenamento</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">-</p>
                    <p className="text-sm text-muted-foreground">Cotações</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">-</p>
                    <p className="text-sm text-muted-foreground">Produtos</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">-</p>
                    <p className="text-sm text-muted-foreground">Fornecedores</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quote Settings */}
          <TabsContent value="quotes" className="space-y-6 max-w-2xl">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Preferências de Cotação</CardTitle>
                    <CardDescription>Configure valores padrão para novas cotações</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="default_deadline">Prazo Padrão (dias)</Label>
                    <Input
                      id="default_deadline"
                      type="number"
                      min={1}
                      max={30}
                      value={quoteSettings.default_deadline_days}
                      onChange={(e) =>
                        setQuoteSettings({
                          ...quoteSettings,
                          default_deadline_days: parseInt(e.target.value) || 7,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Dias para resposta do fornecedor
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min_suppliers">Mínimo de Fornecedores</Label>
                    <Input
                      id="min_suppliers"
                      type="number"
                      min={1}
                      max={10}
                      value={quoteSettings.require_min_suppliers}
                      onChange={(e) =>
                        setQuoteSettings({
                          ...quoteSettings,
                          require_min_suppliers: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Aviso ao abrir cotação com menos fornecedores
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">Auto-selecionar Menor Preço</p>
                    <p className="text-sm text-muted-foreground">
                      Pré-selecionar vencedor com menor preço ao encerrar
                    </p>
                  </div>
                  <Switch
                    checked={quoteSettings.auto_select_lowest_price}
                    onCheckedChange={(checked) =>
                      setQuoteSettings({ ...quoteSettings, auto_select_lowest_price: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_message">Mensagem Padrão para Fornecedores</Label>
                  <Textarea
                    id="default_message"
                    rows={5}
                    value={quoteSettings.default_quote_message}
                    onChange={(e) =>
                      setQuoteSettings({ ...quoteSettings, default_quote_message: e.target.value })
                    }
                    placeholder="Mensagem que aparecerá na tela do fornecedor"
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveQuoteSettings}>
                    Salvar Configurações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
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
        </Tabs>
      </div>
    </div>
  );
}
