import type { Category, GameRecord } from './types'

export const RANKING_SIZE = 10

type Compare = (a: GameRecord, b: GameRecord) => number

// 점수가 같을 때: 소요 시간 오름차순 → 기록 시각 오름차순 (마지막으로 id로 순서 고정).
function compareTiebreak(a: GameRecord, b: GameRecord): number {
  return a.durationSec - b.durationSec || Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id)
}

/** 정렬 기준: 점수 내림차순 → 소요 시간 오름차순 → 기록 시각 오름차순. */
export function compareRecords(a: GameRecord, b: GameRecord): number {
  return b.score - a.score || compareTiebreak(a, b)
}

/**
 * F-16 카테고리별 기록의 정렬 기준: 그 카테고리 정답 수 내림차순 → 판 전체 소요 시간 → 기록 시각.
 * 카테고리별 소요 시간은 따로 기록하지 않으므로 판 전체 시간으로 비교한다.
 */
export function compareByCategory(category: Category): Compare {
  return (a, b) => b.categoryCorrect[category] - a.categoryCorrect[category] || compareTiebreak(a, b)
}

/** 닉네임마다 가장 좋은 기록 하나만 남긴다. */
export function bestPerNickname(records: readonly GameRecord[], compare: Compare = compareRecords): GameRecord[] {
  const best = new Map<string, GameRecord>()
  for (const record of records) {
    const current = best.get(record.nickname)
    if (current === undefined || compare(record, current) < 0) best.set(record.nickname, record)
  }
  return [...best.values()]
}

/** 랭킹 목록: 닉네임별 최고 기록을 정렬한 상위 limit개. */
export function topRanking(
  records: readonly GameRecord[],
  limit = RANKING_SIZE,
  compare: Compare = compareRecords,
): GameRecord[] {
  return bestPerNickname(records, compare).sort(compare).slice(0, limit)
}

/** F-16: 카테고리별 최고 기록 목록. 닉네임마다 그 카테고리에서 가장 좋은 기록 하나. */
export function topRankingByCategory(
  records: readonly GameRecord[],
  category: Category,
  limit = RANKING_SIZE,
): GameRecord[] {
  return topRanking(records, limit, compareByCategory(category))
}

/**
 * 이번 기록의 순위(1부터). 닉네임별 최고 기록 목록 기준이며,
 * 이번 기록이 그 닉네임의 최고 기록이 아니어도 "이 기록이 목록에 있다면 몇 위인지"를 돌려준다.
 */
export function rankOf(records: readonly GameRecord[], target: GameRecord): number {
  const ahead = bestPerNickname(records).filter(
    (r) => r.nickname !== target.nickname && compareRecords(r, target) < 0,
  )
  return ahead.length + 1
}
