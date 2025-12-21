import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PurchaseOrderWithItems } from '@/types/purchase-orders';

interface SendEmailModalProps {
    purchaseOrder: PurchaseOrderWithItems;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SendEmailModal({ purchaseOrder, open, onOpenChange }: SendEmailModalProps) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        to: purchaseOrder.supplier?.email || '',
        subject: `Purchase Order #${purchaseOrder.po_number}`,
        body: `Prezado(a) ${purchaseOrder.supplier?.name || 'Fornecedor'},\n\nSegue em anexo o Purchase Order #${purchaseOrder.po_number}.\n\nPor favor, confirme o recebimento e a disponibilidade dos itens solicitados.\n\nAtenciosamente,\n[Sua Empresa]`,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.to) {
            toast({
                title: 'Email obrigatório',
                description: 'Por favor, informe o email do destinatário',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);

        try {
            // TODO: Implementar integração real com serviço de email
            // Por enquanto, simulando envio
            await new Promise(resolve => setTimeout(resolve, 2000));

            toast({
                title: 'Email enviado!',
                description: `Purchase Order enviado para ${formData.to}`,
            });

            // Salvar histórico no banco (opcional)
            // await supabase.from('po_email_history').insert({...})

            onOpenChange(false);
        } catch (error) {
            console.error('Erro ao enviar email:', error);
            toast({
                title: 'Erro ao enviar email',
                description: 'Ocorreu um erro ao tentar enviar o email',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Enviar Purchase Order por Email
                    </DialogTitle>
                    <DialogDescription>
                        O PDF do Purchase Order será anexado automaticamente ao email.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Destinatário */}
                        <div className="space-y-2">
                            <Label htmlFor="email_to">Para *</Label>
                            <Input
                                id="email_to"
                                type="email"
                                value={formData.to}
                                onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                                placeholder="email@fornecedor.com"
                                required
                            />
                        </div>

                        {/* Assunto */}
                        <div className="space-y-2">
                            <Label htmlFor="email_subject">Assunto *</Label>
                            <Input
                                id="email_subject"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                placeholder="Assunto do email"
                                required
                            />
                        </div>

                        {/* Corpo */}
                        <div className="space-y-2">
                            <Label htmlFor="email_body">Mensagem *</Label>
                            <Textarea
                                id="email_body"
                                value={formData.body}
                                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                                placeholder="Corpo do email..."
                                rows={8}
                                required
                            />
                        </div>

                        {/* Info do anexo */}
                        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                            <p className="font-medium text-blue-900">📎 Anexo:</p>
                            <p className="text-blue-700">PO_{purchaseOrder.po_number}.pdf</p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Mail className="mr-2 h-4 w-4" />
                                    Enviar Email
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
