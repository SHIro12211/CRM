<template>
  <TitleView title="Payments" icon="i-lucide-credit-card" />
  <UBanner v-if="errorMessage" :title="errorMessage" color="error" />
  <DataTable :data="payments" :columns="columns" search-placeholder="Search payments..." new-element="payment">
    <template #modal="{ item, action, close }">
      <div v-if="action === 'delete'" class="space-y-4 p-4">
        <p>Delete this payment of <strong>{{ formatPrice(item.amount_paid) }}</strong>?</p>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="close()">Cancel</UButton>
          <UButton color="error" @click="onDelete(item, close)">Delete</UButton>
        </div>
      </div>
    </template>
  </DataTable>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import DataTable from '~/components/common/DataTable.vue'
import { getHeader } from '~/utils/table'

definePageMeta({ middleware: 'auth' })

const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const ULink = resolveComponent('ULink')

type PaymentRow = {
  id: number
  enrollmentId: number | undefined
  name: string
  course: string
  amount_paid: number
  date: string | null
  method: string
}

const supabase = useSupabase()
const toast = useToast()

const errorMessage = ref('')

const { data: payments } = useAsyncData('payments', async () => {
  const { data: { user } } = await supabase.auth.getUser()
  let clientId: string | null = null
  if (user) {
    const { data: me } = await supabase.from('users').select('user_types(name)').eq('id', user.id).single()
    if ((me as unknown as { user_types: { name: string } | null } | null)?.user_types?.name === 'Client') {
      clientId = user.id
    }
  }
  let query = supabase.from('payments')
    .select('id, payment_date, amount_paid, payment_methods(name), enrollments!inner(id, courses(name), clients(users(name)))')
    .order('id', { ascending: false })
  if (clientId) query = query.eq('enrollments.client_id', clientId)
  const { data, error } = await query
  if (error) {
    errorMessage.value = error.message
    return []
  }
  const rows = (data ?? []) as unknown as {
    id: number
    payment_date: string | null
    amount_paid: number
    payment_methods: { name: string } | null
    enrollments: { id: number, courses: { name: string } | null, clients: { users: { name: string } | null } | null } | null
  }[]
  return rows.map(p => ({
    id: p.id,
    enrollmentId: p.enrollments?.id,
    name: p.enrollments?.clients?.users?.name ?? '—',
    course: p.enrollments?.courses?.name ?? '—',
    amount_paid: Number(p.amount_paid ?? 0),
    date: p.payment_date,
    method: p.payment_methods?.name ?? '—'
  }))
}, { default: () => [] })

const columns: TableColumn<PaymentRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => h(ULink, { to: `/detail/payment/${row.original.id}` }, () => row.original.name)
  },
  { accessorKey: 'course', header: 'Course' },
  {
    accessorKey: 'amount_paid',
    header: ({ column }) => getHeader(column, 'Amount', UButton, UDropdownMenu),
    cell: ({ row }) => formatPrice(Number(row.getValue('amount_paid')))
  },
  {
    accessorKey: 'date',
    header: ({ column }) => getHeader(column, 'Date', UButton, UDropdownMenu),
    cell: ({ row }) => formatDate(row.getValue('date') as string | null)
  },
  { accessorKey: 'method', header: 'Method' }
]

async function onDelete(item: PaymentRow, close: () => void) {
  const { error } = await supabase.functions.invoke('delete-payment', { body: { id: item.id } })
  if (error) {
    toast.add({ title: 'Error', description: error.message, color: 'error' })
    return
  }
  payments.value = (payments.value ?? []).filter(p => p.id !== item.id)
  close()
  toast.add({ title: 'Payment deleted', color: 'success' })
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(price ?? 0))
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US')
}
</script>
