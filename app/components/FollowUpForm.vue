<template>
  <UForm :schema="schema" :state="state" @submit="onSubmit" class="space-y-4">
    <UFormField label="Client" name="client_id">
      <USelect v-model="state.client_id" :items="clientOptions" value-key="id" label-key="name" placeholder="Select client" :disabled="isEdit" class="w-full" />
    </UFormField>

    <UFormField label="Type" name="follow_up_type_id">
      <USelect v-model="state.follow_up_type_id" :items="typeOptions" value-key="id" label-key="name" placeholder="Select type" class="w-full" />
    </UFormField>

    <UFormField label="Next follow-up" name="next_follow_up">
      <UPopover>
        <UInputDate v-model="state.next_follow_up" class="w-full" />
        <template #content>
          <UCalendar v-model="state.next_follow_up" />
        </template>
      </UPopover>
    </UFormField>

    <UFormField label="Hour" name="hour">
      <UInputTime v-model="state.hour" class="w-full" />
    </UFormField>

    <UFormField label="Notes" name="notes">
      <UTextarea v-model="state.notes" :rows="3" placeholder="Notes" class="w-full" />
    </UFormField>

    <div class="flex justify-center gap-3">
      <UButton type="submit" :loading="saving">{{ isEdit ? 'Save' : 'Create' }}</UButton>
      <UButton color="neutral" variant="outline" to="/follow-up">Cancel</UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { CalendarDate, Time, today, getLocalTimeZone } from '@internationalized/date'

type FormFollowUp = {
  id: number
  client_id: string
  follow_up_type_id: number
  next_follow_up: CalendarDate
  hour: Time
  notes: string | null
}

// Sin prop followUp es crear, con prop followUp es editar
const props = defineProps<{ followUp?: FormFollowUp | null }>()
const emit = defineEmits<{
  saved: [followUp: { id: number, client_id: string, follow_up_type_id: number, next_contact: string | null, notes: string | null }]
}>()

const supabase = useSupabase()
const toast = useToast()
const saving = ref(false)
const isEdit = computed(() => !!props.followUp)
const { isAdvisor } = useRole()

// Clientes (de la tabla clients, con el nombre y quién los creó)
const { data: clientRows } = useAsyncData('followup-clients', async () => {
  const { data } = await supabase
    .from('clients')
    .select('user_id, users(id, name, created_by)')
    .returns<{ user_id: string, users: { id: string, name: string, created_by: string | null } }[]>()
  return data ?? []
})

// Tipos de seguimiento
const { data: typeRows } = useAsyncData('follow-up-types', async () => {
  const { data } = await supabase
    .from('follow_up_types')
    .select('id, name')
    .order('id')
  return (data ?? []) as { id: number, name: string }[]
})

// Mi id, para filtrar los clientes del advisor
const { data: myId } = useAsyncData('followup-me', async () => {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
})

const clientOptions = computed(() => {
  const rows = clientRows.value ?? []
  // Al editar se muestran todos (para que se vea el actual); al crear, el advisor solo ve los suyos
  const filtered = !isEdit.value && isAdvisor.value && myId.value
    ? rows.filter((r) => r.users.created_by === myId.value)
    : rows
  return filtered.map((r) => ({ id: r.user_id, name: r.users.name }))
})

const typeOptions = computed(() => {
  return (typeRows.value ?? []).map((t) => ({ id: t.id, name: t.name }))
})

const schema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  follow_up_type_id: z.number({ error: 'Type is required' }),
  next_follow_up: z.instanceof(CalendarDate, { error: 'Next follow-up date is required' }),
  hour: z.instanceof(Time, { error: 'Hour is required' }),
  notes: z.string().optional(),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  client_id: props.followUp?.client_id,
  follow_up_type_id: props.followUp?.follow_up_type_id ?? undefined,
  next_follow_up: props.followUp?.next_follow_up ?? today(getLocalTimeZone()),
  hour: props.followUp?.hour ?? new Time(9, 0),
  notes: props.followUp?.notes ?? '',
})

// Fecha + hora en un solo timestamp para next_contact
function toISOString(date: CalendarDate, time: Time): string {
  return new Date(date.year, date.month - 1, date.day, time.hour, time.minute).toISOString()
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true
  try {
    const nextContact = toISOString(event.data.next_follow_up, event.data.hour)
    if (isEdit.value && props.followUp) {
      const { data, error } = await supabase.functions.invoke('edit-follow-up', {
        body: {
          id: props.followUp.id,
          follow_up_type_id: event.data.follow_up_type_id,
          next_contact: nextContact,
          notes: event.data.notes?.trim() || null,
        },
      })
      if (error) throw error
      toast.add({ title: 'Success', description: data.message || 'Follow-up updated.', color: 'success' })
      emit('saved', {
        id: props.followUp.id,
        client_id: props.followUp.client_id,
        follow_up_type_id: event.data.follow_up_type_id,
        next_contact: nextContact,
        notes: event.data.notes?.trim() || null,
      })
    } else {
      const { data, error } = await supabase.functions.invoke('create-follow-up', {
        body: {
          client_id: event.data.client_id,
          follow_up_type_id: event.data.follow_up_type_id,
          next_contact: nextContact,
          notes: event.data.notes?.trim() || null,
        },
      })
      if (error) throw error
      toast.add({ title: 'Success', description: data.message || 'Follow-up created.', color: 'success' })
      emit('saved', {
        id: data.data.id,
        client_id: event.data.client_id,
        follow_up_type_id: event.data.follow_up_type_id,
        next_contact: nextContact,
        notes: event.data.notes?.trim() || null,
      })
    }
  } catch (e: any) {
    let message = e?.message || 'Error saving follow-up'
    const body = await e?.context?.json?.()?.catch(() => null)
    if (body?.error) message = body.error
    toast.add({ title: 'Error', description: message, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
