import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { CheckCircle, AlertCircle, XCircle, Info, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, timestamp, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex gap-4 w-full items-start">
              <div className="mt-1">
                {variant === 'success' && <CheckCircle className="h-6 w-6 text-green-500" />}
                {variant === 'destructive' && <XCircle className="h-6 w-6 text-red-500" />}
                {variant === 'warning' && <AlertCircle className="h-6 w-6 text-yellow-500" />}
                {(!variant || variant === 'default') && <Info className="h-6 w-6 text-blue-500" />}
              </div>

              <div className="grid gap-1 flex-1">
                <div className="flex justify-between items-start">
                  {title && <ToastTitle className="text-base font-semibold">{title}</ToastTitle>}
                  {timestamp && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 opacity-70">
                      <Clock className="h-3 w-3" />
                      {format(new Date(timestamp), "HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
                {description && <ToastDescription className="text-sm opacity-90 leading-relaxed">{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

