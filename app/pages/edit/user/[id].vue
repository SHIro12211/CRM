<template>
  <TitleView title="Edit User" icon="i-lucide-user" />
  <div class="max-w-2xl mx-auto pt-6 px-4">
    <UserForm v-if="user" :key="user.id" :user="user" @saved="() => navigateTo('/users')" />
    <p v-else class="text-sm text-error">User not found.</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const supabase = useSupabase()
const userId = route.params.id as string

const { data: userData, error } = await supabase
  .from('users')
  .select('id, name, email, phone, user_type_id, active')
  .eq('id', userId)
  .single()
if (error) console.error(error)

const user = userData
  ? {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      user_type_id: userData.user_type_id,
      active: userData.active,
    }
  : null
</script>
