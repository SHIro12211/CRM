<template>
  <UForm :schema="schema" :state="state" @submit="onSubmit" class="space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <UFormField label="Name" name="name">
        <UInput v-model="state.name" placeholder="Course name" class="w-full" />
      </UFormField>
      <UFormField label="Price" name="price">
        <UInput v-model="state.price" type="number" placeholder="0.00" class="w-full" />
      </UFormField>
      <UFormField label="Duration" name="duration">
        <UInput v-model="state.duration" placeholder="e.g. 8 weeks" class="w-full" />
      </UFormField>
      <UFormField label="Active" name="active">
        <USwitch v-model="state.active" />
      </UFormField>
      <UFormField label="Description" name="description" class="md:col-span-2">
        <UTextarea v-model="state.description" placeholder="Course description" class="w-full" />
      </UFormField>
    </div>

    <!-- Topics -->
    <div class="border border-default rounded-lg p-4 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold">Topics</h3>
        <UButton icon="i-lucide-plus" variant="soft" size="sm" @click="addTopic">
          Add topic
        </UButton>
      </div>

      <div v-for="(topic, index) in state.topics" :key="topic.key" class="border border-default rounded-lg p-3 space-y-2">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted w-6 text-center">{{ index + 1 }}</span>
          <UFormField :name="`topics.${index}.name`" class="flex-1">
            <UInput v-model="topic.name" placeholder="Topic name" class="w-full" />
          </UFormField>
          <UButton icon="i-lucide-chevron-up" color="neutral" variant="ghost" size="sm" :disabled="index === 0" @click="moveTopic(index, -1)" />
          <UButton icon="i-lucide-chevron-down" color="neutral" variant="ghost" size="sm" :disabled="index === (state.topics?.length ?? 0) - 1" @click="moveTopic(index, 1)" />
          <UButton icon="i-lucide-trash" color="error" variant="ghost" size="sm" @click="removeTopic(index)" />
        </div>
        <UFormField :name="`topics.${index}.content`">
          <UTextarea v-model="topic.content" placeholder="Topic content" :rows="2" class="w-full" />
        </UFormField>
      </div>

      <p v-if="(state.topics?.length ?? 0) === 0" class="text-sm text-muted">
        No topics yet. Add at least one.
      </p>
    </div>

    <div class="flex justify-center gap-3">
      <UButton type="submit" :loading="saving">{{ isEdit ? 'Save' : 'Create' }}</UButton>
      <UButton color="neutral" variant="outline" to="/course">Cancel</UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

type Topic = {
  id: number
  name: string
  content: string
  position: number
  content_version: number
}

type Course = {
  id: number
  name: string
  description: string | null
  price: number
  duration: string | null
  active: boolean
  topics: Topic[]
}

// Si viene course es edición, si no viene es creación
const props = defineProps<{ course?: Course | null }>()
const emit = defineEmits<{ saved: [] }>()

const supabase = useSupabase()
const toast = useToast()
const saving = ref(false)
const isEdit = computed(() => !!props.course)

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  price: z.number().min(0, 'Price must be 0 or more'),
  description: z.string().optional(),
  duration: z.string().optional(),
  active: z.boolean(),
  topics: z.array(z.object({
    id: z.number().nullable(),
    key: z.string(),
    name: z.string().min(1, 'Topic name is required'),
    content: z.string().optional()
  })).min(1, 'Add at least one topic')
})

type Schema = z.output<typeof schema>

let tempKey = 0
const state = reactive<Partial<Schema>>({
  name: props.course?.name,
  price: props.course?.price,
  description: props.course?.description ?? '',
  duration: props.course?.duration ?? '',
  active: props.course?.active ?? true,
  topics: props.course
    ? props.course.topics.map(t => ({ id: t.id, key: `topic-${t.id}`, name: t.name, content: t.content ?? '' }))
    : [{ id: null, key: `new-${++tempKey}`, name: '', content: '' }]
})

function addTopic() {
  state.topics?.push({ id: null, key: `new-${++tempKey}`, name: '', content: '' })
}

function removeTopic(index: number) {
  state.topics?.splice(index, 1)
}

function moveTopic(index: number, direction: number) {
  const topics = state.topics
  if (!topics) return
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= topics.length) return
  const [topic] = topics.splice(index, 1)
  if (!topic) return
  topics.splice(newIndex, 0, topic)
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true
  try {
    if (isEdit.value && props.course) {
      const { data, error } = await supabase.functions.invoke('edit-course', {
        body: {
          id: props.course.id,
          name: event.data.name,
          description: event.data.description,
          price: event.data.price,
          duration: event.data.duration,
          active: event.data.active,
          topics: event.data.topics.map(t => ({
            id: t.id,
            name: t.name,
            content: t.content ?? ''
          }))
        }
      })
      if (error) throw error
      toast.add({ title: 'Success', description: data.message || 'Course updated.', color: 'success' })
    } else {
      const { data, error } = await supabase.functions.invoke('create-course', {
        body: event.data
      })
      if (error) throw error
      toast.add({ title: 'Success', description: data.message || 'Course created.', color: 'success' })
    }
    emit('saved')
  } catch (e: any) {
    let message = e?.message || 'Error saving course'
    const body = await e?.context?.json?.()?.catch(() => null)
    if (body?.error) message = body.error
    toast.add({ title: 'Error', description: message, color: 'error' })
  } finally {
    saving.value = false
  }
   navigateTo('/course')
}
</script>
