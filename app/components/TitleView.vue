<template>
  <div class="flex items-center gap-4 mb-1 mt-3">
    <UIcon :name="icon" class="w-6 h-6 text-primary" />
    <h2 class="text-xl font-bold">
      <slot>{{ title }}</slot>
    </h2>
    <div class="flex-1 border-t border-neutral-300 dark:border-neutral-700"></div>
  </div>
</template>
<script setup lang="ts">
defineProps<{
  title: string,
  icon: string
}>()
</script>
