export function useTable() {

  const pagination = ref({
    pageIndex: 0,
    pageSize: 10
  })

  const globalFilter = ref('')

  return {
    pagination,
    globalFilter
  }
}
