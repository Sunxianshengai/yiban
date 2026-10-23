// 全年龄段的人生阶段模型。
// 这个文件的存在理由：产品不再只服务长辈，而是「家里每个人、从出生到现在」都记。
// 所以必须有统一的人生阶段划分，才能做成长时间轴、里程碑、分龄提问、成长对比。
// 它只做纯计算，不碰存储、不碰网络，方便单测。

/** 七段人生阶段。from/to 是**年龄**（含边界）。
 *  为什么是七段：婴幼儿(0-6) 童年(7-12) 少年(13-18) 青年(19-30) 壮年(31-50) 中年(51-65) 老年(66+)。
 *  这七段既能覆盖「孩子刚出生」也能覆盖「爷爷奶奶的童年」，而且每段都有
 *  中文家庭语境里说得通的叫法（不是照抄心理学分期）。 */
export const STAGES = [
  {id: 'infancy', label: '婴幼儿', from: 0, to: 6, color: 'peach', hint: '还不会讲完整的句子，但已经会认人、会笑'},
  {id: 'childhood', label: '童年', from: 7, to: 12, color: 'gold', hint: '上小学的年纪，第一次知道「难为情」'},
  {id: 'teen', label: '少年', from: 13, to: 18, color: 'lavender', hint: '开始有自己的主意，也开始有秘密'},
  {id: 'youth', label: '青年', from: 19, to: 30, color: 'blue', hint: '离开家、选定路、遇见要紧的人'},
  {id: 'prime', label: '壮年', from: 31, to: 50, color: 'sage', hint: '上有老下有小，最能扛也最容易扛'},
  {id: 'midadult', label: '中年', from: 51, to: 65, color: 'sage', hint: '孩子长大了，父母变老了'},
  {id: 'elder', label: '老年', from: 66, to: 200, color: 'lavender', hint: '把一辈子慢慢讲出来'},
];

export const DEFAULT_STAGE = STAGES[0];

/** 年龄 → 阶段。age 为空/非法时返回 null（不猜）。 */
export function stageOfAge(age) {
  const n = Number(age);
  if (!Number.isFinite(n) || n < 0) return null;
  return STAGES.find(s => n >= s.from && n <= s.to) || STAGES[STAGES.length - 1];
}

/** 年份 → 年龄。birthYear 缺失或 year 早于出生年时返回 null。 */
export function ageAtYear(birthYear, year) {
  const b = Number(birthYear);
  const y = Number(year);
  if (!Number.isFinite(b) || !Number.isFinite(y)) return null;
  const age = y - b;
  return age >= 0 && age <= 130 ? age : null;
}

/** 年份 → 阶段（先算年龄再归段）。任一项缺失返回 null。 */
export function stageAtYear(birthYear, year) {
  const age = ageAtYear(birthYear, year);
  return age === null ? null : stageOfAge(age);
}

/** 出生年份 → 规范化的四位年份字符串；不合法一律回落到空串。
 *  为什么是空串而不是报错：出生年份是「可后补」的字段，
 *  老数据本来就没有它，用户也可能填错一个字（比如 1865）。
 *  宁可当成「没填」继续用，也不能因为一个可选字段把整条保存流程卡死。 */
export function sanitizeBirthYear(value) {
  const raw = String(value ?? '').trim();
  if (!/^(19|20)\d{2}$/.test(raw)) return '';
  return raw;
}

/** 里程碑清单。key 用于去重，stage 表示该里程碑属于哪一段（'any' 表示任何年纪都可能）。
 *  中文家庭语境特意放进「金榜题名」「第一次独自远行」这类国内才有的节点。 */
export const MILESTONES = [
  {key: 'first-smile', label: '第一次笑出声', stage: 'infancy'},
  {key: 'first-tooth', label: '长出第一颗牙', stage: 'infancy'},
  {key: 'first-word', label: '第一次叫妈妈/爸爸', stage: 'infancy'},
  {key: 'first-step', label: '第一次自己走路', stage: 'infancy'},
  {key: 'first-day-kindergarten', label: '第一天上幼儿园', stage: 'infancy'},
  {key: 'first-school-day', label: '第一天上小学', stage: 'childhood'},
  {key: 'first-lost-tooth', label: '掉第一颗乳牙', stage: 'childhood'},
  {key: 'first-red-scarf', label: '戴上红领巾', stage: 'childhood'},
  {key: 'first-bike', label: '学会骑自行车', stage: 'childhood'},
  {key: 'first-award', label: '第一次上台领奖', stage: 'childhood'},
  {key: 'first-alone-trip', label: '第一次独自出门', stage: 'teen'},
  {key: 'first-board', label: '第一次住校', stage: 'teen'},
  {key: 'first-crush', label: '第一次喜欢一个人', stage: 'teen'},
  {key: 'gaokao', label: '金榜题名（考上大学）', stage: 'teen'},
  {key: 'first-leave-home', label: '离开家去外地上学', stage: 'youth'},
  {key: 'first-job', label: '第一份工作', stage: 'youth'},
  {key: 'first-salary', label: '领到第一份工资', stage: 'youth'},
  {key: 'first-love', label: '遇见要一起过日子的人', stage: 'youth'},
  {key: 'marriage', label: '结婚', stage: 'youth'},
  {key: 'first-home', label: '有了自己的家（买房/乔迁）', stage: 'prime'},
  {key: 'become-parent', label: '当上爸爸/妈妈', stage: 'prime'},
  {key: 'child-school', label: '送孩子上学', stage: 'prime'},
  {key: 'career-high', label: '事业上最得意的一次', stage: 'prime'},
  {key: 'child-gaokao', label: '孩子金榜题名', stage: 'midadult'},
  {key: 'child-marriage', label: '孩子成家', stage: 'midadult'},
  {key: 'become-grandparent', label: '当上爷爷/奶奶', stage: 'midadult'},
  {key: 'retire', label: '退休', stage: 'midadult'},
  {key: 'grandchild-born', label: '孙辈出生', stage: 'elder'},
  {key: 'anniversary-50', label: '结婚五十年', stage: 'elder'},
  {key: 'story-recorded', label: '把这一辈子讲了一遍', stage: 'elder'},
];

/** 某个阶段该问的问题（D 分龄采访用）。
 *  语气刻意不同：对小孩问具体的小事，对少年问不敢说的事，对老人问那条街上有什么。 */
export const INTERVIEW = {
  infancy: ['那一年他最爱抱着什么？', '谁一伸手他就笑？', '第一次生病是哪一次？'],
  childhood: ['那时候放学路上会经过什么？', '有没有一个你到现在还记得的老师？', '那时候最怕谁发现你在做什么？'],
  teen: ['那时候你最不想让爸妈知道的一件事？', '有没有一个人，改变了你后来的路？', '那时候觉得自己长大以后会做什么？'],
  youth: ['刚离开家那阵子，最难的是哪一件事？', '第一次拿到工资，先给谁买了什么？', '那时候觉得自己不会变成什么样的大人？'],
  prime: ['那几年最累的是哪一年？', '有没有哪次，是你咬着牙扛过来的？', '那时候有没有一件后来想起来遗憾的事？'],
  midadult: ['孩子离开家那阵子，家里安静下来是什么感觉？', '父母开始需要你照顾，是从哪一年开始的？', '这辈子最想再看一次哪一天？'],
  elder: ['那时候这条街上都有什么？', '哪一顿饭，你到现在还记得味道？', '有没有一句话，是你这辈子一直记着的？'],
};

/** H 成长对比的固定问题：同一个问题，不同年份问同一个人，答案并排放。 */
export const GROWTH_QUESTIONS = [
  {key: 'place', label: '最想去的地方'},
  {key: 'fear', label: '最害怕的事'},
  {key: 'thanks', label: '最感谢的人'},
  {key: 'dream', label: '长大想做什么'},
  {key: 'happy', label: '最开心的一件事'},
];

/** 分龄陪伴（F）的语气设定，喂给家伴的 system prompt。 */
export const COMPANION_TONE = {
  infancy: '对方还小，你说的话要短，一句话一个意思，多用具体的东西（小猫、糖、门口那棵树），不要讲道理。',
  childhood: '对方是小学生，你可以讲故事，讲你像他这么大的时候发生过什么，让他觉得「原来你也这样」。不要考他、不要问他作业。',
  teen: '对方是少年。你要做的是树洞：不评判、不告状、不说「你应该」。可以讲他父母在他这个年纪也做过类似的事，让他知道自己不孤单。',
  youth: '对方正处在要自己做决定的年纪。帮他理清他真正在意的是什么，不要替他下结论。',
  prime: '对方正扛着上有老下有小的日子。先确认他已经做得够多了，再聊具体怎么喘口气。',
  midadult: '对方开始面对父母老去、孩子离家。陪他把这一段的变化说出口，不要急着给建议。',
  elder: '对方想把一辈子慢慢讲出来。你负责接住、追问细节（那时候是什么味道、什么声音），不要打断，不要总结。',
};

/** 一个成员的阶段概览：给时间轴/平行时间轴用。
 *  memories 需带 year；member 需带 birthYear（可选，没有就只用阶段/年份排序）。 */
export function buildTimeline(member, memories) {
  const birth = Number(member?.birthYear) || null;
  const items = memories
    .filter(m => m.status === 'confirmed')
    .map(m => {
      const year = Number(m.year) || null;
      const age = birth && year ? ageAtYear(birth, year) : null;
      return {memoryId: m.id, year: m.year || '', age, stage: age === null ? null : stageOfAge(age).id, title: m.title, theme: m.theme, cover: m.cover || null};
    })
    .filter(x => x.year)
    .sort((a, b) => Number(a.year) - Number(b.year));
  const covered = [...new Set(items.map(x => x.stage).filter(Boolean))];
  const missing = STAGES.filter(s => !covered.includes(s.id)).map(s => s.id);
  return {memberId: member?.id || null, name: member?.name || '', birthYear: birth, items, coveredStages: covered, missingStages: missing};
}

/** E 家庭平行时间轴：给一个年份，横排展示每个成员那年几岁、在做什么（有没有记忆）。 */
export function buildParallel(members, memories, year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return {year: null, rows: []};
  const rows = members.map(member => {
    const birth = Number(member.birthYear) || null;
    const age = birth ? ageAtYear(birth, y) : null;
    const mine = memories.filter(m => m.status === 'confirmed' && Number(m.year) === y && (m.subjectId === member.id || m.people.includes(member.name)));
    return {
      memberId: member.id, name: member.name, relation: member.relation || '',
      age, stage: age === null ? null : stageOfAge(age).id,
      memories: mine.map(m => ({id: m.id, title: m.title, cover: m.cover || null})),
    };
    // 从年纪最大的排到最小的：中文语境里「1998 年：爸爸 28、妈妈 26、我 6」就是这样念的。
  }).filter(r => r.age !== null).sort((a, b) => b.age - a.age);
  return {year: y, rows};
}

/** 里程碑完成度：done 是已勾选的 key 数组。 */
export function milestoneProgress(done = []) {
  const set = new Set(done);
  const list = MILESTONES.map(m => ({...m, done: set.has(m.key)}));
  return {total: list.length, done: list.filter(m => m.done).length, list};
}

export function sanitizeQuote(input = {}) {
  const text = String(input.text ?? '').trim().slice(0, 300);
  if (!text) throw new Error('先记下这句话');
  return {
    text,
    memberId: String(input.memberId || '').trim().slice(0, 80),
    age: Number.isFinite(Number(input.age)) ? Number(input.age) : null,
    year: /^\d{4}$/.test(String(input.year || '')) ? String(input.year) : new Date().getFullYear().toString(),
    saidAt: String(input.saidAt || new Date().toISOString()),
  };
}

export function sanitizeCapsule(input = {}) {
  const text = String(input.text ?? '').trim().slice(0, 2000);
  if (!text) throw new Error('写一句想留给未来的话');
  const target = String(input.targetMemberId || '').trim().slice(0, 80);
  if (!target) throw new Error('选一位要收到这段话的家人');
  const openAt = String(input.openAt || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(openAt)) throw new Error('请选择开启日期（年-月-日）');
  return {text, targetMemberId: target, openAt, title: String(input.title || '').trim().slice(0, 60)};
}

export function capsuleState(capsule, now = new Date()) {
  const open = new Date(`${capsule.openAt}T00:00:00`);
  const locked = open.getTime() > now.getTime();
  const days = Math.ceil((open.getTime() - now.getTime()) / 86400000);
  return {locked, daysLeft: locked ? days : 0};
}

/** G 高光时刻仪式感模板。中文家庭真正会郑重其事的时刻才收进来——
 *  每个模板给出一组「该填什么」的栏位提示，而不是替用户写内容；
 *  事实仍然只能来自家人核对过的记忆，这一点与 lib/game.mjs 的红线一致。 */
export const HIGHLIGHT_TEMPLATES = [
  {id: 'gaokao', icon: 'sparkle', label: '金榜题名',
   fields: {mood: '查到分数那一刻是什么心情', people: '谁陪在身边', detail: '录取的学校与专业', note: '想对当时的自己说的话'}},
  {id: 'marriage', icon: 'heart', label: '结婚',
   fields: {mood: '那天最难忘的一个瞬间', people: '在场的重要的人', detail: '办酒的日子与地方', note: '想留给对方的一句话'}},
  {id: 'newborn', icon: 'sun', label: '新生儿降生',
   fields: {mood: '第一次抱到孩子的心情', people: '陪产/来探望的人', detail: '出生的日子、时辰与体重', note: '想对孩子说的话'}},
  {id: 'first-job', icon: 'book', label: '第一份工作',
   fields: {mood: '入职第一天的感受', people: '帮过忙、引过路的人', detail: '单位、岗位与第一天发生的具体事', note: '想对刚入职的自己说的话'}},
  {id: 'new-home', icon: 'home', label: '乔迁新居',
   fields: {mood: '第一次开门进新家的感觉', people: '来暖房的人', detail: '小区、楼层与搬进去的日子', note: '想在这个家里实现的愿望'}},
];

/** 高光时刻清洗：模板 id 必须在清单里；各栏位限长，填不满的栏位回落空串
 *  （仪式感不该靠必填校验逼出来，用户愿意只填一句也允许存）。 */
export function sanitizeHighlight(input = {}) {
  const template = HIGHLIGHT_TEMPLATES.find(t => t.id === input.template);
  if (!template) throw new Error('选一个高光时刻模板');
  const memberId = String(input.memberId || '').trim().slice(0, 80);
  if (!memberId) throw new Error('选一位主角');
  const fields = {};
  for (const key of Object.keys(template.fields)) fields[key] = String(input.fields?.[key] ?? '').trim().slice(0, 500);
  const year = String(input.year || '').trim();
  if (year && !/^\d{4}$/.test(year)) throw new Error('年份请填四位，例如 2024');
  return {template: template.id, memberId, fields, year: year || new Date().getFullYear().toString(), title: String(input.title || '').trim().slice(0, 80)};
}
