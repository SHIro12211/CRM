<template>
  <div class="mx-auto w-full max-w-2xl space-y-4 pb-2">
    <h1 class="px-4 pt-2 text-xl font-semibold">Edit payment</h1>
    <div v-if="pending" class="px-4">
      <USkeleton class="h-64 w-full" />
    </div>
    <UCard v-else-if="!payment" class="mx-4">
      <p class="text-center text-muted">Payment not found.</p>
    </UCard>
    <UCard v-else class="mx-4">
      <PaymentForm :key="payment.id" :payment="payment" @saved="navigateTo('/payments')" />
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabase()
const route = useRoute()

const paymentId = route.params.id as string

const { data: payment, pending } = useAsyncData(`payment-${paymentId}`, async () => {
  const { data, error } = await supabase.from('payments')
    .select('id, enrollment_id, amount_paid, payment_method_id, payment_date')
    .eq('id', paymentId)
    .single()
  if (error) return null
  return data
})
</script>
