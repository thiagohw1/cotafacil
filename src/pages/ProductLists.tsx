import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { ModalForm } from "@/components/ui/modal-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, List, Package } from "lucide-react";
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
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface ProductList {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  item_count?: number;
}

interface ListItem {
  id: number;
  product: { id: number; name: string };
  preferred_package?: { id: number; unit: string } | null;
  default_qty: number | null;
}

interface Product {
  id: number;
  name: string;
  packages: { id: number; unit: string }[];
}

export default function ProductLists() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [lists, setLists] = useState<ProductList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
      fetchProducts();
    }
  }, [tenantId, search, page]);

  const fetchLists = async () => {
    if (!tenantId) return;
    setLoading(true);

    let query = supabase
      .from("product_lists")
      .select("*", { count: "exact" })
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
      setLists(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    if (!tenantId) return;

    const { data } = await supabase
      .from("products")
      .select("id, name, product_packages(id, unit)")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .is("deleted_at", null)
      .order("name");

    setProducts(
      data?.map((p) => ({
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
        product:products(id, name),
        preferred_package:product_packages(id, unit)
      `
      )
      .eq("list_id", listId);

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

  const handleManageItems = async (list: ProductList) => {
    setSelectedList(list);
    await fetchListItems(list.id);
    setItemsModalOpen(true);
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
      name: formData.name,
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

  const handleAddItem = async () => {
    if (!selectedList || !newItem.product_id) return;

    const { error } = await supabase.from("product_list_items").insert({
      list_id: selectedList.id,
      product_id: parseInt(newItem.product_id),
      preferred_package_id: newItem.package_id
        ? parseInt(newItem.package_id)
        : null,
      default_qty: newItem.default_qty
        ? parseFloat(newItem.default_qty)
        : null,
    });

    if (error) {
      toast({
        title: "Erro ao adicionar item",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setNewItem({ product_id: "", package_id: "", default_qty: "" });
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

  const selectedProduct = products.find(
    (p) => p.id.toString() === newItem.product_id
  );

  const columns: Column<ProductList>[] = [
    { key: "name", header: "Nome" },
    {
      key: "description",
      header: "Descrição",
      render: (item) => item.description || "-",
    },
    {
      key: "created_at",
      header: "Criada em",
      render: (item) =>
        format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR }),
    },
    {
      key: "actions",
      header: "",
      className: "w-32",
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
        title={`Itens da Lista: ${selectedList?.name}`}
        onSubmit={(e) => e.preventDefault()}
        submitLabel="Fechar"
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <h4 className="font-medium mb-3">Adicionar Produto</h4>
            <div className="grid grid-cols-4 gap-3">
              <Select
                value={newItem.product_id}
                onValueChange={(value) =>
                  setNewItem({ ...newItem, product_id: value, package_id: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={newItem.package_id}
                onValueChange={(value) =>
                  setNewItem({ ...newItem, package_id: value })
                }
                disabled={!selectedProduct?.packages.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Embalagem" />
                </SelectTrigger>
                <SelectContent>
                  {selectedProduct?.packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id.toString()}>
                      {pkg.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                placeholder="Qtde padrão"
                value={newItem.default_qty}
                onChange={(e) =>
                  setNewItem({ ...newItem, default_qty: e.target.value })
                }
              />

              <Button type="button" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {listItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum item na lista</p>
              </div>
            ) : (
              listItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <span className="font-medium">{item.product.name}</span>
                    {item.preferred_package && (
                      <span className="text-muted-foreground ml-2">
                        ({item.preferred_package.unit})
                      </span>
                    )}
                    {item.default_qty && (
                      <span className="text-sm text-muted-foreground ml-4">
                        Qtde: {item.default_qty}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
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
