import { shuffle, type Rng } from './shuffle'
import {
  CATEGORIES,
  QUESTIONS_PER_CATEGORY,
  type AnswerLog,
  type Category,
  type OptionNumber,
  type Question,
} from './types'

/** 화면에 보여 줄 형태로 섞인 문제 한 개. */
export interface PresentedQuestion {
  question: Question
  /** 화면 표시 순서대로 정렬한 보기 문자열 */
  options: string[]
  /** optionOrder[화면 위치] = 원래 보기 번호(1~4). 섞인 보기를 원래 번호로 되돌릴 때 쓴다. */
  optionOrder: OptionNumber[]
}

/** 판이 끝나 recordId가 정해지기 전의 답안. */
export type Answer = Omit<AnswerLog, 'recordId'>

/** 보기만 보고 내린 채점 결과. 걸린 시간(elapsedMs)은 세션이 붙인다. */
export type Judgement = Omit<Answer, 'elapsedMs'>

const OPTION_NUMBERS: readonly OptionNumber[] = [1, 2, 3, 4]

/**
 * 한 판의 출제 목록을 만든다.
 * 카테고리 순서(한국사 → 과학 → 지리 → 일반상식)는 고정하고,
 * 카테고리 안의 문제 순서와 각 문제의 보기 순서만 섞는다.
 * 카테고리에 10문제보다 많으면 섞은 뒤 앞의 10문제를 쓴다.
 * categories를 넘기면 그 카테고리만 출제한다 (카테고리 연습 모드).
 */
export function buildGame(
  bank: readonly Question[],
  rng: Rng = Math.random,
  categories: readonly Category[] = CATEGORIES,
): PresentedQuestion[] {
  return CATEGORIES.filter((c) => categories.includes(c)).flatMap((category) => {
    const pool = bank.filter((q) => q.category === category)
    if (pool.length < QUESTIONS_PER_CATEGORY) {
      throw new Error(`${category} 문제가 ${QUESTIONS_PER_CATEGORY}개보다 적습니다 (${pool.length}개).`)
    }
    return shuffle(pool, rng)
      .slice(0, QUESTIONS_PER_CATEGORY)
      .map((question) => present(question, rng))
  })
}

function present(question: Question, rng: Rng): PresentedQuestion {
  const optionOrder = shuffle(OPTION_NUMBERS, rng)
  return {
    question,
    options: optionOrder.map((n) => question.options[n - 1]),
    optionOrder,
  }
}

/** 정답 보기의 화면 위치(0~3). 피드백에서 정답 보기를 강조할 때 쓴다. */
export function correctDisplayIndex(presented: PresentedQuestion): number {
  return presented.optionOrder.indexOf(presented.question.answer)
}

/**
 * 화면 위치(0~3)로 고른 답을 채점한다. 시간 초과는 displayIndex = null로 넘기며 오답이다.
 * 기록에는 화면 위치가 아니라 원래 보기 번호를 남긴다.
 */
export function judge(presented: PresentedQuestion, displayIndex: number | null): Judgement {
  const questionId = presented.question.id
  if (displayIndex === null) return { questionId, selected: null, isCorrect: false }

  const selected = presented.optionOrder[displayIndex]
  if (selected === undefined) throw new RangeError(`잘못된 보기 위치: ${displayIndex}`)
  return { questionId, selected, isCorrect: selected === presented.question.answer }
}
