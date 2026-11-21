<script setup lang="ts">
const props = defineProps<{
  placeholder?: string
}>()

const model = defineModel<string>()
const show = ref(false)
</script>

<template>
  <UInput v-model="model" :type="show ? 'text' : 'password'" :placeholder="placeholder" class="w-full">
    <template #trailing>
      <UButton
        :icon="show ? 'i-lucide-eye-off' : 'i-lucide-eye'"
        color="neutral"
        variant="link"
        size="xs"
        @click="show = !show"
      />
    </template>
  </UInput>
</template>


