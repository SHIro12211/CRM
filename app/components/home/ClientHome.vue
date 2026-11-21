<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-default">{{ greeting }}</h1>
        <p class="text-muted">Este es tu espacio: tus cursos, tus pagos y tu próximo seguimiento.</p>
      </div>
      <UButton to="/course" color="primary">All Courses</UButton>
    </div>
    <div v-if="pending" class="text-muted">Cargando tus cursos...</div>
    <div v-else-if="error" class="text-red-500">
      No se pudieron cargar tus datos. Intenta recargar la página.
      <pre class="mt-2 overflow-auto rounded bg-red-50 p-3 text-xs">{{ error.message ?? error }}</pre>
    </div>

    <template v-else>
      <CourseList :enrollments="enrollments" />
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-xl border bg-elevated p-4">
          <p class="text-sm text-muted">Mis cursos</p>
          <p class="text-3xl font-bold text-default">{{ enrollments.length }}</p>
        </div>
        <div class="rounded-xl border bg-elevated p-4">
          <p class="text-sm text-muted">Pagado</p>
          <p class="text-3xl font-bold text-default">{{ formatPrice(totalPaid) }}</p>
        </div>
        <div class="rounded-xl border bg-elevated p-4">
          <p class="text-sm text-muted">Saldo pendiente</p>
          <p class="text-3xl font-bold text-default">{{ formatPrice(totalPending) }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <h2 class="text-lg font-semibold text-default">Mis cursos</h2>
          <div v-if="enrollments.length === 0" class="rounded-xl border bg-elevated p-4 text-muted">
            Aún no tienes cursos inscritos.
          </div>
          <div v-for="enrollment in enrollments" :key="enrollment.id"
            class="space-y-3 rounded-xl border bg-elevated p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-semibold text-default">{{ enrollment.courseName }}</p>
                <p v-if="enrollment.courseDescription" class="text-sm text-muted">{{ enrollment.courseDescription }}</p>
              </div>
              <span v-if="enrollment.paymentType"
                class="rounded-full bg-accented px-2 py-0.5 text-xs font-medium text-toned">{{ enrollment.paymentType
                }}</span>
            </div>
            <div>
              <div class="flex justify-between text-sm">
                <span class="text-muted">Progreso</span>
                <span class="font-semibold text-default">{{ enrollment.progress }}%</span>
              </div>
              <div class="mt-1 h-2 rounded-full bg-accented">
                <div class="h-2 rounded-full bg-primary" :style="{ width: enrollment.progress + '%' }" />
              </div>
              <p class="mt-1 text-xs text-muted">{{ enrollment.completedTopics }} de {{ enrollment.totalTopics }}
                lecciones completadas</p>
            </div>
            <UButton :to="`/detail/course/${enrollment.courseId}`" color="primary" variant="soft" size="sm">Ver curso
            </UButton>
          </div>
        </div>

        <div class="space-y-4">
          <div class="space-y-3 rounded-xl border bg-elevated p-4">
            <h2 class="text-lg font-semibold text-default">Mis pagos</h2>
            <p v-if="lastPayment" class="text-sm text-toned">
              Último pago: {{ formatDate(lastPayment.payment_date) }} · {{ formatPrice(lastPayment.amount_paid) }}
            </p>
            <p v-else class="text-sm text-muted">Aún no tienes pagos registrados.</p>
            <p class="text-sm text-toned">Saldo pendiente: <span class="font-semibold text-default">{{
              formatPrice(totalPending) }}</span></p>
            <UButton to="/add/payment" color="primary" block>Pagar ahora</UButton>
          </div>

          <div class="space-y-2 rounded-xl border bg-elevated p-4">
            <h2 class="text-lg font-semibold text-default">Próximo seguimiento</h2>
            <template v-if="nextFollowUp">
              <p class="font-medium text-default">{{ formatDate(nextFollowUp.next_contact) }} · {{
                formatTime(nextFollowUp.next_contact) }}</p>
              <p class="text-sm text-toned">Asesor: {{ nextFollowUp.advisorName }}</p>
              <p class="text-sm text-toned">Tema: {{ nextFollowUp.typeName }}</p>
              <p v-if="nextFollowUp.notes" class="text-sm text-muted">{{ nextFollowUp.notes }}</p>
            </template>
            <p v-else class="text-sm text-muted">No tienes seguimientos próximos.</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabase()
const { name: clientName } = useProfile()

interface EnrollmentRow {
  id: number
  course_id: number
  agreed_price: number
  payment_type: string | null
  courses: { id: number, name: string, description: string | null } | { id: number, name: string, description: string | null }[] | null
  payments: { amount_paid: number, payment_date: string }[] | null
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const formatPrice = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(amount)
const formatDate = (value: string) => new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const formatTime = (value: string) => new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

const { data, pending, error } = await useAsyncData('client-home', async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const userId = user.id

  const [enrollmentsRes, followUpRes] = await Promise.all([
    supabase.from('enrollments')
      .select('id, course_id, agreed_price, payment_type, courses(id, name, description), payments(amount_paid, payment_date)')
      .eq('client_id', userId)
      .order('enrollment_date', { ascending: false }),
    supabase.from('follow_ups')
      .select('next_contact, notes, advisor_id, follow_up_types(name)')
      .eq('client_id', userId)
      .gte('next_contact', new Date().toISOString())
      .order('next_contact', { ascending: true })
      .limit(1)
      .maybeSingle()
  ])

  console.log('client-home errors:', {
    enrollments: enrollmentsRes.error,
    followUp: followUpRes.error
  })

  const enrollments = (enrollmentsRes.data ?? []) as EnrollmentRow[]
  const enrollmentIds = enrollments.map(e => e.id)
  const courseIds = [...new Set(enrollments.map(e => e.course_id))]

  const [topicsRes, progressRes, advisorRes] = await Promise.all([
    courseIds.length
      ? supabase.from('topics').select('id, course_id').in('course_id', courseIds)
      : Promise.resolve({ data: [] as { id: number, course_id: number }[] }),
    enrollmentIds.length
      ? supabase.from('topic_progress').select('enrollment_id, completed').in('enrollment_id', enrollmentIds)
      : Promise.resolve({ data: [] as { enrollment_id: number, completed: boolean }[] }),
    followUpRes.data?.advisor_id
      ? supabase.from('users').select('name').eq('id', followUpRes.data.advisor_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null })
  ])

  const topicsByCourse = new Map<number, number>()
  for (const topic of topicsRes.data ?? []) {
    topicsByCourse.set(topic.course_id, (topicsByCourse.get(topic.course_id) ?? 0) + 1)
  }
  const completedByEnrollment = new Map<number, number>()
  for (const row of progressRes.data ?? []) {
    if (row.completed) completedByEnrollment.set(row.enrollment_id, (completedByEnrollment.get(row.enrollment_id) ?? 0) + 1)
  }

  const mapped = enrollments.map((e) => {
    const course = first(e.courses)
    const payments = e.payments ?? []
    const paid = payments.reduce((sum, p) => sum + Number(p.amount_paid ?? 0), 0)
    const remaining = Number(e.agreed_price ?? 0) - paid
    const totalTopics = topicsByCourse.get(e.course_id) ?? 0
    const completedTopics = completedByEnrollment.get(e.id) ?? 0
    return {
      id: e.id,
      courseId: course?.id ?? e.course_id,
      courseName: course?.name ?? 'Curso',
      courseDescription: course?.description ?? null,
      paymentType: e.payment_type,
      paid,
      remaining,
      totalTopics,
      completedTopics,
      progress: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0
    }
  })

  const totalPaid = mapped.reduce((sum, e) => sum + e.paid, 0)
  // Saldo pendiente con tu regla: solo inscripciones Parcial con saldo
  const totalPending = mapped.reduce((sum, e) => sum + (e.paymentType === 'Parcial' && e.remaining > 0 ? e.remaining : 0), 0)

  const allPayments = enrollments.flatMap(e => e.payments ?? [])
  allPayments.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
  const lastPayment = allPayments[0] ?? null

  const followUp = followUpRes.data
  const nextFollowUp = followUp
    ? {
      next_contact: followUp.next_contact,
      notes: followUp.notes,
      typeName: first(followUp.follow_up_types)?.name ?? '',
      advisorName: advisorRes.data?.name ?? ''
    }
    : null

  return {
    enrollments: mapped,
    totalPaid,
    totalPending,
    lastPayment,
    nextFollowUp
  }
}, { default: () => null, server: false })

const greeting = computed(() => clientName.value ? `Hola, ${clientName.value}` : 'Hola')
const enrollments = computed(() => data.value?.enrollments ?? [])
const totalPaid = computed(() => data.value?.totalPaid ?? 0)
const totalPending = computed(() => data.value?.totalPending ?? 0)
const lastPayment = computed(() => data.value?.lastPayment ?? null)
const nextFollowUp = computed(() => data.value?.nextFollowUp ?? null)
</script>
