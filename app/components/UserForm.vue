<template>
  <UForm :schema="schema" :state="state" @submit="onSubmit" class="space-y-4">
    <UFormField label="Name" name="name">
      <UInput v-model="state.name" placeholder="Enter name" class="w-full" />
    </UFormField>

    <UFormField label="Email" name="email">
      <UInput v-model="state.email" :disabled="isEdit && isAdvisor" placeholder="Enter email" class="w-full" />
    </UFormField>

    <!-- Contraseña solo al crear -->
    <template v-if="!isEdit">
      <UFormField label="Password" name="password">
        <PasswordInput v-model="state.password" placeholder="Enter password" />
      </UFormField>
      <UFormField label="Confirm Password" name="confirm_password">
        <PasswordInput v-model="state.confirm_password" placeholder="Confirm password" />
      </UFormField>
    </template>

    <UFormField label="Phone" name="phone">
      <UInput v-model="state.phone" placeholder="Enter phone" class="w-full" />
    </UFormField>

    <UFormField v-if="role && !isAdvisor" label="Role" name="user_type_id">
      <USelect v-model="state.user_type_id" :items="roleOptions" value-key="id" label-key="name" placeholder="Select role" class="w-full" />
    </UFormField>

    <!-- Active solo al editar -->
    <UFormField v-if="isEdit" label="Active" name="active">
      <USwitch v-model="state.active" />
    </UFormField>

    <div class="flex justify-center gap-3">
      <UButton type="submit" :loading="saving" ">{{ isEdit ? 'Save' : 'Create' }}</UButton>
      <UButton color="neutral" variant="outline" to="/users">Cancel</UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const NAME_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü' -]+$/
const PHONE_REGEX = /^\+?\d{7,15}$/

type FormUser = {
  id: string
  name: string
  email: string
  phone: string | null
  user_type_id: number | null
  active: boolean
}

// Sin prop user es crear, con prop user es editar
const props = defineProps<{ user?: FormUser | null }>()
const emit = defineEmits<{
  saved: [user: { id: string, name: string, email: string, phone: string | null, user_type_id: number | null, role: string | null, active: boolean }]
}>()

const supabase = useSupabase()
const toast = useToast()
const saving = ref(false)
const isEdit = computed(() => !!props.user)
const { role, isAdmin, isAdvisor } = useRole()

// Roles del catálogo para el selector
const { data: roleRows } = useAsyncData('user-types', async () => {
  const { data } = await supabase.from('user_types').select('id, name').order('id')
  return (data ?? []) as { id: number, name: string }[]
})

const roleOptions = computed(() => {
  const rows = roleRows.value ?? []
  // Al editar, Admin ve todos; al crear, solo Advisor y Client
  if (isEdit.value && isAdmin.value) return rows
  return rows.filter((r) => r.name === 'Advisor' || r.name === 'Client')
})

const clientRoleId = computed(() => roleRows.value?.find((r) => r.name === 'Client')?.id ?? null)

const schema = z.object({
  name: z.string().min(2, 'Name is required').regex(NAME_REGEX, 'Name can only contain letters'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional().refine((val) => !val || PHONE_REGEX.test(val), 'Invalid phone'),
  user_type_id: z.number().optional(),
  active: z.boolean().optional(),
  password: z.string().optional(),
  confirm_password: z.string().optional(),
}).superRefine((data, ctx) => {
  if (isEdit.value) return
  if (!data.password || data.password.length < 8) {
    ctx.addIssue({ code: 'custom', message: 'Password must be at least 8 characters', path: ['password'] })
  }
  if (data.password !== data.confirm_password) {
    ctx.addIssue({ code: 'custom', message: 'Passwords do not match', path: ['confirm_password'] })
  }
  if (!isAdvisor.value && !data.user_type_id) {
    ctx.addIssue({ code: 'custom', message: 'Role is required', path: ['user_type_id'] })
  }
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  name: props.user?.name,
  email: props.user?.email,
  phone: props.user?.phone ?? '',
  user_type_id: props.user?.user_type_id ?? undefined,
  active: props.user?.active ?? true,
  password: '',
  confirm_password: '',
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true
  try {
    // Advisor siempre crea Client
    const userTypeId = isAdvisor.value
      ? clientRoleId.value ?? event.data.user_type_id
      : event.data.user_type_id

    if (isEdit.value && props.user) {
      // 1. Si cambió el correo, primero va por update-user-email
      if (event.data.email !== props.user.email) {
        const { error: emailError } = await supabase.functions.invoke('update-user-email', {
          body: { userId: props.user.id, email: event.data.email },
        })
        if (emailError) throw emailError
      }

      // 2. Actualizar el perfil
      const { data, error } = await supabase.functions.invoke('edit-user', {
        body: {
          id: props.user.id,
          name: event.data.name,
          email: event.data.email,
          phone: event.data.phone?.replace(/\D/g, '') || null,
          user_type_id: userTypeId,
          active: event.data.active,
        },
      })
      if (error) throw error
      toast.add({ title: 'Success', description: data.message || 'User updated.', color: 'success' })
      emit('saved', {
        id: props.user.id,
        name: event.data.name,
        email: event.data.email,
        phone: event.data.phone?.replace(/\D/g, '') || null,
        user_type_id: userTypeId ?? null,
        role: roleRows.value?.find((r) => r.id === userTypeId)?.name ?? null,
        active: event.data.active ?? props.user.active,
      })
    } else {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          name: event.data.name,
          email: event.data.email,
          password: event.data.password,
          confirm_password: event.data.confirm_password,
          phone: event.data.phone?.replace(/\D/g, '') || null,
          user_type_id: userTypeId,
        },
      })
      if (error) throw error
      toast.add({ title: 'Success', description: data.message || 'User created.', color: 'success' })
      emit('saved', {
        id: data.user.id,
        name: event.data.name,
        email: event.data.email,
        phone: event.data.phone?.replace(/\D/g, '') || null,
        user_type_id: userTypeId ?? null,
        role: roleRows.value?.find((r) => r.id === userTypeId)?.name ?? null,
        active: true,
      })
    }
  } catch (e: any) {
    let message = e?.message || 'Error saving user'
    const body = await e?.context?.json?.()?.catch(() => null)
    if (body?.error) message = body.error
    toast.add({ title: 'Error', description: message, color: 'error' })
  } finally {
    saving.value = false
  }
  navigateTo('/users')
}
</script>
