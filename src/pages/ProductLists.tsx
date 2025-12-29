import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { ModalForm } from "@/components/ui/modal-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, List, Package, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface ProductList {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  item_count?: number;
  product_list_items?: {
    product: {
      category?: {
        name: string;
      } | null;
    };
  }[];
}

interface ListItem {
  id: number;
  product: {
    id: number;
    name: string;
    category?: { name: string } | null;
    product_packages?: { id: number; unit: string; multiplier: number; is_default: boolean }[];
  };
  preferred_package?: { id: number; unit: string; multiplier: number } | null;
  default_qty: number | null;
}

interface Product {
  id: number;
  name: string;
  packages: { id: number; unit: string; multiplier: number; is_default: boolean }[];
}

interface Category {
  id: number;
  name: string;
  parent_id: number | null;
}

export default function ProductLists() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [lists, setLists] = useState<ProductList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const [modalOpen, setModalOpen] = useState(false);
  const [itemsModalOpen, setItemsModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedList, setSelectedList] = useState<ProductList | null>(null);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  // Search state
  const [openCombobox, setOpenCombobox] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedProductData, setSelectedProductData] = useState<Product | null>(null);

  const [isReadOnly, setIsReadOnly] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [newItem, setNewItem] = useState({
    product_id: "",
    package_id: "",
    default_qty: "",
  });

  useEffect(() => {
    if (tenantId) {
      fetchLists();
      fetchCategories();
    }
  }, [tenantId, search, page]);

  // Debounced search effect
  useEffect(() => {
    setProducts([]);
    setSelectedIndex(-1);

    if (!searchTerm) return;

    const timer = setTimeout(() => {
      fetchProducts(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, tenantId, categories]);

  // Auto-select default package when product changes
  useEffect(() => {
    if (selectedProductData && selectedProductData.packages.length > 0 && !newItem.package_id) {
      const defaultPkg = selectedProductData.packages.find(p => p.is_default) || selectedProductData.packages[0];
      if (defaultPkg) {
        setNewItem(prev => ({ ...prev, package_id: defaultPkg.id.toString() }));
      }
    }
  }, [selectedProductData, newItem.package_id]);

  // Ref for the search results list to manage scrolling
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected item in search results
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const list = listRef.current;
      const item = list.children[selectedIndex] as HTMLElement;
      if (item) {
        // Ensure the item is visible
        const listTop = list.scrollTop;
        const listBottom = listTop + list.clientHeight;
        const itemTop = item.offsetTop;
        const itemBottom = itemTop + item.clientHeight;

        if (itemTop < listTop) {
          list.scrollTop = itemTop;
        } else if (itemBottom > listBottom) {
          list.scrollTop = itemBottom - list.clientHeight;
        }
      }
    }
  }, [selectedIndex]);

  const selectProduct = (product: Product) => {
    const defaultPkg = product.packages.find((pkg) => pkg.is_default) || product.packages[0];
    setNewItem(prev => ({
      ...prev,
      product_id: product.id.toString(),
      package_id: defaultPkg ? defaultPkg.id.toString() : "",
    }));
    setSearchTerm(product.name);
    setSelectedProductData(product);
    setProducts([]);
    setSelectedIndex(-1);
  };

  // ... existing handleKeyDown ...

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSearchTerm("");
      setNewItem({ ...newItem, product_id: "", package_id: "" });
      setSelectedProductData(null);
      setProducts([]);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      // If product is already selected, Add it.
      if (newItem.product_id && selectedProductData) {
        handleSaveItem();
        return;
      }

      // Otherwise, select from search results
      if (!products.length) return;
      const index = selectedIndex >= 0 ? selectedIndex : 0;
      if (products[index]) {
        selectProduct(products[index]);
      }
      return;
    }

    if (!products.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % products.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + products.length) % products.length);
    }
  };


  const fetchLists = async () => {
    if (!tenantId) return;
    setLoading(true);

    let query = supabase
      .from("product_lists")
      .select("*, product_list_items(id, product:products(category:categories(name))), count:product_list_items(count)", { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("name");

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      toast({
        title: "Erro ao carregar listas",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const listsWithCount = data?.map((list: any) => ({
        ...list,
        item_count: list.count?.[0]?.count || 0,
      })) || [];
      setLists(listsWithCount);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("id, name, parent_id")
      .order("name");

    setCategories(data || []);
  };

  const fetchProducts = async (term: string) => {
    if (!tenantId) return;

    // Smart category search logic
    const isCategorySearch = term.trim().startsWith("//");

    let query = supabase
      .from("products")
      .select("id, name, product_packages(id, unit, multiplier, is_default), category:categories!inner(name)")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .is("deleted_at", null)
      .order("name")
      .limit(50);

    if (isCategorySearch) {
      const categoryTerm = term.trim().substring(2).toLowerCase();

      // Define aliases
      const aliases: Record<string, string[]> = {
        "flv": ["frutas", "legumes", "verduras", "hortifruti", "flv"],
        "carnes": ["carnes", "bovinos", "suínos", "aves", "açougue", "suinos", "acougue"],
      };

      const targetNames = aliases[categoryTerm] || [categoryTerm];

      // 1. Find root categories matching the term (or aliases)
      const matchingRoots = categories.filter(c =>
        targetNames.some(name => c.name.toLowerCase().includes(name))
      );

      // 2. Collect all descendant IDs for these roots
      const validCategoryIds = new Set<number>();

      const addCategoryAndChildren = (parentId: number) => {
        validCategoryIds.add(parentId);
        // Find immediate children
        const children = categories.filter(c => c.parent_id === parentId);
        children.forEach(child => addCategoryAndChildren(child.id));
      };

      matchingRoots.forEach(root => addCategoryAndChildren(root.id));

      if (validCategoryIds.size > 0) {
        query = query.in("category_id", Array.from(validCategoryIds));
      } else {
        // No matching category found, ensure no results
        query = query.eq("id", -1);
      }
    } else if (term) {
      query = query.ilike("name", `%${term}%`);
    }

    const { data } = await query;

    setProducts(
      data?.map((p: any) => ({
        id: p.id,
        name: p.name,
        packages: p.product_packages || [],
      })) || []
    );
  };

  const fetchListItems = async (listId: number) => {
    const { data } = await supabase
      .from("product_list_items")
      .select(
        `
        id,
        default_qty,
        product:products(id, name, category:categories(name), product_packages(id, unit, multiplier, is_default)),
        preferred_package:product_packages(id, unit, multiplier)
      `
      )
      .eq("list_id", listId)
      .order("id");

    setListItems(data as any || []);
  };

  const handleCreate = () => {
    setSelectedList(null);
    setFormData({ name: "", description: "" });
    setModalOpen(true);
  };

  const triggerSubmit = () => {
    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (submitBtn && modalOpen) {
      submitBtn.click();
    }
  };

  useKeyboardShortcuts({
    onNew: handleCreate,
    onSave: triggerSubmit,
  });

  const handleEdit = (list: ProductList) => {
    setSelectedList(list);
    setFormData({
      name: list.name,
      description: list.description || "",
    });
    setModalOpen(true);
  };

  const openListModal = async (list: ProductList, readOnly: boolean) => {
    setIsReadOnly(readOnly);
    setSelectedList(list);
    setEditingItemId(null);
    setNewItem({ product_id: "", package_id: "", default_qty: "" });
    setSearchTerm("");
    setSelectedProductData(null);
    await fetchListItems(list.id);
    setItemsModalOpen(true);
  };

  const handleManageItems = (list: ProductList) => {
    openListModal(list, false);
  };

  const handleDelete = (list: ProductList) => {
    setSelectedList(list);
    setDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);

    const payload = {
      tenant_id: tenantId,
      name: formData.name.replace(/(?:^|\s)\S/g, (char) => char.toUpperCase()),
      description: formData.description || null,
    };

    let error;

    if (selectedList) {
      const result = await supabase
        .from("product_lists")
        .update(payload)
        .eq("id", selectedList.id);
      error = result.error;
    } else {
      const result = await supabase.from("product_lists").insert(payload);
      error = result.error;
    }

    if (error) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: selectedList ? "Lista atualizada" : "Lista criada",
      });
      setModalOpen(false);
      fetchLists();
    }
    setSaving(false);
  };

  const handleEditItem = (item: ListItem) => {
    setEditingItemId(item.id);
    setNewItem({
      product_id: item.product.id.toString(),
      package_id: item.preferred_package?.id.toString() || "",
      default_qty: item.default_qty?.toString() || "",
    });

    // Construct Product object from the expanded item.product
    // @ts-ignore - Supabase return type workaround
    const prodPackages = item.product.product_packages || [];

    setSelectedProductData({
      id: item.product.id,
      name: item.product.name,
      packages: prodPackages
    });

    setSearchTerm(item.product.name);
  };

  const handleSaveItem = async () => {
    if (!selectedList || !newItem.product_id) return;

    const payload = {
      list_id: selectedList.id,
      product_id: parseInt(newItem.product_id),
      preferred_package_id: newItem.package_id
        ? parseInt(newItem.package_id)
        : null,
      default_qty: newItem.default_qty
        ? parseFloat(newItem.default_qty)
        : null,
    };

    let error;

    if (editingItemId) {
      const { error: updateError } = await supabase
        .from("product_list_items")
        .update(payload)
        .eq("id", editingItemId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("product_list_items")
        .insert(payload);
      error = insertError;
    }

    if (error) {
      toast({
        title: "Erro ao salvar item",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setNewItem({ product_id: "", package_id: "", default_qty: "" });
      setEditingItemId(null);
      setSearchTerm(""); // Reset search after save
      setSelectedProductData(null);
      fetchListItems(selectedList.id);
    }
  };

  const handleRemoveItem = async (itemId: number) => {
    const { error } = await supabase
      .from("product_list_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Erro ao remover item",
        description: error.message,
        variant: "destructive",
      });
    } else if (selectedList) {
      fetchListItems(selectedList.id);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedList) return;
    setSaving(true);

    const { error } = await supabase
      .from("product_lists")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", selectedList.id);

    if (error) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Lista excluída" });
      setDeleteOpen(false);
      fetchLists();
    }
    setSaving(false);
  };

  // derived selectedProduct now comes from state
  const selectedProduct = selectedProductData;

  const CATEGORY_COLORS: Record<string, string> = {
    "flv": "bg-green-500",
    "hortifruti": "bg-green-500",
    "frutas": "bg-green-500",
    "legumes": "bg-green-500",
    "verduras": "bg-green-500",

    "açougue": "bg-red-500",
    "acougue": "bg-red-500",
    "carnes": "bg-red-500",
    "bovinos": "bg-red-500",
    "aves": "bg-red-500",
    "suínos": "bg-red-500",

    "congelados": "bg-blue-400",
    "frios": "bg-blue-300",
    "laticínios": "bg-yellow-400",
    "laticinios": "bg-yellow-400",
    "queijos": "bg-yellow-400",

    "mercearia": "bg-amber-500",
    "alimentos": "bg-amber-500",
    "grãos": "bg-amber-600",

    "bebidas": "bg-purple-500",
    "limpeza": "bg-cyan-500",
    "higiene": "bg-pink-500",
    "padaria": "bg-orange-400",
    "pães": "bg-orange-400",
    "outros": "bg-gray-400"
  };

  const tailWindColors = [
    "bg-red-400", "bg-orange-400", "bg-amber-400", "bg-yellow-400", "bg-lime-400",
    "bg-green-400", "bg-emerald-400", "bg-teal-400", "bg-cyan-400", "bg-sky-400",
    "bg-blue-400", "bg-indigo-400", "bg-violet-400", "bg-purple-400", "bg-fuchsia-400",
    "bg-pink-400", "bg-rose-400"
  ];

  const getCategoryColor = (category: string) => {
    if (!category) return CATEGORY_COLORS["outros"];

    const normalized = category.toLowerCase().trim();
    // Check direct mapping
    if (CATEGORY_COLORS[normalized]) return CATEGORY_COLORS[normalized];

    // Check if any key is contained in the category name (e.g. "Carnes Nobres" -> "Carnes")
    const foundKey = Object.keys(CATEGORY_COLORS).find(key => normalized.includes(key));
    if (foundKey) return CATEGORY_COLORS[foundKey];

    // Hash fallback for unknown categories
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % tailWindColors.length;
    return tailWindColors[index];
  };

  const getCategoryDistribution = (list: ProductList) => {
    if (!list.product_list_items || list.product_list_items.length === 0) return [];

    const counts: Record<string, number> = {};
    const total = list.product_list_items.length;

    list.product_list_items.forEach(item => {
      const category = item.product?.category?.name || "Sem Categoria";
      counts[category] = (counts[category] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count);
  };

  const columns: Column<ProductList>[] = [
    { key: "id", header: "ID", className: "w-16 py-0" },
    { key: "name", header: "Nome", className: "py-0" },
    {
      key: "type",
      header: "Tipo",
      className: "w-48 py-0",
      render: (item) => {
        const distribution = getCategoryDistribution(item);
        if (distribution.length === 0) return <span className="text-muted-foreground">-</span>;

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-muted">
                  {distribution.map((dist, idx) => (
                    <div
                      key={idx}
                      className={cn("h-full", getCategoryColor(dist.name))}
                      style={{ width: `${dist.percentage}%` }}
                    />
                  ))}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex flex-col gap-1 text-xs">
                  {distribution.map((dist, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", getCategoryColor(dist.name))} />
                      <span>{dist.count} itens {dist.name}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
    },
    {
      key: "item_count",
      header: "Qtd. Itens",
      className: "py-0",
      render: (item) => item.item_count || 0,
    },
    {
      key: "description",
      header: "Descrição",
      className: "py-0",
      render: (item) => item.description || "-",
    },
    {
      key: "created_at",
      header: "Criada em",
      className: "py-0",
      render: (item) =>
        format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR }),
    },
    {
      key: "actions",
      header: "",
      className: "w-32 py-0",
      render: (item) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleManageItems(item);
            }}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
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
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const itemColumns: Column<ListItem>[] = [
    {
      key: "index",
      header: "#",
      className: "w-12 py-0",
      render: (_, index) => index + 1,
    },
    {
      key: "category",
      header: "Categoria",
      className: "py-0",
      render: (item) => item.product.category?.name || "-",
    },
    {
      key: "product",
      header: "Produto",
      className: "py-0",
      render: (item) => (
        <div>
          <span className="text-xs text-muted-foreground mr-1">#{item.product.id}</span>
          <span className="font-medium"> {item.product.name}</span>
        </div>
      ),
    },
    {
      key: "package",
      header: "Embalagem",
      className: "py-0",
      render: (item) =>
        item.preferred_package
          ? `${item.preferred_package.unit}-${item.preferred_package.multiplier}`
          : "-",
    },
    {
      key: "qty",
      header: "Qtde Padrão",
      className: "py-0",
      render: (item) => item.default_qty || "-",
    },
    {
      key: "actions",
      header: "",
      className: "w-24 py-0",
      render: (item) => (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleEditItem(item)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleRemoveItem(item.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <Header
        title="Listas de Produtos"
        description="Crie listas reutilizáveis para suas cotações"
        actions={
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Lista
          </Button>
        }
      />

      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar listas..."
            className="w-80"
          />
        </div>

        <DataTable
          columns={columns}
          data={lists}
          loading={loading}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          onRowDoubleClick={(item) => openListModal(item, true)}
          emptyMessage="Nenhuma lista encontrada"
        />
      </div>

      <ModalForm
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={selectedList ? "Editar Lista" : "Nova Lista"}
        onSubmit={handleSubmit}
        loading={saving}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Nome da lista"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Descrição (opcional)"
              rows={3}
            />
          </div>
        </div>
      </ModalForm>

      <ModalForm
        open={itemsModalOpen}
        onOpenChange={setItemsModalOpen}
        title={`Itens da Lista: ${selectedList?.name} ${isReadOnly ? '(Visualização)' : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          setItemsModalOpen(false);
        }}
        submitLabel="Fechar"
        hideCancel={true}
        size="xl"
      >
        <div className="flex flex-col h-[75vh] space-y-4">
          {!isReadOnly && (
            <div className="rounded-lg border p-4 bg-muted/20 shrink-0">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                {editingItemId ? (
                  <>
                    <Pencil className="h-4 w-4" />
                    Editar Item
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Adicionar Produto
                  </>
                )}
              </h4>
              <div className="grid grid-cols-8 gap-3 items-end">
                <div className="relative col-span-4">
                  <Popover open={searchTerm.length > 0 && !newItem.product_id && products.length > 0}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            if (newItem.product_id) {
                              setNewItem({ ...newItem, product_id: "", package_id: "" });
                              setSelectedProductData(null);
                            }
                          }}
                          onKeyDown={handleKeyDown}
                          placeholder="Buscar produto..."
                          className="w-full"
                        />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[500px]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                      <div
                        ref={listRef}
                        className="max-h-[300px] overflow-y-auto modern-scrollbar p-1"
                      >
                        {products.map((product, index) => (
                          <div
                            key={product.id}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm rounded-sm transition-colors",
                              selectedIndex === index ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                            )}
                            onClick={() => selectProduct(product)}
                            onMouseEnter={() => setSelectedIndex(index)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                newItem.product_id === product.id.toString()
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex items-center gap-2 overflow-hidden w-full">
                              <span className="text-xs text-muted-foreground shrink-0 font-mono bg-muted/50 px-1 rounded">
                                {product.id}
                              </span>
                              <span className="font-medium truncate flex-1">
                                {product.name}
                              </span>
                              {product.packages && product.packages.length > 0 && (
                                <span className="text-xs text-muted-foreground shrink-0 border-l pl-2">
                                  {(() => {
                                    const def = product.packages.find(p => p.is_default) || product.packages[0];
                                    return `${def.unit}-${def.multiplier}`;
                                  })()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {newItem.product_id && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-0 h-9 w-9 z-10 hover:bg-transparent"
                      onClick={() => {
                        setNewItem({ ...newItem, product_id: "", package_id: "" });
                        setSearchTerm("");
                        setSelectedProductData(null);
                        setSelectedIndex(-1);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                    </Button>
                  )}
                </div>

                <div className="col-span-1">
                  <Select
                    value={newItem.package_id}
                    onValueChange={(value) =>
                      setNewItem(prev => ({ ...prev, package_id: value }))
                    }
                    disabled={!selectedProduct?.packages?.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Emb" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProduct?.packages?.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id.toString()}>
                          {pkg.unit}-{pkg.multiplier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-1">
                  <Input
                    type="number"
                    placeholder="Qtd"
                    value={newItem.default_qty}
                    onChange={(e) =>
                      setNewItem({ ...newItem, default_qty: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveItem();
                    }}
                  />
                </div>

                <div className="col-span-2 flex gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={handleSaveItem}
                  >
                    {editingItemId ? "Atualizar" : "Adicionar"}
                  </Button>

                  {editingItemId && (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setEditingItemId(null);
                        setNewItem({ product_id: "", package_id: "", default_qty: "" });
                        setSelectedProductData(null);
                        setSearchTerm("");
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto overflow-x-hidden modern-scrollbar pr-2">
            <DataTable
              columns={isReadOnly ? itemColumns.filter(c => c.key !== 'actions') : itemColumns}
              data={listItems}
              loading={false}
              page={1}
              pageSize={100}
              totalCount={listItems.length}
              onPageChange={() => { }}
              emptyMessage="Nenhum item na lista"
            />
          </div>
        </div>
      </ModalForm>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir lista"
        description={`Tem certeza que deseja excluir a lista "${selectedList?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="destructive"
        loading={saving}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
