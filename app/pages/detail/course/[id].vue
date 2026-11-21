<template>
  <div class="w-full space-y-6 pb-2">
    <div class="flex items-center justify-between px-4 pt-2">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="navigateTo('/course')">
        Courses
      </UButton>
      <UButton v-if="course && canEditCourse" icon="i-lucide-pencil" color="primary" variant="soft"
        @click="navigateTo(`/edit/course/${course.id}`)">
      </UButton>
    </div>

    <!-- Cargando -->
    <div v-if="pending" class="space-y-4 px-4">
      <USkeleton class="h-8 w-1/3" />
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <!-- No encontrado -->
    <UCard v-else-if="!course" class="mx-4">
      <p class="text-center text-muted">Course not found.</p>
    </UCard>

    <template v-else>
      <!-- Datos del curso -->
      <UCard class="mx-4">
        <template #header>
          <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold">{{ course.name }}</h1>
            <UBadge :color="course.active ? 'success' : 'neutral'" :label="course.active ? 'Active' : 'Inactive'" />
          </div>
        </template>

        <p v-if="course.description" class="text-muted">{{ course.description }}</p>
        <p v-else class="italic text-muted">No description.</p>

        <div class="mt-4 flex flex-wrap gap-6">
          <div>
            <p class="text-sm text-muted">Price</p>
            <p class="font-medium">{{ formatPrice(course.price) }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Duration</p>
            <p class="font-medium">{{ course.duration ? `${course.duration} weeks` : '—' }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Enrolled</p>
            <p class="font-medium">{{ enrolledCount }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Topics</p>
            <p class="font-medium">{{ topics.length }}</p>
          </div>
          <div v-if="canMarkProgress">
            <p class="text-sm text-muted">My progress</p>
            <p class="font-medium">{{ completedCount }} of {{ topics.length }} topics · {{ progressPercent }}%</p>
            <div class="mt-1 h-2 w-48 rounded-full bg-accented">
              <div class="h-2 rounded-full bg-primary" :style="{ width: progressPercent + '%' }" />
            </div>
          </div>
        </div>
      </UCard>

      <!-- Temas -->
      <UCard class="mx-4">
        <template #header>
          <h2 class="font-semibold">Topics</h2>
        </template>

        <p v-if="!topics.length" class="text-muted">This course has no topics yet.</p>

        <p v-if="toggleError" class="mb-3 text-sm text-red-500">{{ toggleError }}</p>

        <UAccordion v-else :items="accordionItems">
          <template #leading="{ item }">
            <UIcon v-if="canMarkProgress" :name="isTopicCompleted(item.id) ? 'i-lucide-check' : 'i-lucide-circle'" :class="isTopicCompleted(item.id) ? 'text-success' : 'text-muted'" class="size-5" />
          </template>
          <template #content="{ item }">
            <div class="space-y-2">
              <UBadge color="neutral" variant="soft" :label="`Content version ${item.version}`" />
              <p class="whitespace-pre-wrap text-sm">{{ item.content }}</p>
              <div v-if="canMarkProgress" class="flex flex-wrap items-center gap-3 border-t pt-3">
                <UCheckbox
                  :model-value="isTopicCompleted(item.id)"
                  :disabled="toggling === item.id"
                  label="Mark as completed"
                  @update:model-value="toggleTopic(item.id, $event)"
                />
                <span v-if="isTopicCompleted(item.id) && topicCompletedAt(item.id)" class="text-xs text-muted">
                  Completed {{ formatDate(topicCompletedAt(item.id)) }}
                </span>
              </div>
            </div>
          </template>
        </UAccordion>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const route = useRoute()
const { isAdmin, isHeadAdvisor, isClient } = useRole()

const courseId = route.params.id as string
const canEditCourse = computed(() => isAdmin.value || isHeadAdvisor.value)

const { data: course, pending } = useAsyncData(`course-${courseId}`, async () => {
  const { data, error } = await supabase.from('courses').select('*').eq('id', courseId).single()
  if (error) return null
  return data
})

const { data: topics } = useAsyncData(`course-topics-${courseId}`, async () => {
  const { data } = await supabase.from('topics')
    .select('id, name, position, content, content_version')
    .eq('course_id', courseId)
    .order('position', { ascending: true })
  return data ?? []
}, { default: () => [] })

const { data: enrolledCount } = useAsyncData(`course-enrolled-${courseId}`, async () => {
  const { count } = await supabase.from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
  return count ?? 0
}, { default: () => 0 })

// ── Progreso del cliente en este curso ──────────────
const enrollmentId = ref<number | null>(null)
const progressMap = ref<Record<number, { completed: boolean, completed_at: string | null }>>({})
const toggling = ref<number | null>(null)
const toggleError = ref('')

useAsyncData(`course-progress-${courseId}`, async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: enrollment } = await supabase.from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('client_id', user.id)
    .maybeSingle()
  if (!enrollment) return null
  enrollmentId.value = enrollment.id
  const { data: rows } = await supabase.from('topic_progress')
    .select('topic_id, completed, completed_at')
    .eq('enrollment_id', enrollment.id)
  const map: Record<number, { completed: boolean, completed_at: string | null }> = {}
  for (const row of rows ?? []) {
    map[row.topic_id] = { completed: row.completed, completed_at: row.completed_at }
  }
  progressMap.value = map
  return map
}, { server: false })

// Solo el cliente inscrito en este curso puede marcar sus temas
const canMarkProgress = computed(() => isClient.value && enrollmentId.value !== null)
const completedCount = computed(() => Object.values(progressMap.value).filter(p => p.completed).length)
const progressPercent = computed(() => topics.value.length > 0 ? Math.round((completedCount.value / topics.value.length) * 100) : 0)

function isTopicCompleted(topicId: number) {
  return !!progressMap.value[topicId]?.completed
}

function topicCompletedAt(topicId: number) {
  return progressMap.value[topicId]?.completed_at ?? null
}

async function toggleTopic(topicId: number, completed: boolean) {
  if (!enrollmentId.value || toggling.value !== null) return
  const previous = progressMap.value[topicId]
  progressMap.value = {
    ...progressMap.value,
    [topicId]: { completed, completed_at: completed ? new Date().toISOString() : null }
  }
  toggling.value = topicId
  toggleError.value = ''
  const { error } = await supabase.functions.invoke('toggle-topic-progress', {
    body: { topic_id: topicId, completed }
  })
  toggling.value = null
  if (error) {
    const next = { ...progressMap.value }
    if (previous) next[topicId] = previous
    else delete next[topicId]
    progressMap.value = next
    toggleError.value = 'No se pudo guardar el cambio. Intenta de nuevo.'
  }
}

const accordionItems = computed(() => (topics.value ?? []).map(t => ({
  id: t.id,
  label: `${t.position}. ${t.name}`,
  content: t.content,
  version: t.content_version
})))

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(price))
}

function formatDate(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>
