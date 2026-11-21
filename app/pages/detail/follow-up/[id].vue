<template>
  <div class="w-full space-y-6 pb-2">
    <div class="flex items-center justify-between px-4 pt-2">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="navigateTo('/follow-up')">
        Follow-ups
      </UButton>
      <UButton v-if="detail && isStaff" icon="i-lucide-pencil" color="primary" variant="soft"
        @click="navigateTo(`/edit/follow-up/${detail.followUp.id}`)">
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
      <p class="text-center text-muted">Follow-up not found.</p>
    </UCard>

    <div v-else class="space-y-6">
      <!-- Datos del seguimiento -->
      <UCard class="mx-4">
        <template #header>
          <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold">{{ detail.followUp.clients?.users?.name ?? '—' }}</h1>
            <UBadge color="primary" variant="soft" :label="detail.followUp.follow_up_types?.name ?? '—'" />
          </div>
        </template>

        <div class="flex flex-wrap gap-6">
          <div>
            <p class="text-sm text-muted">Advisor</p>
            <p class="font-medium">{{ detail.advisorName ?? '—' }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Date</p>
            <p class="font-medium">{{ formatDateTime(detail.followUp.date) }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">Next contact</p>
            <p class="font-medium">{{ formatDateTime(detail.followUp.next_contact) }}</p>
          </div>
        </div>

        <div class="mt-4">
          <p class="text-sm text-muted">Notes</p>
          <p v-if="detail.followUp.notes" class="whitespace-pre-wrap">{{ detail.followUp.notes }}</p>
          <p v-else class="italic text-muted">No notes.</p>
        </div>
      </UCard>

      <!-- Historial del cliente -->
      <UCard class="mx-4">
        <template #header>
          <h2 class="font-semibold">Client history</h2>
        </template>

        <p v-if="!detail.history.length" class="text-muted">No previous follow-ups for this client.</p>

        <ul v-else class="space-y-2">
          <li v-for="item in detail.history" :key="item.id"
            class="flex items-center justify-between border-b border-default pb-2 last:border-0 last:pb-0">
            <ULink :to="`/detail/follow-up/${item.id}`" class="font-medium text-primary">
              {{ item.follow_up_types?.name ?? 'Follow-up' }}
            </ULink>
            <span class="text-sm text-muted">{{ formatDateTime(item.date) }}</span>
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

interface FollowUpDetailRow {
  id: number
  client_id: string
  follow_up_type_id: number
  advisor_id: string
  date: string
  next_contact: string | null
  notes: string | null
  clients: { users: { name: string } | null } | null
  follow_up_types: { name: string } | null
}

interface HistoryRow {
  id: number
  date: string
  next_contact: string | null
  follow_up_types: { name: string } | null
}

const supabase = useSupabase()
const route = useRoute()
const { isStaff } = useRole()

const followUpId = route.params.id as string

const { data: detail, pending } = useAsyncData(`follow-up-${followUpId}`, async () => {
  const { data, error } = await supabase.from('follow_ups')
    .select('*, clients(users(name)), follow_up_types(name)')
    .eq('id', followUpId)
    .single()
  if (error || !data) return null
  const followUp = data as unknown as FollowUpDetailRow

  // Nombre del asesor
  let advisorName: string | null = null
  if (followUp.advisor_id) {
    const { data: advisor } = await supabase.from('users').select('name').eq('id', followUp.advisor_id).single()
    advisorName = (advisor as unknown as { name: string } | null)?.name ?? null
  }

  // Historial del cliente (sin este seguimiento)
  const { data: hist } = await supabase.from('follow_ups')
    .select('id, date, next_contact, follow_up_types(name)')
    .eq('client_id', followUp.client_id)
    .neq('id', followUpId)
    .order('date', { ascending: false })
    .limit(5)
  const history = (hist ?? []) as unknown as HistoryRow[]

  return { followUp, advisorName, history }
})

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>
