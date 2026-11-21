import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail(405, 'Method not allowed')

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return fail(401, 'Missing authorization')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return fail(401, 'Invalid session')

  const { topic_id, completed } = await req.json().catch(() => ({}))
  if (typeof topic_id !== 'number' || typeof completed !== 'boolean') {
    return fail(400, 'topic_id and completed are required')
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // El tema y su curso
  const { data: topic, error: topicError } = await admin
    .from('topics')
    .select('id, course_id, content_version')
    .eq('id', topic_id)
    .single()
  if (topicError || !topic) return fail(404, 'Topic not found')

  // Solo el cliente inscrito en ese curso puede marcar sus temas
  const { data: enrollment, error: enrollmentError } = await admin
    .from('enrollments')
    .select('id')
    .eq('course_id', topic.course_id)
    .eq('client_id', user.id)
    .maybeSingle()
  if (enrollmentError || !enrollment) return fail(403, 'Not enrolled in this course')

  // Upsert: crea la fila si no existe, actualiza si ya existe
  const { data, error } = await admin
    .from('topic_progress')
    .upsert({
      enrollment_id: enrollment.id,
      topic_id,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      content_version: topic.content_version
    }, { onConflict: 'enrollment_id,topic_id' })
    .select('id, enrollment_id, topic_id, completed, completed_at, content_version')
    .single()
  if (error) return fail(400, error.message)

  return new Response(JSON.stringify({ data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
