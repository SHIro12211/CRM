import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function fail(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getRole(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('users').select('user_types(name)').eq('id', userId).single()
  return (data as unknown as { user_types: { name: string } | null } | null)?.user_types?.name ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return fail('Missing authorization', 401)

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    if (userError || !user) return fail('Invalid session', 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const role = await getRole(supabase, user.id)
    if (role !== 'Admin' && role !== 'Head Advisor') {
      return fail('Forbidden', 403)
    }

    const body = await req.json()
    const { id } = body
    if (!id) return fail('Missing or invalid fields')

    const { data: payment } = await supabase
      .from('payments')
      .select('id')
      .eq('id', id)
      .single()
    if (!payment) return fail('Payment not found', 404)

    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (error) return fail(error.message)

    return ok({ deleted: true })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error', 500)
  }
})
