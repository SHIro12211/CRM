<template>

  <div class="w-full space-y-6 px-4 pb-2 pt-2">
    <!-- Solo staff -->
    <div v-if="role === 'Client'">
      <ClientHome />
    </div>
    <div v-else-if="role !== `Client`">

      <!-- Cargando -->
      <div v-if="pending" class="space-y-4">
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <USkeleton class="h-24 w-full" />
          <USkeleton class="h-24 w-full" />
          <USkeleton class="h-24 w-full" />
          <USkeleton class="h-24 w-full" />
        </div>
        <USkeleton class="h-64 w-full" />
        <USkeleton class="h-64 w-full" />
      </div>

      <!-- Error -->
      <UCard v-else-if="!stats">
        <p class="text-center text-muted">No se pudieron cargar los datos del panel.</p>
      </UCard>
      <!-- Dashboard -->
      <div v-else class="space-y-6">
        <!-- KPIs -->
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <UCard>
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-users" class="size-8 text-primary" />
              <div>
                <p class="text-sm text-muted">Asesores activos</p>
                <p class="text-2xl font-semibold">{{ stats.advisorsCount }}</p>
              </div>
            </div>
          </UCard>
          <UCard>
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-graduation-cap" class="size-8 text-primary" />
              <div>
                <p class="text-sm text-muted">Estudiantes</p>
                <p class="text-2xl font-semibold">{{ stats.studentsCount }}</p>
              </div>
            </div>
          </UCard>
          <UCard>
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-clipboard-list" class="size-8 text-primary" />
              <div>
                <p class="text-sm text-muted">Inscripciones</p>
                <p class="text-2xl font-semibold">{{ stats.totalEnrollments }}</p>
              </div>
            </div>
          </UCard>
          <UCard>
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-dollar-sign" class="size-8 text-primary" />
              <div>
                <p class="text-sm text-muted">Ingresos</p>
                <p class="text-2xl font-semibold">{{ formatPrice(stats.totalRevenue) }}</p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Top cursos + Donut -->
        <div class="grid gap-6 lg:grid-cols-2">
          <UCard>
            <template #header>
              <h2 class="font-semibold">Cursos más vendidos</h2>
            </template>
            <p v-if="!stats.topCourses.length" class="text-muted">Aún no hay inscripciones.</p>
            <ul v-else class="space-y-4">
              <li v-for="(course, i) in stats.topCourses" :key="course.name">
                <div class="mb-1 flex items-center justify-between">
                  <span class="font-medium">{{ i + 1 }}. {{ course.name }}</span>
                  <span class="text-sm text-muted">{{ course.count }} vendidos · {{ formatPrice(course.revenue)
                  }}</span>
                </div>
                <UProgress :value="course.count" :max="stats.maxCount" />
              </li>
            </ul>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-semibold">Ventas por curso</h2>
            </template>
            <p v-if="!stats.byCourse.length" class="text-muted">Aún no hay inscripciones.</p>
            <UChart v-else type="donut" :data="stats.byCourse" index="course"
              :categories="[{ key: 'sales', label: 'Ventas' }]" :height="280">
              <template #center>
                <div class="text-center">
                  <p class="text-2xl font-semibold">{{ stats.totalEnrollments }}</p>
                  <p class="text-sm text-muted">Inscripciones</p>
                </div>
              </template>
            </UChart>
          </UCard>
        </div>

        <!-- Ventas por mes -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">Cursos vendidos por mes</h2>
          </template>
          <UChart type="bar" :data="stats.monthly" index="month"
            :categories="[{ key: 'sales', label: 'Cursos vendidos' }]" :height="280" />
        </UCard>

        <!-- Próximos seguimientos -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">Próximos seguimientos</h2>
          </template>
          <p v-if="!stats.followUps.length" class="text-muted">No hay seguimientos próximos.</p>
          <UTable v-else :data="stats.followUps" :columns="followUpColumns" />
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'
definePageMeta({ middleware: 'auth' })
import ClientHome from '~/components/home/ClientHome.vue'
const { role } = useProfile()
const {isAdvisor} = useRole()


const supabase = useSupabase()


interface EnrollmentRow {
  id: number
  course_id: number
  agreed_price: number
  enrollment_date: string
  courses: { name: string } | null
}

interface FollowUpRow {
  id: number
  next_contact: string | null
  notes: string | null
  follow_up_types: { name: string } | null
  clients: { users: { name: string } | null } | null
  users: { name: string } | null
}



const followUpColumns = [
  {
    accessorKey: 'client',
    header: 'Cliente',
    cell: ({ row }: any) => h(resolveComponent('ULink'), {
      to: `/detail/follow-up/${row.original.id}`,
      class: 'font-medium text-primary'
    }, () => row.original.client)
  },
  { accessorKey: 'type', header: 'Tipo' },
  { accessorKey: 'advisor', header: 'Asesor' },
  { accessorKey: 'date', header: 'Fecha' },
  { accessorKey: 'notes', header: 'Notas' }
]

const { data: stats, pending } = useAsyncData('home-stats', async () => {
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const enrollmentsPromise = supabase.from('enrollments')
    .select('id, course_id, agreed_price, enrollment_date, courses(name)')
  const advisorsPromise = supabase.from('users')
    .select('id, user_types!inner(name)', { count: 'exact', head: true })
    .eq('active', true)
    .eq('user_types.name', 'Advisor')
  const studentsPromise = supabase.from('users')
    .select('id, user_types!inner(name)', { count: 'exact', head: true })
    .eq('user_types.name', 'Client')

  let followUpsQuery = supabase.from('follow_ups')
    .select('id, next_contact, notes, follow_up_types(name), clients(users(name)), users(name)')
    .gte('next_contact', new Date().toISOString())
    .order('next_contact', { ascending: true })
    .limit(10)
  // El Advisor ve solo sus seguimientos (RLS es la protección real; esto afina la vista)
  if (isAdvisor.value && authUser?.id) {
    followUpsQuery = followUpsQuery.eq('advisor_id', authUser.id)
  }

  const [
    { data: enrollmentsData },
    { count: advisorsCount },
    { count: studentsCount },
    { data: followUpsData }
  ] = await Promise.all([enrollmentsPromise, advisorsPromise, studentsPromise, followUpsQuery])

  const enrollments = (enrollmentsData ?? []) as unknown as EnrollmentRow[]

  // Cursos más vendidos + donut
  const byCourseMap = new Map<number, { name: string, count: number, revenue: number }>()
  for (const e of enrollments) {
    const name = Array.isArray(e.courses) ? (e.courses as any)[0]?.name : e.courses?.name
    const entry = byCourseMap.get(e.course_id) ?? { name: name ?? '—', count: 0, revenue: 0 }
    entry.count += 1
    entry.revenue += Number(e.agreed_price ?? 0)
    byCourseMap.set(e.course_id, entry)
  }
  const topCourses = [...byCourseMap.values()].sort((a, b) => b.count - a.count).slice(0, 5)
  const byCourse = [...byCourseMap.values()].map(c => ({ course: c.name, sales: c.count }))

  // Ventas por mes, últimos 6 meses
  const now = new Date()
  const months: { key: string, month: string, sales: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: label.charAt(0).toUpperCase() + label.slice(1),
      sales: 0
    })
  }
  const monthIndex = new Map(months.map(m => [m.key, m]))
  for (const e of enrollments) {
    // Se parsea el string 'YYYY-MM-DD' directo, sin new Date, para no mover el mes por zona horaria
    const [y, m] = (e.enrollment_date ?? '').split('-').map(Number)
    if (!y || !m) continue
    const monthRow = monthIndex.get(`${y}-${m - 1}`)
    if (monthRow) monthRow.sales += 1
  }
  const monthly = months.map(({ month, sales }) => ({ month, sales }))

  // Próximos seguimientos
  const followUps = ((followUpsData ?? []) as unknown as FollowUpRow[]).map(f => ({
    id: f.id,
    client: f.clients?.users?.name ?? '—',
    type: f.follow_up_types?.name ?? '—',
    advisor: f.users?.name ?? '—',
    date: formatDateTime(f.next_contact),
    notes: f.notes ?? ''
  }))

  return {
    advisorsCount: advisorsCount ?? 0,
    studentsCount: studentsCount ?? 0,
    totalEnrollments: enrollments.length,
    totalRevenue: enrollments.reduce((sum, e) => sum + Number(e.agreed_price ?? 0), 0),
    topCourses,
    maxCount: topCourses[0]?.count ?? 0,
    byCourse,
    monthly,
    followUps
  }
}, { default: () => null, server: false })

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(price ?? 0))
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>
