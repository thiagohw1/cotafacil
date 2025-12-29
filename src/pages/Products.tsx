import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { ModalForm } from "@/components/ui/modal-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Package2, Settings2, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { CategoryModal } from "@/components/modals/CategoryModal";

interface Product {
  id: number;
  name: string;
  unit: string | null;
  brand: string | null;
  notes: string | null;
  active: boolean;
  category?: { name: string } | null;
  category_id?: number | null;
  product_packages?: { unit: string; multiplier: number; is_default: boolean }[];
}

interface ProductPackage {
  id: number;
  unit: string;
  multiplier: number;
  barcode: string | null;
  is_default: boolean;
}

interface Category {
  id: number;
  name: string;
  // ...
}

interface PackagingUnit {
  id: number;
  code: string;
  name: string;
}

export default function Products() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packagingUnits, setPackagingUnits] = useState<PackagingUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [statusFilter, setStatusFilter] = useState("available");
  const [sortColumn, setSortColumn] = useState("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const pageSize = 50;

  const [modalOpen, setModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [packagingModalOpen, setPackagingModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [packages, setPackages] = useState<ProductPackage[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    unit: "un",
    category_id: "",
    brand: "",
    notes: "",
    active: true,
    default_unit: "",
    default_multiplier: "1",
  });
  const [newPackage, setNewPackage] = useState({
    unit: "",
    multiplier: "1",
    barcode: "",
    is_default: false,
  });
  const [newPackagingUnit, setNewPackagingUnit] = useState({ code: "", name: "" });
  const [deletePackagingOpen, setDeletePackagingOpen] = useState(false);
  const [selectedPackagingUnit, setSelectedPackagingUnit] = useState<PackagingUnit | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const unitInputRef = useRef<HTMLButtonElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [modalOpen]);

  // Initial fetch and reset on filter changes
  useEffect(() => {
    if (tenantId) {
      setPage(1);
      setProducts([]); // Clear list on filter change
      setHasMore(true);
      fetchProducts(1, true); // Reset
      fetchCategories();
      fetchPackagingUnits();
    }
  }, [tenantId, search, statusFilter, sortColumn, sortDirection]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.5 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loading, loadingMore]);

  // Fetch more when page changes (except initial which is handled above)
  useEffect(() => {
    if (page > 1) {
      fetchProducts(page, false);
    }
  }, [page]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const fetchProducts = async (currentPage: number, isReset: boolean) => {
    if (!tenantId) return;

    if (isReset) setLoading(true);
    else setLoadingMore(true);

    let query = supabase
      .from("products")
      .select("*, category:categories(name), product_packages(unit, multiplier, is_default)", { count: "exact" })
      .eq("tenant_id", tenantId);

    if (statusFilter === 'deleted') {
      query = query.not('deleted_at', 'is', null);
    } else {
      query = query.is('deleted_at', null);

      if (statusFilter === 'active') {
        query = query.eq('active', true);
      } else if (statusFilter === 'inactive') {
        query = query.eq('active', false);
      }
    }

    if (sortColumn === 'category') {
      query = query.order('name', { foreignTable: 'categories', ascending: sortDirection === 'asc' });
    } else {
      query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
    }

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const from = (currentPage - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      toast({
        title: "Erro ao carregar produtos",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const newProducts = (data as any) || [];
      if (isReset) {
        setProducts(newProducts);
      } else {
        setProducts(prev => [...prev, ...newProducts]);
      }

      setTotalCount(count || 0);
      setHasMore(newProducts.length === pageSize);
    }

    if (isReset) setLoading(false);
    else setLoadingMore(false);
  };

  const fetchCategories = async () => {
    if (!tenantId) return;

    const { data } = await supabase
      .from("categories")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .is("deleted_at", null)
      .order("name");

    setCategories(data || []);
  };

  const fetchPackagingUnits = async () => {
    if (!tenantId) return;

    const query = supabase
      .from("packaging_units")
      .select("id, code, name")
      .eq("tenant_id", tenantId);

    // @ts-ignore
    const { data } = await query.order("code");

    setPackagingUnits((data as any) || []);
  };

  const handleAddPackagingUnit = async () => {
    if (!tenantId || !newPackagingUnit.code || !newPackagingUnit.name) return;
    setSaving(true);

    const { error } = await supabase.from("packaging_units").insert({
      tenant_id: tenantId,
      code: newPackagingUnit.code.toUpperCase(),
      name: newPackagingUnit.name,
    } as any);

    if (error) {
      toast({
        title: "Erro ao adicionar unidade",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Unidade de embalagem adicionada", variant: "success" });
      setNewPackagingUnit({ code: "", name: "" });
      fetchPackagingUnits();
    }
    setSaving(false);
  };

  const handleDeletePackagingUnit = async () => {
    if (!selectedPackagingUnit) return;
    setSaving(true);

    const { error } = await supabase
      .from("packaging_units")
      .delete()
      .eq("id", selectedPackagingUnit.id);

    if (error) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Unidade de embalagem excluída" });
      setDeletePackagingOpen(false);
      fetchPackagingUnits();
    }
    setSaving(false);
  };

  const fetchPackages = async (productId: number) => {
    const { data } = await supabase
      .from("product_packages")
      .select("*")
      .eq("product_id", productId)
      .order("unit");

    setPackages((data as any) || []);
  };

  const handleCreate = () => {
    setSelectedProduct(null);
    setPackages([]);
    setFormData({
      name: "",
      unit: "un",
      category_id: "",
      brand: "",
      notes: "",
      active: true,
      default_unit: "",
      default_multiplier: "1",
    });
    setModalOpen(true);
  };

  // Keyboard Shortcuts moved here to avoid hoisting issues
  const triggerSubmit = () => {
    // If the category modal is open, do not trigger product save
    if (categoryModalOpen) return;

    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (submitBtn && modalOpen) {
      submitBtn.click();
    }
  };

  useKeyboardShortcuts({
    onNew: handleCreate,
    onSave: triggerSubmit,
  });

  const handleEdit = async (product: Product) => {
    setSelectedProduct(product);
    const defaultPkg = product.product_packages?.find(p => p.is_default);
    setFormData({
      name: product.name,
      unit: product.unit || "un",
      category_id: product.category_id?.toString() || "",
      brand: product.brand || "",
      notes: product.notes || "",
      active: product.active,
      default_unit: defaultPkg?.unit || "",
      default_multiplier: defaultPkg?.multiplier?.toString() || "1",
    });
    await fetchPackages(product.id);
    setModalOpen(true);
  };

  const handleDelete = (product: Product) => {
    setSelectedProduct(product);
    setDeleteOpen(true);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      unitInputRef.current?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);

    const payload = {
      tenant_id: tenantId,
      name: formData.name.replace(/(?:^|\s)\S/g, (char) => char.toUpperCase()),
      unit: formData.unit,
      category_id: formData.category_id ? parseInt(formData.category_id) : null,
      brand: formData.brand || null,
      notes: formData.notes || null,
      active: formData.active,
    };

    // Check for duplicate name
    let checkQuery = supabase
      .from("products")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", payload.name);

    if (selectedProduct) {
      checkQuery = checkQuery.neq("id", selectedProduct.id);
    }

    const { data: existingProducts } = await checkQuery;

    if (existingProducts && existingProducts.length > 0) {
      toast({
        title: "Erro ao salvar",
        description: "Já existe um produto com este nome.",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    let error;
    let productId = selectedProduct?.id;

    if (selectedProduct) {
      const result = await supabase
        .from("products")
        .update(payload)
        .eq("id", selectedProduct.id);
      error = result.error;
    } else {
      const result = await supabase
        .from("products")
        .insert(payload)
        .select()
        .single();
      error = result.error;
      if (result.data) {
        productId = result.data.id;
      }
    }

    if (error) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Criar embalagem padrão se foi informada e é um novo produto
      if (!selectedProduct && productId && formData.default_unit) {
        await supabase.from("product_packages").insert({
          product_id: productId,
          unit: formData.default_unit.toUpperCase(),
          multiplier: parseFloat(formData.default_multiplier) || 1,
          is_default: true,
        });
      }
      toast({
        title: selectedProduct ? "Produto atualizado" : "Produto criado",
        variant: "success",
      });
      setModalOpen(false);
      fetchProducts(1, true);
    }
    setSaving(false);
  };

  const handleAddPackage = async () => {
    if (!selectedProduct || !newPackage.unit) return;

    // Se marcando como padrão, remove o padrão das outras
    if (newPackage.is_default) {
      await supabase
        .from("product_packages")
        .update({ is_default: false })
        .eq("product_id", selectedProduct.id);
    }

    const { error } = await supabase.from("product_packages").insert({
      product_id: selectedProduct.id,
      unit: newPackage.unit,
      multiplier: parseFloat(newPackage.multiplier) || 1,
      barcode: newPackage.barcode || null,
      is_default: newPackage.is_default,
    });

    if (error) {
      toast({
        title: "Erro ao adicionar embalagem",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Embalagem adicionada", variant: "success" });
      setNewPackage({ unit: "", multiplier: "1", barcode: "", is_default: false });
      fetchPackages(selectedProduct.id);
      fetchProducts(1, true);
    }
  };

  const handleSetDefaultPackage = async (pkgId: number) => {
    if (!selectedProduct) return;

    // Remove o padrão de todas as embalagens do produto
    await supabase
      .from("product_packages")
      .update({ is_default: false })
      .eq("product_id", selectedProduct.id);

    // Define a embalagem selecionada como padrão
    const { error } = await supabase
      .from("product_packages")
      .update({ is_default: true })
      .eq("id", pkgId);

    if (error) {
      toast({
        title: "Erro ao definir embalagem principal",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Embalagem principal atualizada", variant: "success" });
      fetchPackages(selectedProduct.id);
      fetchProducts(1, true);
    }
  };

  const handleDeletePackage = async (pkgId: number) => {
    const { error } = await supabase
      .from("product_packages")
      .delete()
      .eq("id", pkgId);

    if (error) {
      toast({
        title: "Erro ao remover embalagem",
        description: error.message,
        variant: "destructive",
      });
    } else if (selectedProduct) {
      fetchPackages(selectedProduct.id);
    }
  };

  const handleExport = async (type: "pdf" | "excel" | "json") => {
    if (!tenantId) return;
    setLoading(true); // Re-use loading state or add specific exportLoading state

    try {
      let query = supabase
        .from("products")
        .select("*, category:categories(name), product_packages(unit, multiplier, is_default)", {
          count: "exact",
        })
        .eq("tenant_id", tenantId);

      // Apply same filters as main list
      if (statusFilter === "deleted") {
        query = query.not("deleted_at", "is", null);
      } else {
        query = query.is("deleted_at", null);
        if (statusFilter === "active") {
          query = query.eq("active", true);
        } else if (statusFilter === "inactive") {
          query = query.eq("active", false);
        }
      }

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      // Order by name for export by default
      query = query.order("name");

      const { data, error } = await query;

      if (error) throw error;

      const exportData = (data as any[]).map((product) => {
        // Format packages
        const packages = product.product_packages
          ?.map((p: any) => `${p.unit}-${p.multiplier}`)
          .join(", ");

        return {
          id: product.id,
          name: product.name,
          brand: product.brand || "",
          unit: product.unit || "",
          category: product.category?.name || "",
          packages: packages || "",
          active: product.active ? "Ativo" : "Inativo",
        };
      });

      if (type === "pdf") {
        const doc = new jsPDF();
        doc.text("Relatório de Produtos", 14, 15);

        autoTable(doc, {
          head: [["ID", "Nome", "Marca", "Und", "Categoria", "Embalagens", "Status"]],
          body: exportData.map((item) => [
            item.id,
            item.name,
            item.brand,
            item.unit,
            item.category,
            item.packages,
            item.active,
          ]),
          startY: 20,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [66, 66, 66] },
        });

        doc.save("produtos.pdf");
      } else if (type === "excel") {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Produtos");
        const excelBuffer = XLSX.write(workbook, {
          bookType: "xlsx",
          type: "array",
        });
        const dataBlob = new Blob([excelBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
        });
        saveAs(dataBlob, "produtos.xlsx");
      } else if (type === "json") {
        const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        });
        saveAs(jsonBlob, "produtos.json");
      }

      toast({
        title: "Download iniciado",
        variant: "default", // or success if available
      });
    } catch (error: any) {
      toast({
        title: "Erro na exportação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedProduct) return;
    setSaving(true);

    const { error } = await supabase
      .from("products")
      .update({
        deleted_at: new Date().toISOString(),
        active: false,
        name: `${selectedProduct.name}_deleted_${Date.now()}`
      })
      .eq("id", selectedProduct.id);

    if (error) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Produto excluído" });
      setDeleteOpen(false);
      fetchProducts(1, true);
    }
    setSaving(false);
  };

  const getDefaultPackageDisplay = (product: Product) => {
    const defaultPkg = product.product_packages?.find(p => p.is_default);
    if (!defaultPkg) return "-";
    return `${defaultPkg.unit}-${defaultPkg.multiplier}`;
  };

  const columns: Column<Product>[] = [
    {
      key: "id",
      header: "ID",
      sortable: true,
      className: "py-0",
    },
    {
      key: "name",
      header: "Nome",
      sortable: true,
      className: "py-1",
      render: (item) => (
        <span>
          {item.name}{item.unit && <span className="text-muted-foreground text-xs ml-1">{item.unit}</span>}
        </span>
      )
    },
    {
      key: "package",
      header: "Embalagem",
      className: "py-1",
      render: (item) => (
        <span className="font-mono text-sm">{getDefaultPackageDisplay(item)}</span>
      ),
    },
    {
      key: "category",
      header: "Categoria",
      className: "py-1",
      render: (item) => item.category?.name || "-",
    },
    { key: "brand", header: "Marca", sortable: true, className: "py-1", render: (item) => item.brand || "-" },
    {
      key: "active",
      header: "Status",
      sortable: true,
      className: "py-1",
      render: (item) => (
        <StatusBadge status={item.active ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      header: "Ações",
      className: "w-24 py-1",
      render: (item) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <Header
        title="Produtos"
        description="Gerencie seus produtos e embalagens"
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")}>
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")}>
                  JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" onClick={() => setPackagingModalOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Embalagens
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar produtos..."
            className="w-80"
          />
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Todos (Ativos/Inativos)</SelectItem>
              <SelectItem value="active">Somente Ativos</SelectItem>
              <SelectItem value="inactive">Somente Inativos</SelectItem>
              <SelectItem value="deleted">Excluídos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={products}
          loading={loading}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          emptyMessage="Nenhum produto encontrado"
          onSort={handleSort}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          hidePagination={true}
        />

        {loadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        <div ref={observerTarget} className="h-4" />
      </div>

      <ModalForm
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={selectedProduct ? "Editar Produto" : "Novo Produto"}
        onSubmit={handleSubmit}
        loading={saving}
        size="lg"
      >
        <Tabs defaultValue="data">
          <TabsList className="mb-4">
            <TabsTrigger value="data">Dados</TabsTrigger>
            {selectedProduct && (
              <TabsTrigger value="packages">Embalagens</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="data" className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 space-y-2">
                <Label htmlFor="name">Descrição</Label>
                <Input
                  ref={nameInputRef}
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Descrição do produto"
                  required
                  className="capitalize"
                  onKeyDown={handleNameKeyDown}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unidade Base</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) =>
                    setFormData({ ...formData, unit: value })
                  }
                >
                  <SelectTrigger ref={unitInputRef}>
                    <SelectValue placeholder="Un" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">un</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="pct">pct</SelectItem>
                    <SelectItem value="cx">cx</SelectItem>
                    <SelectItem value="fd">fd</SelectItem>
                    <SelectItem value="sc">sc</SelectItem>
                    <SelectItem value="bdj">bdj</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="category">Categoria</Label>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto font-normal text-xs"
                    onClick={() => setCategoryModalOpen(true)}
                  >
                    Nova Categoria
                  </Button>
                </div>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand">Marca</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) =>
                    setFormData({ ...formData, brand: e.target.value })
                  }
                  placeholder="Marca (opcional)"
                />
              </div>
            </div>

            <CategoryModal
              open={categoryModalOpen}
              onOpenChange={setCategoryModalOpen}
              onSuccess={() => {
                fetchCategories();
              }}
              categoryToEdit={null} // Always creating new from here
            />

            {!selectedProduct && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="default_unit">Embalagem Padrão</Label>
                  <Select
                    value={formData.default_unit}
                    onValueChange={(value) =>
                      setFormData({ ...formData, default_unit: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {packagingUnits.length === 0 ? (
                        <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                          Nenhuma unidade cadastrada.
                          <br />
                          <Button
                            type="button"
                            variant="link"
                            className="p-0 h-auto"
                            onClick={() => setPackagingModalOpen(true)}
                          >
                            Cadastrar embalagens
                          </Button>
                        </div>
                      ) : (
                        packagingUnits.map((unit) => (
                          <SelectItem key={unit.id} value={unit.code}>
                            {unit.code} - {unit.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_multiplier">Quantidade Embalada</Label>
                  <Input
                    id="default_multiplier"
                    type="number"
                    min="1"
                    step="0.01"
                    value={formData.default_multiplier}
                    onChange={(e) =>
                      setFormData({ ...formData, default_multiplier: e.target.value })
                    }
                    placeholder="Ex: 25"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Observações (opcional)"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="active">Produto ativo</Label>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, active: checked })
                }
              />
            </div>
          </TabsContent>

          {selectedProduct && (
            <TabsContent value="packages" className="space-y-4">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-3">Adicionar Embalagem</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Unidade</Label>
                    <Select
                      value={newPackage.unit}
                      onValueChange={(value) =>
                        setNewPackage({ ...newPackage, unit: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {packagingUnits.length === 0 ? (
                          <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                            Nenhuma unidade cadastrada.
                          </div>
                        ) : (
                          packagingUnits.map((unit) => (
                            <SelectItem key={unit.id} value={unit.code}>
                              {unit.code} - {unit.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Quantidade</Label>
                    <Input
                      placeholder="Ex: 25"
                      type="number"
                      min="1"
                      step="0.01"
                      value={newPackage.multiplier}
                      onChange={(e) =>
                        setNewPackage({ ...newPackage, multiplier: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Código de barras</Label>
                    <Input
                      placeholder="Opcional"
                      value={newPackage.barcode}
                      onChange={(e) =>
                        setNewPackage({ ...newPackage, barcode: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex items-center gap-2 h-9">
                      <input
                        type="checkbox"
                        id="is_default_new"
                        checked={newPackage.is_default}
                        onChange={(e) =>
                          setNewPackage({ ...newPackage, is_default: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-input"
                      />
                      <Label htmlFor="is_default_new" className="text-sm font-normal">
                        Embalagem principal
                      </Label>
                    </div>
                  </div>
                </div>
                <Button type="button" onClick={handleAddPackage} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Embalagem
                </Button>
              </div>

              <div className="space-y-2">
                {packages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma embalagem cadastrada</p>
                  </div>
                ) : (
                  packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="default_package"
                          checked={pkg.is_default}
                          onChange={() => handleSetDefaultPackage(pkg.id)}
                          className="h-4 w-4"
                          title="Marcar como embalagem principal"
                        />
                        <div>
                          <span className="font-medium">{pkg.unit}</span>
                          <span className="text-muted-foreground ml-2">
                            x{pkg.multiplier}
                          </span>
                          {pkg.barcode && (
                            <span className="text-sm text-muted-foreground ml-4">
                              {pkg.barcode}
                            </span>
                          )}
                          {pkg.is_default && (
                            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              Principal
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePackage(pkg.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </ModalForm>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir produto"
        description={`Tem certeza que deseja excluir o produto "${selectedProduct?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="destructive"
        loading={saving}
        onConfirm={handleConfirmDelete}
      />

      {/* Modal de Unidades de Embalagem */}
      <ModalForm
        open={packagingModalOpen}
        onOpenChange={setPackagingModalOpen}
        title="Unidades de Embalagem"
        onSubmit={(e) => {
          e.preventDefault();
          handleAddPackagingUnit();
        }}
        loading={saving}
        submitLabel="Adicionar"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit_code">Código</Label>
              <Input
                id="unit_code"
                value={newPackagingUnit.code}
                onChange={(e) =>
                  setNewPackagingUnit({ ...newPackagingUnit, code: e.target.value })
                }
                placeholder="Ex: CX"
                maxLength={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_name">Nome</Label>
              <Input
                id="unit_name"
                value={newPackagingUnit.name}
                onChange={(e) =>
                  setNewPackagingUnit({ ...newPackagingUnit, name: e.target.value })
                }
                placeholder="Ex: Caixa"
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3">Unidades Cadastradas</h4>
            {packagingUnits.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Package2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma unidade cadastrada</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {packagingUnits.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <span className="font-mono font-medium">{unit.code}</span>
                      <span className="text-muted-foreground ml-2">- {unit.name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedPackagingUnit(unit);
                        setDeletePackagingOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModalForm>

      <ConfirmDialog
        open={deletePackagingOpen}
        onOpenChange={setDeletePackagingOpen}
        title="Excluir unidade de embalagem"
        description={`Tem certeza que deseja excluir a unidade "${selectedPackagingUnit?.code} - ${selectedPackagingUnit?.name}"?`}
        confirmLabel="Excluir"
        variant="destructive"
        loading={saving}
        onConfirm={handleDeletePackagingUnit}
      />
    </div>
  );
}
