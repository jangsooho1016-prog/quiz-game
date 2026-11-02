import { buildGame, judge, type Answer, type PresentedQuestion } from './game'
import { finishGame, scoreOf, summarizeGame } from './scoring'
import type { Rng } from './shuffle'
import {
  CATEGORIES,
  TIME_LIMIT_SEC,
  type AnswerLog,
  type Category,
  type GameMode,
  type GameRecord,
  type Question,
} from './types'

/**
 * 진행 중인 한 판의 상태. 화면은 이 값을 그리기만 하고, 바꿀 때는 아래 순수 함수를 쓴다.
 * answers[i]는 questions[i]의 답이다 (문제는 순서대로만 풀 수 있다).
 */
export interface GameSession {
  id: string
  nickname: string
  mode: GameMode
  /** 연습 모드에서 고른 카테고리. 전체 도전이면 null */
  practiceCategory: Category | null
  questions: PresentedQuestion[]
  index: number
  answers: Answer[]
  /** 첫 문제를 표시한 시각 (ms) */
  startedAt: number
  /** 마지막 문제의 답을 확정한 시각 (ms). 끝나기 전이면 null */
  finishedAt: number | null
  /** 현재 문제를 표시한 시각 (ms). 제한 시간은 여기서부터 잰다. */
  questionShownAt: number
  /** 문제당 제한 시간 (ms). null이면 제한 없음 */
  timeLimitMs: number | null
}

export interface StartSessionInput {
  id: string
  nickname: string
  bank: readonly Question[]
  now: number
  rng?: Rng
  timeLimitMs?: number | null
  /** 기본은 전체 도전. 연습 모드면 practiceCategory가 필요하다. */
  mode?: GameMode
  practiceCategory?: Category
}

export function startSession({
  id,
  nickname,
  bank,
  now,
  rng,
  timeLimitMs = TIME_LIMIT_SEC * 1000,
  mode = 'full',
  practiceCategory,
}: StartSessionInput): GameSession {
  if (mode === 'practice' && practiceCategory === undefined) throw new Error('연습할 카테고리를 골라야 합니다.')
  const category = mode === 'practice' ? (practiceCategory as Category) : null
  return {
    id,
    nickname,
    mode,
    practiceCategory: category,
    questions: buildGame(bank, rng, category === null ? CATEGORIES : [category]),
    index: 0,
    answers: [],
    startedAt: now,
    finishedAt: null,
    questionShownAt: now,
    timeLimitMs,
  }
}

export function currentQuestion(session: GameSession): PresentedQuestion {
  return session.questions[session.index]
}

/** 현재 문제의 확정된 답. 아직 고르지 않았으면 undefined. */
export function currentAnswer(session: GameSession): Answer | undefined {
  return session.answers[session.index]
}

export function isLastQuestion(session: GameSession): boolean {
  return session.index === session.questions.length - 1
}

export function isComplete(session: GameSession): boolean {
  return session.answers.length === session.questions.length
}

/** 빠른 정답 보너스는 제한 시간이 있을 때만 준다 (제한 시간 없는 연습은 보너스 없음). */
export function hasSpeedBonus(session: GameSession): boolean {
  return session.timeLimitMs !== null
}

export function sessionScore(session: GameSession): number {
  return scoreOf(session.answers, hasSpeedBonus(session))
}

function deadline(session: GameSession): number | null {
  return session.timeLimitMs === null ? null : session.questionShownAt + session.timeLimitMs
}

/** 현재 문제의 남은 시간 (ms, 0 이상). 제한이 없거나 이미 답했으면 null. */
export function remainingMs(session: GameSession, now: number): number | null {
  const end = deadline(session)
  if (end === null || currentAnswer(session) !== undefined) return null
  return Math.max(0, end - now)
}

/**
 * 현재 문제에 답을 확정한다. 이미 답한 문제면 그대로 둔다 (확정 후 변경 불가).
 * 제한 시간이 지난 뒤에 고른 답은 시간 초과(오답)로 처리하고, 확정 시각은 마감 시각으로 남긴다.
 * 걸린 시간(elapsedMs)도 함께 기록해 빠른 정답 보너스를 계산한다.
 */
export function answerCurrent(session: GameSession, displayIndex: number | null, now: number): GameSession {
  if (currentAnswer(session) !== undefined) return session
  const end = deadline(session)
  const timedOut = end !== null && now >= end
  const confirmedAt = end !== null && timedOut ? end : now
  const answer: Answer = {
    ...judge(currentQuestion(session), timedOut ? null : displayIndex),
    elapsedMs: Math.max(0, confirmedAt - session.questionShownAt),
  }
  const answers = [...session.answers, answer]
  const finishedAt = answers.length === session.questions.length ? confirmedAt : null
  return { ...session, answers, finishedAt }
}

/** 제한 시간이 지났으면 시간 초과로 확정한다. 아직이면 같은 객체를 그대로 돌려준다. */
export function expireIfOverdue(session: GameSession, now: number): GameSession {
  const left = remainingMs(session, now)
  return left === 0 ? answerCurrent(session, null, now) : session
}

/** 답을 확정한 뒤에만 다음 문제로 넘어간다. 마지막 문제에서는 그대로 둔다. */
export function goToNext(session: GameSession, now: number): GameSession {
  if (currentAnswer(session) === undefined || isLastQuestion(session)) return session
  return { ...session, index: session.index + 1, questionShownAt: now }
}

export interface CategoryTransition {
  from: Category
  to: Category
  /** 방금 끝난 카테고리에서 맞힌 문제 수 */
  fromCorrect: number
  fromTotal: number
}

/** F-08: 현재 문제가 새 카테고리의 첫 문제면 전환 정보를, 아니면 null을 돌려준다. */
export function categoryTransition(session: GameSession): CategoryTransition | null {
  if (session.index === 0) return null
  const to = currentQuestion(session).question.category
  const from = session.questions[session.index - 1].question.category
  if (from === to) return null

  const indexes = session.questions.flatMap((p, i) => (p.question.category === from ? [i] : []))
  return {
    from,
    to,
    fromCorrect: indexes.filter((i) => session.answers[i]?.isCorrect).length,
    fromTotal: indexes.length,
  }
}

/** 고른 보기의 화면 위치(0~3). 시간 초과처럼 고르지 않았으면 null. */
export function selectedDisplayIndex(presented: PresentedQuestion, answer: Answer): number | null {
  return answer.selected === null ? null : presented.optionOrder.indexOf(answer.selected)
}

function finishInput(session: GameSession) {
  if (!isComplete(session) || session.finishedAt === null) throw new Error('아직 끝나지 않은 판입니다.')
  return {
    id: session.id,
    nickname: session.nickname,
    answers: session.answers,
    questions: session.questions.map((p) => p.question),
    startedAt: new Date(session.startedAt),
    finishedAt: new Date(session.finishedAt),
    withBonus: hasSpeedBonus(session),
  }
}

/** 끝난 전체 도전 판을 랭킹에 저장할 기록으로 만든다. 소요 시간은 첫 문제 표시부터 마지막 답 확정까지다. */
export function toResult(session: GameSession): { record: GameRecord; logs: AnswerLog[] } {
  if (session.mode !== 'full') throw new Error('연습 모드 판은 랭킹 기록으로 만들 수 없습니다.')
  if (session.timeLimitMs === null) throw new Error('랭킹에 남는 판은 제한 시간이 있어야 합니다.')
  return finishGame(finishInput(session))
}

/** 끝난 연습 판의 결과. 랭킹에는 저장하지 않고 결과·오답 화면에만 쓴다. */
export function toPracticeSummary(session: GameSession): { record: GameRecord; logs: AnswerLog[] } {
  if (session.mode !== 'practice') throw new Error('연습 모드 판이 아닙니다.')
  return summarizeGame(finishInput(session))
}

export function createSessionId(): string {
  // crypto.randomUUID는 보안 컨텍스트(https, localhost)에서만 있으므로 대체값을 둔다.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
