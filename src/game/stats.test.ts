import { describe, expect, it } from 'vitest'
import { questions } from '../data/testQuestions'
import { completionRate, questionStats, retryRate, statusOf } from './stats'
import type { PlayLog } from './types'

let seq = 0

function play(overrides: Partial<PlayLog> = {}): PlayLog {
  seq++
  return {
    sessionId: `s${seq}`,
    mode: 'full',
    practiceCategory: null,
    startedAt: '2026-11-02T00:00:00.000Z',
    finishedAt: '2026-11-02T00:08:00.000Z',
    answers: [],
    retried: false,
    ...overrides,
  }
}

const abandoned = (overrides: Partial<PlayLog> = {}) => play({ finishedAt: null, ...overrides })

describe('completionRate', () => {
  it('전체 도전을 시작한 판 중 끝낸 판의 비율', () => {
    const plays = [play(), play(), play(), abandoned()]
    expect(completionRate(plays)).toEqual({ count: 3, total: 4, rate: 0.75 })
  })

  it('연습 모드는 세지 않는다', () => {
    const plays = [play(), abandoned({ mode: 'practice', practiceCategory: '과학' })]
    expect(completionRate(plays)).toEqual({ count: 1, total: 1, rate: 1 })
  })

  it('기록이 없으면 rate는 null', () => {
    expect(completionRate([])).toEqual({ count: 0, total: 0, rate: null })
  })
})

describe('retryRate', () => {
  it('끝낸 전체 도전 판 중 "다시 하기"를 누른 비율. 중도 이탈과 연습은 분모에서 빠진다', () => {
    const plays = [
      play({ retried: true }),
      play(),
      play(),
      play(),
      abandoned(),
      play({ mode: 'practice', practiceCategory: '지리', retried: true }),
    ]
    expect(retryRate(plays)).toEqual({ count: 1, total: 4, rate: 0.25 })
  })

  it('끝낸 판이 없으면 rate는 null', () => {
    expect(retryRate([abandoned()]).rate).toBeNull()
  })
})

describe('statusOf', () => {
  it.each([
    [9, 0, 'insufficient'],
    [10, 0.09, 'too-hard'],
    [10, 0.1, 'ok'],
    [10, 0.95, 'ok'],
    [10, 0.96, 'too-easy'],
  ] as const)('%i번 시도, 정답률 %f → %s', (attempts, rate, status) => {
    expect(statusOf(attempts, rate)).toBe(status)
  })
})

describe('questionStats', () => {
  /** questionId 문제를 n번 풀어 correct번 맞힌 판들 */
  function attempts(questionId: number, n: number, correct: number, extra: Partial<PlayLog> = {}): PlayLog[] {
    return Array.from({ length: n }, (_, i) => play({ answers: [{ questionId, isCorrect: i < correct }], ...extra }))
  }

  it('끝낸 판(전체·연습)의 답으로 문제별 시도 수와 정답률을 센다', () => {
    const plays = [
      ...attempts(1, 6, 3),
      ...attempts(1, 4, 2, { mode: 'practice', practiceCategory: '한국사' }),
      abandoned({ answers: [{ questionId: 1, isCorrect: true }] }), // 중도 이탈은 세지 않음
    ]
    const stat = questionStats(plays, questions).find((s) => s.question.id === 1)!
    expect(stat).toMatchObject({ attempts: 10, correct: 5, rate: 0.5, status: 'ok' })
  })

  it('검토 대상(너무 어려움 → 너무 쉬움)을 먼저, 표본 부족을 마지막에 둔다', () => {
    const plays = [...attempts(5, 10, 10), ...attempts(7, 10, 0), ...attempts(9, 10, 5), ...attempts(3, 2, 1)]
    const stats = questionStats(plays, questions)
    expect(stats).toHaveLength(questions.length)
    expect(stats.slice(0, 3).map((s) => [s.question.id, s.status])).toEqual([
      [7, 'too-hard'],
      [5, 'too-easy'],
      [9, 'ok'],
    ])
    const three = stats.find((s) => s.question.id === 3)!
    expect(three).toMatchObject({ attempts: 2, status: 'insufficient' })
    expect(stats.find((s) => s.question.id === 40)).toMatchObject({ attempts: 0, rate: null, status: 'insufficient' })
  })
})
