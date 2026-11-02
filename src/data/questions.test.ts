import { describe, expect, it } from 'vitest'
import raw from '../../public/questions.json'
import { CATEGORIES, QUESTIONS_PER_CATEGORY, TOTAL_QUESTIONS } from '../game/types'
import { loadQuestions } from './loadQuestions'
import { parseQuestions } from './questions'
import { questions } from './testQuestions'

describe('public/questions.json', () => {
  it('카테고리별로 정확히 10문제, 총 40문제다', () => {
    expect(questions).toHaveLength(TOTAL_QUESTIONS)
    for (const category of CATEGORIES) {
      expect(questions.filter((q) => q.category === category), category).toHaveLength(QUESTIONS_PER_CATEGORY)
    }
  })

  it('같은 문제 본문이 두 번 나오지 않는다', () => {
    expect(new Set(questions.map((q) => q.content)).size).toBe(questions.length)
  })

  it('모든 문제의 보기 4개가 서로 다르고, 정답은 1~4, 해설이 있다', () => {
    for (const q of questions) {
      expect(new Set(q.options).size, `문제 ${q.id}`).toBe(4)
      expect([1, 2, 3, 4], `문제 ${q.id}`).toContain(q.answer)
      expect(q.explanation.trim(), `문제 ${q.id}`).not.toBe('')
    }
  })

  it('형식 검사를 거친 결과가 원본 JSON과 같다', () => {
    expect(questions).toEqual(raw)
  })
})

describe('parseQuestions', () => {
  /** 실제 문제 은행에서 첫 문제만 바꾼 데이터 */
  const withFirst = (patch: object) => [{ ...raw[0], ...patch }, ...raw.slice(1)]

  it('올바른 데이터를 그대로 돌려준다', () => {
    expect(parseQuestions(raw)).toEqual(raw)
  })

  it.each([
    ['알 수 없는 카테고리', { category: '음악' }],
    ['보기가 3개', { options: ['가', '나', '다'] }],
    ['정답 번호가 범위 밖', { answer: 5 }],
    ['해설 없음', { explanation: '' }],
    ['다른 문제와 id가 같음', { id: raw[1].id }],
  ])('%s이면 예외를 던진다', (_, patch) => {
    expect(() => parseQuestions(withFirst(patch))).toThrow()
  })

  it('카테고리 문제가 10개보다 적으면 예외를 던진다', () => {
    expect(() => parseQuestions(raw.slice(1))).toThrow(/한국사/)
  })

  it('배열이 아니면 예외를 던진다', () => {
    expect(() => parseQuestions({ questions: raw })).toThrow(/배열/)
  })
})

describe('loadQuestions', () => {
  const respond = (body: string, status = 200) => async () => new Response(body, { status })

  it('문제 파일을 받아 검사한 뒤 돌려준다', async () => {
    expect(await loadQuestions('/questions.json', respond(JSON.stringify(raw)))).toEqual(raw)
  })

  it('파일을 받지 못하면 HTTP 상태를 알려 준다', async () => {
    await expect(loadQuestions('/questions.json', respond('', 404))).rejects.toThrow(/404/)
  })

  it('JSON이 아니면 알려 준다', async () => {
    await expect(loadQuestions('/questions.json', respond('{not json'))).rejects.toThrow(/JSON/)
  })

  it('형식이 틀리면 어느 항목이 틀렸는지 알려 준다', async () => {
    const broken = JSON.stringify([{ ...raw[0], answer: 7 }, ...raw.slice(1)])
    await expect(loadQuestions('/questions.json', respond(broken))).rejects.toThrow(/0번 항목/)
  })
})
