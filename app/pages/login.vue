<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'

const toast = useToast()
const fields: AuthFormField[] = [{
  name: 'email',
  type: 'email',
  label: 'Email',
  placeholder: 'Enter your email',
  required: true
}, {
  name: 'password',
  label: 'Password',
  type: 'password',
  placeholder: 'Enter your password',
  required: true
}, {
  name: 'remember',
  label: 'Remember me',
  type: 'checkbox'
}]

const schema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters')
})

type Schema = z.output<typeof schema>
const errorMessage = ref('')
const showError = ref(false)
const supabase = useSupabase()


async function onSubmit(payload: FormSubmitEvent<Schema>) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: payload.data.email,
    password: payload.data.password
  })

  if (error) {
    errorMessage.value = error.message
    showError.value = true
    return
  }

  if (data.user) {
    toast.add({
      title: 'Login successful',
      description: 'You have successfully logged in.',
      color: 'success',
      icon: 'i-lucide-check-circle',
      progress: false,
      duration: 1000
    })
    await new Promise(resolve => setTimeout(resolve, 200))
    await navigateTo('/', { replace: true })
  }
}
definePageMeta({
  layout: 'auth',
})

</script>


<template>
  <div class="flex flex-col items-center justify-center gap-4 p-4">
    <h1 class="text-2xl font-bold text-center tracking-wider mt-10" mb-4>Programming Academy</h1>
    <p class="text-center mb-4">Welcome back! Please login to your account.</p>
    <UPageCard class="w-full max-w-md">
      <UAlert v-if="showError" type="error" :title="errorMessage" color="error" variant="soft" />
      <UAuthForm :schema="schema" title="Login" description="Enter your credentials to access your account."
        icon="i-lucide-user" :fields="fields" @submit="onSubmit" />

    </UPageCard>
  </div>
</template>
