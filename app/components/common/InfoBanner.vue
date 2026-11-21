<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
  color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
}>(), {
  icon: 'i-lucide-info',
  title: 'This is a banner with an icon.',
  color: 'primary'
})
</script>

<template>
  <UBanner :icon="icon" :title="title" :description="description" :color="color" />
  <slot />
</template>
