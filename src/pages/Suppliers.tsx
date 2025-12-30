import { useState, useEffect, useRef } from "react";
import { normalizeString } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
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
import { Plus, Pencil, Trash2, History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface Supplier {
  id: number;
  name: string;
  cnpj: string | null;
  email: string;
  phone: string | null;
  contact_name: string | null;
  notes: string | null;
  active: boolean;
}

// Helper for Title Case
const toTitleCase = (str: string) => {
  return str.replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
};

export default function Suppliers() {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  const pageSize = 50;

  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    email: "",
    phone: "",
    contact_name: "",
    notes: "",
    active: true,
  });

  // Keyboard Shortcuts
  useKeyboardShortcuts({
    onNew: () => {
      if (!modalOpen) handleCreate();
    },
    onSave: () => {
      if (modalOpen) {
        // Trigger submit by clicking the submit button in the active dialog
        const submitBtn = document.querySelector('div[role="dialog"] button[type="submit"]') as HTMLButtonElement;
        if (submitBtn) {
          submitBtn.click();
        }
      }
    }
  });



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

  // Initial fetch and reset on filter changes
  useEffect(() => {
    if (tenantId) {
      setPage(1);
      setSuppliers([]); // Clear list on filter change
      setHasMore(true);
      fetchSuppliers(1, true); // Reset
    }
  }, [tenantId, search]);

  // Fetch more when page changes (except initial which is handled above)
  useEffect(() => {
    if (page > 1) {
      fetchSuppliers(page, false);
    }
  }, [page]);

  const fetchSuppliers = async (currentPage: number, isReset: boolean) => {
    if (!tenantId) return;

    if (isReset) setLoading(true);
    else setLoadingMore(true);

    try {
      let query = supabase
        .from("suppliers")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId)
        .is('deleted_at', null)
        .order("name");

      if (search) {
        const normalizedSearch = normalizeString(search);
        query = query.ilike("name_clean", `%${normalizedSearch}%`);
      }

      const from = (currentPage - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, count, error } = await query;

      if (error) {
        toast({
          title: "Erro ao carregar fornecedores",
          description: error.message,
          variant: "destructive",
        });
      } else {
        const newSuppliers = data || [];
        if (isReset) {
          setSuppliers(newSuppliers);
        } else {
          setSuppliers(prev => [...prev, ...newSuppliers]);
        }
        setTotalCount(count || 0);
        setHasMore(newSuppliers.length === pageSize);
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    } finally {
      if (isReset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  const handleCreate = () => {
    setSelectedSupplier(null);
    setFormData({
      name: "",
      cnpj: "",
      email: "",
      phone: "",
      contact_name: "",
      notes: "",
      active: true,
    });
    setModalOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      cnpj: supplier.cnpj || "",
      email: supplier.email,
      phone: supplier.phone || "",
      contact_name: supplier.contact_name || "",
      notes: supplier.notes || "",
      active: supplier.active,
    });
    setModalOpen(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);

    const payload = {
      tenant_id: tenantId,
      name: formData.name, // Already capitalized via onChange
      cnpj: formData.cnpj || null,
      email: formData.email || null, // Optional now
      phone: formData.phone || null,
      contact_name: formData.contact_name || null, // Already capitalized via onChange
      notes: formData.notes || null,
      active: formData.active,
    };

    let error;

    if (selectedSupplier) {
      const result = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", selectedSupplier.id);
      error = result.error;
    } else {
      const result = await supabase.from("suppliers").insert(payload);
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
        title: selectedSupplier ? "Fornecedor atualizado" : "Fornecedor criado",
      });
      setModalOpen(false);
      fetchSuppliers(1, true);
    }
    setSaving(false);
  };

  const handleConfirmDelete = async () => {
    if (!selectedSupplier) return;
    setSaving(true);

    const { error } = await supabase
      .from("suppliers")
      .update({
        deleted_at: new Date().toISOString(),
        active: false,
        name: `${selectedSupplier.name}_deleted_${Date.now()}`,
        email: `${selectedSupplier.email}_deleted_${Date.now()}`,
        ...(selectedSupplier.cnpj ? { cnpj: `${selectedSupplier.cnpj}_del_${Date.now()}` } : {})
      })
      .eq("id", selectedSupplier.id);

    if (error) {
      console.error("Error deleting supplier:", error);
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Fornecedor excluído" });
      setDeleteOpen(false);
      fetchSuppliers(1, true);
    }
    setSaving(false);
  };

  const columns: Column<Supplier>[] = [
    {
      key: "id",
      header: "ID",
      className: "w-20",
      render: (item) => <span className="text-muted-foreground font-mono text-xs">#{item.id}</span>
    },
    { key: "name", header: "Nome" },
    { key: "email", header: "E-mail" },
    { key: "phone", header: "Telefone", render: (item) => item.phone || "-" },
    {
      key: "contact_name",
      header: "Contato",
      render: (item) => item.contact_name || "-",
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
      className: "w-32",
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Ver histórico"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/suppliers/${item.id}/history`);
            }}
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Editar"
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
            title="Excluir"
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
        title="Fornecedores"
        description="Gerencie seus fornecedores"
        actions={
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Fornecedor
          </Button>
        }
      />

      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar fornecedores..."
            className="w-80"
          />
        </div>

        <DataTable
          columns={columns}
          data={suppliers}
          loading={loading}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          emptyMessage="Nenhum fornecedor encontrado"
        />
      </div>

      <ModalForm
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={selectedSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
        onSubmit={handleSubmit}
        loading={saving}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: toTitleCase(e.target.value) })
                }
                placeholder="Nome do fornecedor"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) =>
                  setFormData({ ...formData, cnpj: e.target.value })
                }
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="email@fornecedor.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_name">Nome do Contato</Label>
            <Input
              id="contact_name"
              value={formData.contact_name}
              onChange={(e) =>
                setFormData({ ...formData, contact_name: toTitleCase(e.target.value) })
              }
              placeholder="Nome da pessoa de contato"
            />
          </div>

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
            <Label htmlFor="active">Fornecedor ativo</Label>
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, active: checked })
              }
            />
          </div>
        </div>
      </ModalForm>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir fornecedor"
        description={`Tem certeza que deseja excluir o fornecedor "${selectedSupplier?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="destructive"
        loading={saving}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
