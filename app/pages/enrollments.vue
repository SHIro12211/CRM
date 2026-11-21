<template>
  <TitleView title="Enrollments" icon="i-lucide-book" />
  <UBanner v-if="error" :title="error" color="error" />
  <DataTable :data="enrollmentsList" :columns="columns" search-placeholder="Search enrollments..."
    new-element="enrollment">
    <template #modal="{ item, action, close }">
      <!-- details modal for enrollment -->
      <div v-if="action === 'view'" class="p-4">
        <h3 class="text-lg font-bold mb-2">Enrollment Details</h3>
        <p><strong>Client:</strong> {{ item?.client }}</p>
        <p><strong>Course:</strong> {{ item?.course }}</p>
        <p><strong>Enrolled By:</strong> {{ item?.enrolledBy }}</p>
        <p><strong>Date Enrolled:</strong> {{ item?.dateEnrolled }}</p>
        <p><strong>Active:</strong> {{ item?.active }}</p>
        <p><strong>Completed:</strong> {{ item?.completed }}%</p>
        <p><strong>Payment Type:</strong> {{ item?.paymentType }}</p>
        <div class="mt-4">
          <UButton color="primary" @click="close">Close</UButton>
        </div>
      </div>
      <div v-else-if="action === 'delete'">
        <h2 class="text-xl font-bold">Delete enrollment</h2>

        <p>Are you sure you want to delete {{ item?.client }}'s enrollment?</p>

        <div class="flex justify-end gap-2 mt-4">
          <UButton color="neutral" variant="outline" @click="close">
            Cancel
          </UButton>
          <UButton color="error">
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

const toast = useToast()
//Button and DropdownMenu components for table headers
const Uicon = resolveComponent('UIcon')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
//Tipo de dato para las inscripciones
type Enrollment = {
  id: number
  client: string
  course: string
  enrolledBy: string
  dateEnrolled: string
  active: boolean
  completed: Number | null
  paymentType: string | null
}
const enrollmentsList = ref<Enrollment[]>([])

const supabase = useSupabase()
const error = ref('')
const { data: enrollments, error: enrollmentsError } = await supabase.from('enrollments')
  .select('id, payment_type ,enrollment_date, progress, status_id(name), clients(users(name), follow_ups(users(name))), courses(name)')
// payment type/enrollment date, process, status name, client, adviser, course
if (enrollmentsError) {
  error.value = enrollmentsError.message
}
for (let i = 0; i < enrollments.length; i++) {
  const enrollment = enrollments[i]
  enrollmentsList.value.push({
    id: enrollment.id,
    client: enrollment.clients?.users?.name,
    course: enrollment.courses?.name,
    enrolledBy: enrollment.clients?.follow_ups?.[0]?.users?.name,//aqui me di cuenta q hice mal una relacion, deberia estar en otra tabla o relacion distinta
    dateEnrolled: enrollment.enrollment_date,
    active: enrollment.status_id?.name,
    completed: enrollment.progress,
    paymentType: enrollment.payment_type
  })
}
const ULink = resolveComponent('ULink')

const columns: TableColumn<Enrollment>[] = [
  {
    accessorKey: 'client',
    header: 'Client',
    meta: { class: { th: 'text-left', td: 'text-left' } },
    cell: ({ row }) => {
      return h(ULink, { href: `/detail/enrollment/${row.original.id}` }, () => row.getValue('client'))
    }
  },
  { accessorKey: 'course', header: 'Course' },
  { accessorKey: 'enrolledBy', header: 'Enrolled By' },
  {
    accessorKey: 'dateEnrolled', header: ({ column }) => getHeader(column, 'Date Enrolled', UButton, UDropdownMenu),
    cell({ row }) {
      return new Date(row.getValue('dateEnrolled')).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    }
  },
  { accessorKey: 'active', header: 'Active' },
  {
    accessorKey: 'completed', header: ({ column }) => getHeader(column, 'Completed', UButton, UDropdownMenu),
    cell({ row }) { return `${row.getValue('completed')}%` }
  },
  { accessorKey: 'paymentType', header: 'Payment Type' }
]
async function onDelete(item: Enrollment, close: () => void) {
  const { error } = await supabase.functions.invoke('delete-enrollment', { body: { enrollmentId: item.id } })
  if (error) {
    let message = error.message
    const body = await error.context?.json?.()?.catch(() => null)
    if (body?.error) message = body.error
    toast.add({ title: 'Error', description: message, color: 'error' })
    return
  }
  enrollmentsList.value = enrollmentsList.value.filter((e) => e.id !== item.id)
  toast.add({ title: 'Success', description: 'Enrollment deleted.', color: 'success' })
  close()
}

</script>
