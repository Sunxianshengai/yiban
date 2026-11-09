import { desktopBridge, stageDesktopRecording } from '~/utils/desktopBridge'

const maxRecordingMs = 10 * 60 * 1000

export function useVoiceNote(onFile: (file: File) => Promise<void>, onError: (message: string) => void) {
  const available = !!desktopBridge() && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
  const status = ref<'idle' | 'requesting' | 'recording' | 'encoding'>('idle')
  let recorder: MediaRecorder | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let worker: Worker | undefined
  let disposed = false

  async function toMp3(blob: Blob) {
    const context = new AudioContext({ sampleRate: 44100 })
    let audio: AudioBuffer
    try { audio = await context.decodeAudioData(await blob.arrayBuffer()) }
    finally { await context.close() }
    if (disposed) return
    const pcm = new Float32Array(audio.length)
    for (let channel = 0; channel < audio.numberOfChannels; channel++) {
      const samples = audio.getChannelData(channel)
      for (let i = 0; i < pcm.length; i++) pcm[i] = pcm[i]! + samples[i]! / audio.numberOfChannels
    }
    return new Promise<File>((resolve, reject) => {
      const encoder = new Worker(new URL('../workers/encodeVoiceMp3.ts', import.meta.url), { type: 'module' })
      worker = encoder
      function stop() { encoder.terminate(); worker = undefined }
      encoder.onerror = () => { stop(); reject(new Error('MP3 encoding failed.')) }
      encoder.onmessage = ({ data }: MessageEvent<{ bytes?: Uint8Array<ArrayBuffer>; error?: string }>) => {
        stop()
        if (data.bytes?.byteLength) resolve(new File([data.bytes], 'Voice note.mp3', { type: 'audio/mpeg' }))
        else reject(new Error(data.error || 'The recording was empty.'))
      }
      encoder.postMessage({ pcm, sampleRate: audio.sampleRate }, [pcm.buffer])
    })
  }

  async function start() {
    if (!available || status.value !== 'idle') return
    status.value = 'requesting'
    let stream: MediaStream | undefined
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (disposed) { stream.getTracks().forEach(track => track.stop()); return }
      const current = new MediaRecorder(stream)
      recorder = current
      const parts: Blob[] = []
      current.ondataavailable = event => { if (event.data.size) parts.push(event.data) }
      current.onerror = () => onError('Audio recording stopped unexpectedly.')
      current.onstop = async () => {
        clearTimeout(timer)
        current.stream.getTracks().forEach(track => track.stop())
        if (disposed) return
        status.value = 'encoding'
        try {
          const file = await toMp3(new Blob(parts, { type: current.mimeType }))
          if (file && !disposed) await onFile(await stageDesktopRecording(file))
        } catch (error) {
          if (!disposed) onError((error as Error).message || 'Could not save the recording.')
        } finally { status.value = 'idle' }
      }
      current.start()
      status.value = 'recording'
      timer = setTimeout(stop, maxRecordingMs)
    } catch {
      stream?.getTracks().forEach(track => track.stop())
      status.value = 'idle'
      onError('Could not start recording. Check microphone access.')
    }
  }

  function stop() {
    if (recorder?.state === 'recording') recorder.stop()
  }

  onBeforeUnmount(() => {
    disposed = true
    clearTimeout(timer)
    stop()
    recorder?.stream.getTracks().forEach(track => track.stop())
    worker?.terminate()
  })

  return { available, status, start, stop }
}
