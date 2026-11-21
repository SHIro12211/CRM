<template>
  <TitleView title="Add Enrollment" icon="i-lucide-graduation-cap" />
  <div class="max-w-2xl mx-auto pt-6 px-4">
    <EnrollmentForm @saved="() => navigateTo('/enrollments')" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>
