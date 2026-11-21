<template>
  <div class="mx-auto w-full max-w-2xl space-y-4 pb-2">
    <h1 class="px-4 pt-2 text-xl font-semibold">Add payment</h1>
    <UCard class="mx-4">
      <PaymentForm @saved="navigateTo('/payments')" />
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

</script>
