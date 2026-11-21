<template>
  <div class="w-full space-y-6 pb-2">
    <div class="flex items-center justify-between px-4 pt-2">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="navigateTo('/payments')">
        Payments
      </UButton>
      <UButton v-if="detail && canEditPayment" icon="i-lucide-pencil" color="primary" variant="soft"
        @click="navigateTo(`/edit/payment/${detail.payment.id}`)">
      </UButton>
    </div>

    <!-- Cargando -->
    <div v-if="pending" class="space-y-4 px-4">
      <USkeleton class="h-8 w-1/3" />
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <!-- No encontrado -->
    <UCard v-else-if="!detail" class="mx-4">
      <p class="text-center text-muted">Payment not found.</p>
    </UCard>

    <div v-else class="space-y-6">
      <!-- Datos del pago -->
      <UCard class="mx-4">
        <template #header>
          <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold">{{ formatPrice(detail.payment.amount_paid) }}</h1>
            <UBadge color="primary" variant="soft" :label="detail.payment.payment_methods?.name ?? '—'" />
          </div>
        </template>

        <div class="flex flex-wrap gap-6">
          <div>
            <p class="text-sm text-muted">Payment date</p>
            <p class="font-medium">{{ formatDate(detail.payment.payment_date) }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Client</p>
            <p class="font-medium">{{ detail.payment.enrollments?.clients?.users?.name ?? '—' }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Course</p>
            <ULink v-if="detail.payment.enrollments?.course_id" :to="`/detail/course/${detail.payment.enrollments.course_id}`" class="font-medium text-primary">
              {{ detail.payment.enrollments?.courses?.name ?? '—' }}
            </ULink>
            <p v-else class="font-medium">—</p>
          </div>
          <div>
            <p class="text-sm text-muted">Enrollment</p>
            <ULink v-if="detail.payment.enrollments" :to="`/detail/enrollment/${detail.payment.enrollments.id}`" class="font-medium text-primary">
              #{{ detail.payment.enrollments.id }}
            </ULink>
            <p v-else class="font-medium">—</p>
          </div>
          <div>
            <p class="text-sm text-muted">Payment type</p>
            <p class="font-medium">{{ detail.payment.enrollments?.payment_type ?? '—' }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Agreed price</p>
            <p class="font-medium">{{ detail.payment.enrollments ? formatPrice(detail.payment.enrollments.agreed_price) : '—' }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Total paid</p>
            <p class="font-medium">{{ formatPrice(detail.totalPaid) }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Remaining</p>
            <p class="font-medium">{{ detail.remaining !== null ? formatPrice(detail.remaining) : '—' }}</p>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

interface PaymentDetailRow {
  id: number
  enrollment_id: number
  payment_method_id: number
  amount_paid: number
  payment_date: string
  payment_methods: { name: string } | null
  enrollments: {
    id: number
    course_id: number
    agreed_price: number
    payment_type: string
    courses: { name: string } | null
    clients: { users: { name: string } | null } | null
  } | null
}

const supabase = useSupabase()
const route = useRoute()
const { isAdmin, isHeadAdvisor } = useRole()

const paymentId = route.params.id as string
const canEditPayment = computed(() => isAdmin.value || isHeadAdvisor.value)

const { data: detail, pending } = useAsyncData(`payment-${paymentId}`, async () => {
  // La consulta depende de la sesión (RLS): solo en el navegador.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  const { data, error } = await supabase.from('payments')
    .select('*, payment_methods(name), enrollments(id, course_id, agreed_price, payment_type, courses(name), clients(users(name)))')
    .eq('id', paymentId)
    .abortSignal(controller.signal)
    .single()
  clearTimeout(timeout)
  if (error || !data) {
    console.error('payment detail error:', error)
    return null
  }
  const payment = data as unknown as PaymentDetailRow

  // Total pagado de la inscripción (todos sus pagos)
  const { data: pays } = await supabase.from('payments')
    .select('amount_paid')
    .eq('enrollment_id', payment.enrollment_id)
  const totalPaid = ((pays ?? []) as unknown as { amount_paid: number }[])
    .reduce((sum, p) => sum + Number(p.amount_paid ?? 0), 0)

  return {
    payment,
    totalPaid,
    remaining: payment.enrollments ? Number(payment.enrollments.agreed_price ?? 0) - totalPaid : null
  }
}, { server: false })

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(price ?? 0))
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US')
}
</script>
