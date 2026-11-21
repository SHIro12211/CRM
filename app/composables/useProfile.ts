// app/composables/useProfile.ts
// Nombre y rol del usuario conectado, servidos desde el backend.
// - El rol sale del RPC current_user_role() (SECURITY DEFINER): RLS no lo bloquea,
//   así funciona también para el cliente.
// - El nombre sale de una consulta simple sobre la propia fila (RLS lo permite).
// No usa el embed user_types, que al cliente le llega nulo y rompía el layout.
import { computed } from 'vue'

export function useProfile() {
  const supabase = useSupabase()

  const { data: profile, pending, error, refresh } = useAsyncData('my-profile', async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const [{ data: row }, { data: roleName }] = await Promise.all([
      supabase.from('users').select('name').eq('id', user.id).maybeSingle(),
      supabase.rpc('current_user_role')
    ])

    return {
      id: user.id,
      name: row?.name ?? '',
      role: (roleName as string | null) ?? ''
    }
  }, { default: () => null , server: false })

  const name = computed(() => profile.value?.name ?? '')
  const role = computed(() => profile.value?.role ?? '')

  return { profile, name, role, pending, error, refresh }
}
