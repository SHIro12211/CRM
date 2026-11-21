<template>
  <UError
    redirect="/"
    :error="{
      status: 404,
      statusText: 'Page not found',
      message: 'The page you are looking for does not exist.'
    }"
  />
</template>
<script setup></script>
