import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { CategoryModal, Category } from "@/components/modals/CategoryModal";
import { CategoryTree } from "@/components/categories/CategoryTree";

export default function Categories() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [totalCount, setTotalCount] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<number | null>(null);

  useEffect(() => {
    if (tenantId) {
      fetchCategories();
    }
  }, [tenantId, search]);

  const fetchCategories = async (showLoading = true) => {
    if (!tenantId) return;
    if (showLoading) setLoading(true);

    let query = supabase
      .from("categories")
      .select("*, parent:categories!parent_id(name)", { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("name");

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      toast({
        title: "Erro ao carregar categorias",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCategories(data || []);
      setTotalCount(count || 0);
    }
    if (showLoading) setLoading(false);
  };

  const handleCreate = () => {
    setSelectedCategory(null);
    setDefaultParentId(null);
    setModalOpen(true);
  };

  const handleAddSubcategory = (parent: Category) => {
    setSelectedCategory(null);
    setDefaultParentId(parent.id);
    setModalOpen(true);
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setDefaultParentId(null);
    setModalOpen(true);
  };

  const handleDelete = (category: Category) => {
    setSelectedCategory(category);
    setDeleteOpen(true);
  };

  useKeyboardShortcuts({
    onNew: handleCreate,
  });

  const handleConfirmDelete = async () => {
    if (!selectedCategory) return;
    setSaving(true);

    const { error } = await supabase
      .from("categories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", selectedCategory.id);

    if (error) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Categoria excluída" });
      setDeleteOpen(false);
      fetchCategories(false);
    }
    setSaving(false);
  };

  const columns: Column<Category>[] = [
    { key: "name", header: "Nome" },
    {
      key: "parent",
      header: "Categoria Pai",
      render: (item) => item.parent?.name || "-",
    },
    {
      key: "active",
      header: "Status",
      render: (item) => (
        <StatusBadge status={item.active ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: (item) => (
        <div className="flex items-center gap-2">
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

  // Determine valid parent options
  const isDescendant = (potentialDescendant: Category, rootId: number): boolean => {
    if (!potentialDescendant.parent_id) return false;
    if (potentialDescendant.parent_id === rootId) return true;
    const parent = categories.find(c => c.id === potentialDescendant.parent_id);
    return parent ? isDescendant(parent, rootId) : false;
  };

  const parentOptions = categories.filter((c) => {
    if (!selectedCategory) return true;
    if (c.id === selectedCategory.id) return false;
    if (isDescendant(c, selectedCategory.id)) return false;
    return true;
  });

  return (
    <div className="min-h-screen">
      <Header
        title="Categorias"
        description="Gerencie as categorias de produtos"
        actions={
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Categoria
          </Button>
        }
      />

      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar categorias..."
            className="w-80"
          />
        </div>

        {search ? (
          <DataTable
            columns={columns}
            data={categories}
            loading={loading}
            page={1}
            pageSize={1000}
            totalCount={totalCount}
            onPageChange={() => { }}
            emptyMessage="Nenhuma categoria encontrada"
          />
        ) : (
          <div className="bg-white rounded-lg shadow-sm">
            {loading ? (
              <div className="p-4 text-center">Carregando...</div>
            ) : (
              <CategoryTree
                categories={categories}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAddSubcategory={handleAddSubcategory}
              />
            )}
          </div>
        )}
      </div>

      <CategoryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        categoryToEdit={selectedCategory}
        parentOptions={parentOptions}
        defaultParentId={defaultParentId}
        onSuccess={() => fetchCategories(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir categoria"
        description={`Tem certeza que deseja excluir a categoria "${selectedCategory?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="destructive"
        loading={saving}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
