import type { PlayLog, Question } from './types'

// PRD '성공 지표'의 목표값
export const COMPLETION_TARGET = 0.7
export const RETRY_TARGET = 0.3
/** 정답률이 이보다 낮거나 높으면 검토 대상 (PRD: 10% 미만, 95% 초과) */
export const TOO_HARD_BELOW = 0.1
export const TOO_EASY_ABOVE = 0.95
/** 이보다 적게 풀린 문제는 정답률을 판단하지 않는다. */
export const MIN_ATTEMPTS = 10

export interface Rate {
  /** 분모 */
  total: number
  /** 분자 */
  count: number
  /** 분모가 0이면 null */
  rate: number | null
}

function rate(count: number, total: number): Rate {
  return { count, total, rate: total === 0 ? null : count / total }
}

/** 완주율: 전체 도전을 시작한 판 중 40문제를 끝낸 판의 비율. 중도 이탈한 판은 시작 기록만 있다. */
export function completionRate(plays: readonly PlayLog[]): Rate {
  const full = plays.filter((p) => p.mode === 'full')
  return rate(full.filter((p) => p.finishedAt !== null).length, full.length)
}

/** 재도전율: 끝낸 전체 도전 판 중 결과 화면에서 "다시 하기"를 누른 판의 비율. */
export function retryRate(plays: readonly PlayLog[]): Rate {
  const finished = plays.filter((p) => p.mode === 'full' && p.finishedAt !== null)
  return rate(finished.filter((p) => p.retried).length, finished.length)
}

export type QuestionStatus = 'too-hard' | 'too-easy' | 'ok' | 'insufficient'

export interface QuestionStat {
  question: Question
  attempts: number
  correct: number
  /** 시도가 없으면 null */
  rate: number | null
  status: QuestionStatus
}

const STATUS_ORDER: Record<QuestionStatus, number> = { 'too-hard': 0, 'too-easy': 1, ok: 2, insufficient: 3 }

export function statusOf(attempts: number, correctRate: number | null): QuestionStatus {
  if (attempts < MIN_ATTEMPTS || correctRate === null) return 'insufficient'
  if (correctRate < TOO_HARD_BELOW) return 'too-hard'
  if (correctRate > TOO_EASY_ABOVE) return 'too-easy'
  return 'ok'
}

/**
 * 문제별 정답률. 끝낸 판(전체 도전·연습 모두)의 답만 센다.
 * 검토 대상(너무 어려움 → 너무 쉬움)을 먼저, 그다음 정상, 표본 부족 순이며 같은 상태 안에서는 문제 id 순이다.
 */
export function questionStats(plays: readonly PlayLog[], questions: readonly Question[]): QuestionStat[] {
  const tally = new Map<number, { attempts: number; correct: number }>()
  for (const play of plays) {
    if (play.finishedAt === null) continue
    for (const a of play.answers) {
      const t = tally.get(a.questionId) ?? { attempts: 0, correct: 0 }
      t.attempts++
      if (a.isCorrect) t.correct++
      tally.set(a.questionId, t)
    }
  }
  return questions
    .map((question) => {
      const { attempts, correct } = tally.get(question.id) ?? { attempts: 0, correct: 0 }
      const correctRate = attempts === 0 ? null : correct / attempts
      return { question, attempts, correct, rate: correctRate, status: statusOf(attempts, correctRate) }
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.question.id - b.question.id)
}
