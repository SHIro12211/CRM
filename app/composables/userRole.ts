// app/composables/useRole.ts
export function useRole() {
  const supabase = useSupabase()

  // La clave 'my-role' es la misma en todas las páginas, así el rol se pide una sola vez.
  const { data: role, status, error, refresh } = useAsyncData('my-role', async () => {
    const { data } = await supabase.rpc('current_user_role')
    return data as string | null
  }, { default: () => null, server: false })

  const isAdmin = computed(() => role.value === 'Admin')
  const isHeadAdvisor = computed(() => role.value === 'Head Advisor')
  const isAdvisor = computed(() => role.value === 'Advisor')
  const isClient = computed(() => role.value === 'Client')

  // Staff = cualquiera que no sea cliente
  const isStaff = computed(() => isAdmin.value || isHeadAdvisor.value || isAdvisor.value)

  // Permisos según mi RLS
  const canCreateUsers = computed(() => isAdmin.value || isHeadAdvisor.value)
  const canCreateCourses = computed(() => isAdmin.value || isHeadAdvisor.value)

  function hasRole(...roles: string[]) {
    return roles.includes(role.value ?? '')
  }

  return {
    role,
    status,
    error,
    refresh,
    isAdmin,
    isHeadAdvisor,
    isAdvisor,
    isClient,
    isStaff,
    canCreateUsers,
    canCreateCourses,
    hasRole
  }
}
