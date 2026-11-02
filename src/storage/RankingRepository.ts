import type { AnswerLog, Category, GameRecord } from '../game/types'

export interface RankingRepository {
  /** 40문제를 모두 푼 판만 저장한다. 조건에 맞지 않으면 예외를 던지고 아무것도 저장하지 않는다. */
  save(record: GameRecord, logs: readonly AnswerLog[]): void
  /** 닉네임별 최고 기록 중 상위 limit개 (기본 10개). */
  getTop(limit?: number): GameRecord[]
  /** F-16: 닉네임별로 그 카테고리에서 가장 좋은 기록 중 상위 limit개 (기본 10개). */
  getTopByCategory(category: Category, limit?: number): GameRecord[]
  /** 저장된 기록의 순위. 없는 id면 null. */
  rankOf(recordId: string): number | null
  /** 한 판의 문제별 답안 (오답 다시 보기 F-14용). */
  getAnswerLogs(recordId: string): AnswerLog[]
}
