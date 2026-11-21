export default defineNuxtRouteMiddleware(async (to) => {
  // Si la ruta no coincide con ninguna página, no hacer nada:
  // Nuxt muestra su error 404 por defecto.
  if (!to.matched.length) return

  const supabase = useSupabase()

  // getUser() valida el token contra el servidor de Supabase.
  // getSession() solo lee la sesión guardada y no verifica que siga siendo válida.
  const { data: { user }, error } = await supabase.auth.getUser()

  // Sin usuario (o si falló la comprobación) y no estamos en /login → a login.
  // El chequeo de /login evita el bucle de redirecciones.
  if ((error || !user) && to.path !== '/login') {
    return navigateTo('/login')
  }

  // Chequeo de rol: solo si la página declara roles en definePageMeta.
  // Sin sesión ya se redirigió arriba, así que aquí el usuario existe.
  // El rol viene del RPC current_user_role() (SECURITY DEFINER, RLS no lo bloquea).
  // Si el rol no está en la lista → a /forbidden (NO a /login).
  const roles = to.meta.roles as string[] | undefined
  if (roles?.length) {
    const { data: role } = await supabase.rpc('current_user_role')
    if (!roles.includes(role)) {
      return navigateTo('/forbidden')
    }
  }
})
