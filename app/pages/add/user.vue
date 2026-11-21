<template>
  <TitleView title="Add User" icon="i-lucide-user" />
  <div class="max-w-2xl mx-auto pt-6 px-4">
    <UserForm @saved="() => navigateTo('/users')" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>
