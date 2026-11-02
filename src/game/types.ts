// PRD '데이터 모델'의 question / game_record / answer_log에 대응하는 타입.

export const CATEGORIES = ['한국사', '과학', '지리', '일반상식'] as const

export type Category = (typeof CATEGORIES)[number]

/** 보기 번호 (1~4). PRD의 option_1 ~ option_4에 대응한다. */
export type OptionNumber = 1 | 2 | 3 | 4

export const QUESTIONS_PER_CATEGORY = 10
export const TOTAL_QUESTIONS = CATEGORIES.length * QUESTIONS_PER_CATEGORY
export const POINTS_PER_CORRECT = 10
/** F-09: 문제당 제한 시간. 지나면 오답 처리한다. */
export const TIME_LIMIT_SEC = 15
/** 빠른 정답 보너스: 남은 시간 BONUS_STEP_SEC초마다 +1점, 최대 MAX_SPEED_BONUS점 (맞힌 문제만). */
export const MAX_SPEED_BONUS = 5
export const BONUS_STEP_SEC = 3
export const MAX_POINTS_PER_QUESTION = POINTS_PER_CORRECT + MAX_SPEED_BONUS

/** 문제 수에 따른 만점. 전체 도전 40문제는 600점. 보너스가 없으면(제한 시간 없는 연습) 문제당 10점. */
export function maxScore(questionCount: number, withBonus = true): number {
  return questionCount * (withBonus ? MAX_POINTS_PER_QUESTION : POINTS_PER_CORRECT)
}

/** full: 40문제 전체 도전(랭킹 반영), practice: 카테고리 하나 10문제 연습(랭킹 미반영) */
export type GameMode = 'full' | 'practice'

export interface Question {
  id: number
  category: Category
  content: string
  /** option_1 ~ option_4. options[0]이 1번 보기다. */
  options: [string, string, string, string]
  answer: OptionNumber
  explanation: string
  difficulty?: 1 | 2 | 3
}

export type CategoryCounts = Record<Category, number>

export interface GameRecord {
  id: string
  nickname: string
  score: number
  correctCount: number
  categoryCorrect: CategoryCounts
  durationSec: number
  /** ISO 8601 문자열 */
  createdAt: string
}

export interface AnswerLog {
  recordId: string
  questionId: number
  /** 원래 보기 번호. 시간 초과면 null */
  selected: OptionNumber | null
  isCorrect: boolean
  /** 문제 표시부터 답 확정까지 걸린 시간 (ms). 시간 초과면 제한 시간. 보너스 계산에 쓴다. */
  elapsedMs: number
}

/** 성공 지표용 플레이 기록. 랭킹 기록과 달리 끝내지 않은 판(중도 이탈)도 남는다. */
export interface PlayLog {
  sessionId: string
  mode: GameMode
  practiceCategory: Category | null
  /** ISO 8601 */
  startedAt: string
  /** 끝내지 않았으면 null (중도 이탈) */
  finishedAt: string | null
  /** 끝낸 판의 문제별 결과. 문제 통계에 쓴다. */
  answers: { questionId: number; isCorrect: boolean }[]
  /** 결과 화면에서 "다시 하기"를 눌렀는지 */
  retried: boolean
}
