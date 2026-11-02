import {
  CATEGORIES,
  QUESTIONS_PER_CATEGORY,
  type Category,
  type OptionNumber,
  type Question,
} from '../game/types'

// 문제 파일(public/questions.json)을 교체해도(F-17) 형식이 틀리면 앱 시작 시점에 바로 드러나도록 검사한다.
export function parseQuestions(data: unknown): Question[] {
  if (!Array.isArray(data)) throw new Error('문제 데이터는 배열이어야 합니다.')
  const questions = data.map((item, i) => parseQuestion(item, i))
  validateBank(questions)
  return questions
}

/** 한 판을 만들 수 있는 문제 은행인지 확인한다: id가 겹치지 않고, 카테고리마다 10문제 이상. */
function validateBank(questions: readonly Question[]): void {
  const ids = new Set<number>()
  for (const q of questions) {
    if (ids.has(q.id)) throw new Error(`문제 id ${q.id}가 두 번 이상 나옵니다.`)
    ids.add(q.id)
  }
  for (const category of CATEGORIES) {
    const count = questions.filter((q) => q.category === category).length
    if (count < QUESTIONS_PER_CATEGORY) {
      throw new Error(`${category} 문제가 ${QUESTIONS_PER_CATEGORY}개보다 적습니다 (${count}개).`)
    }
  }
}

function parseQuestion(item: unknown, index: number): Question {
  const fail = (reason: string): never => {
    throw new Error(`문제 데이터 ${index}번 항목: ${reason}`)
  }
  if (typeof item !== 'object' || item === null) return fail('객체가 아닙니다.')
  const q = item as Record<string, unknown>

  if (!Number.isInteger(q.id)) fail('id는 정수여야 합니다.')
  if (!CATEGORIES.includes(q.category as Category)) fail(`알 수 없는 카테고리: ${String(q.category)}`)
  if (!isNonEmptyString(q.content)) fail('content가 비어 있습니다.')
  if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(isNonEmptyString)) {
    fail('options는 비어 있지 않은 문자열 4개여야 합니다.')
  }
  if (![1, 2, 3, 4].includes(q.answer as number)) fail('answer는 1~4여야 합니다.')
  if (!isNonEmptyString(q.explanation)) fail('explanation이 비어 있습니다.')
  if (q.difficulty !== undefined && ![1, 2, 3].includes(q.difficulty as number)) {
    fail('difficulty는 1~3이어야 합니다.')
  }

  return {
    id: q.id as number,
    category: q.category as Category,
    content: q.content as string,
    options: q.options as Question['options'],
    answer: q.answer as OptionNumber,
    explanation: q.explanation as string,
    ...(q.difficulty !== undefined && { difficulty: q.difficulty as 1 | 2 | 3 }),
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
