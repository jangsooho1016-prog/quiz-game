import type { PlayLog } from '../game/types'

/**
 * 성공 지표용 플레이 기록 저장소. 랭킹과 달리 끝내지 않은 판도 남긴다.
 * 통계는 부가 기능이므로 구현체는 저장에 실패해도 예외를 던지지 않는다.
 */
export interface StatsRepository {
  /** 판을 시작했을 때. 끝내지 않으면 이 기록만 남아 중도 이탈로 집계된다. */
  recordStart(play: Pick<PlayLog, 'sessionId' | 'mode' | 'practiceCategory' | 'startedAt'>): void
  /** 마지막 문제까지 답하고 결과 화면으로 갔을 때. */
  recordFinish(sessionId: string, finishedAt: string, answers: PlayLog['answers']): void
  /** 결과 화면에서 "다시 하기"를 눌렀을 때. */
  recordRetry(sessionId: string): void
  getPlays(): PlayLog[]
}
