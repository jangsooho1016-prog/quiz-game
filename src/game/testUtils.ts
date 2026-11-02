import { CATEGORIES, type GameRecord } from './types'

/** 테스트용 기록. 필요한 필드만 덮어써서 쓴다. */
export function makeRecord(overrides: Partial<GameRecord> & Pick<GameRecord, 'id'>): GameRecord {
  return {
    nickname: overrides.id,
    score: 0,
    correctCount: 0,
    categoryCorrect: Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as GameRecord['categoryCorrect'],
    durationSec: 300,
    createdAt: '2026-10-31T00:00:00.000Z',
    ...overrides,
  }
}
