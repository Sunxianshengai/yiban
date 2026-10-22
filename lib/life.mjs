// 人生推演：L3 对话式人生模拟。
//
// 和以前那版「七段线性选择题」的区别：
//  1) 起点是一段真实记忆，推演从那一刻往后走「如果」——不是把七段记忆串成一条线。
//  2) 每一幕由模型写，玩家除了三个预设选项，还可以写「我想……」。
//  3) 属性会随选择漂移，属性又反过来卡住后面能走的路（低勇气的人不敢开口，
//     高牵挂的人会绕远路回家），所以同一段记忆走两遍能走到不同的地方。
//
// 伦理边界（比旧版更明确，因为现在故事是生成的）：
//  - 起点事实只来自 status==='confirmed' 的记忆，年份/地点/人物照抄。
//  - 从第二幕起是明确的「如果」，不得让真实家人说出他们没说过的话。
//  - 不做对错评价，不给分数排名，结尾只陈述这个人成了什么样。
//  - 任何时候都标明这是假设，不是真实发生过的事。

export const STATS = ['牵挂', '勇气', '守候', '坦然', '胆识', '温情'];

// 两条轴：敢不敢走出去 / 守不守得住人。属性同时影响这两条轴，
// 于是「同一个人、同一段记忆」也能推出不同质地的人生。
export const STAT_META = {
  牵挂: {label: '牵挂', hint: '你有多放不下家里的人', color: 'peach'},
  勇气: {label: '勇气', hint: '你敢不敢把话说出口、把路走出去', color: 'gold'},
  守候: {label: '守候', hint: '你愿意在原地等多久', color: 'sage'},
  坦然: {label: '坦然', hint: '你能不能接住已经发生的事', color: 'lavender'},
  胆识: {label: '胆识', hint: '你敢不敢做没把握的事', color: 'blue'},
  温情: {label: '温情', hint: '你对身边的人有多软', color: 'peach'},
};

export const MIN_STAT = 0;
export const MAX_STAT = 20;
export const MAX_STAGES = 24; // 安全阀：正常由模型决定何时收尾，这里只防无限推演
export const MAX_CHOICE_TEXT = 200; // 玩家自由输入的「我想……」上限
export const MAX_NARRATION = 700;
export const MAX_CHOICE_LABEL = 40;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** 属性的初始值由起点记忆的内容推出来，不随机——同一段记忆开局手感一致。 */
export function startingStats(memory = {}) {
  const text = `${memory.title || ''} ${memory.story || ''}`;
  const base = {牵挂: 4, 勇气: 4, 守候: 4, 坦然: 4, 胆识: 4, 温情: 4};
  const bumps = [
    [/家人|妈妈|爸爸|母亲|父亲|女儿|儿子|老伴|全家|团圆|过年|春节/, ['牵挂', '温情']],
    [/离开|远行|火车|车站|出发|独自|闯|辞职/, ['勇气', '胆识']],
    [/等|守|留下|照顾|陪|一直/, ['守候']],
    [/走|去世|离开我们|病|葬礼|想念|没来得及/, ['坦然']],
    [/第一次|决定|赌|试|选择/, ['胆识']],
  ];
  for (const [pattern, keys] of bumps) {
    if (!pattern.test(text)) continue;
    for (const key of keys) base[key] += 2;
  }
  return base;
}

/** 把一次选择的影响落到属性上，越界就夹住。 */
export function applyDeltas(stats, deltas = {}) {
  const next = {...stats};
  for (const key of STATS) {
    if (deltas[key]) next[key] = clamp((next[key] || 0) + Number(deltas[key]), MIN_STAT, MAX_STAT);
  }
  return next;
}

/** 两条轴的读数，用来给玩家一个「你正在往外走 / 往里收」的直观反馈。 */
export function axes(stats = {}) {
  // 必须取平均，不能直接相加：往外只有两项（勇气、胆识），往里有三项
  // （牵挂、守候、温情）。直接相加的话，属性全是基准值的开局就已经是
  // 「往里收」，玩家一步没走就先被定了性。
  const outward = ((stats.勇气 || 0) + (stats.胆识 || 0)) / 2;
  const inward = ((stats.牵挂 || 0) + (stats.守候 || 0) + (stats.温情 || 0)) / 3;
  const total = outward + inward || 1;
  return {
    outward,
    inward,
    /* 0 = 完全往回收，100 = 完全往外走 */
    balance: Math.round((outward / total) * 100),
    label: outward > inward * 1.2 ? '往外走' : inward > outward * 1.2 ? '往里收' : '停在中间',
  };
}

/**
 * 一局的开局。起点记忆只提供事实；从这里往后全是假设。
 */
export function startRun({memory, subjectName}) {
  if (!memory) throw new Error('这段人生还缺一个起点，换一段已确认的记忆试试');
  const stats = startingStats(memory);
  return {
    id: null, // 由路由层补
    subjectName: String(subjectName || '这位家人').slice(0, 40),
    origin: {
      memoryId: memory.id,
      title: String(memory.title || '').slice(0, 80),
      year: String(memory.year || '').slice(0, 12),
      location: String(memory.location || '').slice(0, 80),
      people: (memory.people || []).slice(0, 8).map(name => String(name).slice(0, 30)),
      story: String(memory.story || memory.title || '').slice(0, 1200),
    },
    stats,
    stages: [],
    stageIndex: 0,
    status: 'playing',
    createdAt: null,
  };
}

/** 当前该展示/推进的一幕。 */
export function currentStage(run) {
  if (!run || run.status !== 'playing') return null;
  return run.stages[run.stageIndex] || null;
}

/**
 * 记录玩家的选择，并推进到下一幕。
 * 局面长短不设死：由模型的 ending 决定什么时候收尾，这里只做硬性兜底。
 */
export function recordChoice(run, {choiceId, text, freeDeltas} = {}) {
  if (!run || run.status !== 'playing') throw new Error('这一局已经结束了');
  const stage = currentStage(run);
  if (!stage) throw new Error('这一幕还没准备好，稍等一下');

  let picked = null;
  if (choiceId) {
    picked = (stage.choices || []).find(choice => choice.id === choiceId);
    if (!picked) throw new Error('这个选项不在当前这一幕里');
  } else {
    const words = String(text || '').trim().slice(0, MAX_CHOICE_TEXT);
    if (!words) throw new Error('写一句你在这个路口会怎么做');
    // 自由输入的权重来自模型对那句话的判定，本地不猜。
    picked = {id: `free-${run.stageIndex}`, label: words, freeText: words, deltas: deltasFromModel(freeDeltas)};
  }

  const stats = applyDeltas(run.stats, picked.deltas || {});
  const answer = {
    stageIndex: run.stageIndex,
    choiceId: picked.id,
    label: String(picked.label || '').slice(0, MAX_CHOICE_TEXT),
    freeText: picked.freeText || null,
    deltas: picked.deltas || {},
    statsAfter: stats,
    at: new Date().toISOString(),
  };
  const stages = run.stages.map((item, index) => (index === run.stageIndex ? {...item, answer} : item));
  const stageIndex = run.stageIndex + 1;
  // 模型说这一幕是最后一幕，就收；否则继续。MAX_STAGES 只是防止无限推演的安全阀。
  const finished = stage.ending === true || stageIndex >= MAX_STAGES;
  return {
    ...run,
    stages,
    stats,
    stageIndex,
    status: finished ? 'finished' : 'playing',
    finishedAt: finished ? new Date().toISOString() : null,
  };
}

/**
 * 玩家自己写的那句话，由模型判定它落到了哪些属性上。
 * 这里只做「合法化」：模型给了什么就用什么，没给就不动属性——
 * 绝不用本地关键词去假装判断了一个人的人生。
 */
export function deltasFromModel(input) {
  if (!input || typeof input !== 'object') return {};
  const deltas = {};
  let count = 0;
  for (const key of STATS) {
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value === 0) continue;
    deltas[key] = Math.max(-3, Math.min(3, Math.round(value)));
    if (++count >= 3) break;
  }
  return deltas;
}

/** 交给前端的形态：机制细节（提示词、原始 JSON）不下发。 */
export function publicRun(run) {
  if (!run) return null;
  return {
    id: run.id,
    subjectName: run.subjectName,
    origin: run.origin,
    stats: run.stats,
    axes: axes(run.stats),
    stageIndex: run.stageIndex,
    status: run.status,
    maxStages: MAX_STAGES,
    stages: (run.stages || []).map(stage => ({
      index: stage.index,
      narration: stage.narration,
      choices: (stage.choices || []).map(choice => ({
        id: choice.id,
        label: choice.label,
        hint: choice.hint || '',
      })),
      answer: stage.answer || null,
      // 结局那一幕才把「你这个人成了什么样」交出去，中途不剧透
      summaries: run.status === 'finished' ? stage.summaries || null : null,
    })),
    ending: run.status === 'finished' ? (run.ending || buildEnding(run)) : null,
  };
}

/**
 * 结局不再打分排名，只陈述三件事：你偏向了哪一边、你最舍不得的是谁、
 * 这段路和真实发生过的那段有什么不一样。
 */
export function buildEnding(run) {
  const reading = axes(run.stats);
  const ranked = Object.entries(run.stats || {}).sort((a, b) => b[1] - a[1]);
  const strongest = ranked[0]?.[0] || '坦然';
  const weakest = ranked.at(-1)?.[0] || '勇气';
  const picks = (run.stages || []).filter(stage => stage.answer).map(stage => stage.answer);
  const freeCount = picks.filter(pick => pick.freeText).length;

  const shape = reading.balance >= 65
    ? `你几乎每一次都选择了往外走。这个人后来大概会离家乡很远，也离当年的自己很远。`
    : reading.balance <= 35
      ? `你几乎每一次都选择了留下来。这个人后来大概一直待在同一片地方，把日子过成了根。`
      : `你在往外走和留下来之间来回摇摆。这样的人往往两头都放不下，也两头都没走到底。`;

  const dominant = `走到最后，最重的是${strongest}，最轻的是${weakest}。`;

  const differentFromTruth = run.origin?.story
    ? `真实发生过的那段是「${String(run.origin.story).slice(0, 60)}${String(run.origin.story).length > 60 ? '…' : ''}」。这一局不是它——它是同一个人在同一年，走进另一条岔路之后的样子。`
    : `这一局是从那一年开始的另一条岔路，不是你家人真实走过的路。`;

  const note = freeCount > 0
    ? `其中有 ${freeCount} 次你没有选我们给的选项，而是自己写了想做的事。那些时刻最能看出这个人是谁。`
    : '';

  return {
    balance: reading.balance,
    label: reading.label,
    strongest,
    weakest,
    text: [shape, dominant, differentFromTruth, note].filter(Boolean).join('\n\n'),
    stats: run.stats,
    stages: (run.stages || []).length,
    // 明确写出来：这是如果，不是事实
    disclaimer: `${run.subjectName}的人生这一局是推演出来的，不是真实发生的事。真实发生过的那段，还在记忆库里。`,
  };
}
