import { Link, useLocation, useNavigate } from "react-router-dom";
import React from "react";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Users,
  Bell,
  ListOrdered,
  FileText,
  Settings,
  LogOut,
  TrendingUp,
  BarChart3,
  Shield,
  ShoppingCart,
  FlaskConical,
  User,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications } from "@/contexts/NotificationContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

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


interface SidebarContentProps {
  onLinkClick?: () => void;
}

export function SidebarContent({ onLinkClick }: SidebarContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [open, setOpen] = React.useState(false);
  const { setTheme } = useTheme();

  const handleNotificationClick = async (id: number, link?: string) => {
    await markAsRead(id);
    setOpen(false);
    if (link) {
      navigate(link);
    }
  };

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
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3" onClick={onLinkClick}>
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
        {navigation
          .filter(item => item.name !== "Permissões" || profile?.role === "admin")
          .map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={onLinkClick}
                className={cn("nav-link", isActive && "active")}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border mt-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex-1 justify-start h-auto py-3 px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <div className="flex items-center gap-3 text-left">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {profile?.full_name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="text-sm font-medium truncate">
                    {profile?.full_name || "Usuário"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </span>
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mb-2" side="right">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Meu Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              navigate("/settings");
              if (onLinkClick) onLinkClick();
            }}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span>Tema</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="mr-2 h-4 w-4" />
                  <span>Claro</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="mr-2 h-4 w-4" />
                  <span>Escuro</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Laptop className="mr-2 h-4 w-4" />
                  <span>Sistema</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative shrink-0">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent side="right" align="end" className="w-80 p-0 mr-2 mb-2">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h4 className="font-semibold text-sm">Notificações</h4>
              {unreadCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {unreadCount} não lidas
                </span>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma notificação nova
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.slice(0, 5).map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification.id, notification.link)}
                      className={cn(
                        "flex flex-col items-start gap-1 p-3 text-left hover:bg-muted/50 transition-colors border-b last:border-0",
                        !notification.is_read && "bg-muted/20"
                      )}
                    >
                      <div className="flex items-start justify-between w-full gap-2">
                        <span className={cn("text-sm font-medium leading-none", !notification.is_read && "text-primary")}>
                          {notification.title}
                        </span>
                        {!notification.is_read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0 mt-1" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(notification.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-2 border-t bg-muted/20 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs h-auto py-1.5"
                onClick={() => {
                  setOpen(false);
                  navigate("/notifications");
                }}
              >
                Ver todas as notificações
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <div className="hidden md:flex w-64 flex-col fixed inset-y-0">
      <SidebarContent />
    </div>
  );
}
