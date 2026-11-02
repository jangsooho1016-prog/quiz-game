import { describe, expect, it } from 'vitest'
import { questions } from '../data/testQuestions'
import { buildGame, correctDisplayIndex, judge } from './game'
import { seededRng, shuffle } from './shuffle'
import { CATEGORIES, QUESTIONS_PER_CATEGORY, TOTAL_QUESTIONS, type Question } from './types'

const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1)

describe('shuffle', () => {
  it('원본을 바꾸지 않고 같은 원소를 모두 담은 배열을 돌려준다', () => {
    const original = [1, 2, 3, 4, 5]
    const result = shuffle(original, seededRng(7))
    expect(original).toEqual([1, 2, 3, 4, 5])
    expect([...result].sort()).toEqual(original)
  })

  it('같은 시드면 같은 결과가 나온다', () => {
    expect(shuffle([1, 2, 3, 4, 5], seededRng(42))).toEqual(shuffle([1, 2, 3, 4, 5], seededRng(42)))
  })
})

describe('buildGame', () => {
  it('40문제를 카테고리 순서(한국사→과학→지리→일반상식)대로 10문제씩 출제한다', () => {
    const expected = CATEGORIES.flatMap((c) => Array<string>(QUESTIONS_PER_CATEGORY).fill(c))
    for (const seed of SEEDS) {
      const game = buildGame(questions, seededRng(seed))
      expect(game.map((p) => p.question.category)).toEqual(expected)
      expect(new Set(game.map((p) => p.question.id)).size).toBe(TOTAL_QUESTIONS)
    }
  })

  it('카테고리 안의 문제 순서와 보기 순서가 실제로 섞인다', () => {
    const orders = new Set(SEEDS.map((s) => buildGame(questions, seededRng(s)).map((p) => p.question.id).join()))
    expect(orders.size).toBeGreaterThan(1)

    const correctPositions = new Set(SEEDS.map((s) => correctDisplayIndex(buildGame(questions, seededRng(s))[0])))
    expect(correctPositions.size).toBeGreaterThan(1)
  })

  it('섞인 보기는 원래 보기와 같은 문자열 4개이고, optionOrder가 원래 번호를 가리킨다', () => {
    for (const p of buildGame(questions, seededRng(3))) {
      expect([...p.options].sort()).toEqual([...p.question.options].sort())
      p.optionOrder.forEach((n, i) => expect(p.options[i]).toBe(p.question.options[n - 1]))
    }
  })

  it('카테고리 문제가 10개보다 적으면 예외를 던진다', () => {
    expect(() => buildGame(questions.slice(1), seededRng(1))).toThrow(/한국사/)
  })

  it('카테고리 문제가 10개보다 많으면 그중 10개를 뽑는다', () => {
    const extra: Question = { ...questions[0], id: 999 }
    expect(buildGame([...questions, extra], seededRng(1))).toHaveLength(TOTAL_QUESTIONS)
  })
})

describe('judge', () => {
  it('보기를 섞어도 정답 문자열이 있는 위치를 고르면 정답이다', () => {
    for (const seed of SEEDS) {
      for (const p of buildGame(questions, seededRng(seed))) {
        const correctText = p.question.options[p.question.answer - 1]
        const index = p.options.indexOf(correctText)
        expect(index).toBe(correctDisplayIndex(p))
        expect(judge(p, index)).toEqual({ questionId: p.question.id, selected: p.question.answer, isCorrect: true })
      }
    }
  })

  it('정답이 아닌 위치를 고르면 오답이고, 고른 보기의 원래 번호를 기록한다', () => {
    for (const p of buildGame(questions, seededRng(11))) {
      const correct = correctDisplayIndex(p)
      for (let i = 0; i < 4; i++) {
        if (i === correct) continue
        const answer = judge(p, i)
        expect(answer.isCorrect).toBe(false)
        expect(p.question.options[answer.selected! - 1]).toBe(p.options[i])
      }
    }
  })

  it('시간 초과(null)는 오답이고 selected는 null이다', () => {
    const p = buildGame(questions, seededRng(1))[0]
    expect(judge(p, null)).toEqual({ questionId: p.question.id, selected: null, isCorrect: false })
  })

  it('범위 밖 위치는 예외를 던진다', () => {
    const p = buildGame(questions, seededRng(1))[0]
    expect(() => judge(p, 4)).toThrow(RangeError)
  })
})
