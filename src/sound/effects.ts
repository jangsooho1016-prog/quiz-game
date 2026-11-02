export type SoundEffect = 'correct' | 'wrong'

interface Note {
  freq: number
  start: number
  duration: number
}

// 정답: 짧게 올라가는 두 음, 오답(시간 초과 포함): 낮은 한 음
const EFFECTS: Record<SoundEffect, { wave: OscillatorType; volume: number; notes: Note[] }> = {
  correct: {
    wave: 'triangle',
    volume: 0.25,
    notes: [
      { freq: 784, start: 0, duration: 0.09 },
      { freq: 1175, start: 0.09, duration: 0.18 },
    ],
  },
  wrong: {
    wave: 'square',
    volume: 0.08,
    notes: [{ freq: 196, start: 0, duration: 0.25 }],
  },
}

let context: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null // 오디오를 쓸 수 없는 환경(테스트, 오래된 브라우저)에서는 조용히 넘어간다.
  }
}

/** F-18 효과음. 파일 없이 브라우저에서 합성한다. 답을 고른 직후(사용자 조작 직후)에 불러야 재생된다. */
export function playEffect(effect: SoundEffect): void {
  const ctx = audio()
  if (ctx === null) return
  const { wave, volume, notes } = EFFECTS[effect]
  for (const note of notes) {
    const start = ctx.currentTime + note.start
    const end = start + note.duration
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = wave
    osc.frequency.value = note.freq
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, end)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(end)
  }
}
