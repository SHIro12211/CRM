<template>
  <UForm :schema="schema" :state="state" @submit="onSubmit" class="space-y-4">
    <UFormField label="Client" name="client_id">
      <USelect v-model="state.client_id" :items="clientOptions" value-key="id" label-key="name"
        placeholder="Select client" :disabled="isEdit" class="w-full" />
    </UFormField>

    <UFormField label="Course" name="course_id">
      <USelect v-model="state.course_id" :items="courseOptions" value-key="id" label-key="name"
        placeholder="Select course" :disabled="isEdit" class="w-full" />
    </UFormField>

    <UFormField label="Agreed Price" name="agreed_price">
      <UInput v-model="state.agreed_price" type="number" min="0" step="0.01" placeholder="Enter agreed price"
        class="w-full" />
    </UFormField>

    <UFormField label="Payment Type" name="payment_type">
      <USelect v-model="state.payment_type" :items="paymentTypes" placeholder="Select payment type" class="w-full" />
    </UFormField>

    <UFormField label="Enrollment Date" name="enrollment_date">
      <UInput v-model="state.enrollment_date" type="date" class="w-full" />
    </UFormField>

    <UFormField label="Status" name="status_id">
      <USelect v-model="state.status_id" :items="statusOptions" value-key="id" label-key="name"
        placeholder="Select status" class="w-full" />
    </UFormField>

    <div class="flex justify-center gap-3">
      <UButton type="submit" :loading="saving">{{ isEdit ? 'Save' : 'Create' }}</UButton>
      <UButton color="neutral" variant="outline" to="/enrollments">Cancel</UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

type FormEnrollment = {
  id: number
  client_id: string
  course_id: number
  agreed_price: number
  payment_type: 'Full' | 'Parcial'
  enrollment_date: string
  status_id: number | null
}

// Sin prop enrollment es crear, con prop enrollment es editar
const props = defineProps<{ enrollment?: FormEnrollment | null }>()
const emit = defineEmits<{
  saved: [enrollment: { id: number, client_id: string, course_id: number, agreed_price: number, payment_type: 'Full' | 'Parcial', enrollment_date: string, status_id: number | null }]
}>()

const supabase = useSupabase()
const toast = useToast()
const saving = ref(false)
const isEdit = computed(() => !!props.enrollment)
const { isAdvisor } = useRole()

const paymentTypes = ['Full', 'Parcial'] as const

// Clientes (de la tabla clients, con el nombre y quién los creó)
const { data: clientRows } = useAsyncData('enrollment-clients', async () => {
  const { data } = await supabase
    .from('clients')
    .select('user_id, users(id, name, created_by)')
    .returns<{ user_id: string, users: { id: string, name: string, created_by: string | null } }[]>()
  return data ?? []
})

// Cursos
const { data: courseRows } = useAsyncData('enrollment-courses', async () => {
  const { data } = await supabase
    .from('courses')
    .select('id, name, price, active')
    .order('name')
  return (data ?? []) as { id: number, name: string, price: number, active: boolean }[]
})

// Estados del catálogo
const { data: statusRows } = useAsyncData('enrollment-statuses', async () => {
  const { data } = await supabase
    .from('enrollment_statuses')
    .select('id, name')
    .order('id')
  return (data ?? []) as { id: number, name: string }[]
})

// Mi id, para filtrar los clientes del advisor
const { data: myId } = useAsyncData('enrollment-me', async () => {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
})

const clientOptions = computed(() => {
  const rows = clientRows.value ?? []
  // Al editar se muestran todos (para que se vea el actual); al crear, el advisor solo ve los suyos
  const filtered = !isEdit.value && isAdvisor.value && myId.value
    ? rows.filter((r) => r.users.created_by === myId.value)
    : rows
  return filtered.map((r) => ({ id: r.user_id, name: r.users.name }))
})

const courseOptions = computed(() => {
  const rows = courseRows.value ?? []
  // Al crear solo cursos activos; al editar todos, para que se vea el actual
  const filtered = isEdit.value ? rows : rows.filter((c) => c.active)
  return filtered.map((c) => ({ id: c.id, name: c.name }))
})

const statusOptions = computed(() => {
  return (statusRows.value ?? []).map((s) => ({ id: s.id, name: s.name }))
})

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const schema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  course_id: z.number({ error: 'Course is required' }),
  agreed_price: z.coerce.number().positive('Agreed price must be greater than 0'),
  payment_type: z.enum(paymentTypes),
  enrollment_date: z.string().min(1, 'Enrollment date is required'),
  status_id: z.number({ error: 'Status is required' }),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  client_id: props.enrollment?.client_id,
  course_id: props.enrollment?.course_id,
  agreed_price: props.enrollment?.agreed_price,
  payment_type: props.enrollment?.payment_type ?? 'Full',
  enrollment_date: props.enrollment?.enrollment_date ?? today(),
  status_id: props.enrollment?.status_id ?? undefined,
})

// Al elegir curso, el precio se llena con el precio del curso (se puede ajustar)
watch(() => state.course_id, (courseId) => {
  if (isEdit.value) return
  const course = courseRows.value?.find((c) => c.id === courseId)
  if (course) state.agreed_price = course.price
})

// Al crear, el estado por defecto es Active (o el primero del catálogo)
watch(statusRows, (rows) => {
  if (isEdit.value || state.status_id || !rows?.length) return
  state.status_id = rows.find((r) => r.name === 'Active')?.id ?? rows[0].id
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true
  try {
    if (isEdit.value && props.enrollment) {
      const { data, error } = await supabase.functions.invoke('edit-enrollment', {
        body: {
          id: props.enrollment.id,
          agreed_price: event.data.agreed_price,
          payment_type: event.data.payment_type,
          enrollment_date: event.data.enrollment_date,
          status_id: event.data.status_id,
        },
      })
      if (error) throw error
      toast.add({ title: 'Success', description: data.message || 'Enrollment updated.', color: 'success' })
      emit('saved', {
        id: props.enrollment.id,
        client_id: props.enrollment.client_id,
        course_id: props.enrollment.course_id,
        agreed_price: event.data.agreed_price,
        payment_type: event.data.payment_type,
        enrollment_date: event.data.enrollment_date,
        status_id: event.data.status_id,
      })
    } else {
      const { data, error } = await supabase.functions.invoke('create-enrollment', {
        body: {
          client_id: event.data.client_id,
          course_id: event.data.course_id,
          agreed_price: event.data.agreed_price,
          payment_type: event.data.payment_type,
          enrollment_date: event.data.enrollment_date,
          status_id: event.data.status_id,
        },
      })
      if (error) throw error
      toast.add({ title: 'Success', description: data.message || 'Enrollment created.', color: 'success' })
      emit('saved', {
        id: data.data.id,
        client_id: event.data.client_id,
        course_id: event.data.course_id,
        agreed_price: event.data.agreed_price,
        payment_type: event.data.payment_type,
        enrollment_date: event.data.enrollment_date,
        status_id: event.data.status_id,
      })
    }
  } catch (e: any) {
    let message = e?.message || 'Error saving enrollment'
    const body = await e?.context?.json?.()?.catch(() => null)
    if (body?.error) message = body.error
    toast.add({ title: 'Error', description: message, color: 'error' })
  } finally {
    saving.value = false
  }
  navigateTo('/enrollments')

}
</script>
