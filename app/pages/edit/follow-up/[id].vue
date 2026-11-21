<template>
  <TitleView title="Edit Follow-up" icon="i-lucide-phone-call" />
  <div class="max-w-2xl mx-auto pt-6 px-4">
    <FollowUpForm v-if="followUp" :key="followUp.id" :follow-up="followUp" @saved="() => navigateTo('/follow-up')" />
    <p v-else class="text-sm text-error">Follow-up not found.</p>
  </div>
</template>

<script setup lang="ts">
import { CalendarDate, Time, today, getLocalTimeZone } from '@internationalized/date'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const supabase = useSupabase()
const followUpId = Number(route.params.id)

// next_contact (timestamptz) -> CalendarDate en hora local
function toCalendarDate(iso: string | null): CalendarDate {
  if (!iso) return today(getLocalTimeZone())
  const d = new Date(iso)
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

// next_contact (timestamptz) -> Time en hora local
function toTime(iso: string | null): Time {
  if (!iso) return new Time(9, 0)
  const d = new Date(iso)
  return new Time(d.getHours(), d.getMinutes())
}

const { data: followUpData, error } = await supabase
  .from('follow_ups')
  .select('id, client_id, follow_up_type_id, next_contact, notes')
  .eq('id', followUpId)
  .single()
if (error) console.error(error)

const followUp = followUpData
  ? {
      id: followUpData.id,
      client_id: followUpData.client_id,
      follow_up_type_id: followUpData.follow_up_type_id,
      next_follow_up: toCalendarDate(followUpData.next_contact),
      hour: toTime(followUpData.next_contact),
      notes: followUpData.notes,
    }
  : null
</script>
