import { describe, expect, it } from 'vitest'
import { questions } from '../data/testQuestions'
import { buildGame, correctDisplayIndex, judge, type Answer } from './game'
import { bonusOf, countByCategory, finishGame, pointsFor, scoreOf, speedBonus, summarizeGame } from './scoring'
import { seededRng } from './shuffle'
import { maxScore } from './types'

/** isCorrect(questionId)가 참인 문제만 맞히고 나머지는 틀린 답안 40개. 모든 답은 elapsedMs만큼 걸렸다고 본다. */
function playGame(isCorrect: (questionId: number) => boolean, elapsedMs = 1_000): Answer[] {
  return buildGame(questions, seededRng(5)).map((p) => {
    const correct = correctDisplayIndex(p)
    return { ...judge(p, isCorrect(p.question.id) ? correct : (correct + 1) % 4), elapsedMs }
  })
}

describe('speedBonus', () => {
  it.each([
    [0, 5],
    [2_999, 5],
    [3_000, 4],
    [5_999, 4],
    [6_000, 3],
    [11_999, 2],
    [12_000, 1],
    [14_999, 1],
    [15_000, 0],
    [99_000, 0],
  ])('%ims 걸리면 보너스 %i점', (elapsedMs, bonus) => {
    expect(speedBonus(elapsedMs)).toBe(bonus)
  })
})

describe('pointsFor', () => {
  it('정답이면 10점 + 보너스', () => {
    expect(pointsFor({ isCorrect: true, elapsedMs: 4_000 })).toBe(14)
  })

  it('오답이면 빨리 골라도 0점', () => {
    expect(pointsFor({ isCorrect: false, elapsedMs: 500 })).toBe(0)
  })

  it('보너스 없이(제한 시간 없는 연습) 계산하면 정답은 10점', () => {
    expect(pointsFor({ isCorrect: true, elapsedMs: 500 }, false)).toBe(10)
    expect(maxScore(10, false)).toBe(100)
  })
})

describe('scoreOf', () => {
  it('모두 2.9초 안에 맞히면 만점 600점', () => {
    expect(scoreOf(playGame(() => true, 2_900))).toBe(600)
    expect(maxScore(40)).toBe(600)
  })

  it('모두 틀리면 0점 (감점 없음)', () => {
    expect(scoreOf(playGame(() => false))).toBe(0)
  })

  it('정답마다 10점 + 보너스를 더한다', () => {
    const answers = playGame((id) => id % 3 === 0, 7_000) // 13개 정답, 7초 → 보너스 3
    expect(scoreOf(answers)).toBe(13 * 13)
    expect(bonusOf(answers)).toBe(13 * 3)
  })

  it('시간 초과는 0점', () => {
    const p = buildGame(questions, seededRng(1))[0]
    expect(scoreOf([{ ...judge(p, null), elapsedMs: 15_000 }])).toBe(0)
  })
})

describe('countByCategory', () => {
  it('카테고리별 정답 수를 센다', () => {
    // 한국사 1~10, 과학 11~20, 지리 21~30, 일반상식 31~40
    const answers = playGame((id) => id <= 3 || (id >= 21 && id <= 30) || id === 40)
    expect(countByCategory(answers, questions)).toEqual({ 한국사: 3, 과학: 0, 지리: 10, 일반상식: 1 })
  })

  it('답안이 없으면 모두 0', () => {
    expect(countByCategory([], questions)).toEqual({ 한국사: 0, 과학: 0, 지리: 0, 일반상식: 0 })
  })
})

describe('finishGame', () => {
  const startedAt = new Date('2026-10-31T10:00:00.000Z')
  const finishedAt = new Date('2026-10-31T10:07:30.400Z')

  it('점수(보너스 포함), 정답 수, 카테고리별 정답 수, 소요 시간, 기록 시각을 담은 기록을 만든다', () => {
    const answers = playGame((id) => id > 20, 10_000) // 20개 정답, 10초 → 보너스 2
    const { record, logs } = finishGame({ id: 'r1', nickname: '퀴즈왕', answers, questions, startedAt, finishedAt })

    expect(record).toEqual({
      id: 'r1',
      nickname: '퀴즈왕',
      score: 20 * 12,
      correctCount: 20,
      categoryCorrect: { 한국사: 0, 과학: 0, 지리: 10, 일반상식: 10 },
      durationSec: 450,
      createdAt: '2026-10-31T10:07:30.400Z',
    })
    expect(logs).toHaveLength(40)
    expect(logs.every((l) => l.recordId === 'r1' && l.elapsedMs === 10_000)).toBe(true)
  })

  it('40문제를 다 풀지 않았으면 예외를 던진다', () => {
    const answers = playGame(() => true).slice(0, 39)
    expect(() => finishGame({ id: 'r1', nickname: '퀴즈왕', answers, questions, startedAt, finishedAt })).toThrow()
  })
})

describe('summarizeGame', () => {
  it('문제 수와 관계없이 결과를 정리한다 (연습 모드 10문제)', () => {
    const tenHistory = buildGame(questions, seededRng(2), ['한국사']).map((p) => ({
      ...judge(p, correctDisplayIndex(p)),
      elapsedMs: 1_000,
    }))
    const { record } = summarizeGame({
      id: 'p1',
      nickname: '연습생',
      answers: tenHistory,
      questions,
      startedAt: new Date(0),
      finishedAt: new Date(60_000),
    })
    expect(record).toMatchObject({ score: 150, correctCount: 10, durationSec: 60 })
    expect(record.categoryCorrect).toEqual({ 한국사: 10, 과학: 0, 지리: 0, 일반상식: 0 })
  })
})
