<template>
  <TitleView title="Edit Enrollment" icon="i-lucide-graduation-cap" />
  <div class="max-w-2xl mx-auto pt-6 px-4">
    <EnrollmentForm v-if="enrollment" :key="enrollment.id" :enrollment="enrollment" @saved="() => navigateTo('/enrollments')" />
    <p v-else class="text-sm text-error">Enrollment not found.</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const supabase = useSupabase()
const enrollmentId = Number(route.params.id)

const { data: enrollmentData, error } = await supabase
  .from('enrollments')
  .select('id, client_id, course_id, agreed_price, payment_type, enrollment_date, status_id')
  .eq('id', enrollmentId)
  .single()
if (error) console.error(error)

const enrollment = enrollmentData
  ? {
      id: enrollmentData.id,
      client_id: enrollmentData.client_id,
      course_id: enrollmentData.course_id,
      agreed_price: enrollmentData.agreed_price,
      payment_type: enrollmentData.payment_type as 'Full' | 'Parcial',
      enrollment_date: enrollmentData.enrollment_date,
      status_id: enrollmentData.status_id,
    }
  : null
</script>

