/** [0, 1) 범위의 난수를 돌려주는 함수. 테스트에서는 시드 고정 난수를 넣는다. */
export type Rng = () => number

/** Fisher–Yates 섞기. 원본 배열은 바꾸지 않는다. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** 재현 가능한 테스트용 난수 생성기 (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
