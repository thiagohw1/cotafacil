import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building, User } from "lucide-react";

export default function Settings() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profileData, setProfileData] = useState({
    full_name: "",
    email: "",
  });

  const [tenantData, setTenantData] = useState({
    name: "",
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
        setTenantData({ name: tenant.name });
      }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Configurações" description="Gerencie seu perfil e empresa" />

      <div className="p-6 space-y-6 max-w-3xl animate-fade-in">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Perfil</CardTitle>
                <CardDescription>Suas informações pessoais</CardDescription>
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

        {/* Company Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Empresa</CardTitle>
                <CardDescription>Informações da sua empresa</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="flex justify-end">
              <Button onClick={handleSaveTenant} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Empresa
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
