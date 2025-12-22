import { Outlet, Navigate } from "react-router-dom";
import { Sidebar, SidebarContent } from "./Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export function AppLayout() {
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {/* Mobile Header */}
      <div className="md:hidden flex items-center h-16 px-4 border-b bg-background border-border sticky top-0 z-50">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 border-r border-sidebar-border" aria-describedby={undefined}>
            <SheetTitle className="sr-only">Menu de Navegação</SheetTitle>
            <SheetDescription className="sr-only">Menu principal do sistema</SheetDescription>
            <SidebarContent onLinkClick={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="ml-2 text-lg font-semibold">CotaFácil</span>
      </div>

      <main className="md:pl-64">
        <Outlet />
      </main>
    </div>
  );
}
