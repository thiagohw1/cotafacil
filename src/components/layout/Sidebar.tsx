import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Users,
  ListOrdered,
  FileText,
  Settings,
  LogOut,
  TrendingUp,
  BarChart3,
  Shield,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Cotações", href: "/quotes", icon: FileText },
  { name: "Produtos", href: "/products", icon: Package },
  { name: "Categorias", href: "/categories", icon: FolderTree },
  { name: "Fornecedores", href: "/suppliers", icon: Users },
  { name: "Listas", href: "/lists", icon: ListOrdered },
  { name: "Histórico de Preços", href: "/price-history", icon: TrendingUp },
  { name: "Relatórios", href: "/reports", icon: BarChart3 },
  { name: "Pedidos de Compra", href: "/purchase-orders", icon: ShoppingCart },
  { name: "Permissões", href: "/permissions", icon: Shield },
];


export function Sidebar() {
  const location = useLocation();
  const { toast } = useToast();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <FileText className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">
            CotaFácil
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn("nav-link", isActive && "active")}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <Link to="/settings" className="nav-link">
          <Settings className="w-5 h-5" />
          Configurações
        </Link>
        <button onClick={handleLogout} className="nav-link w-full">
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </aside>
  );
}
