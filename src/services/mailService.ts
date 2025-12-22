import { supabase } from "@/integrations/supabase/client";

interface SendEmailParams {
    to: string[];
    subject: string;
    html: string;
}

export const mailService = {
    /**
     * Sends an email via Supabase Edge Function (resend)
     */
    async sendEmail({ to, subject, html }: SendEmailParams) {
        try {
            console.log(`Attempting to send email to ${to} with subject "${subject}"...`);

            const { data, error } = await supabase.functions.invoke('send-email', {
                body: {
                    to,
                    subject,
                    html,
                },
            });

            if (error) {
                console.error("Link/Function Error:", error);
                throw error;
            }

            console.log("Email sent successfully:", data);
            return { success: true, data };
        } catch (error: any) {
            console.error("Mail Service Error:", error);
            return { success: false, error };
        }
    },

    /**
     * Generates a standard HTML template for Quote Invitations
     */
    generateQuoteInvitation(quoteTitle: string, supplierName: string, link: string, message?: string) {
        return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #333;">Convite para Cotação: ${quoteTitle}</h2>
        <p>Olá <strong>${supplierName}</strong>,</p>
        
        <p>Você foi convidado para participar de uma nova cotação no Cotafácil.</p>
        
        ${message ? `<p style="background: #f9f9f9; padding: 15px; border-left: 4px solid #ddd; font-style: italic;">"${message}"</p>` : ''}
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${link}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Acessar Cotação Agora
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666;">
          Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br>
          <a href="${link}">${link}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          Enviado via Cotafácil
        </p>
      </div>
    `;
    }
};
