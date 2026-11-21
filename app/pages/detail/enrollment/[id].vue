<template>
  <div class="w-full space-y-6 pb-2">
    <div class="flex items-center justify-between px-4 pt-2">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="navigateTo('/enrollments')">
        Enrollments
      </UButton>
      <UButton v-if="detail && isStaff" icon="i-lucide-pencil" color="primary" variant="soft"
        @click="navigateTo(`/edit/enrollment/${detail.enrollment.id}`)">
      </UButton>
    </div>

    <!-- Cargando -->
    <div v-if="pending" class="space-y-4 px-4" >
      <USkeleton class="h-8 w-1/3" />
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <!-- No encontrado -->
    <UCard v-else-if="!detail" class="mx-4">
      <p class="text-center text-muted">Enrollment not found.</p>
    </UCard>

    <div v-else class="space-y-6">
      <!-- Datos de la inscripción -->
      <UCard class="mx-4">
        <template #header>
          <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold">{{ detail.enrollment.clients?.users?.name ?? '—' }}</h1>
            <UBadge :color="statusColor(detail.enrollment.enrollment_statuses?.name)"
              :label="detail.enrollment.enrollment_statuses?.name ?? '—'" />
          </div>
        </template>

        <div class="flex flex-wrap gap-6">
          <div>
            <p class="text-sm text-muted">Course</p>
            <ULink :to="`/detail/course/${detail.enrollment.course_id}`" class="font-medium text-primary">
              {{ detail.enrollment.courses?.name ?? '—' }}
            </ULink>
          </div>
          <div>
            <p class="text-sm text-muted">Agreed price</p>
            <p class="font-medium">{{ formatPrice(detail.enrollment.agreed_price) }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Payment type</p>
            <p class="font-medium">{{ detail.enrollment.payment_type }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Enrollment date</p>
            <p class="font-medium">{{ formatDate(detail.enrollment.enrollment_date) }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Enrolled by</p>
            <p class="font-medium">{{ detail.enrolledBy ?? '—' }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Total paid</p>
            <p class="font-medium">{{ formatPrice(detail.totalPaid) }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Remaining</p>
            <p class="font-medium">{{ formatPrice(detail.remaining) }}</p>
          </div>
        </div>
      </UCard>

      <!-- Progreso de temas -->
      <UCard class="mx-4">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">Topic progress</h2>
            <span class="text-sm text-muted">{{ detail.completedCount }} of {{ detail.topics.length }} completed</span>
          </div>
        </template>

        <UProgress :value="detail.completedCount" :max="detail.topics.length" class="mb-4" />

        <p v-if="!detail.topics.length" class="text-muted">This course has no topics yet.</p>

        <ul v-else class="space-y-2">
          <li v-for="topic in detail.topics" :key="topic.id" class="flex items-center gap-2">
            <UIcon :name="topic.completed ? 'i-lucide-check-circle' : 'i-lucide-circle'"
              :class="topic.completed ? 'text-success' : 'text-muted'" class="size-5" />
            <span :class="topic.completed ? '' : 'text-muted'">{{ topic.position }}. {{ topic.name }}</span>
          </li>
        </ul>
      </UCard>

      <!-- Pagos -->
      <UCard class="mx-4">
        <template #header>
          <h2 class="font-semibold">Payments</h2>
        </template>

        <p v-if="!detail.payments.length" class="text-muted">No payments yet.</p>

        <ul v-else class="space-y-2">
          <li v-for="payment in detail.payments" :key="payment.id"
            class="flex items-center justify-between border-b border-default pb-2 last:border-0 last:pb-0">
            <span class="font-medium">{{ formatPrice(payment.amount_paid) }}</span>
            <span class="text-sm text-muted">{{ formatDate(payment.payment_date ?? payment.created_at) }}</span>
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

interface EnrollmentDetailRow {
  id: number
  client_id: string
  course_id: number
  agreed_price: number
  payment_type: string
  enrollment_date: string
  status_id: number | null
  courses: { name: string } | null
  clients: { users: { name: string, created_by: string | null } | null } | null
  enrollment_statuses: { name: string } | null
}

interface PaymentRow {
  id: number
  amount_paid: number
  payment_date?: string | null
  created_at?: string | null
}

const supabase = useSupabase()
const route = useRoute()
const { isStaff } = useRole()

const enrollmentId = route.params.id as string

const { data: detail, pending } = useAsyncData(`enrollment-${enrollmentId}`, async () => {
  // La consulta depende de la sesión (RLS): solo en el navegador.
  // En el servidor no hay sesión y el fetch se puede quedar colgado.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  const { data, error } = await supabase.from('enrollments')
    .select('*, courses(name), clients(users(name, created_by)), enrollment_statuses(name)')
    .eq('id', enrollmentId)
    .abortSignal(controller.signal)
    .single()
  clearTimeout(timeout)
  if (error || !data) {
    console.error('enrollment detail error:', error)
    return null
  }
  const enrollment = data as unknown as EnrollmentDetailRow

  // Enrolled by: el usuario que creó al cliente
  let enrolledBy: string | null = null
  const createdBy = enrollment.clients?.users?.created_by
  if (createdBy) {
    const { data: advisor } = await supabase.from('users').select('name').eq('id', createdBy).single()
    enrolledBy = (advisor as unknown as { name: string } | null)?.name ?? null
  }

  // Pagos
  const { data: pays } = await supabase.from('payments')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('id', { ascending: false })
  const payments = (pays ?? []) as unknown as PaymentRow[]
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_paid ?? 0), 0)

  // Temas del curso + progreso
  const { data: courseTopics } = await supabase.from('topics')
    .select('id, name, position')
    .eq('course_id', enrollment.course_id)
    .order('position', { ascending: true })
  const { data: prog } = await supabase.from('topic_progress')
    .select('topic_id, completed')
    .eq('enrollment_id', enrollmentId)
  const progressMap = new Map(((prog ?? []) as unknown as { topic_id: number, completed: boolean }[])
    .map(r => [r.topic_id, !!r.completed]))
  const topics = ((courseTopics ?? []) as unknown as { id: number, name: string, position: number }[])
    .map(t => ({ ...t, completed: progressMap.get(t.id) ?? false }))

  return {
    enrollment,
    enrolledBy,
    payments,
    totalPaid,
    remaining: Number(enrollment.agreed_price ?? 0) - totalPaid,
    topics,
    completedCount: topics.filter(t => t.completed).length
  }
}, { server: false })

function statusColor(name?: string | null) {
  if (name === 'Active') return 'success'
  if (name === 'Completed') return 'primary'
  if (name === 'Cancelled') return 'error'
  return 'neutral'
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(price ?? 0))
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US')
}
</script>
