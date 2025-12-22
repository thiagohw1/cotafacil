import { Resend } from "npm:resend@2.0.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const { to, subject, html } = await req.json()
        const apiKey = Deno.env.get('RESEND_API_KEY')

        // 1. Mock Mode (if no API Key)
        if (!apiKey) {
            console.log(">>> [MOCK EMAIL MODE] <<<")
            console.log(`To: ${to}`)
            console.log(`Subject: ${subject}`)
            console.log("-----------------------")
            return new Response(
                JSON.stringify({
                    success: true,
                    mocked: true,
                    message: "API Key not found. Email logged to console."
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                }
            )
        }

        // 2. Real Send
        const resend = new Resend(apiKey)
        const data = await resend.emails.send({
            from: 'Cotafácil <onboarding@resend.dev>', // Default sender for testing
            to,
            subject,
            html,
        })

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Error sending email:", error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})
