<template>
  <TitleView title="Add Course" icon="i-lucide-book" />
  <div class="max-w-2xl mx-auto pt-6 px-4">
    <CourseForm @saved="() => navigateTo('/course')" />
  </div>
</template>
