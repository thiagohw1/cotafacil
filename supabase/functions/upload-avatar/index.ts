import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file')
        const userId = formData.get('userId')

        if (!file || !userId) {
            return new Response(
                JSON.stringify({ error: 'File and userId are required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const filePath = `${userId}/avatar.jpg`

        const { data, error: uploadError } = await supabaseAdmin
            .storage
            .from('avatars')
            .upload(filePath, file, {
                contentType: 'image/jpeg',
                upsert: true
            })

        if (uploadError) {
            console.error('Upload error:', uploadError)
            throw uploadError
        }

        const { data: { publicUrl } } = supabaseAdmin
            .storage
            .from('avatars')
            .getPublicUrl(filePath)

        // Append timestamp to force refresh on client side
        const publicUrlWithTimestamp = `${publicUrl}?t=${new Date().getTime()}`

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ avatar_url: publicUrlWithTimestamp })
            .eq('user_id', userId)

        if (updateError) {
            console.error('Profile update error:', updateError)
            throw updateError
        }

        return new Response(
            JSON.stringify({ publicUrl: publicUrlWithTimestamp }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
