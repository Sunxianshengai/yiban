<script setup lang="ts">
import {
  mdiBookOpenPageVariantOutline,
  mdiImageMultipleOutline,
  mdiMapMarkerOutline,
  mdiCalendarMonth,
  mdiFormatBold,
  mdiFormatItalic,
  mdiFormatListBulleted,
  mdiCheckboxMarkedOutline,
  mdiFormatColorHighlight,
  mdiCameraOutline,
  mdiMusicNoteOutline,
  mdiEmoticonHappyOutline,
  mdiEmoticonSadOutline,
  mdiEmoticonAngryOutline,
  mdiAccountGroupOutline,
  mdiCloudUploadOutline,
  mdiLockOutline,
  mdiDownloadOutline,
  mdiHistory,
  mdiArrowRight,
  mdiWeatherSunny,
  mdiStar,
  mdiMapMarker,
  mdiCheck,
} from '@mdi/js'

useHead({ title: '拾叙 — 你值得信赖的日记伙伴' })

/** 落地页固定浅色板（对照 journey.cloud 首页视觉，不随应用主题变化）。
 *  演示区全部渲染真实数据（自己的日记/照片/家人动态/心情曲线），新访客用精写示例日记本兜底。 */

// 顶层解构：模板对顶层 ref 才会自动解包（对象属性里的 ref 不会）
const {
  heroEntries, heroPhoto, hasRealEntries,
  moodCells, family, totalEntries, photoCount, streakCount,
  throwback, mediaThumbs, mapPins, calendarDays,
} = useLandingData()

const demoTab = ref<'media' | 'atlas' | 'calendar'>('media')
const demoTabs = [
  { key: 'media', label: '媒体', icon: mdiImageMultipleOutline },
  { key: 'atlas', label: '地图册', icon: mdiMapMarkerOutline },
  { key: 'calendar', label: '日历', icon: mdiCalendarMonth },
] as const

const toolBubbles = [
  { icon: mdiFormatBold, label: '粗体', x: 6, y: 18, c: '#7C4DFF' },
  { icon: mdiFormatItalic, label: '斜体', x: 22, y: 6, c: '#26A69A' },
  { icon: mdiFormatListBulleted, label: '列表', x: 40, y: 2, c: '#F59E0B' },
  { icon: mdiCheckboxMarkedOutline, label: '待办', x: 58, y: 8, c: '#10B981' },
  { icon: mdiFormatColorHighlight, label: '高亮', x: 74, y: 20, c: '#E91E63' },
  { icon: mdiCameraOutline, label: '照片', x: 88, y: 40, c: '#3F51B5' },
  { icon: mdiMusicNoteOutline, label: '音乐', x: 92, y: 64, c: '#00BCD4' },
] as const

const moodColors = ['#e3e9ec', '#aed581', '#fff59d', '#ffab91']
const moodFaces = [
  { icon: mdiEmoticonSadOutline, c: '#5C6BC0' },
  { icon: mdiEmoticonAngryOutline, c: '#EF5350' },
  { icon: mdiEmoticonHappyOutline, c: '#FFB300' },
]

const moments = [
  { emoji: '🏔️', t: '一场说走就走的旅行', d: '沿途的照片、定位与天气自动归档进日记，地图册替你记住每一段路。' },
  { emoji: '👨‍👩‍👧', t: '和家人共写一本日记', d: '把日记共享给家人：他们可以评论、也可以在文末追加一段，原文永远只有你能改。' },
  { emoji: '🌙', t: '睡前三分钟的心事', d: '本地优先、随手可写；心情与天气悄悄记下，多年后翻回来还是那天晚上的样子。' },
]

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="lp">
    <!-- 顶部导航 -->
    <header class="lp-nav">
      <NuxtLink to="/" class="lp-brand">
        <span class="lp-logo">J</span>
        <span class="lp-brand-name">拾叙</span>
      </NuxtLink>
      <nav class="lp-menu">
        <button type="button" @click="scrollTo('features')">功能</button>
        <button type="button" @click="scrollTo('editor')">编辑器</button>
        <button type="button" @click="scrollTo('family')">共享日记</button>
        <button type="button" @click="scrollTo('sync')">同步与隐私</button>
      </nav>
      <NuxtLink to="/" class="lp-cta">
        打开应用
        <JrIcon :path="mdiArrowRight" :size="16" />
      </NuxtLink>
    </header>

    <!-- Hero -->
    <section class="lp-hero">
      <div class="lp-hero-icon" aria-hidden="true"><JrIcon :path="mdiBookOpenPageVariantOutline" :size="34" /></div>
      <h1>开启你的记录旅程</h1>
      <p class="lp-hero-sub">拾叙，你值得信赖的日记伙伴</p>

      <div class="lp-stage">
        
        <!-- 桌面窗口 mockup：真实最近日记（新访客为示例日记本） -->
        <div class="lp-desktop">
          <div class="lp-dots"><i /><i /><i /></div>
          <div class="lp-desktop-body">
            <div class="lp-d-side">
              <span class="lp-d-nav on">时间线</span>
              <span class="lp-d-nav">相册</span>
              <span class="lp-d-nav">日历</span>
              <span class="lp-d-nav">写作伙伴</span>
              <span class="lp-d-nav">家庭组</span>
            </div>
            <div class="lp-d-list">
              <div v-for="(e, ei) in heroEntries" :key="`he-${ei}`" class="lp-d-row">
                <span class="lp-d-date"><i>{{ e.weekday }}</i><b>{{ e.day }}</b></span>
                <span class="lp-d-main">
                  <span class="lp-d-title-row">
                    <b>{{ e.title }}</b>
                    <i v-if="e.fav" class="lp-d-fav"><JrIcon :path="mdiStar" :size="11" /></i>
                  </span>
                  <span>{{ e.snippet }}</span>
                  <span class="lp-d-meta">
                    <i v-if="e.mood">{{ e.mood }}</i>
                    <i v-if="e.weatherEmoji">{{ e.weatherEmoji }} {{ e.temp }}°</i>
                    <i v-if="e.place"><JrIcon :path="mdiMapMarker" :size="10" /> {{ e.place }}</i>
                  </span>
                </span>
              </div>
            </div>
            <div class="lp-d-entry">
              <span class="lp-d-entry-date">{{ heroEntries[0]?.monthDay }} · 星期{{ (heroEntries[0]?.weekday || '').slice(-1) }}</span>
              <b class="lp-d-entry-title">{{ heroEntries[0]?.title }}</b>
              <span class="lp-d-entry-line" />
              <span class="lp-d-entry-line short" />
              <span v-if="heroPhoto" class="lp-d-entry-photo real">
                <img :src="heroPhoto" alt="" />
              </span>
              <span v-else class="lp-d-entry-photo" />
              <span class="lp-d-entry-tags">
                <i v-if="heroEntries[0]?.weatherEmoji">{{ heroEntries[0].weatherEmoji }} {{ heroEntries[0].temp }}°</i>
                <i v-if="heroEntries[0]?.place"><JrIcon :path="mdiMapMarker" :size="10" /> {{ heroEntries[0].place }}</i>
                <i v-if="heroEntries[0]?.mood">{{ heroEntries[0].mood }}</i>
              </span>
            </div>
          </div>
        </div>
        <!-- 手机 mockup：真实家庭组 -->
        <div class="lp-phone lp-phone-a">
          <span class="lp-p-head">
            家庭 · {{ family.name }}
            <i v-if="family.unread" class="lp-family-dot" />
          </span>
          <span v-for="(m, i) in family.lines.slice(0, 2)" :key="i" class="lp-p-row">
            <i class="lp-p-ava" :style="{ background: m.color }">{{ m.who.slice(0, 1) }}</i>
            <span><b>{{ m.who }}</b> {{ m.kind }}：{{ m.text }}</span>
          </span>
          <span class="lp-p-chip">家人追加的段落 · 2</span>
        </div>
        <!-- 手机 mockup：真实心情 -->
        <div class="lp-phone lp-phone-b">
          <span class="lp-p-head">心情 · 近 4 周</span>
          <span class="lp-p-moods">
            <i v-for="(m, i) in moodCells.slice(0, 21)" :key="i" :style="{ background: moodColors[m] }" />
          </span>
          <span class="lp-p-row"><i class="lp-p-ava smile"><JrIcon :path="mdiEmoticonHappyOutline" :size="14" /></i><span>今天心情不错</span></span>
        </div>
        <!-- 小羊 + 气泡 -->
        <img src="/pet/lamb-poster.webp" alt="瞌睡小羊" class="lp-lamb" />
        <span class="lp-bubble b1"><JrIcon :path="mdiEmoticonHappyOutline" :size="26" /></span>
        <span class="lp-bubble b2"><JrIcon :path="mdiWeatherSunny" :size="22" /></span>
      </div>

      <NuxtLink to="/" class="lp-cta lp-cta-big">
        开始写日记
        <JrIcon :path="mdiArrowRight" :size="17" />
      </NuxtLink>
      <p class="lp-hero-note" role="status">
        {{ hasRealEntries ? '↑ 上面展示的就是你的日记本 — 打开应用，接着写。' : '↑ 示例日记本 — 打开应用写下你的第一篇。' }}
      </p>
    </section>

    <!-- 功能一览 -->
    <section id="features" class="lp-section">
      <h2>捕捉美丽的回忆</h2>
      <p class="lp-lead">照片、视频、音频、地点与天气——生活里的美好时刻，都值得被完整地留下来。</p>
      <div class="lp-cards">
        <div class="lp-card">
          <div class="lp-demo-tabs">
            <button
              v-for="t in demoTabs" :key="t.key" type="button"
              :class="{ on: demoTab === t.key }" @click="demoTab = t.key"
            >
              <JrIcon :path="t.icon" :size="15" /> {{ t.label }}
            </button>
          </div>
          <div class="lp-demo-body">
            <!-- 媒体：真实照片 -->
            <template v-if="demoTab === 'media'">
              <b>媒体</b>
              <p>单张图片里可以储存丰富的记忆。轻松地将照片、视频、GIF 和音乐上传到你的日记条目中。</p>
              <div class="lp-demo-grid">
                <template v-if="mediaThumbs.length">
                  <img v-for="(u, i) in mediaThumbs" :key="i" :src="u" alt="你的照片" />
                </template>
                <template v-else>
                  <i /><i /><i /><i />
                </template>
              </div>
            </template>
            <!-- 地图册：真实定位条目 -->
            <template v-else-if="demoTab === 'atlas'">
              <b>地图册</b>
              <p>在条目中标记位置，自动整理成一本旅行日志。在地图册上查看你去过的地方，和在那里留下的照片与文字。</p>
              <div class="lp-demo-map">
                <i v-for="(p, i) in mapPins" :key="i" :style="{ left: `${p.x}%`, top: `${p.y}%` }" />
              </div>
            </template>
            <!-- 日历：真实当月 -->
            <template v-else>
              <b>日历</b>
              <p>用日历规划一周或一个月，一眼看到哪些天写下了日记，安排你的自我照顾时间。</p>
              <div class="lp-demo-cal">
                <i v-for="n in 28" :key="n" :class="{ on: calendarDays.has(n) }" />
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- 编辑器 -->
    <section id="editor" class="lp-section alt">
      <h2>创建精美的日记条目</h2>
      <p class="lp-lead">段落样式、粗体斜体、待办清单、高亮与颜色，照片音乐随手插入——编辑器里的每一样工具都触手可及。</p>
      <div class="lp-editor-stage">
        <div class="lp-editor-card">
          <span class="lp-ed-line w80" />
          <span class="lp-ed-line w60" />
          <span class="lp-ed-line w70 hl" />
          <span class="lp-ed-line w40" />
          <span class="lp-ed-check"><JrIcon :path="mdiCheckboxMarkedOutline" :size="15" /> 买一束尤加利</span>
          <span class="lp-ed-quote">「重要的不是写下什么，而是明天还想回来写。」</span>
        </div>
        <span
          v-for="b in toolBubbles" :key="b.label"
          class="lp-tool-bubble"
          :style="{ left: `${b.x}%`, top: `${b.y}%`, '--c': b.c }"
          :title="b.label"
        >
          <JrIcon :path="b.icon" :size="20" />
        </span>
      </div>
    </section>

    <!-- 心情 -->
    <section class="lp-section">
      <h2>用心情追踪你的情绪</h2>
      <p class="lp-lead">写日记时顺手记下感受，看看一个月里心情如何起伏。</p>
      <div class="lp-mood-stage">
        <div class="lp-mood-grid">
          <i v-for="(m, i) in moodCells" :key="i" :style="{ background: moodColors[m] }" />
        </div>
        <span class="lp-bubble b3"><JrIcon :path="moodFaces[2].icon" :size="24" :style="{ color: moodFaces[2].c }" /></span>
        <span class="lp-bubble b4"><JrIcon :path="moodFaces[0].icon" :size="20" :style="{ color: moodFaces[0].c }" /></span>
      </div>
    </section>

    <!-- 共享日记 / 家庭组 -->
    <section id="family" class="lp-section alt">
      <h2>共享日记：和家人共写一本</h2>
      <p class="lp-lead">把一篇日记标为「共享给家人」，它会出现在家人的时间线里——可以评论，也可以在文末追加自己的段落。原文，永远只有你能改。</p>
      <div class="lp-family-stage">
        <div class="lp-family-card">
          <div class="lp-fam-row">
            <JrIcon :path="mdiAccountGroupOutline" :size="18" style="color:#44C0FF" />
            <b>{{ family.name }}</b>
            <span v-if="family.unread" class="lp-fam-dot" />
          </div>
          <div v-for="(m, i) in family.lines" :key="i" class="lp-fam-msg">
            <i class="lp-p-ava" :style="{ background: m.color }">{{ m.who.slice(0, 1) }}</i>
            <span><b>{{ m.who }}</b> {{ m.kind }}：{{ m.text }}</span>
          </div>
          <div class="lp-fam-avatars-row">
            <span
              v-for="(m, i) in family.members" :key="i"
              class="lp-p-ava" :style="{ background: m.color }"
            >{{ m.label }}</span>
            <span class="lp-fam-count">{{ family.members.length }} 位成员</span>
          </div>
        </div>
        <div class="lp-family-note">
          <JrIcon :path="mdiLockOutline" :size="16" />
          标为「仅自己」的日记，家人永远看不到。
        </div>
      </div>
    </section>

    <!-- 怀旧 -->
    <section class="lp-section">
      <h2>怀旧你最快乐的时刻</h2>
      <p class="lp-lead">回顾一周、一个月、甚至一年前的今天，你写下了什么。</p>
      <div class="lp-throw-stage">
        <div class="lp-throw-card">
          <JrIcon :path="mdiHistory" :size="20" />
          <span>怀旧 · {{ throwback.years }}</span>
          <b>{{ throwback.text }}</b>
        </div>
      </div>
    </section>

    <!-- 同步与隐私 -->
    <section id="sync" class="lp-section alt">
      <h2>同步与隐私，两样都要</h2>
      <p class="lp-lead">本地优先：日记先写进这台设备，断网也能写。登录后一键同步上云；PIN 密码锁替你守住入口。</p>
      <div class="lp-sync-cards">
        <div class="lp-sync-card">
          <JrIcon :path="mdiCloudUploadOutline" :size="22" />
          <b>云同步</b>
          <p>多设备之间增量同步，附件走私有存储直传。</p>
        </div>
        <div class="lp-sync-card">
          <JrIcon :path="mdiLockOutline" :size="22" />
          <b>密码锁</b>
          <p>4–8 位 PIN 守住新会话，隐私是日记的底线。</p>
        </div>
        <div class="lp-sync-card">
          <JrIcon :path="mdiDownloadOutline" :size="22" />
          <b>随时带走</b>
          <p>一键导出 ZIP / JSON 备份，日记永远属于你。</p>
        </div>
      </div>
    </section>

    <!-- 为不同时刻而写 + 真实统计条 -->
    <section class="lp-section">
      <h2>为每一个值得记下的时刻</h2>
      <div class="lp-stat-strip" role="status">
        <span class="st"><b>{{ totalEntries }}</b>篇日记</span>
        <span class="st"><b>{{ photoCount }}</b>张照片</span>
        <span class="st"><b>{{ streakCount }}</b>天连续记录</span>
        <span class="st note">{{ hasRealEntries ? '这是你现在的日记本' : '示例日记本的规模' }}</span>
      </div>
      <div class="lp-moments">
        <div v-for="m in moments" :key="m.t" class="lp-moment">
          <span class="lp-moment-emoji">{{ m.emoji }}</span>
          <b>{{ m.t }}</b>
          <p>{{ m.d }}</p>
        </div>
      </div>
    </section>

    <!-- 底部 CTA + 页脚 -->
    <section class="lp-final">
      <h2>现在，写下第一篇</h2>
      <NuxtLink to="/" class="lp-cta lp-cta-big">
        打开拾叙
        <JrIcon :path="mdiArrowRight" :size="17" />
      </NuxtLink>
    </section>

    <footer class="lp-footer">
      <span>拾叙 · 独立复刻研究项目</span>
      <span>灵感来自 Journey.Cloud 的产品理念，全部界面与代码均为独立实现</span>
    </footer>
  </div>
</template>

<style scoped>
/* 固定浅色板：对照 journey.cloud 首页（浅蓝底 + 大圆角区块 + 深青 CTA），不随应用主题 */
.lp {
  --lp-bg: #eef4f7;
  --lp-panel: #d9e5ec;
  --lp-card: #ffffff;
  --lp-ink: #1f3a44;
  --lp-ink-2: #52707c;
  --lp-brand: #0d5a70;
  --lp-accent: #44c0ff;
  width: 100%;
  min-height: 100vh;
  background:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.55) 0 26px, rgba(255, 255, 255, 0) 26px 52px),
    linear-gradient(180deg, #e4eef3 0%, #dfeaf0 100%);
  color: var(--lp-ink);
  font-family: inherit;
}

/* 导航 */
.lp-nav {
  position: sticky; top: 0; z-index: 30;
  display: flex; align-items: center; gap: 18px;
  padding: 12px 22px;
  background: rgba(228, 238, 243, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(13, 90, 112, 0.08);
}
.lp-brand { display: flex; align-items: center; gap: 9px; text-decoration: none; }
.lp-logo {
  width: 30px; height: 30px; border-radius: 9px;
  background: linear-gradient(150deg, #58ccff, #2196d9);
  color: #fff; font-weight: 800; font-size: 15px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 8px rgba(33, 150, 217, 0.35);
}
.lp-brand-name { font-size: 16px; font-weight: 800; letter-spacing: 3px; color: var(--lp-brand); }
.lp-menu { flex: 1; display: flex; justify-content: center; gap: 4px; }
.lp-menu button {
  border: 0; background: transparent; cursor: pointer;
  padding: 8px 16px; border-radius: 999px;
  font-size: 14px; font-weight: 600; color: var(--lp-brand); font-family: inherit;
}
.lp-menu button:hover { background: rgba(255, 255, 255, 0.8); }
.lp-cta {
  display: inline-flex; align-items: center; gap: 7px;
  background: var(--lp-brand); color: #fff;
  border-radius: 999px; padding: 9px 20px;
  font-size: 14px; font-weight: 700; text-decoration: none;
  box-shadow: 0 3px 10px rgba(13, 90, 112, 0.3);
}
.lp-cta:hover { filter: brightness(1.08); }
.lp-cta-big { padding: 14px 34px; font-size: 16px; }

/* Hero */
.lp-hero { text-align: center; padding: 54px 20px 30px; }
.lp-hero-icon {
  width: 62px; height: 62px; margin: 0 auto 18px; border-radius: 18px;
  background: linear-gradient(150deg, #58ccff, #2196d9);
  color: #fff; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 10px 24px rgba(33, 150, 217, 0.35);
}
.lp-hero h1 { font-size: clamp(30px, 4.6vw, 46px); font-weight: 800; margin: 0 0 10px; color: var(--lp-brand); letter-spacing: -0.5px; }
.lp-hero-sub { font-size: clamp(15px, 2vw, 19px); color: var(--lp-ink-2); margin: 0 0 30px; }
.lp-stage { position: relative; max-width: 980px; margin: 0 auto 30px; min-height: 430px; }
.lp-hero-note { font-size: 12.5px; color: #7e97a1; margin: 6px 0 0; }

/* 桌面 mockup */
.lp-desktop {
  position: absolute; left: 50%; top: 0; transform: translateX(-50%);
  width: min(600px, 92%); border-radius: 14px; overflow: hidden;
  background: #fbfdfe; box-shadow: 0 24px 60px rgba(31, 58, 68, 0.22);
  text-align: left;
}
.lp-dots { display: flex; gap: 6px; padding: 10px 14px; background: #eef3f6; }
.lp-dots i { width: 10px; height: 10px; border-radius: 50%; background: #ff5f57; }
.lp-dots i:nth-child(2) { background: #febc2e; }
.lp-dots i:nth-child(3) { background: #28c840; }
.lp-desktop-body { display: grid; grid-template-columns: 130px 1.1fr 1.3fr; min-height: 250px; }
.lp-d-side { background: #f2f7f9; padding: 12px 10px; display: flex; flex-direction: column; gap: 8px; }
.lp-d-nav { font-size: 11.5px; color: #52707c; padding: 6px 9px; border-radius: 8px; }
.lp-d-nav.on { background: #dff1fa; color: #0d5a70; font-weight: 700; }
.lp-d-list { padding: 12px; display: flex; flex-direction: column; gap: 8px; border-right: 1px solid #e6eef2; }
.lp-d-row { display: flex; gap: 9px; background: #fff; border: 1px solid #e6eef2; border-radius: 10px; padding: 8px 10px; }
.lp-d-date { display: flex; flex-direction: column; align-items: center; color: #2196d9; flex-shrink: 0; }
.lp-d-date i { font-style: normal; font-size: 9.5px; }
.lp-d-date b { font-size: 16px; }
.lp-d-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lp-d-title-row { display: flex; align-items: center; gap: 5px; }
.lp-d-title-row b { font-size: 11.5px; color: #1f3a44; }
.lp-d-fav { color: #f59e0b; display: inline-flex; }
.lp-d-main > span:not(.lp-d-title-row):not(.lp-d-meta) { font-size: 10px; color: #7e97a1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.lp-d-meta { display: flex; gap: 7px; align-items: center; font-size: 9.5px; color: #6a8794; font-style: normal; }
.lp-d-meta i { font-style: normal; display: inline-flex; align-items: center; gap: 2px; }
.lp-d-entry { padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; background: linear-gradient(180deg, #f6fbfd, #eef6fa); }
.lp-d-entry-date { font-size: 10px; color: #7e97a1; }
.lp-d-entry-title { font-size: 15px; color: #1f3a44; }
.lp-d-entry-line { height: 7px; border-radius: 4px; background: #e2edf2; width: 88%; }
.lp-d-entry-line.short { width: 62%; }
.lp-d-entry-photo { height: 64px; border-radius: 8px; overflow: hidden; background: linear-gradient(135deg, #ffe0b2, #ffab91 55%, #ff8a65); }
.lp-d-entry-photo.real img { width: 100%; height: 100%; object-fit: cover; }
.lp-d-entry-tags { display: flex; gap: 7px; font-size: 9.5px; color: #6a8794; }
.lp-d-entry-tags i { font-style: normal; display: inline-flex; align-items: center; gap: 2px; background: #fff; border: 1px solid #e6eef2; border-radius: 999px; padding: 2px 8px; }

/* 手机 mockup */
.lp-phone {
  position: absolute; width: 172px; border-radius: 18px; padding: 12px;
  background: #fff; box-shadow: 0 18px 40px rgba(31, 58, 68, 0.25);
  display: flex; flex-direction: column; gap: 8px; text-align: left;
  border: 5px solid #17262c;
}
.lp-phone-a { right: 2%; top: 148px; transform: rotate(3deg); }
.lp-phone-b { left: 1%; top: 190px; transform: rotate(-3deg); }
.lp-p-head { font-size: 11px; font-weight: 800; color: #0d5a70; display: flex; align-items: center; gap: 5px; }
.lp-p-row { display: flex; align-items: center; gap: 7px; font-size: 10.5px; color: #33454d; background: #f2f7f9; border-radius: 9px; padding: 7px 8px; }
.lp-p-row b { color: #1f3a44; }
.lp-p-ava {
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; font-size: 10px; font-weight: 700; font-style: normal;
}
.lp-p-ava.smile { background: #ffb300; color: #fff; }
.lp-p-chip { align-self: flex-start; font-size: 9.5px; font-weight: 700; color: #2196d9; background: #dff1fa; padding: 4px 9px; border-radius: 999px; }
.lp-p-moods { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.lp-p-moods i { height: 14px; border-radius: 4px; }
.lp-family-dot { width: 8px; height: 8px; border-radius: 50%; background: #44c0ff; }

/* 小羊 + 气泡 */
.lp-lamb {
  position: absolute; right: 24%; bottom: -6px; width: 128px;
  filter: drop-shadow(0 12px 20px rgba(31, 58, 68, 0.3));
  pointer-events: none;
}
.lp-bubble {
  position: absolute; width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 30% 25%, #ffffff, #ffe082 70%);
  box-shadow: 0 8px 18px rgba(31, 58, 68, 0.25), 0 0 0 5px rgba(255, 224, 130, 0.25);
  color: #ffb300;
}
.lp-bubble.b1 { left: 20%; top: 66px; }
.lp-bubble.b2 { left: 30%; top: 150px; width: 34px; height: 34px; background: radial-gradient(circle at 30% 25%, #ffffff, #b3e5fc 70%); color: #2196d9; box-shadow: 0 8px 18px rgba(31, 58, 68, 0.2), 0 0 0 4px rgba(179, 229, 252, 0.3); }
.lp-bubble.b3 { right: 8%; top: -4px; }
.lp-bubble.b4 { left: 6%; bottom: 8px; width: 34px; height: 34px; background: radial-gradient(circle at 30% 25%, #ffffff, #c5cae9 70%); box-shadow: 0 8px 18px rgba(31, 58, 68, 0.2), 0 0 0 4px rgba(197, 202, 233, 0.3); }

/* 区块通用 */
.lp-section { max-width: 900px; margin: 0 auto; padding: 64px 22px; text-align: center; }
.lp-section.alt { max-width: none; background: var(--lp-panel); }
.lp-section.alt > * { max-width: 900px; margin-left: auto; margin-right: auto; }
.lp-section h2 { font-size: clamp(22px, 3vw, 30px); font-weight: 800; margin: 0 0 12px; color: var(--lp-brand); }
.lp-lead { font-size: 15.5px; line-height: 1.8; color: var(--lp-ink-2); margin: 0 auto 34px; max-width: 620px; }

/* 媒体/地图/日历 tab 演示 */
.lp-cards { display: flex; justify-content: center; }
.lp-card {
  width: min(560px, 100%); border-radius: 20px; padding: 18px;
  background: var(--lp-card); box-shadow: 0 16px 40px rgba(31, 58, 68, 0.14);
}
.lp-demo-tabs { display: flex; gap: 6px; background: #eef3f6; border-radius: 999px; padding: 4px; width: max-content; margin: 0 auto 16px; }
.lp-demo-tabs button {
  display: inline-flex; align-items: center; gap: 6px;
  border: 0; background: transparent; cursor: pointer;
  padding: 7px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; color: #52707c; font-family: inherit;
}
.lp-demo-tabs button.on { background: var(--lp-accent); color: #fff; box-shadow: 0 2px 8px rgba(68, 192, 255, 0.4); }
.lp-demo-body { text-align: left; background: #f6fafc; border-radius: 14px; padding: 18px; min-height: 190px; }
.lp-demo-body b { font-size: 14.5px; color: #1f3a44; }
.lp-demo-body p { font-size: 13px; line-height: 1.7; color: #52707c; margin: 8px 0 14px; }
.lp-demo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.lp-demo-grid i { height: 58px; border-radius: 8px; background: linear-gradient(135deg, #b3e5fc, #81d4fa); }
.lp-demo-grid i:nth-child(2) { background: linear-gradient(135deg, #ffe0b2, #ffcc80); }
.lp-demo-grid i:nth-child(3) { background: linear-gradient(135deg, #c8e6c9, #a5d6a7); }
.lp-demo-grid i:nth-child(4) { background: linear-gradient(135deg, #e1bee7, #ce93d8); }
.lp-demo-grid img { width: 100%; height: 58px; object-fit: cover; border-radius: 8px; }
.lp-demo-map { position: relative; height: 96px; border-radius: 10px; background: linear-gradient(135deg, #d7e9f7, #c3ddf0); overflow: hidden; }
.lp-demo-map i { position: absolute; width: 12px; height: 12px; border-radius: 50%; background: #2196d9; border: 2.5px solid #fff; box-shadow: 0 2px 6px rgba(33, 150, 217, 0.5); }
.lp-demo-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
.lp-demo-cal i { height: 22px; border-radius: 6px; background: #e6eef2; }
.lp-demo-cal i.on { background: var(--lp-accent); }

/* 编辑器气泡 */
.lp-editor-stage { position: relative; max-width: 620px; margin: 0 auto; }
.lp-editor-card {
  background: var(--lp-card); border-radius: 18px; padding: 26px 28px 20px;
  box-shadow: 0 16px 40px rgba(31, 58, 68, 0.14);
  display: flex; flex-direction: column; gap: 13px; text-align: left;
}
.lp-ed-line { height: 9px; border-radius: 5px; background: #e6eef2; }
.lp-ed-line.w80 { width: 80%; }
.lp-ed-line.w60 { width: 60%; }
.lp-ed-line.w70 { width: 70%; }
.lp-ed-line.hl { background: linear-gradient(0deg, #fff176 40%, transparent 40%); }
.lp-ed-line.w40 { width: 40%; }
.lp-ed-check { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: #33454d; font-weight: 600; }
.lp-ed-quote { font-size: 12.5px; color: #52707c; border-left: 3px solid var(--lp-accent); padding-left: 10px; }
.lp-tool-bubble {
  position: absolute; width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 30% 25%, #fff, var(--c));
  color: #fff; box-shadow: 0 10px 22px rgba(31, 58, 68, 0.28);
  transform: translate(-50%, -50%);
}

/* 心情 */
.lp-mood-stage { position: relative; width: min(420px, 100%); margin: 0 auto; }
.lp-mood-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; background: var(--lp-card); border-radius: 16px; padding: 16px; box-shadow: 0 16px 40px rgba(31, 58, 68, 0.14); }
.lp-mood-grid i { height: 34px; border-radius: 9px; }

/* 家庭组 */
.lp-family-stage { display: flex; flex-direction: column; gap: 14px; align-items: center; }
.lp-family-card {
  width: min(520px, 100%); border-radius: 18px; padding: 18px;
  background: var(--lp-card); box-shadow: 0 16px 40px rgba(31, 58, 68, 0.14);
  display: flex; flex-direction: column; gap: 12px; text-align: left;
}
.lp-fam-row { display: flex; align-items: center; gap: 9px; font-size: 15px; color: #1f3a44; }
.lp-fam-dot { width: 9px; height: 9px; border-radius: 50%; background: #44c0ff; margin-left: auto; }
.lp-fam-msg { display: flex; align-items: center; gap: 9px; font-size: 13px; color: #33454d; background: #f2f7f9; border-radius: 12px; padding: 10px 12px; }
.lp-fam-msg b { color: #1f3a44; }
.lp-fam-avatars-row { display: flex; align-items: center; gap: 6px; padding-top: 2px; }
.lp-fam-avatars-row .lp-p-ava { width: 24px; height: 24px; font-size: 11px; margin-left: -7px; }
.lp-fam-avatars-row .lp-p-ava:first-child { margin-left: 0; }
.lp-fam-count { font-size: 11.5px; color: #7e97a1; margin-left: 6px; }
.lp-family-note {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12.5px; color: #52707c; background: rgba(255, 255, 255, 0.7);
  border: 1px dashed #9db8c4; border-radius: 999px; padding: 8px 18px;
}

/* 怀旧 */
.lp-throw-stage { display: flex; justify-content: center; }
.lp-throw-card {
  display: flex; align-items: center; gap: 12px;
  width: min(480px, 100%); border-radius: 16px; padding: 18px 22px;
  background: linear-gradient(135deg, #fff8e1, #ffecb3);
  box-shadow: 0 14px 34px rgba(31, 58, 68, 0.14); text-align: left;
  color: #795548;
}
.lp-throw-card span { font-size: 11.5px; font-weight: 800; letter-spacing: 1px; color: #bf8a2e; white-space: nowrap; }
.lp-throw-card b { font-size: 14px; }

/* 同步卡 */
.lp-sync-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; max-width: 760px; margin: 0 auto; }
.lp-sync-card {
  background: var(--lp-card); border-radius: 16px; padding: 20px 16px;
  box-shadow: 0 14px 34px rgba(31, 58, 68, 0.12);
  display: flex; flex-direction: column; align-items: center; gap: 7px; color: #2196d9;
}
.lp-sync-card b { font-size: 14.5px; color: #1f3a44; }
.lp-sync-card p { font-size: 12.5px; line-height: 1.65; color: #52707c; margin: 0; }

/* 真实统计条 */
.lp-stat-strip {
  display: flex; align-items: center; justify-content: center; gap: 26px;
  width: max-content; max-width: 100%; margin: 0 auto 34px;
  background: var(--lp-card); border-radius: 999px; padding: 13px 30px;
  box-shadow: 0 14px 34px rgba(31, 58, 68, 0.12);
  flex-wrap: wrap;
}
.lp-stat-strip .st { display: flex; flex-direction: column; align-items: center; font-size: 11px; color: #7e97a1; }
.lp-stat-strip .st b { font-size: 19px; font-weight: 800; color: #1f3a44; line-height: 1.15; }
.lp-stat-strip .st.note { font-size: 11.5px; color: #2196d9; font-weight: 700; }

/* 时刻 */
.lp-moments { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; max-width: 860px; margin: 0 auto; text-align: left; }
.lp-moment { background: var(--lp-card); border-radius: 16px; padding: 20px; box-shadow: 0 14px 34px rgba(31, 58, 68, 0.12); }
.lp-moment-emoji { font-size: 30px; }
.lp-moment b { display: block; font-size: 14.5px; color: #1f3a44; margin: 10px 0 6px; }
.lp-moment p { font-size: 12.5px; line-height: 1.7; color: #52707c; margin: 0; }

/* 尾部 */
.lp-final { text-align: center; padding: 60px 20px 40px; }
.lp-final h2 { font-size: clamp(24px, 3.4vw, 34px); font-weight: 800; color: var(--lp-brand); margin: 0 0 22px; }
.lp-footer {
  display: flex; flex-direction: column; gap: 4px; align-items: center;
  padding: 26px 20px 34px; font-size: 11.5px; color: #7e97a1;
}

@media (max-width: 720px) {
  .lp-stage { min-height: 0; }
  .lp-desktop { position: static; transform: none; margin: 0 auto; }
  .lp-desktop-body { grid-template-columns: 1fr; }
  .lp-d-entry { display: none; }
  .lp-phone-a { right: 4%; top: -12px; }
  .lp-phone-b { left: 2%; top: 30px; }
  .lp-lamb { width: 92px; right: 8%; }
  .lp-bubble.b1 { left: 6%; }
  .lp-menu { display: none; }
  .lp-sync-cards, .lp-moments { grid-template-columns: 1fr; }
  .lp-stat-strip { gap: 16px; padding: 12px 18px; }
}
</style>
