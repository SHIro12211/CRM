<template>
  <div>
    <TitleView title="Users" icon="i-lucide-users" />
    <DataTable :data="usersList" :columns="columns" search-placeholder="Search users..." new-element="user">
      <template #modal="{ item, action, close }">
        <div class="p-6">
          <div v-if="action === 'view'">
            <h2 class="text-xl font-bold">User Details</h2>
            <p>Name: {{ item?.name }}</p>
            <p>Email: {{ item?.email }}</p>
            <p>Phone: {{ item?.phone }}</p>
            <p>Enrollments: {{ item?.countEnrollments }}</p>
            <p>Debt: {{ item?.debt }}</p>
            <p>Status: {{ item?.status }}</p>
            <p v-if="isAdvisor">Role: {{ item?.role }}</p>
            <p v-if="isAdvisor">Created By: {{ item?.created_by }}</p>
            <p>Created At: {{ item?.created_at }}</p>
            <p>Updated At: {{ item?.updated_at }}</p>
          </div>

          <div v-else-if="action === 'edit'">
            <h2 class="text-xl font-bold">Edit User</h2>

            <!-- Aquí irá CourseForm -->
          </div>

          <div v-else-if="action === 'delete'">
            <h2 class="text-xl font-bold">Delete User</h2>

            <p>Are you sure you want to delete {{ item?.name }}?</p>

            <div class="flex justify-end gap-2 mt-4">
              <UButton color="neutral" variant="outline" @click="close">
                Cancel
              </UButton>
              <UButton v-if="isAdmin" color="error" @click="onDelete(item, close)">
                Delete
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </DataTable>
  </div>
</template>
<script setup lang="ts">
import { useClientDebt } from '~/components/useClientDebt'
import formatPhone from '~/utils/formatPhone'
definePageMeta({
  middleware: 'auth',
  roles: ['Admin', 'Head Advisor', 'Advisor']
})
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import DataTable from '~/components/common/DataTable.vue'
import { getHeader } from '~/utils/table'
const { getDebt } = useClientDebt()
const { isAdvisor, isAdmin } = useRole()
const toast = useToast()



const Uicon = resolveComponent('UIcon')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')

type User = {
  id: string
  name: string
  email: string
  phone: string
  countEnrollments: number
  debt: number
  status: string
  created_at: string
  updated_at: string
  //--role admin and head advisor-----
  created_by: string | null
  role: string | null
  //----------------------------------
}
const usersList = ref<User[]>([])
// Fetch the current user ID from Supabase Auth
let currentUserID = null
const supabase = useSupabase()
const { data: currentUser } = await supabase.auth.getUser()
if (currentUser) currentUserID = currentUser?.user?.id
const { data: users, error } = await supabase.from('users')
  .select('*,user_types(name),clients(enrollments(id, agreed_price, payment_type, payments(amount_paid)))').neq('id', currentUserID)
if (error) {
  console.error(error)
}
// Function to calculate client debt using the composable
function getClientDebt(user: any): number {
  const client = Array.isArray(user.clients) ? user.clients[0] : user.clients
  const enrollments = client?.enrollments ?? []
  return enrollments
    .filter((e: any) => e.payment_type === 'Parcial')
    .reduce((total: number, e: any) => {
      const paid = (e.payments ?? []).reduce((sum: number, p: any) => sum + Number(p.amount_paid ?? 0), 0)
      const remaining = Number(e.agreed_price ?? 0) - paid
      return total + (remaining > 0 ? remaining : 0)
    }, 0)
}


const usersListMapped = (users ?? []).map(user => {
  const client = Array.isArray(user.clients) ? user.clients[0] : user.clients
  const role = Array.isArray(user.user_types) ? user.user_types[0]?.name : user.user_types?.name
  return {
    ...user,
    role: role ?? '—',
    enrollmentsCount: client?.enrollments?.length ?? 0,
    debt: getDebt(user)
  }
})


for (let i = 0; i < (usersListMapped?.length ?? 0); i++) {
  const user = usersListMapped?.[i]
  const { data, error } = await supabase.from('users')
    .select('id, name').eq('id', user.created_by).single()
  if (error) {
    console.error(error)
  }
  if (user) {
    usersList.value.push({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: formatPhone(user.phone),
      countEnrollments: user.enrollmentsCount || '0',
      debt: user.debt || 0,
      status: user.active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      created_by: !isAdvisor.value ? data?.name : '-',
      role: !isAdvisor.value ? user.role || null : null
    })
  }
}
const ULink = resolveComponent('ULink')
//Columns for data table
const columns = computed(() => {
  const allColumns: TableColumn<User>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      meta: { class: { th: 'text-left', td: 'text-left' } },
      cell: ({ row }) => {
        return h(ULink, { href: `/detail/user/${row.original.id}` }, () => row.getValue('name'))
      }
    },
    {
      accessorKey: 'email', header: 'Email'
    },
    {
      accessorKey: 'phone', header: 'Phone'
    },
    {
      accessorKey: 'countEnrollments',
      header: ({ column }) => getHeader(column, 'Enrollments', UButton, UDropdownMenu)
    },
    {
      accessorKey: 'debt',
      header: ({ column }) => getHeader(column, 'Debt', UButton, UDropdownMenu),
      cell: ({ row }) => {
        const debt = Number.parseFloat(row.getValue('debt'))
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(debt)
      }
    },
    {
      accessorKey: 'status', header: 'Active',
      cell: ({ row }) => {
        const active = row.getValue('status') as User['status']
        const status = active ? 'true' : 'false'
        const config = {
          true: {
            color: 'success' as const,
            icon: 'i-lucide-check-circle'
          },
          false: {
            color: 'danger' as const,
            icon: 'i-lucide-x-circle'
          }
        }[status]

        return h('div', { class: 'flex items-center gap-2' }, [
          h(Uicon, {
            name: config.icon,
            class: 'size-5'
          })
        ])
      }
    },
    {
      accessorKey: 'role', header: 'Role',
      meta: {
        class: {
          td: 'text-center',
          th: 'text-center'
        }
      }
    },
    {
      accessorKey: 'created_by', header: 'Created By'
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => getHeader(column, 'Created At', UButton, UDropdownMenu),
      cell({ row }) {
        return new Date(row.getValue('created_at')).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      }
    },
    {
      accessorKey: 'updated_at',
      header: ({ column }) => getHeader(column, 'Updated At', UButton, UDropdownMenu),
      cell({ row }) {
        return new Date(row.getValue('updated_at')).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      }
    }

  ]

  if (isAdvisor.value) {
    return allColumns.filter(column => !['created_by', 'role'].includes(column.accessorKey))
  }
  return allColumns
})
async function onDelete(item: User, close: () => void) {
  const { error } = await supabase.functions.invoke('delete-user', { body: { userId: item.id } })
  if (error) {
    let message = error.message
    const body = await error.context?.json?.()?.catch(() => null)
    if (body?.error) message = body.error
    toast.add({ title: 'Error', description: message, color: 'error' })
    return
  }
  usersList.value = usersList.value.filter((u) => u.id !== item.id)
  toast.add({ title: 'Success', description: 'User deleted.', color: 'success' })
  close()
}

</script>
