<template>
  <TitleView title="Follow-up" icon="i-lucide-phone-call" />
  <UBanner v-if="error" :title="error" color="error" />
  <DataTable :columns="columns" :data="followUpsList" new-element="follow-up" >
     <template #modal="{ item, action, close }">
      <!-- details modal for follow-up -->
      <div v-if="action === 'view'" class="p-4">
        <h3 class="text-lg font-bold mb-2">Follow-up Details</h3>
        <p><strong>Client:</strong> {{ item?.client }}</p>
        <p><strong>Type of Follow-up:</strong> {{ item?.type_follow_up }}</p>
        <p><strong>Adviser:</strong> {{ item?.adviser }}</p>
        <p><strong>Date:</strong> {{ item?.date }}</p>
        <p><strong>Next Follow-up:</strong> {{ item?.next_follow_up }}</p>
        <p><strong>Notes:</strong> {{ item?.notes }}</p>
        <div class="mt-4">
          <UButton color="primary" @click="close">Close</UButton>
        </div>
      </div>

      <div v-else-if="action === 'delete'">
        <h2 class="text-xl font-bold">Delete follow-up</h2>

        <p>Are you sure you want to delete {{ item?.client }}'s follow-up?</p>

        <div class="flex justify-end gap-2 mt-4">
          <UButton color="neutral" variant="outline" @click="close">
            Cancel
          </UButton>
          <UButton color="error" @click="onDelete(item, close)  ">
            Delete
          </UButton>
        </div>
      </div>
    </template>
  </DataTable>
</template>
<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

import { h, resolveComponent, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import DataTable from '~/components/common/DataTable.vue'
import { getHeader } from '~/utils/table'

const supabase = useSupabase()
const toast = useToast()
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
type FollowUp = {
  id: number
  client: string
  type_follow_up: string
  adviser: string
  date: string
  next_follow_up: string | null
  notes: string | null
}
const error = ref('')
const followUpsList = ref<FollowUp[]>([])
const { data, error: followUpsError } = await useSupabase().from('follow_ups')
  .select('id, clients(users(name)), follow_up_types(name), users(name), date, next_contact, notes')
if (followUpsError) {
  error.value = followUpsError.message
}
for (let i = 0; i < data.length; i++) {
  const followUp = data[i]
  followUpsList.value.push({
    id: followUp.id,
    client: followUp.clients.users.name,
    type_follow_up: followUp.follow_up_types.name,
    adviser: followUp.users.name,
    date: followUp.date,
    next_follow_up: followUp.next_contact,
    notes: followUp.notes
  })
}
const ULink = resolveComponent('ULink')

const columns: TableColumn<FollowUp>[] = [
 {
    accessorKey: 'client',
    header: 'Client',
    meta: { class: { th: 'text-left', td: 'text-left' } },
    cell:({row})=>{
      return h(ULink, { href: `/detail/follow-up/${row.original.id}` }, () => row.getValue('client'))
    }
  },
  { accessorKey: 'type_follow_up', header: 'Type of Follow-up' },
  { accessorKey: 'adviser', header: 'Adviser' },
  {
    accessorKey: 'date', header: ({ column }) => getHeader(column, 'Date', UButton, UDropdownMenu),
    cell({ row }) {
      return new Date(row.getValue('date')).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    }
  },
  {
    accessorKey: 'next_follow_up', header: ({ column }) => getHeader(column, 'Next Follow-up', UButton, UDropdownMenu),
    cell({ row }) {
      return new Date(row.getValue('next_follow_up')).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    }
  },
  { accessorKey: 'notes', header: 'Notes' }
]
async function onDelete(item: FollowUp, close: () => void) {
  const { error } = await supabase.functions.invoke('delete-follow-up', { body: { followUpId: item.id } })
  if (error) {
    let message = error.message
    const body = await error.context?.json?.()?.catch(() => null)
    if (body?.error) message = body.error
    toast.add({ title: 'Error', description: message, color: 'error' })
    return
  }
  followUpsList.value = followUpsList.value.filter((f) => f.id !== item.id)
  toast.add({ title: 'Success', description: 'Follow-up deleted.', color: 'success' })
  close()
}

</script>
