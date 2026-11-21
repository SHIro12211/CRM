<template>
  <div class="w-full space-y-4 pb-2">

    <div class="flex justify-between px-4 py-3.5 border-b border-accented">
      <UInput v-model="globalFilter" :placeholder="searchPlaceholder ?? 'Search...'" class="max-w-sm">
        <template v-if="globalFilter?.length" #trailing>
          <UButton color="neutral" variant="link" size="sm" icon="i-lucide-circle-x" aria-label="Clear input"
            @click="globalFilter = ''" />
        </template>
      </UInput>

      <UButton v-if="canAdd" color="primary" variant="soft" icon="i-lucide-plus"
        :to="`/add/${newElement ?? 'enrollments'}`" />
    </div>

    <UTable ref="table" v-model:pagination="pagination" v-model:global-filter="globalFilter" :data="data"
      :columns="columnsWithActions" :ui="{ th: 'text-center', td: 'text-center' }" :pagination-options="{
        getPaginationRowModel: getPaginationRowModel()
      }" class="flex-1" />

    <div class="flex justify-between border-t border-default pt-4 px-4">

      <UBadge :label="`Total: ${data.length}`" color="primary" />

      <UPagination :page="(table?.tableApi?.getState().pagination.pageIndex ?? 0) + 1"
        :items-per-page="table?.tableApi?.getState().pagination.pageSize"
        :total="table?.tableApi?.getFilteredRowModel().rows.length ?? 0"
        @update:page="p => table?.tableApi?.setPageIndex(p - 1)" />

    </div>

    <!-- Modal reutilizable -->
    <UModal v-model:open="isModalOpen">
      <template #content>
        <slot name="modal" :item="selectedItem" :action="modalAction" :close="() => isModalOpen = false" />
      </template>
    </UModal>

  </div>
</template>
<script setup lang="ts" generic="T extends Record<string, any>">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/vue-table'
import { h, resolveComponent, computed } from 'vue'
const { isAdmin, isHeadAdvisor, isStaff } = useRole()
const canEdit = computed(() => {
  if (props.newElement === 'course' || props.newElement === 'payment') {
    return isAdmin.value || isHeadAdvisor.value
  }
  return isStaff.value
})

const canDelete = computed(() => {
  if (props.newElement === 'user') return isAdmin.value
  if (props.newElement === 'course' || props.newElement === 'payment') {
    return isAdmin.value || isHeadAdvisor.value
  }
  return isStaff.value
})

const canAdd = computed(() => {
  // Cursos y pagos: solo Admin y Head Advisor
  if (props.newElement === 'course' || props.newElement === 'payment') {
    return isAdmin.value || isHeadAdvisor.value
  }
  // Usuarios, inscripciones y seguimientos: todo el staff
  return isStaff.value
})

const props = defineProps<{
  data: T[]
  columns: TableColumn<T>[]
  searchPlaceholder?: string
  newElement?: string
}>()

const UButton = resolveComponent('UButton')

const table = useTemplateRef('table')

const { pagination, globalFilter } = useTable()

// Control del modal
const isModalOpen = ref(false)
const selectedItem = ref<T | null>(null)
const modalAction = ref('')

// Abrir modal
function openModal(item: T, action: string) {
  selectedItem.value = item
  modalAction.value = action
  isModalOpen.value = true
}

// Agregar columna de acciones automáticamente
const columnsWithActions = computed<TableColumn<T>[]>(() => [
  ...props.columns,
  ...(canEdit.value ? [{
    id: 'edit',
    header: 'Edit',
    cell: ({ row }) => h(UButton, {
      icon: 'i-lucide-pencil',
      color: 'neutral',
      variant: 'ghost',
      size: 'sm',
      onClick: () => navigateTo(`/edit/${props.newElement}/${row.original.id}`)
    })
  }] : []),
  ...(canDelete.value ? [{
    id: 'delete',
    header: 'Delete',
    cell: ({ row }) => h(UButton, {
      icon: 'i-lucide-trash',
      color: 'error',
      variant: 'ghost',
      size: 'sm',
      onClick: () => openModal(row.original, 'delete')
    })
  }] : []),
])

</script>
