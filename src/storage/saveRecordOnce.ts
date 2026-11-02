import type { AnswerLog, GameRecord } from '../game/types'
import type { RankingRepository } from './RankingRepository'

export type SaveOutcome = { saved: true; rank: number } | { saved: false; error: string }

/**
 * 기록을 한 번만 저장하고 순위를 돌려준다.
 * 같은 기록 id가 이미 있으면 다시 저장하지 않으므로, 여러 번 불려도 기록은 하나만 남는다.
 */
export function saveRecordOnce(
  repository: RankingRepository,
  record: GameRecord,
  logs: readonly AnswerLog[],
): SaveOutcome {
  try {
    if (repository.rankOf(record.id) === null) repository.save(record, logs)
    const rank = repository.rankOf(record.id)
    if (rank === null) return { saved: false, error: '저장한 기록을 다시 읽지 못했습니다.' }
    return { saved: true, rank }
  } catch (e) {
    return { saved: false, error: e instanceof Error ? e.message : String(e) }
  }
}
