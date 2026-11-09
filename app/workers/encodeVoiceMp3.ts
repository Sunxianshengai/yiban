import { Mp3Encoder } from '@breezystack/lamejs'

self.onmessage = ({ data }: MessageEvent<{ pcm: Float32Array; sampleRate: number }>) => {
  try {
    const encoder = new Mp3Encoder(1, data.sampleRate, 96)
    const blocks: Uint8Array[] = []
    const input = new Int16Array(1152)
    for (let start = 0; start < data.pcm.length; start += input.length) {
      const length = Math.min(input.length, data.pcm.length - start)
      for (let offset = 0; offset < length; offset++) {
        const sample = Math.max(-1, Math.min(1, data.pcm[start + offset]!))
        input[offset] = sample < 0 ? sample * 32768 : sample * 32767
      }
      blocks.push(new Uint8Array(encoder.encodeBuffer(input.subarray(0, length))))
    }
    blocks.push(new Uint8Array(encoder.flush()))
    const bytes = new Uint8Array(blocks.reduce((size, block) => size + block.length, 0))
    let offset = 0
    for (const block of blocks) { bytes.set(block, offset); offset += block.length }
    self.postMessage({ bytes }, { transfer: [bytes.buffer] })
  } catch (error) {
    self.postMessage({ error: (error as Error).message })
  }
}
