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
    const { id, amount, payment_method_id, payment_date } = body
    if (!id || !amount || Number(amount) <= 0 || !payment_method_id || !payment_date) {
      return fail('Missing or invalid fields')
    }

    const { data: payment } = await supabase
      .from('payments')
      .select('id, enrollment_id')
      .eq('id', id)
      .single()
    if (!payment) return fail('Payment not found', 404)

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('agreed_price')
      .eq('id', payment.enrollment_id)
      .single()
    if (!enrollment) return fail('Enrollment not found', 404)

    // Tope sin contar este pago
    const { data: pays } = await supabase
      .from('payments')
      .select('amount')
      .eq('enrollment_id', payment.enrollment_id)
      .neq('id', id)
    const paidOthers = (pays ?? []).reduce((sum: number, p: { amount: number }) => sum + Number(p.amount ?? 0), 0)
    if (paidOthers + Number(amount) > Number(enrollment.agreed_price)) {
      return fail('Payment exceeds the remaining balance')
    }

    const { data: updated, error } = await supabase
      .from('payments')
      .update({ amount: Number(amount), payment_method_id, payment_date })
      .eq('id', id)
      .select()
      .single()
    if (error) return fail(error.message)

    return ok(updated)
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error', 500)
  }
})
