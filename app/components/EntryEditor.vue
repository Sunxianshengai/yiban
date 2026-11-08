<script setup lang="ts">
import { mdiCalendarBlankOutline, mdiImageOutline, mdiWeatherSunny, mdiEmoticonOutline, mdiRun, mdiTagOutline, mdiFormatSize, mdiPlus, mdiFormatBold, mdiFormatItalic, mdiFormatStrikethrough, mdiFormatUnderline, mdiFormatColorText, mdiFormatAlignLeft, mdiFormatAlignCenter, mdiUndo, mdiRedo, mdiChevronDown, mdiAlphaW, mdiBookOpenOutline } from '@mdi/js'

const props = defineProps<{ entryId?: number; initialText?: string; initialDate?: Date }>()
const emit = defineEmits<{ (e: 'done'): void }>()

const area = ref<HTMLElement | null>(null)
const words = ref(0)
const chars = ref(0)
const hasContent = ref(false)
const date = ref(props.initialDate ? new Date(props.initialDate) : new Date())

const dateLabel = computed(() =>
  new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date.value).replace(' at ', ' At ').replace(',', ','),
)

onMounted(() => {
  if (props.initialText && area.value) {
    area.value.innerHTML = props.initialText
    recount()
  }
  area.value?.focus()
})

function recount() {
  const t = area.value?.innerText || ''
  const wordsArr = t.trim().split(/\s+/).filter(Boolean)
  words.value = t.trim() ? wordsArr.length : 0
  chars.value = t.replace(/\n/g, '').length
  hasContent.value = !!t.trim() || !!area.value?.querySelector('img')
}

function cmd(name: string, val?: string) {
  area.value?.focus()
  document.execCommand(name, false, val)
  recount()
}

async function save() {
  const text = area.value?.innerHTML || ''
  if (!text.trim()) { emit('done'); return }
  const { createEntry, updateEntry } = useEntries()
  if (props.entryId) await updateEntry(props.entryId, text, date.value)
  else await createEntry(text, date.value)
  emit('done')
}
</script>

<template>
  <div class="jr-editor">
    <div class="jr-editor-head">
      <button class="dt">
        <JrIcon :path="mdiCalendarBlankOutline" :size="19" />
        <span>{{ dateLabel }}</span>
        <JrIcon :path="mdiChevronDown" :size="18" />
      </button>
      <button class="done" @click="save">Done</button>
    </div>

    <div class="jr-editor-body">
      <div
        ref="area"
        class="jr-editor-area"
        contenteditable="true"
        spellcheck="false"
        @input="recount"
      />
    </div>

    <div class="jr-editor-toolbar">
      <button class="tb" title="Journal"><JrIcon :path="mdiBookOpenOutline" :size="20" /></button>
      <button class="tb" title="Location"><JrIcon :path="mdiMapOutline" :size="20" /></button>
      <button class="tb" title="Weather"><JrIcon :path="mdiWeatherSunny" :size="20" /></button>
      <button class="tb" title="Mood"><JrIcon :path="mdiEmoticonOutline" :size="20" /></button>
      <button class="tb" title="Activity"><JrIcon :path="mdiRun" :size="20" /></button>
      <button class="tb" title="Tags"><JrIcon :path="mdiTagOutline" :size="20" /></button>
      <div class="sep" />
      <button class="body-btn" :disabled="!hasContent">
        <JrIcon :path="mdiFormatSize" :size="17" />
        <span>Body</span>
        <JrIcon :path="mdiChevronDown" :size="16" />
      </button>
      <button class="body-btn" :disabled="!hasContent">
        <JrIcon :path="mdiPlus" :size="17" />
        <JrIcon :path="mdiChevronDown" :size="16" />
      </button>
      <div class="sep" />
      <button class="tb" :disabled="!hasContent" @click="cmd('bold')"><JrIcon :path="mdiFormatBold" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" @click="cmd('italic')"><JrIcon :path="mdiFormatItalic" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" @click="cmd('strikeThrough')"><JrIcon :path="mdiFormatStrikethrough" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" @click="cmd('underline')"><JrIcon :path="mdiFormatUnderline" :size="19" /></button>
      <button class="tb" :disabled="!hasContent"><JrIcon :path="mdiFormatColorText" :size="19" /></button>
      <div class="sep" />
      <button class="tb" :disabled="!hasContent" @click="cmd('justifyLeft')"><JrIcon :path="mdiFormatAlignLeft" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" @click="cmd('justifyCenter')"><JrIcon :path="mdiFormatAlignCenter" :size="19" /></button>
      <div class="sep" />
      <button class="tb" :disabled="!hasContent" @click="cmd('undo')"><JrIcon :path="mdiUndo" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" @click="cmd('redo')"><JrIcon :path="mdiRedo" :size="19" /></button>
      <button class="words">
        <span>Words</span>
        <span style="font-weight:700">{{ words }}</span>
        <span>·</span>
        <span>Characters</span>
        <span style="font-weight:700">{{ chars }}</span>
        <JrIcon :path="mdiChevronDown" :size="16" />
      </button>
    </div>
  </div>
</template>
