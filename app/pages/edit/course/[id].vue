<template>
  <TitleView title="Edit Course" icon="i-lucide-book" />
  <div class="max-w-2xl mx-auto pt-6 px-4">
    <CourseForm v-if="course" :key="course.id" :course="course" @saved="() => navigateTo('/course')" />
    <p v-else class="text-sm text-error">Course not found.</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})
const route = useRoute()
const supabase = useSupabase()
const courseId = Number(route.params.id)

const { data: courseData, error } = await supabase
  .from('courses')
  .select('id, name, description, price, duration, active')
  .eq('id', courseId)
  .single()
if (error) console.error(error)

const { data: topicsData } = await supabase
  .from('topics')
  .select('id, name, content, position, content_version')
  .eq('course_id', courseId)
  .order('position')

const course = courseData ? {
  ...courseData,
  topics: (topicsData ?? []).map(t => ({
    id: t.id,
    name: t.name,
    content: t.content ?? '',
    position: t.position,
    content_version: t.content_version
  }))
} : null

</script>
