<script setup lang="ts">
import { mdiCommentOutline, mdiTextLong, mdiSend } from '@mdi/js'
import { cloudApi } from '~/utils/cloudApi'
import { familyAvatarColor, familyAvatarChar } from '~/utils/familyUi'
import { errorText } from '~/utils/uiText'

/**
 * 家庭互动区（附加功能）：公共日记下的「家人追加段落」与「评论」。
 * 都是服务端追加记录、纯文本插值渲染（防 XSS）；原文永远只有作者能改。
 * 挂载点：家人条目详情（ownerUserId 取 familyAuthor）或自己的
 * visibility=family 日记详情（ownerUserId = 我的 userId，作者在这里看家人的互动）。
 */
const props = defineProps<{ entryOwnerUserId: string; entryClientId: string }>()

const { socialsFor, state, feed, refreshFamily } = useFamilySync()
const joined = computed(() => !!state.value.group)
const items = computed(() => socialsFor(props.entryOwnerUserId, props.entryClientId))
const contributions = computed(() => items.value.filter(s => s.kind === 'contribution'))
const comments = computed(() => items.value.filter(s => s.kind === 'comment'))

const mode = ref<'comment' | 'contribution'>('comment')
const text = ref('')
const sending = ref(false)
const note = ref('')

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

function lines(content: string) {
  return content.split('\n').filter(Boolean)
}

async function send() {
  const content = text.value.trim()
  if (!content || sending.value) return
  sending.value = true
  note.value = ''
  try {
    const { social } = await cloudApi.familySocial({
      entryOwnerUserId: props.entryOwnerUserId,
      entryClientId: props.entryClientId,
      kind: mode.value,
      content,
    })
    text.value = ''
    // 乐观插入：Neon 往返有延迟，先让评论/追加上屏，后台再对齐服务端全量
    feed.value = { ...feed.value, socials: [...feed.value.socials, social] }
    note.value = mode.value === 'comment' ? '评论已发送。' : '段落已追加。'
    void refreshFamily()
  } catch (e) {
    note.value = errorText(e, '发送失败，请重试。')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="jr-family-social">
    <!-- 追加段落（接龙式）：渲染在评论上方，像全家人接着往下写 -->
    <template v-if="contributions.length">
      <div class="jr-social-head"><JrIcon :path="mdiTextLong" :size="16" /> 家人追加的段落</div>
      <div v-for="s in contributions" :key="s.id" class="jr-contribution">
        <div class="jr-social-meta">
          <span class="jr-family-avatar" :style="{ background: familyAvatarColor(s.authorUserId) }">{{ familyAvatarChar(s.authorNickname) }}</span>
          <b>{{ s.authorNickname }}</b>
          <span class="jr-muted">{{ fmtTime(s.createdAt) }}</span>
        </div>
        <p v-for="(line, i) in lines(s.content)" :key="i" class="jr-contribution-text">{{ line }}</p>
      </div>
    </template>

    <div class="jr-social-head"><JrIcon :path="mdiCommentOutline" :size="16" /> 评论（{{ comments.length }}）</div>
    <div v-if="!comments.length" class="jr-muted" style="font-size:12.5px">还没有评论。</div>
    <div v-for="s in comments" :key="s.id" class="jr-comment">
      <span class="jr-family-avatar" :style="{ background: familyAvatarColor(s.authorUserId) }">{{ familyAvatarChar(s.authorNickname) }}</span>
      <div class="jr-comment-main">
        <div class="jr-social-meta">
          <b>{{ s.authorNickname }}</b>
          <span class="jr-muted">{{ fmtTime(s.createdAt) }}</span>
        </div>
        <p v-for="(line, i) in lines(s.content)" :key="i" class="jr-comment-text">{{ line }}</p>
      </div>
    </div>

    <template v-if="joined">
      <div class="jr-social-tabs">
        <button :class="{ on: mode === 'comment' }" @click="mode = 'comment'">写评论</button>
        <button :class="{ on: mode === 'contribution' }" @click="mode = 'contribution'">追加一段</button>
      </div>
      <textarea
        v-model="text"
        :rows="mode === 'contribution' ? 4 : 1"
        :placeholder="mode === 'comment' ? '写评论…' : '在文末追加一段你的记录（原文不会被改动）…'"
      />
      <div class="jr-social-actions">
        <span v-if="note" class="jr-muted" role="status">{{ note }}</span>
        <button class="jr-btn jr-btn-sm" :disabled="sending || !text.trim()" @click="send">
          <JrIcon :path="mdiSend" :size="14" /> {{ sending ? '发送中…' : '发送' }}
        </button>
      </div>
    </template>
    <p v-else class="jr-muted" style="font-size:12px">加入家庭组后可以在这里评论、追加段落。</p>
  </div>
</template>

<style scoped>
.jr-family-social { margin-top: 18px; border-top: 1px solid var(--jr-outline-variant); padding-top: 6px; }
.jr-social-head { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; margin: 12px 0 8px; color: var(--jr-on-bg); }
.jr-social-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.jr-social-meta b { font-size: 12.5px; }
.jr-contribution { background: var(--jr-surface-variant); border-left: 3px solid var(--jr-primary); border-radius: 8px; padding: 10px 12px; margin: 8px 0; }
.jr-contribution-text { font-size: 14px; line-height: 1.7; margin: 4px 0 0; }
.jr-comment { display: flex; gap: 8px; margin: 8px 0; }
.jr-comment-main { flex: 1; min-width: 0; }
.jr-comment-text { font-size: 13.5px; line-height: 1.6; margin: 2px 0 0; }
.jr-social-tabs { display: flex; gap: 6px; margin: 12px 0 6px; }
.jr-social-tabs button { border: 1px solid var(--jr-outline-variant); background: transparent; color: var(--jr-on-surface-variant); border-radius: 999px; padding: 4px 12px; font-size: 12.5px; font-family: inherit; cursor: pointer; }
.jr-social-tabs button.on { background: var(--jr-primary-container); color: var(--jr-on-primary-container); border-color: transparent; }
.jr-social-input textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--jr-outline-variant); border-radius: 10px; padding: 9px 12px; font-family: inherit; font-size: 13.5px; background: var(--jr-surface); color: var(--jr-on-bg); resize: vertical; }
.jr-social-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 6px; }
textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--jr-outline-variant); border-radius: 10px; padding: 9px 12px; font-family: inherit; font-size: 13.5px; background: var(--jr-surface); color: var(--jr-on-bg); resize: vertical; }
</style>
