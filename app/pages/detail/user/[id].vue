<template>
  <div class="w-full space-y-6 pb-2">
    <div class="flex items-center justify-between px-4 pt-2">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="navigateTo('/users')">
        Users
      </UButton>
      <UButton v-if="detail && isStaff" icon="i-lucide-pencil" color="primary" variant="soft"
        @click="navigateTo(`/edit/user/${detail.user.id}`)">
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
      <p class="text-center text-muted">User not found.</p>
    </UCard>

    <div v-else class="space-y-6">
      <!-- Datos del usuario -->
      <UCard class="mx-4">
        <template #header>
          <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold">{{ detail.user.name }}</h1>
            <div class="flex gap-2">
              <UBadge :color="roleColor(detail.user.user_types?.name)" :label="detail.user.user_types?.name ?? '—'" />
              <UBadge :color="detail.user.active ? 'success' : 'neutral'"
                :label="detail.user.active ? 'Active' : 'Inactive'" />
            </div>
          </div>
        </template>

        <div class="flex flex-wrap gap-6">
          <div>
            <p class="text-sm text-muted">Email</p>
            <p class="font-medium">{{ detail.user.email }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Phone</p>
            <p class="font-medium">{{ detail.user.phone ?? '—' }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Created by</p>
            <p class="font-medium">{{ detail.createdByName ?? '—' }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Created at</p>
            <p class="font-medium">{{ formatDateTime(detail.user.created_at) }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Updated at</p>
            <p class="font-medium">{{ formatDateTime(detail.user.updated_at) }}</p>
          </div>
        </div>
      </UCard>

      <!-- Inscripciones (si es cliente) -->
      <UCard v-if="detail.enrollments.length" class="mx-4">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">Enrollments</h2>
            <span class="text-sm text-muted">
              Total: {{ formatPrice(detail.totalAgreed) }} · Paid: {{ formatPrice(detail.totalPaid) }} · Debt: {{ formatPrice(detail.totalAgreed - detail.totalPaid) }}
            </span>
          </div>
        </template>

        <ul class="space-y-2">
          <li v-for="enrollment in detail.enrollments" :key="enrollment.id"
            class="flex items-center justify-between border-b border-default pb-2 last:border-0 last:pb-0">
            <div>
              <ULink :to="`/detail/course/${enrollment.course_id}`" class="font-medium text-primary">
                {{ enrollment.courses?.name ?? '—' }}
              </ULink>
              <p class="text-sm text-muted">
                {{ enrollment.enrollment_statuses?.name ?? '—' }} · {{ formatDate(enrollment.enrollment_date) }}
              </p>
            </div>
            <div class="text-right">
              <p class="font-medium">{{ formatPrice(enrollment.agreed_price) }}</p>
              <p class="text-sm text-muted">Paid {{ formatPrice(enrollment.paid) }} · Due {{ formatPrice(enrollment.remaining) }}</p>
            </div>
          </li>
        </ul>
      </UCard>

      <!-- Usuarios creados por este usuario -->
      <UCard v-if="detail.createdUsers.length" class="mx-4">
        <template #header>
          <h2 class="font-semibold">Created users</h2>
        </template>

        <ul class="space-y-2">
          <li v-for="created in detail.createdUsers" :key="created.id"
            class="flex items-center justify-between border-b border-default pb-2 last:border-0 last:pb-0">
            <ULink :to="`/detail/user/${created.id}`" class="font-medium text-primary">
              {{ created.name }}
            </ULink>
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted">{{ created.email }}</span>
              <UBadge color="neutral" variant="soft" :label="created.user_types?.name ?? '—'" />
            </div>
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

interface UserDetailRow {
  id: string
  name: string
  email: string
  phone: string | null
  user_type_id: number
  created_by: string | null
  active: boolean
  created_at: string
  updated_at: string
  user_types: { name: string } | null
}

interface EnrollmentRow {
  id: number
  agreed_price: number
  enrollment_date: string
  course_id: number
  courses: { name: string } | null
  enrollment_statuses: { name: string } | null
  payments: { amount: number }[]
}

interface CreatedUserRow {
  id: string
  name: string
  email: string
  user_types: { name: string } | null
}

const supabase = useSupabase()
const route = useRoute()
const { isStaff } = useRole()

const userId = route.params.id as string

const { data: detail, pending } = useAsyncData(`user-${userId}`, async () => {
  const { data, error } = await supabase.from('users')
    .select('*, user_types(name)')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  const user = data as unknown as UserDetailRow

  // Creado por
  let createdByName: string | null = null
  if (user.created_by) {
    const { data: creator } = await supabase.from('users').select('name').eq('id', user.created_by).single()
    createdByName = (creator as unknown as { name: string } | null)?.name ?? null
  }

  // Inscripciones (si es cliente) con lo pagado de cada una
  const { data: enrs } = await supabase.from('enrollments')
    .select('id, agreed_price, enrollment_date, course_id, courses(name), enrollment_statuses(name), payments(amount)')
    .eq('client_id', userId)
    .order('enrollment_date', { ascending: false })
  const enrollments = ((enrs ?? []) as unknown as EnrollmentRow[]).map(e => {
    const paid = (e.payments ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
    return { ...e, paid, remaining: Number(e.agreed_price ?? 0) - paid }
  })

  // Usuarios creados por este usuario
  const { data: created } = await supabase.from('users')
    .select('id, name, email, user_types(name)')
    .eq('created_by', userId)
    .order('name', { ascending: true })
  const createdUsers = (created ?? []) as unknown as CreatedUserRow[]

  return {
    user,
    createdByName,
    enrollments,
    createdUsers,
    totalAgreed: enrollments.reduce((sum, e) => sum + Number(e.agreed_price ?? 0), 0),
    totalPaid: enrollments.reduce((sum, e) => sum + e.paid, 0)
  }
})

function roleColor(name?: string | null) {
  if (name === 'Admin') return 'primary'
  if (name === 'Head Advisor') return 'info'
  if (name === 'Advisor') return 'success'
  return 'neutral'
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(price ?? 0))
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US')
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>
