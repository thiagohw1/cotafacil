
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing Authorization header')
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // Check if user is admin
        const {
            data: { user },
            error: userError
        } = await supabaseClient.auth.getUser()

        if (userError || !user) {
            console.error("Auth error:", userError)
            throw new Error(`Unauthorized: ${userError?.message || 'No user found'}`)
        }

        const { data: userRole, error: roleError } = await supabaseClient
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        if (roleError) {
            console.error("Role error:", roleError)
            throw new Error(`Failed to check role: ${roleError.message}`)
        }

        if (userRole?.role !== 'admin') {
            throw new Error('Unauthorized: Admin access required')
        }

        // Get tenant_id for the admin
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('tenant_id')
            .eq('user_id', user.id)
            .single()

        if (profileError || !profile?.tenant_id) {
            console.error("Profile error:", profileError)
            throw new Error('Admin has no tenant_id')
        }

        const { email, password, fullName, role } = await req.json()

        if (!email || !password || !fullName || !role) {
            throw new Error('Missing required fields')
        }

        // Create Supabase Admin client to create user
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                tenant_id: profile.tenant_id,
                role: role
            }
        })

        if (createUserError) {
            console.error("Create user error:", createUserError)
            throw createUserError
        }

        return new Response(
            JSON.stringify(newUser),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
