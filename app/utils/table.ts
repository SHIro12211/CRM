import { h } from 'vue'
import type { Column } from '@tanstack/vue-table'
// Para generar encabezados de tabla con opciones de ordenamiento usando UButton y UDropdownMenu
export function getHeader<T>(
  column: Column<T, unknown>,
  label: string,
  UButton: any,
  UDropdownMenu: any
) {
  const isSorted = column.getIsSorted()

  return h(
    UDropdownMenu,
    {
      content: {
        align: 'start'
      },
      items: [
        {
          label: 'Asc',
          type: 'checkbox',
          icon: 'i-lucide-arrow-up-narrow-wide',
          checked: isSorted === 'asc',
          onSelect: () => {
            isSorted === 'asc'
              ? column.clearSorting()
              : column.toggleSorting(false)
          }
        },
        {
          label: 'Desc',
          type: 'checkbox',
          icon: 'i-lucide-arrow-down-wide-narrow',
          checked: isSorted === 'desc',
          onSelect: () => {
            isSorted === 'desc'
              ? column.clearSorting()
              : column.toggleSorting(true)
          }
        }
      ]
    },
    () =>
      h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label,
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5 data-[state=open]:bg-elevated',
        'aria-label': `Sort by ${isSorted === 'asc' ? 'descending' : 'ascending'}`
      })
  )
}
