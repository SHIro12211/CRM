<template>
  <UForm :schema="schema" :state="state" @submit="onSubmit">
    <div class="space-y-4">
      <UFormField label="Enrollment" name="enrollment_id">
        <USelect v-model="state.enrollment_id" :items="enrollmentItems" :disabled="isEdit"
          placeholder="Select enrollment" class="w-full" />
      </UFormField>

      <p v-if="selectedEnrollment" class="text-sm text-muted">
        Agreed: {{ formatPrice(selectedEnrollment.agreed_price) }} · Paid: {{ formatPrice(paidSoFar) }} · Remaining: {{ formatPrice(remaining) }}
      </p>

      <UFormField label="Amount" name="amount">
        <UInput v-model="state.amount" type="number" min="0.01" step="0.01" placeholder="0.00" />
      </UFormField>

      <UFormField label="Payment method" name="payment_method_id">
        <USelect v-model="state.payment_method_id" :items="methodItems" placeholder="Select method" class="w-full" />
      </UFormField>

      <UFormField label="Date" name="payment_date">
        <UInput v-model="state.payment_date" type="date" />
      </UFormField>

      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="navigateTo('/payments')">Cancel</UButton>
        <UButton type="submit" :loading="loading" color="primary">
          {{ isEdit ? 'Update payment' : 'Create payment' }}
        </UButton>
      </div>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import { z } from 'zod'

export interface PaymentRow {
  id: number
  enrollment_id: number
  amount: number
  payment_method_id: number
  payment_date: string | null
}

interface EnrollmentOption {
  id: number
  agreed_price: number
  courses: { name: string } | null
  clients: { users: { name: string } | null } | null
}

const props = defineProps<{ payment?: PaymentRow }>()
const emit = defineEmits<{ saved: [] }>()

const supabase = useSupabase()
const toast = useToast()

const isEdit = computed(() => !!props.payment)
const loading = ref(false)

const schema = z.object({
  enrollment_id: z.coerce.number(),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  payment_method_id: z.coerce.number(),
  payment_date: z.string().min(1, 'Select a date')
})

const state = reactive({
  enrollment_id: props.payment?.enrollment_id as number | undefined,
  amount: props.payment?.amount as number | undefined,
  payment_method_id: props.payment?.payment_method_id as number | undefined,
  payment_date: (props.payment?.payment_date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10)
})

// Inscripciones: el cliente solo ve las suyas
const { data: enrollments } = useAsyncData('payment-enrollments', async () => {
  const { data: { user } } = await supabase.auth.getUser()
  let clientId: string | null = null
  if (user) {
    const { data: me } = await supabase.from('users').select('user_types(name)').eq('id', user.id).single()
    if ((me as unknown as { user_types: { name: string } | null } | null)?.user_types?.name === 'Client') {
      clientId = user.id
    }
  }
  let query = supabase.from('enrollments')
    .select('id, agreed_price, courses(name), clients(users(name))')
    .order('id', { ascending: false })
  if (clientId) query = query.eq('client_id', clientId)
  const { data } = await query
  return (data ?? []) as unknown as EnrollmentOption[]
})

const { data: methods } = useAsyncData('payment-methods', async () => {
  const { data } = await supabase.from('payment_methods').select('id, name').order('name')
  return (data ?? []) as { id: number, name: string }[]
})

const enrollmentItems = computed(() => (enrollments.value ?? []).map(e => ({
  label: `${e.clients?.users?.name ?? '—'} — ${e.courses?.name ?? '—'}`,
  value: e.id
})))
const methodItems = computed(() => (methods.value ?? []).map(m => ({ label: m.name, value: m.id })))
const selectedEnrollment = computed(() => (enrollments.value ?? []).find(e => e.id === Number(state.enrollment_id)))

// Lo ya pagado de la inscripción elegida (sin contar este pago si se edita)
const paidSoFar = ref(0)
async function loadPaid(enrollmentId: number) {
  const { data } = await supabase.from('payments').select('amount').eq('enrollment_id', enrollmentId)
  let paid = (data ?? []).reduce((sum, p) => sum + Number((p as { amount: number }).amount ?? 0), 0)
  if (isEdit.value && props.payment) paid -= Number(props.payment.amount ?? 0)
  paidSoFar.value = paid
}
watch(() => state.enrollment_id, (id) => { if (id) loadPaid(Number(id)) }, { immediate: true })

const remaining = computed(() => Number(selectedEnrollment.value?.agreed_price ?? 0) - paidSoFar.value)

async function onSubmit() {
  if (Number(state.amount) > remaining.value) {
    toast.add({ title: 'Amount exceeds the remaining balance', description: `Remaining: ${formatPrice(remaining.value)}`, color: 'error' })
    return
  }
  loading.value = true
  const fn = isEdit.value ? 'update-payment' : 'create-payment'
  const body = isEdit.value
    ? { id: props.payment!.id, amount: Number(state.amount), payment_method_id: Number(state.payment_method_id), payment_date: state.payment_date }
    : { enrollment_id: Number(state.enrollment_id), amount: Number(state.amount), payment_method_id: Number(state.payment_method_id), payment_date: state.payment_date }
  const { error } = await supabase.functions.invoke(fn, { body })
  loading.value = false
  if (error) {
    toast.add({ title: 'Error', description: error.message, color: 'error' })
    return
  }
  emit('saved')
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(price ?? 0))
}
</script>
