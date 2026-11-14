/**
 * Pal 房间音效 —— WebAudio 现场合成，零素材依赖。
 *
 * 原版用 ogg/mp3 音频文件（totem-insert/remove/tap、plant-water/sparkle 等，
 * 见 evidence/derived/pal-totems/companion-sounds/）；复刻用等义合成音，
 * 避免把原版音频资产带进仓库。音量压得很低，只做触感反馈。
 */

let ctx: AudioContext | null = null
function ac(): AudioContext | null {
  try {
    ctx = ctx ?? new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

interface Tone { f: number; f2?: number; dur: number; type?: OscillatorType; vol?: number; delay?: number }
function tone({ f, f2, dur, type = 'sine', vol = 0.035, delay = 0 }: Tone) {
  const a = ac()
  if (!a) return
  const t0 = a.currentTime + delay
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(f, t0)
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(a.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

export const palSound = {
  /** 点选家具 */
  tap() { tone({ f: 640, dur: 0.07 }) },
  /** 摆上家具 */
  insert() { tone({ f: 320, f2: 620, dur: 0.14 }) },
  /** 移除家具 */
  remove() { tone({ f: 520, f2: 240, dur: 0.16, type: 'triangle' }) },
  /** 浇水：两滴水 */
  water() { tone({ f: 900, f2: 1400, dur: 0.09 }); tone({ f: 700, f2: 1200, dur: 0.09, delay: 0.1 }) },
  /** 生长闪亮：小三连音 */
  sparkle() { [880, 1180, 1480].forEach((f, i) => tone({ f, dur: 0.09, vol: 0.028, delay: i * 0.08 })) },
  /** 点吉祥物出反应 */
  react() { tone({ f: 740, f2: 980, dur: 0.1 }) },
  /** 音箱点唱：五音符小旋律 */
  melody() { [523, 659, 784, 659, 880].forEach((f, i) => tone({ f, dur: 0.18, vol: 0.032, delay: i * 0.16, type: 'triangle' })) },
  /** 电子琴：上行琶音 */
  arp() { [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.22, vol: 0.034, delay: i * 0.12 })) },
  /** 鸟叫：两声啾啾 */
  chirp() { tone({ f: 2100, f2: 2800, dur: 0.08, vol: 0.03 }); tone({ f: 2400, f2: 1900, dur: 0.1, vol: 0.028, delay: 0.14 }) },
  /** 壁炉拨火：低沉噼啪 */
  stoke() { tone({ f: 180, f2: 90, dur: 0.14, type: 'triangle', vol: 0.045 }); tone({ f: 320, f2: 140, dur: 0.08, type: 'triangle', vol: 0.03, delay: 0.16 }) },
}
