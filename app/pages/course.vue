<template>
  <TitleView title="Courses" icon="i-lucide-book-open" />
  <DataTable :data="courseList" :columns="columns" search-placeholder="Search courses..." new-element="course">
    <template #modal="{ item, action, close }">
      <div class="p-6">
        <div v-if="action === 'view'">
          <h2 class="text-xl font-bold">Course Details</h2>
          <p>Name: {{ item?.name }}</p>
          <p>Price: {{ item?.price }}</p>
          <p>Duration: {{ item?.duration }} weeks</p>
        </div>

        <div v-else-if="action === 'edit'">
          <h2 class="text-xl font-bold">Edit Course</h2>

          <!-- Aquí irá CourseForm -->
        </div>

        <div v-else-if="action === 'delete'">
          <h2 class="text-xl font-bold">Delete Course</h2>

          <p>Are you sure you want to delete {{ item?.name }}?</p>

          <div class="flex justify-end gap-2 mt-4">
            <UButton color="neutral" variant="outline" @click="close">
              Cancel
            </UButton>
            <UButton color="error">
              Delete
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </DataTable>
</template>
<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import DataTable from '~/components/common/DataTable.vue'
import { getHeader } from '~/utils/table'
const { role } = useProfile()
const isClient = role.value === 'Client'

//Button and DropdownMenu components for table headers
const Uicon = resolveComponent('UIcon')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const ULink = resolveComponent('ULink')
//Tipo de dato para los cursos
type Course = {
  id: number
  name: string
  price: number
  duration: number
  active: boolean
  purchased_courses: number
}
// List of courses
const courseList = ref<Course[]>([])
//Consulta de cursos desde Supabase
const supabase = useSupabase()
const { data: courses, error: coursesError } = await supabase.from('courses')
  .select('*,enrollments(course_id)')
if (coursesError) {
  console.error(coursesError)
}

// Populate the course list with data from Supabase
for (let i = 0; i < (courses?.length ?? 0); i++) {
  const course = courses?.[i]
  if (course) {
    courseList.value.push({
      id: course.id,
      name: course.name,
      price: course.price,
      duration: course.duration,
      active: course.active,
      purchased_courses: course.enrollments?.length ?? 0
    })
  }
}

// Columns for the data table
const columns: TableColumn<Course>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    meta: { class: { th: 'text-left', td: 'text-left' } },
    cell: ({ row }) => {
      return h(ULink, { href: `/detail/course/${row.original.id}` }, () => row.getValue('name'))
    }
  },
  {
    accessorKey: 'price',
    enableSorting: true,
    header: ({ column }) => getHeader(column, 'Price', UButton, UDropdownMenu),
    cell: ({ row }) => {
      const price = Number.parseFloat(row.getValue('price'))
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(price)
    }
  },
  {
    accessorKey: 'duration',
    enableSorting: true,
    header: ({ column }) => getHeader(column, 'Duration', UButton, UDropdownMenu),
    cell: ({ row }) => {
      const duration = row.getValue('duration')
      return `${duration} weeks`
    }
  }, ...(!isClient ? [//si no es cliente, mostrar estas columnas
    {
      accessorKey: 'purchased_courses',
      enableSorting: true,
      header: ({ column }) => getHeader(column, 'Purchased Courses', UButton, UDropdownMenu)
    },
    {
      accessorKey: 'active',
      header: 'Active',
      cell: ({ row }) => {
        const active = row.getValue('active') as Course['active']
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
    }
  ] : [])
]
</script>
