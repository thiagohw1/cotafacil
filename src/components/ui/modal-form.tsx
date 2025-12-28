import type { ReactNode, FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";
import { Loader2 } from "lucide-react";

interface ModalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: (e: FormEvent) => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  hideCancel?: boolean;
  hideSubmit?: boolean;
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function ModalForm({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Salvar",
  cancelLabel = "Cancelar",
  loading = false,
  size = "md",
  hideCancel = false,
  hideSubmit = false,
}: ModalFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={sizeClasses[size]} aria-describedby={description ? undefined : "modal-form-desc"}>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className={description ? "" : "sr-only"}>
              {description || "Formulário de edição"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">{children}</div>
          <DialogFooter>
            {!hideCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                {cancelLabel}
              </Button>
            )}
            {!hideSubmit && (
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitLabel}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
