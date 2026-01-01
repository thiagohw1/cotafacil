
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Create Supabase client
        const supabaseClient = createClient(
            // Use env vars for service role key to bypass RLS and read all quotes
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Find quotes expiring in less than 24 hours that haven't been alerted yet
        // '24 hours' logic: deadline_at is in the future but less than 24h away.
        // Also consider ensuring it's not expired yet (deadline_at > now).
        const now = new Date();
        const future24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Query: Status = open, Deadline Alert Sent = false, and Deadline is between NOW and NOW+24h
        // Note: handling TZs can be tricky properly, relying on ISO strings comparison.

        const { data: quotes, error: queriesError } = await supabaseClient
            .from('quotes')
            .select('id, title, created_by, deadline_at, tenant_id')
            .eq('status', 'open')
            .eq('deadline_alert_sent', false)
            .gt('deadline_at', now.toISOString())
            .lt('deadline_at', future24h.toISOString());

        if (queriesError) throw queriesError;

        console.log(`Found ${quotes?.length ?? 0} quotes to alert.`);

        if (!quotes || quotes.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No expiring quotes found.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const notifications = [];
        const updates = [];

        // 2. Prepare notifications and updates
        for (const quote of quotes) {
            // Notification for the buyer
            notifications.push({
                user_id: quote.created_by,
                tenant_id: quote.tenant_id,
                title: 'Prazo expirando',
                message: `A cotação "${quote.title}" encerra em menos de 24 horas.`,
                link: `/quotes/${quote.id}`,
                is_read: false
            });

            // Update list
            updates.push(quote.id);
        }

        // 3. Batch Insert Notifications
        const { error: insertError } = await supabaseClient
            .from('notifications')
            .insert(notifications);

        if (insertError) throw insertError;

        // 4. Batch Update Quotes (mark as alerted)
        // We update one by one or using 'in' if updating same field. 
        // Supabase JS doesn't support bulk update with different WHERE easily without loop or RPC.
        // Since we just update 'deadline_alert_sent' to TRUE for ALL of these IDs, we can use .in()

        const { error: updateError } = await supabaseClient
            .from('quotes')
            .update({ deadline_alert_sent: true })
            .in('id', updates);

        if (updateError) throw updateError;

        return new Response(
            JSON.stringify({
                success: true,
                alerted_count: quotes.length,
                quotes: updates
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error processing alerts:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
