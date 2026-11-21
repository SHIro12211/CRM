<template>
  <TitleView title="Add Follow-up" icon="i-lucide-phone-call" />
  <div class="max-w-2xl mx-auto pt-6 px-4">
    <FollowUpForm @saved="() => navigateTo('/follow-up')" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>
