import type { EntryV2 } from '~/utils/db'
import { getPalConfig } from '~/utils/palClient'

export interface OdysseyCitation {
  entryId: number
  dateLabel: string
  snippet: string
  address?: string
}

export interface OdysseyAnswer {
  text: string
  citations: OdysseyCitation[]
  mode: 'local' | 'ai'
}

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseTimeRange(q: string): { start?: Date; end?: Date; label?: string } {
  const now = new Date()
  const yearMatch = q.match(/(20\d{2})\s*年?/)
  if (yearMatch) {
    const y = Number(yearMatch[1])
    const qMatch = q.match(/(?:Q|第\s*)([1-4])\s*(?:季度)?/i)
    if (qMatch) {
      const quarter = Number(qMatch[1])
      const mStart = (quarter - 1) * 3
      return {
        start: new Date(y, mStart, 1),
        end: new Date(y, mStart + 3, 0, 23, 59, 59),
        label: `${y} 年第 ${quarter} 季度`,
      }
    }
    const mMatch = q.match(/(\d{1,2})\s*月/)
    if (mMatch) {
      const m = Number(mMatch[1]) - 1
      if (m >= 0 && m <= 11) {
        return {
          start: new Date(y, m, 1),
          end: new Date(y, m + 1, 0, 23, 59, 59),
          label: `${y} 年 ${m + 1} 月`,
        }
      }
    }
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59), label: `${y} 年` }
  }
  if (/今年/.test(q)) {
    const y = now.getFullYear()
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59), label: '今年' }
  }
  if (/去年/.test(q)) {
    const y = now.getFullYear() - 1
    if (/圣诞/.test(q)) {
      return { start: new Date(y, 11, 20), end: new Date(y, 11, 28, 23, 59, 59), label: `${y} 年圣诞节前后` }
    }
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59), label: '去年' }
  }
  if (/本月|这个月/.test(q)) {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
      label: '本月',
    }
  }
  if (/上月|上个月/.test(q)) {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
      label: '上个月',
    }
  }
  if (/最近|近期|本周|这周/.test(q)) {
    const start = new Date(now)
    start.setDate(now.getDate() - 14)
    return { start, end: now, label: '最近两周' }
  }
  return {}
}

function tokenizeQuery(q: string): string[] {
  const cleaned = q
    .replace(/[？?！!。，,、；;：:""''（）()]/g, ' ')
    .replace(/(我在|我|的|了|吗|呢|什么|哪些|多少篇|几篇|统计|总结|一下|按月|写过|做过|关于|去年|今年|本月|上月|最近)/g, ' ')
    .trim()
  const parts = cleaned.split(/\s+/).filter((w) => w.length >= 2)
  const chars = cleaned.replace(/\s+/g, '')
  if (parts.length === 0 && chars.length >= 2) {
    for (let i = 0; i < chars.length - 1; i++) parts.push(chars.slice(i, i + 2))
  }
  return [...new Set(parts)].slice(0, 12)
}

export async function answerOdysseyQuestion(
  question: string,
  entries: EntryV2[],
  blockedEntryIds: number[] = [],
): Promise<OdysseyAnswer> {
  const blocked = new Set(blockedEntryIds)
  const active = entries.filter((e) => e.id != null && !blocked.has(e.id))
  if (!active.length) {
    return {
      text: '你还没有可检索的日记。先写下第一篇日记，再来向我提问吧！',
      citations: [],
      mode: 'local',
    }
  }

  const range = parseTimeRange(question)
  const scoped = active.filter((e) => {
    const d = new Date(e.dateOfJournal)
    if (range.start && d < range.start) return false
    if (range.end && d > range.end) return false
    return true
  })

  const isStatQuery = /多少篇|几篇|统计|按月|频率|一共写/.test(question)
  const keywords = tokenizeQuery(question)

  const scored = (scoped.length ? scoped : active).map((entry) => {
    const plain = stripHtml(entry.text)
    const haystack = `${plain} ${(entry.tags || []).join(' ')} ${entry.address || ''}`.toLowerCase()
    let score = 0
    for (const kw of keywords) {
      if (haystack.includes(kw.toLowerCase())) score += 10
    }
    if (range.start && new Date(entry.dateOfJournal) >= range.start) score += 3
    if (entry.favourite) score += 1
    return { entry, plain, score }
  })

  scored.sort((a, b) => b.score - a.score || +new Date(b.entry.dateOfJournal) - +new Date(a.entry.dateOfJournal))
  const top = scored.slice(0, 4).filter((item) => item.plain.length > 0)

  const dateFmt = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
  const citations: OdysseyCitation[] = top.map((item) => ({
    entryId: item.entry.id!,
    dateLabel: dateFmt.format(new Date(item.entry.dateOfJournal)),
    snippet: item.plain.slice(0, 96) + (item.plain.length > 96 ? '…' : ''),
    address: item.entry.address || undefined,
  }))

  // Optional AI synthesis when user configured OpenAI-compatible API in Settings
  const pal = getPalConfig()
  if (pal.apiKey && citations.length > 0) {
    try {
      const contextLines = top.map((item, idx) =>
        `[${idx + 1}] (${dateFmt.format(new Date(item.entry.dateOfJournal))}${item.entry.address ? ` · ${item.entry.address}` : ''}) ${item.plain.slice(0, 260)}`,
      ).join('\n')
      const resp = await fetch(`${pal.endpoint.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pal.apiKey}`,
        },
        body: JSON.stringify({
          model: pal.model || 'gpt-4o-mini',
          temperature: 0.4,
          messages: [
            {
              role: 'system',
              content: '你是「拾叙」的个人日记问答助手。只根据提供的日记片段用简体中文简洁回答，不要编造未出现的事实，并在合适位置用 [1] [2] 标注引用。',
            },
            {
              role: 'user',
              content: `问题：${question}\n\n相关日记（时间范围内共 ${scoped.length} 篇）：\n${contextLines}`,
            },
          ],
        }),
      })
      if (resp.ok) {
        const data = await resp.json()
        const aiText = data?.choices?.[0]?.message?.content?.trim()
        if (aiText) return { text: aiText, citations, mode: 'ai' }
      }
    } catch {
      // Fall back gracefully to local deterministic engine
    }
  }

  if (isStatQuery) {
    const targetList = range.start ? scoped : active
    const byMonth = new Map<string, number>()
    for (const e of targetList) {
      const d = new Date(e.dateOfJournal)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1)
    }
    const breakdown = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([m, c]) => `${m}：${c} 篇`)
      .join('；')
    const scopeText = range.label ? `在${range.label}` : '截至目前'
    return {
      text: `${scopeText}共记录了 ${targetList.length} 篇日记。${breakdown ? `\n按月分布：${breakdown}。` : ''}`,
      citations,
      mode: 'local',
    }
  }

  if (!scoped.length && range.label) {
    return {
      text: `在「${range.label}」时间范围内暂时没有找到日记记录。你可以换个时间范围，或点击下方最近相关的日记看看。`,
      citations,
      mode: 'local',
    }
  }

  if (keywords.length && scored[0] && scored[0].score >= 10) {
    const best = scored[0]
    return {
      text: `我在你的日记中找到了 ${scoped.filter((e) => {
        const h = stripHtml(e.text).toLowerCase()
        return keywords.some((k) => h.includes(k.toLowerCase()))
      }).length || 1} 条最相关记录。其中 ${dateFmt.format(new Date(best.entry.dateOfJournal))} 写道：「${best.plain.slice(0, 120)}${best.plain.length > 120 ? '…' : ''}」\n\n点击下方引用卡片可以直接查看或编辑原文。`,
      citations,
      mode: 'local',
    }
  }

  const latest = top[0]
  return {
    text: `${range.label ? `在${range.label}共有 ${scoped.length} 篇日记，` : ''}为你整理了最相关的 ${citations.length} 篇回忆${latest ? `（最近一篇记录于 ${dateFmt.format(new Date(latest.entry.dateOfJournal))}）` : ''}。点击下方引用卡片即可查看完整内容。`,
    citations,
    mode: 'local',
  }
}
