export function createHouseAudio() {
  let ctx: AudioContext | null = null
  let muted = false

  function ensureContext(): AudioContext | null {
    if (muted || typeof window === 'undefined') return null
    if (!ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return null
      ctx = new AudioCtx()
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  }

  function tone(freq: number, endFreq: number, duration: number, type: OscillatorType = 'sine', gainPeak = .08, delay = 0) {
    const audio = ensureContext()
    if (!audio) return
    const now = audio.currentTime + delay
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration)
    gain.gain.setValueAtTime(.0001, now)
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + Math.min(.02, duration * .25))
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start(now)
    osc.stop(now + duration + .02)
  }

  function noise(duration: number, filterFreq: number, gainPeak = .05) {
    const audio = ensureContext()
    if (!audio) return
    const sampleCount = Math.floor(audio.sampleRate * duration)
    const buffer = audio.createBuffer(1, sampleCount, audio.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < sampleCount; i++) data[i] = Math.random() * 2 - 1
    const source = audio.createBufferSource()
    source.buffer = buffer
    const filter = audio.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value = 1.2
    const gain = audio.createGain()
    const now = audio.currentTime
    gain.gain.setValueAtTime(.0001, now)
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + .03)
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(audio.destination)
    source.start(now)
    source.stop(now + duration + .02)
  }

  return {
    get muted() { return muted },
    setMuted(value: boolean) { muted = value },
    playSwitch(on: boolean) {
      tone(on ? 520 : 380, on ? 760 : 240, .055, 'triangle', .07)
    },
    playDoor(open: boolean) {
      tone(open ? 210 : 170, open ? 130 : 95, .14, 'triangle', .08)
      noise(.12, open ? 480 : 340, .035)
    },
    playPetBark() {
      tone(340, 520, .08, 'triangle', .07, 0)
      tone(420, 260, .10, 'triangle', .06, .09)
    },
    playCoffee() {
      noise(.42, 1400, .04)
      tone(280, 420, .18, 'sine', .04, .05)
    },
    playWater(on: boolean) {
      noise(on ? .35 : .14, 1900, on ? .05 : .025)
    },
    playMicrowave(on: boolean) {
      if (on) tone(190, 192, .25, 'sine', .05)
      else tone(880, 880, .28, 'sine', .07)
    },
    playChime() {
      tone(587, 880, .14, 'sine', .05, 0)
      tone(880, 1174, .18, 'sine', .045, .07)
    },
    playShutter() {
      noise(.05, 2400, .06)
      tone(980, 420, .05, 'triangle', .05, .02)
    },
    dispose() {
      if (ctx) {
        void ctx.close().catch(() => {})
        ctx = null
      }
    },
  }
}
