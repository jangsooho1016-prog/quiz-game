import type { Answer } from './game'
import {
  BONUS_STEP_SEC,
  CATEGORIES,
  MAX_SPEED_BONUS,
  POINTS_PER_CORRECT,
  TOTAL_QUESTIONS,
  type AnswerLog,
  type CategoryCounts,
  type GameRecord,
  type Question,
} from './types'

/**
 * 빠른 정답 보너스. 걸린 시간 3초마다 1점씩 줄어든다.
 * 0~2.9초 +5, 3~5.9초 +4, 6~8.9초 +3, 9~11.9초 +2, 12~14.9초 +1, 15초 이상 0.
 */
export function speedBonus(elapsedMs: number): number {
  const lost = Math.floor(Math.max(0, elapsedMs) / (BONUS_STEP_SEC * 1000))
  return Math.max(0, MAX_SPEED_BONUS - lost)
}

/**
 * 한 문제의 점수: 정답이면 10점 + 보너스, 오답·시간 초과는 0점.
 * withBonus = false는 제한 시간 없는 연습이다. 시간 제한이 없으면 "빨리 맞힌" 기준도 없으므로 보너스를 주지 않는다.
 */
export function pointsFor(answer: Pick<Answer, 'isCorrect' | 'elapsedMs'>, withBonus = true): number {
  if (!answer.isCorrect) return 0
  return POINTS_PER_CORRECT + (withBonus ? speedBonus(answer.elapsedMs) : 0)
}

/** 총점 = 문제별 점수의 합. 40문제 기준 0~600점. */
export function scoreOf(answers: readonly Pick<Answer, 'isCorrect' | 'elapsedMs'>[], withBonus = true): number {
  return answers.reduce((sum, a) => sum + pointsFor(a, withBonus), 0)
}

/** 총점 중 보너스 부분. 결과 화면의 점수 내역에 쓴다. */
export function bonusOf(answers: readonly Pick<Answer, 'isCorrect' | 'elapsedMs'>[], withBonus = true): number {
  return scoreOf(answers, withBonus) - countCorrect(answers) * POINTS_PER_CORRECT
}

export function countCorrect(answers: readonly Pick<Answer, 'isCorrect'>[]): number {
  return answers.filter((a) => a.isCorrect).length
}

export function countByCategory(
  answers: readonly Pick<Answer, 'questionId' | 'isCorrect'>[],
  questions: readonly Question[],
): CategoryCounts {
  const categoryOf = new Map(questions.map((q) => [q.id, q.category]))
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as CategoryCounts
  for (const answer of answers) {
    const category = categoryOf.get(answer.questionId)
    if (category === undefined) throw new Error(`알 수 없는 문제 id: ${answer.questionId}`)
    if (answer.isCorrect) counts[category]++
  }
  return counts
}

export interface FinishGameInput {
  id: string
  nickname: string
  answers: readonly Answer[]
  questions: readonly Question[]
  startedAt: Date
  finishedAt: Date
  /** 빠른 정답 보너스를 줄지. 제한 시간 없는 연습이면 false (기본 true) */
  withBonus?: boolean
}

/** 끝난 판을 기록(GameRecord)과 답안 로그로 정리한다. 문제 수는 검사하지 않는다 (연습 모드에도 쓴다). */
export function summarizeGame(input: FinishGameInput): { record: GameRecord; logs: AnswerLog[] } {
  const { id, nickname, answers, questions, startedAt, finishedAt, withBonus = true } = input
  const record: GameRecord = {
    id,
    nickname,
    score: scoreOf(answers, withBonus),
    correctCount: countCorrect(answers),
    categoryCorrect: countByCategory(answers, questions),
    durationSec: Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)),
    createdAt: finishedAt.toISOString(),
  }
  return { record, logs: answers.map((a) => ({ ...a, recordId: id })) }
}

/** 40문제를 모두 푼 판을 랭킹에 저장할 기록으로 정리한다. */
export function finishGame(input: FinishGameInput): { record: GameRecord; logs: AnswerLog[] } {
  if (input.answers.length !== TOTAL_QUESTIONS) {
    throw new Error(`${TOTAL_QUESTIONS}문제를 모두 풀어야 기록할 수 있습니다 (${input.answers.length}개 답함).`)
  }
  return summarizeGame(input)
}
