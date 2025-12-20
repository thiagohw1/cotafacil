import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Categories from "./pages/Categories";
import Products from "./pages/Products";
import Suppliers from "./pages/Suppliers";
import SupplierHistory from "./pages/SupplierHistory";
import ProductLists from "./pages/ProductLists";
import Quotes from "./pages/Quotes";
import QuoteForm from "./pages/QuoteForm";
import SupplierQuote from "./pages/SupplierQuote";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/supplier/quote/:token" element={<SupplierQuote />} />

            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/products" element={<Products />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/suppliers/:id/history" element={<SupplierHistory />} />
              <Route path="/lists" element={<ProductLists />} />
              <Route path="/quotes" element={<Quotes />} />
              <Route path="/quotes/new" element={<QuoteForm />} />
              <Route path="/quotes/:id" element={<QuoteForm />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
