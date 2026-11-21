<template>
  <!-- Header -->
  <UHeader>
    <template #title>
      <UIcon name="i-lucide-code" class="mr-2 mb-1" />
      Programming Academy
    </template>
    <UNavigationMenu v-if="!(role === 'Client')" :items="items" />
    <template #right>
      <UColorModeButton />
      <UDropdownMenu :items="dropdownItems">
        <UAvatar color="primary" class="cursor-pointer" :alt="name" />
      </UDropdownMenu>
    </template>
  </UHeader>
  <!-- Main content -->
  <UContainer>
    <slot />
  </UContainer>
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { DropdownMenuItem } from '@nuxt/ui'

const route = useRoute()
const supabase = useSupabase()
const toast = useToast()

// Nombre y rol del usuario conectado, desde el composable useProfile.
// El rol viene del RPC current_user_role() (SECURITY DEFINER, RLS no lo bloquea)
// y el nombre de una consulta simple sobre la propia fila.
// name y role son computeds: en el script se leen con .value, en el template solos.

const { name, role } = useProfile()

 const items = ref<NavigationMenuItem[]>([])
 items.value =  [
  {
    label: 'Courses',
    to: '/course',
    active: route.path.startsWith('/course')
  },

  {
    label: 'Users',
    to: '/users',
    active: route.path.startsWith('/users')
  },
  {
    label: 'Enrollments',
    to: '/enrollments',
    active: route.path.startsWith('/enrollments')
  },
  {
    label: 'Follow-up',
    to: '/follow-up',
    active: route.path.startsWith('/follow-up')
  },
  {
    label: 'Payments',
    to: '/payments',
    active: route.path.startsWith('/payments')
  }
]


const dropdownItems = computed<DropdownMenuItem[]>(() => [
  {
    label: name.value,
    description: role.value,
    icon: 'i-lucide-user'
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: 'i-lucide-settings'
  },
  {
    label: 'Sign Out',
    icon: 'i-lucide-log-out',
    color: 'error',
    onSelect: signOut
  }
])

async function signOut() {
  const { error } = await supabase.auth.signOut()
  console.log(error)
  if (error) {
    toast.add({
      title: 'Error',
      description: error.message,
      color: 'error'
    })
    return
  }

  await navigateTo('/login')

  toast.add({
    title: 'Signed Out',
    description: 'You have successfully signed out.',
    color: 'success',
    icon: 'i-lucide-check-circle',
    progress: false,
    duration: 1000
  })
}
</script>
