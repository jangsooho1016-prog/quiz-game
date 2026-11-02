import { describe, expect, it } from 'vitest'
import { questions } from '../data/testQuestions'
import { wrongAnswers } from './review'

const q = (id: number) => questions.find((x) => x.id === id)!

describe('wrongAnswers (F-14)', () => {
  it('틀린 문제만 푼 순서대로, 내 답과 정답 문자열을 담아 돌려준다', () => {
    const logs = [
      { questionId: 1, selected: 1 as const, isCorrect: true },
      { questionId: 2, selected: 1 as const, isCorrect: false }, // 2번 정답은 2번 보기(왕건)
      { questionId: 3, selected: null, isCorrect: false },
    ]
    expect(wrongAnswers(logs, questions)).toEqual([
      { number: 2, question: q(2), myAnswer: '궁예', correctAnswer: '왕건' },
      { number: 3, question: q(3), myAnswer: null, correctAnswer: '이순신' },
    ])
  })

  it('모두 맞혔으면 빈 목록', () => {
    expect(wrongAnswers([{ questionId: 1, selected: 1, isCorrect: true }], questions)).toEqual([])
  })

  it('문제 은행에 없는 문제가 있으면 예외를 던진다', () => {
    expect(() => wrongAnswers([{ questionId: 999, selected: 1, isCorrect: false }], questions)).toThrow(/999/)
  })
})
