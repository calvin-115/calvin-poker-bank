// A per-device preference: off unless the player turns it on in Settings.
const SOUND_KEY = 'poker-bank:sound'

export function isSoundOn() {
  return localStorage.getItem(SOUND_KEY) === 'on'
}

export function setSoundOn(on: boolean) {
  localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
}

let context: AudioContext | undefined

/** Two short filtered noise bursts, which read as chips clacking together. */
export function playChipClack() {
  if (!isSoundOn()) return
  context ??= new AudioContext()
  const ctx = context
  for (const delay of [0, 0.07]) {
    const length = Math.floor(ctx.sampleRate * 0.05)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 4

    const source = ctx.createBufferSource()
    source.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 3200
    filter.Q.value = 1.5
    const gain = ctx.createGain()
    gain.gain.value = 0.6
    source.connect(filter).connect(gain).connect(ctx.destination)
    source.start(ctx.currentTime + delay)
  }
}
