<script setup lang="ts">
import { mdiAccountGroupOutline, mdiAccountMultipleOutline, mdiCubeOutline, mdiImageOutline, mdiLockOutline, mdiPencil, mdiPlus, mdiRefresh, mdiTrashCanOutline } from '@mdi/js'
import EntryDetail from '~/components/EntryDetail.vue'
import EntryDetailMobile from '~/components/EntryDetailMobile.vue'
import { cloudApi } from '~/utils/cloudApi'
import { db, type EntryV2 } from '~/utils/db'
import { familyAvatarChar, familyAvatarColor } from '~/utils/familyUi'
import { errorText } from '~/utils/uiText'

useHead({ title: '我们的小家' })

const isMobile = useIsMobile()
const canOpen3DHouse = useFamilyHouseAccess()
const { user, checking, loadOwnFamilyEntry } = useCloudSync()
const { state, feed, sharedEntries, busy, loaded, error, refreshFamily, markFamilySeen } = useFamilySync()
const { refresh: refreshEntries, moveToTrash } = useEntries()
const { prefetchFamily, signedUrl, dispose } = useMediaResolver()

const memberId = ref('')
const selectedId = ref<number>()
const thumbnails = ref<Record<number, string>>({})
const composer = ref<{ groupId: string; userId: string; previousMediaIds: string[] }>()
const editing = ref<EntryV2>()
const editor = ref<{ discardChanges: () => Promise<boolean> }>()
const actionBusy = ref(false)
const actionError = ref('')
const removalError = ref('')
const notice = ref('')
const removal = ref<'withdraw' | 'trash'>('withdraw')
const confirmRemoval = ref<HTMLDialogElement>()

const visibleEntries = computed(() => sharedEntries.value.filter(entry => !memberId.value || entry.familyAuthor?.ownerUserId === memberId.value))
const selected = computed(() => visibleEntries.value.find(entry => entry.id === selectedId.value)
  ?? (isMobile.value ? undefined : visibleEntries.value[0]))
const ownSelection = computed(() => feed.value.entries.find(entry => entry.clientId === selected.value?.cloudId
  && entry.ownerUserId === selected.value?.familyAuthor?.ownerUserId && entry.ownerUserId === user.value?.id))
const dayFormat = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
const timeFormat = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
const groups = computed(() => {
  const days = new Map<string, { key: string; label: string; entries: typeof visibleEntries.value }>()
  for (const entry of visibleEntries.value) {
    const date = entry.dateOfJournal
    const key = date.toDateString()
    if (!days.has(key)) days.set(key, { key, label: dayFormat.format(date), entries: [] })
    days.get(key)!.entries.push(entry)
  }
  return [...days.values()]
})

onMounted(() => {
  if (user.value && loaded.value && !busy.value) void refreshFamily()
  markFamilySeen()
})
onBeforeUnmount(dispose)
onBeforeRouteLeave(() => editor.value?.discardChanges())

watch(() => state.value.group?.id, () => {
  selectedId.value = undefined
  memberId.value = ''
  composer.value = undefined
})
watch(() => state.value.members, members => {
  if (memberId.value && !members?.some(member => member.userId === memberId.value)) memberId.value = ''
})
watch(visibleEntries, async (entries, _, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  const photos = entries.flatMap(entry => {
    const photo = entry.familyMedia?.find(item => item.mimeType.startsWith('image/'))
    return photo && entry.id != null ? [{ id: entry.id, pathname: photo.pathname }] : []
  })
  const retained = photos.flatMap(photo => {
    const url = signedUrl(photo.pathname)
    return url ? [[photo.id, url] as const] : []
  })
  thumbnails.value = Object.fromEntries(retained)
  await prefetchFamily(photos.map(photo => photo.pathname))
  if (!active) return
  thumbnails.value = Object.fromEntries(photos.flatMap(photo => {
    const url = signedUrl(photo.pathname)
    return url ? [[photo.id, url] as const] : []
  }))
}, { immediate: true })

function chooseMember(id: string) {
  memberId.value = id
  selectedId.value = undefined
  actionError.value = ''
}

async function startWriting(edit = false) {
  const group = state.value.group
  const account = user.value
  const shared = edit ? ownSelection.value : undefined
  if (!group || !account || actionBusy.value || (edit && !shared)) return
  actionBusy.value = true
  actionError.value = ''
  notice.value = ''
  try {
    editing.value = shared ? await loadOwnFamilyEntry(shared) : undefined
    composer.value = { groupId: group.id, userId: account.id, previousMediaIds: shared?.media.map(photo => photo.clientId) || [] }
  } catch (cause) {
    actionError.value = errorText(cause, '无法打开日记，请重试。')
  } finally {
    actionBusy.value = false
  }
}

const editingMeta = computed(() => {
  if (!editing.value) return undefined
  const { address, lat, lng, locationSource, adcode, sentiment, activity, weatherIcon, weatherDegreeC, weatherDescription,
    weatherPlace, tagWordIds, timezone } = editing.value
  return { address, lat, lng, locationSource, adcode, sentiment, activity, weatherIcon, weatherDegreeC, weatherDescription,
    weatherPlace, tagWordIds, timezone }
})

async function onSaved(savedId?: number) {
  const wasEditing = !!editing.value
  composer.value = undefined
  editing.value = undefined
  if (savedId == null) return
  const entry = await db.entriesV2.get(savedId)
  notice.value = wasEditing ? '已保存修改。' : '已发布到小家。'
  if (!wasEditing) memberId.value = ''
  if (await refreshFamily()) {
    selectedId.value = sharedEntries.value.find(item => item.cloudId === entry?.cloudId
      && item.familyAuthor?.ownerUserId === user.value?.id)?.id
  }
}

const selectedIndex = computed(() => visibleEntries.value.findIndex(entry => entry.id === selected.value?.id))
function step(delta: number) {
  selectedId.value = visibleEntries.value[selectedIndex.value + delta]?.id
  actionError.value = ''
}

function askRemoval(action: 'withdraw' | 'trash') {
  removal.value = action
  removalError.value = ''
  confirmRemoval.value?.showModal()
}

async function remove() {
  const shared = ownSelection.value
  if (!shared || actionBusy.value) return
  actionBusy.value = true
  removalError.value = ''
  try {
    const local = await loadOwnFamilyEntry(shared)
    const official = await cloudApi.familyRemoveEntry({ clientId: shared.clientId, ownerUserId: shared.ownerUserId, action: removal.value })
    const date = official.dateModified ? new Date(official.dateModified) : new Date()
    const newerLocal = +local.dateModified > +date
    await db.entriesV2.update(local.id!, { visibility: 'private', dateModified: newerLocal ? local.dateModified : date, synced: newerLocal ? 0 : 1 })
    if (removal.value === 'trash') await moveToTrash(local.id!)
    else await refreshEntries()
    feed.value = {
      ...feed.value,
      entries: feed.value.entries.filter(entry => entry.ownerUserId !== shared.ownerUserId || entry.clientId !== shared.clientId),
      socials: feed.value.socials.filter(item => item.entryOwnerUserId !== shared.ownerUserId || item.entryClientId !== shared.clientId),
    }
    confirmRemoval.value?.close()
    selectedId.value = undefined
    notice.value = removal.value === 'trash' ? '已移到回收站。' : '已撤回，日记仅自己可见。'
    await refreshFamily()
  } catch (cause) {
    removalError.value = errorText(cause, '操作未完成，请重试。')
  } finally {
    actionBusy.value = false
  }
}
</script>

<template>
  <section class="family-home" aria-labelledby="family-title">
    <header class="family-heading">
      <div class="family-heading-copy">
        <h1 id="family-title">我们的小家</h1>
        <p v-if="state.group">{{ state.group.name }}<span aria-hidden="true"> · </span>{{ state.members?.length || 0 }} 位家人</p>
      </div>
      <NuxtLink v-if="canOpen3DHouse" class="family-button family-house-link" to="/family-house" aria-label="进入 3D 小家">
        <JrIcon :path="mdiCubeOutline" :size="19" /> <span>3D 小家</span>
      </NuxtLink>
      <NuxtLink v-if="state.group" class="family-icon" to="/settings?section=family" aria-label="家庭组设置" title="家庭组设置">
        <JrIcon :path="mdiAccountMultipleOutline" :size="21" />
      </NuxtLink>
      <button v-if="state.group" type="button" class="family-button primary" :disabled="actionBusy || !!composer" @click="startWriting()">
        <JrIcon :path="mdiPlus" :size="19" /> 写日记
      </button>
    </header>

    <p v-if="checking || (user && !loaded && !error)" class="family-message" role="status">正在打开小家…</p>
    <div v-else-if="!user || (!state.group && !error)" class="family-empty">
      <JrIcon :path="mdiAccountGroupOutline" :size="38" />
      <h2>{{ user ? '创建或加入一个家庭组' : '登录后进入小家' }}</h2>
      <p>{{ user ? '你可以创建自己的小家，或使用家人发来的邀请码。' : '家人用各自的账号，分享想让彼此看到的日记。' }}</p>
      <NuxtLink class="family-button primary" :to="user ? '/settings?section=family' : '/cloud'">
        {{ user ? '创建或加入' : '登录或注册' }}
      </NuxtLink>
    </div>
    <div v-else class="family-layout">
      <div class="family-feed" :aria-busy="busy">
        <div class="family-controls" v-if="state.group">
          <div class="family-members" role="group" aria-label="按成员筛选">
            <button type="button" :aria-pressed="!memberId" @click="chooseMember('')">全部</button>
            <button v-for="member in state.members" :key="member.userId" type="button"
              :aria-pressed="memberId === member.userId" @click="chooseMember(member.userId)">
              <span class="jr-family-avatar" :style="{ background: familyAvatarColor(member.userId) }" aria-hidden="true">{{ familyAvatarChar(member.nickname) }}</span>
              {{ member.nickname }}
            </button>
          </div>
          <button type="button" class="family-icon" aria-label="刷新小家" title="刷新小家" :disabled="busy" @click="refreshFamily">
            <JrIcon :path="mdiRefresh" :size="20" />
          </button>
        </div>
        <div v-if="error" class="family-message" role="alert">
          {{ error }} <button type="button" class="family-button" @click="refreshFamily">重试</button>
        </div>
        <p v-if="notice" class="family-message" role="status">{{ notice }}</p>
        <p v-if="actionError" class="family-message" role="alert">{{ actionError }}</p>
        <div v-if="loaded && !visibleEntries.length && !error" class="family-empty">
          <JrIcon :path="mdiImageOutline" :size="33" />
          <h2>{{ memberId ? '这位家人还没有分享日记' : '小家还没有日记' }}</h2>
          <p v-if="!memberId">分享一件今天想让家人知道的小事。</p>
        </div>
        <section v-for="group in groups" :key="group.key" class="family-day">
          <h2>{{ group.label }}</h2>
          <button v-for="entry in group.entries" :key="entry.id" type="button" class="family-row"
            :aria-pressed="selected?.id === entry.id" @click="selectedId = entry.id; actionError = ''; markFamilySeen()">
            <span class="family-row-copy">
              <span v-if="entry.familyAuthor" class="family-byline">
                <span class="jr-family-avatar" :style="{ background: familyAvatarColor(entry.familyAuthor.ownerUserId) }" aria-hidden="true">{{ familyAvatarChar(entry.familyAuthor.ownerNickname) }}</span>
                <b>{{ entry.familyAuthor.ownerNickname }}</b>
                <time :datetime="entry.dateOfJournal.toISOString()">{{ timeFormat.format(entry.dateOfJournal) }}</time>
              </span>
              <span class="family-summary">{{ entry.previewText || '照片日记' }}</span>
            </span>
            <img v-if="entry.id != null && thumbnails[entry.id]" class="family-photo" :src="thumbnails[entry.id]" loading="lazy" alt="" />
            <JrIcon v-else-if="entry.familyMedia?.length" class="family-media-icon" :path="mdiImageOutline" :size="21" />
          </button>
        </section>
      </div>
      <div v-if="composer || selected" class="family-detail">
        <EntryEditor v-if="composer" ref="editor" :inline="!isMobile" :family="composer"
          :entry-id="editing?.id" :initial-text="editing?.text" :initial-date="editing?.dateOfJournal"
          :initial-meta="editingMeta" @done="onSaved" />
        <component v-else-if="selected && (!isMobile || selectedId != null)" :is="isMobile ? EntryDetailMobile : EntryDetail"
          :entry="selected" v-bind="isMobile ? { hasPrev: selectedIndex > 0, hasNext: selectedIndex < visibleEntries.length - 1, notice: actionError, busy: actionBusy } : {}"
          @back="selectedId = undefined; actionError = ''" @prev="step(-1)" @next="step(1)">
          <template v-if="ownSelection" #actions>
            <div class="family-actions">
              <button type="button" class="family-icon" aria-label="编辑共享日记" title="编辑共享日记" :disabled="actionBusy" @click="startWriting(true)">
                <JrIcon :path="mdiPencil" :size="19" />
              </button>
              <button type="button" class="family-button withdraw" :disabled="actionBusy" @click="askRemoval('withdraw')">
                <JrIcon :path="mdiLockOutline" :size="17" /> 撤回共享
              </button>
              <button type="button" class="family-icon" aria-label="移到回收站" title="移到回收站" :disabled="actionBusy" @click="askRemoval('trash')">
                <JrIcon :path="mdiTrashCanOutline" :size="19" />
              </button>
            </div>
          </template>
        </component>
      </div>
    </div>
    <dialog ref="confirmRemoval" class="family-confirm" aria-labelledby="family-confirm-title" @cancel.prevent="!actionBusy && confirmRemoval?.close()">
      <h2 id="family-confirm-title">{{ removal === 'trash' ? '移到回收站？' : '撤回这篇日记？' }}</h2>
      <p>{{ removal === 'trash' ? '这篇日记会从小家移除，并移到你的回收站。' : '家人将无法查看这篇日记，你仍然可以在个人时间线里看到它。' }}</p>
      <p v-if="removalError" role="alert">{{ removalError }}</p>
      <div class="family-actions">
        <button type="button" class="family-button" autofocus :disabled="actionBusy" @click="confirmRemoval?.close()">取消</button>
        <button type="button" class="family-button primary" :disabled="actionBusy" @click="remove">{{ removal === 'trash' ? '移到回收站' : '确认撤回' }}</button>
      </div>
    </dialog>
  </section>
</template>

<style scoped>
.family-home { height: 100%; min-height: 0; display: flex; flex-direction: column; background: var(--jr-bg); }
.family-heading { display: flex; align-items: center; gap: 10px; padding: 24px clamp(16px, 4vw, 44px); border-bottom: 1px solid var(--jr-outline-variant); }
.family-heading-copy { flex: 1; min-width: 0; }
.family-heading h1 { margin: 0; font-size: 1.65rem; line-height: 1.25; letter-spacing: -0.02em; }
.family-heading p { margin: 4px 0 0; font-size: .85rem; color: var(--jr-on-surface-variant); overflow-wrap: anywhere; }
.family-button, .family-icon, .family-members button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 40px; padding: 0 12px; border: 0; border-radius: 8px; background: transparent; color: var(--jr-on-bg); font: inherit; font-size: .875rem; font-weight: 600; text-decoration: none; cursor: pointer; }
.family-button:hover, .family-icon:hover, .family-members button:hover { background: var(--jr-surface-variant); }
.family-button.primary { background: color-mix(in srgb, var(--jr-primary-container) 84%, var(--jr-primary)); color: var(--jr-on-primary-container); }
.family-button.primary:hover { background: color-mix(in srgb, var(--jr-primary-container) 72%, var(--jr-primary)); }
.family-house-link { flex: none; white-space: nowrap; }
.family-icon { width: 42px; padding: 0; flex: none; }
.family-home :is(button, a):focus-visible { outline: 2px solid var(--jr-primary); outline-offset: 2px; }
.family-home button:disabled { opacity: .55; cursor: default; }
.family-layout { display: flex; flex: 1; min-height: 0; }
.family-feed { flex: 1 1 410px; min-width: 0; overflow: auto; }
.family-detail { flex: 1.4 1 540px; display: flex; min-width: 0; min-height: 0; flex-direction: column; border-left: 1px solid var(--jr-outline-variant); background: var(--jr-surface); }
.family-detail :deep(.jr-detail-container) { flex: 1; min-height: 0; }
.family-controls { display: flex; align-items: flex-start; gap: 6px; padding: 12px 14px; border-bottom: 1px solid var(--jr-outline-variant); }
.family-members { display: flex; flex-wrap: wrap; flex: 1; gap: 4px; min-width: 0; }
.family-members button { min-height: 42px; max-width: 100%; overflow-wrap: anywhere; }
.family-members button[aria-pressed="true"] { color: var(--jr-on-primary-container); background: var(--jr-primary-container); }
.family-members .jr-family-avatar, .family-byline .jr-family-avatar { flex: none; }
.family-day { padding: 0 10px; }
.family-day h2 { margin: 16px 8px 4px; color: var(--jr-on-surface-variant); font-size: .825rem; font-weight: 650; }
.family-row { display: flex; align-items: center; width: 100%; min-height: 86px; gap: 14px; padding: 10px 8px; border: 0; border-bottom: 1px solid var(--jr-outline-variant); background: transparent; color: inherit; text-align: left; cursor: pointer; }
.family-row:hover, .family-row[aria-pressed="true"] { background: var(--jr-surface-variant); border-radius: 8px; }
.family-row-copy { flex: 1; min-width: 0; }
.family-byline { display: flex; align-items: center; gap: 7px; font-size: .825rem; }
.family-byline time { color: var(--jr-on-surface-variant); font-variant-numeric: tabular-nums; }
.family-summary { display: -webkit-box; margin-top: 5px; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; font-size: .91rem; line-height: 1.5; }
.family-photo { width: 68px; height: 64px; flex: none; border-radius: 8px; object-fit: cover; background: var(--jr-surface-variant); }
.family-media-icon { color: var(--jr-on-surface-variant); }
.family-message { margin: 10px 18px; color: var(--jr-on-surface-variant); font-size: .875rem; }
.family-empty { padding: 44px 18px; text-align: center; color: var(--jr-on-surface-variant); }
.family-empty h2 { margin: 8px 0; font-size: 1.05rem; color: var(--jr-on-bg); }
.family-empty p { margin: 0 0 16px; font-size: .875rem; }
.family-actions { display: flex; align-items: center; gap: 4px; }
.family-actions .withdraw { white-space: nowrap; }
.family-confirm { width: min(360px, calc(100% - 32px)); padding: 20px; background: var(--jr-surface); color: var(--jr-on-bg); border: 1px solid var(--jr-outline-variant); border-radius: 14px; }
.family-confirm::backdrop { background: rgb(0 0 0 / .4); }
.family-confirm h2 { font-size: 1.1rem; margin: 0 0 8px; }
.family-confirm p { font-size: .875rem; line-height: 1.55; margin: 0 0 16px; color: var(--jr-on-surface-variant); }
.family-confirm .family-actions { justify-content: flex-end; }
@media (max-width: 800px) {
  .family-detail :deep(.jr-detail-top-bar) { flex-wrap: wrap; min-height: 0; }
}
@media (max-width: 600px) {
  .family-home { height: auto; min-height: 100%; }
  .family-heading { padding: 12px 14px; gap: 5px; }
  .family-heading h1 { font-size: 1.35rem; }
  .family-feed { flex-basis: 100%; overflow: visible; }
  .family-detail { flex: 0 0 0; border: 0; }
  .family-controls { padding-inline: 10px; }
  .family-members button, .family-icon, .family-button { min-height: 44px; }
}
</style>
