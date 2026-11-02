import { describe, expect, it } from 'vitest'
import { questions } from '../data/testQuestions'
import { correctDisplayIndex } from './game'
import {
  answerCurrent,
  categoryTransition,
  currentAnswer,
  currentQuestion,
  expireIfOverdue,
  goToNext,
  hasSpeedBonus,
  isComplete,
  isLastQuestion,
  remainingMs,
  selectedDisplayIndex,
  sessionScore,
  startSession,
  toPracticeSummary,
  toResult,
  type GameSession,
} from './session'
import { seededRng } from './shuffle'

const T0 = Date.UTC(2026, 9, 31, 10, 0, 0)
const LIMIT = 15_000

function newSession(): GameSession {
  return startSession({ id: 's1', nickname: '퀴즈왕', bank: questions, now: T0, rng: seededRng(1) })
}

/** pickCorrect(i)가 참이면 정답, 아니면 오답을 골라 40문제를 끝까지 푼다. 문제마다 1초 걸린다고 본다. */
function playThrough(pickCorrect: (index: number) => boolean): GameSession {
  let s = newSession()
  for (let i = 0; i < s.questions.length; i++) {
    const t = T0 + (i + 1) * 1000
    const correct = correctDisplayIndex(currentQuestion(s))
    s = answerCurrent(s, pickCorrect(i) ? correct : (correct + 1) % 4, t)
    s = goToNext(s, t)
  }
  return s
}

describe('session', () => {
  it('첫 문제에서 시작하고 아직 답이 없다', () => {
    const s = newSession()
    expect(s.index).toBe(0)
    expect(currentAnswer(s)).toBeUndefined()
    expect(s.questions).toHaveLength(40)
    expect(s.startedAt).toBe(T0)
  })

  it('답을 확정하기 전에는 다음 문제로 넘어가지 않는다', () => {
    const s = newSession()
    expect(goToNext(s, T0 + 1000)).toBe(s)
  })

  it('확정한 답은 바꿀 수 없다', () => {
    const s = newSession()
    const correct = correctDisplayIndex(currentQuestion(s))
    const answered = answerCurrent(s, correct, T0 + 1000)
    const again = answerCurrent(answered, (correct + 1) % 4, T0 + 2000)
    expect(again).toBe(answered)
    expect(currentAnswer(again)?.isCorrect).toBe(true)
    expect(sessionScore(again)).toBe(15) // 1초 만에 맞혀 10점 + 보너스 5점
  })

  it('고른 보기의 화면 위치를 되찾을 수 있다', () => {
    const s = answerCurrent(newSession(), 2, T0)
    expect(selectedDisplayIndex(currentQuestion(s), currentAnswer(s)!)).toBe(2)
  })

  it('40번째 문제에서는 다음 문제로 넘어가지 않고, 답을 확정한 시각을 종료 시각으로 남긴다', () => {
    const s = playThrough(() => true)
    expect(isLastQuestion(s)).toBe(true)
    expect(isComplete(s)).toBe(true)
    expect(s.index).toBe(39)
    expect(s.finishedAt).toBe(T0 + 40_000)
  })

  it('끝난 판을 기록으로 만든다: 소요 시간은 첫 문제 표시부터 40번째 답 확정까지', () => {
    // 문제마다 1초 만에 답했으므로 맞힌 25문제는 모두 10 + 보너스 5점
    const { record, logs } = toResult(playThrough((i) => i < 25))
    expect(record).toMatchObject({ id: 's1', nickname: '퀴즈왕', score: 25 * 15, correctCount: 25, durationSec: 40 })
    expect(record.categoryCorrect).toEqual({ 한국사: 10, 과학: 10, 지리: 5, 일반상식: 0 })
    expect(logs).toHaveLength(40)
  })

  it('끝나지 않은 판은 기록으로 만들 수 없다', () => {
    expect(() => toResult(newSession())).toThrow()
  })

  it('답마다 문제 표시부터 확정까지 걸린 시간을 기록한다', () => {
    let s = answerCurrent(newSession(), 0, T0 + 4_200)
    expect(currentAnswer(s)?.elapsedMs).toBe(4_200)
    s = goToNext(s, T0 + 9_000)
    s = answerCurrent(s, 0, T0 + 9_700)
    expect(currentAnswer(s)?.elapsedMs).toBe(700)
  })

  it('정답의 점수는 걸린 시간에 따라 보너스가 붙는다', () => {
    const s = newSession()
    const correct = correctDisplayIndex(currentQuestion(s))
    expect(sessionScore(answerCurrent(s, correct, T0 + 2_000))).toBe(15)
    expect(sessionScore(answerCurrent(s, correct, T0 + 13_000))).toBe(11)
  })
})

describe('카테고리 연습 모드', () => {
  const practice = () =>
    startSession({ id: 'p1', nickname: '연습생', bank: questions, now: T0, mode: 'practice', practiceCategory: '지리' })

  it('고른 카테고리의 10문제만 출제한다', () => {
    const s = practice()
    expect(s.mode).toBe('practice')
    expect(s.practiceCategory).toBe('지리')
    expect(s.questions).toHaveLength(10)
    expect(s.questions.every((p) => p.question.category === '지리')).toBe(true)
  })

  it('카테고리를 고르지 않으면 시작할 수 없다', () => {
    expect(() => startSession({ id: 'p', nickname: '연습생', bank: questions, now: T0, mode: 'practice' })).toThrow()
  })

  it('10번째 문제가 마지막이고, 카테고리 전환 안내는 나오지 않는다', () => {
    let s = practice()
    for (let i = 0; i < 9; i++) {
      s = goToNext(answerCurrent(s, 0, T0 + i * 1000), T0 + i * 1000)
      expect(categoryTransition(s)).toBeNull()
    }
    expect(isLastQuestion(s)).toBe(true)
    s = answerCurrent(s, 0, T0 + 20_000)
    expect(isComplete(s)).toBe(true)
  })

  it('연습 판은 연습 결과로만 정리하고, 랭킹 기록으로는 만들 수 없다', () => {
    let s = practice()
    for (let i = 0; i < 10; i++) {
      const t = T0 + (i + 1) * 1000
      s = goToNext(answerCurrent(s, correctDisplayIndex(currentQuestion(s)), t), t)
    }
    expect(() => toResult(s)).toThrow(/연습/)
    const { record, logs } = toPracticeSummary(s)
    expect(record).toMatchObject({ score: 150, correctCount: 10, durationSec: 10 })
    expect(record.categoryCorrect.지리).toBe(10)
    expect(logs).toHaveLength(10)
  })

  it('전체 도전 판은 연습 결과로 정리할 수 없다', () => {
    expect(() => toPracticeSummary(newSession())).toThrow()
  })
})

describe('제한 시간 (F-09)', () => {
  it('기본 제한 시간은 15초이고, 문제를 표시한 시각부터 잰다', () => {
    const s = newSession()
    expect(s.timeLimitMs).toBe(LIMIT)
    expect(remainingMs(s, T0)).toBe(LIMIT)
    expect(remainingMs(s, T0 + 4_000)).toBe(11_000)
    expect(remainingMs(s, T0 + 99_000)).toBe(0)
  })

  it('다음 문제로 넘어가면 그 시각부터 다시 15초', () => {
    const s = goToNext(answerCurrent(newSession(), 0, T0 + 3_000), T0 + 8_000)
    expect(remainingMs(s, T0 + 8_000)).toBe(LIMIT)
  })

  it('답한 문제는 남은 시간이 없다 (null)', () => {
    expect(remainingMs(answerCurrent(newSession(), 0, T0 + 1_000), T0 + 2_000)).toBeNull()
  })

  it('시간이 남아 있으면 expireIfOverdue는 같은 객체를 돌려준다', () => {
    const s = newSession()
    expect(expireIfOverdue(s, T0 + LIMIT - 1)).toBe(s)
  })

  it('시간이 지나면 시간 초과(selected = null)로 오답 처리하고, 걸린 시간은 제한 시간으로 남긴다', () => {
    const s = expireIfOverdue(newSession(), T0 + LIMIT + 400)
    expect(currentAnswer(s)).toEqual({
      questionId: currentQuestion(s).question.id,
      selected: null,
      isCorrect: false,
      elapsedMs: LIMIT,
    })
    expect(sessionScore(s)).toBe(0)
  })

  it('마감 뒤에 고른 보기는 정답이어도 시간 초과로 처리한다', () => {
    const s = newSession()
    const correct = correctDisplayIndex(currentQuestion(s))
    const late = answerCurrent(s, correct, T0 + LIMIT + 300)
    expect(currentAnswer(late)?.isCorrect).toBe(false)
    expect(currentAnswer(late)?.selected).toBeNull()
  })

  it('마지막 문제가 시간 초과면 종료 시각은 마감 시각이다', () => {
    let s = newSession()
    for (let i = 0; i < 39; i++) s = goToNext(answerCurrent(s, 0, T0 + i * 1000), T0 + i * 1000)
    const shownAt = s.questionShownAt
    s = expireIfOverdue(s, shownAt + LIMIT + 5_000)
    expect(isComplete(s)).toBe(true)
    expect(s.finishedAt).toBe(shownAt + LIMIT)
  })

  it('timeLimitMs = null이면 제한이 없다', () => {
    const s = startSession({ id: 's', nickname: '퀴즈왕', bank: questions, now: T0, timeLimitMs: null })
    expect(remainingMs(s, T0 + 999_999)).toBeNull()
    expect(expireIfOverdue(s, T0 + 999_999)).toBe(s)
  })
})

describe('categoryTransition (F-08)', () => {
  /** n번째 문제까지 진행한 판. 앞의 문제들은 correct(i)일 때만 맞힌다. */
  function advanceTo(n: number, correct: (i: number) => boolean) {
    let s = newSession()
    for (let i = 0; i < n; i++) {
      const c = correctDisplayIndex(currentQuestion(s))
      s = goToNext(answerCurrent(s, correct(i) ? c : (c + 1) % 4, T0), T0)
    }
    return s
  }

  it('첫 문제와 카테고리 중간에서는 null', () => {
    expect(categoryTransition(newSession())).toBeNull()
    expect(categoryTransition(advanceTo(5, () => true))).toBeNull()
  })

  it('새 카테고리의 첫 문제에서 이전 카테고리 결과를 알려 준다', () => {
    expect(categoryTransition(advanceTo(10, (i) => i < 7))).toEqual({
      from: '한국사',
      to: '과학',
      fromCorrect: 7,
      fromTotal: 10,
    })
    expect(categoryTransition(advanceTo(30, (i) => i >= 20 && i < 23))).toMatchObject({
      from: '지리',
      to: '일반상식',
      fromCorrect: 3,
    })
  })
})

describe('제한 시간 없는 연습 (WCAG 2.2.1)', () => {
  const untimed = () =>
    startSession({
      id: 'u1',
      nickname: '천천히',
      bank: questions,
      now: T0,
      mode: 'practice',
      practiceCategory: '과학',
      timeLimitMs: null,
    })

  it('시간이 아무리 지나도 시간 초과가 되지 않는다', () => {
    const s = untimed()
    expect(expireIfOverdue(s, T0 + 600_000)).toBe(s)
    const late = answerCurrent(s, correctDisplayIndex(currentQuestion(s)), T0 + 600_000)
    expect(currentAnswer(late)?.isCorrect).toBe(true)
  })

  it('보너스 없이 정답마다 10점이다', () => {
    const s = untimed()
    expect(hasSpeedBonus(s)).toBe(false)
    expect(sessionScore(answerCurrent(s, correctDisplayIndex(currentQuestion(s)), T0 + 500))).toBe(10)
  })

  it('연습 결과도 보너스 없이 정리된다', () => {
    let s = untimed()
    for (let i = 0; i < 10; i++) {
      const t = T0 + (i + 1) * 1000
      s = goToNext(answerCurrent(s, correctDisplayIndex(currentQuestion(s)), t), t)
    }
    expect(toPracticeSummary(s).record.score).toBe(100)
  })

  it('제한 시간 없는 전체 도전은 랭킹 기록으로 만들 수 없다', () => {
    let s = startSession({ id: 'f', nickname: '퀴즈왕', bank: questions, now: T0, timeLimitMs: null })
    for (let i = 0; i < 40; i++) s = goToNext(answerCurrent(s, 0, T0 + i), T0 + i)
    expect(() => toResult(s)).toThrow(/제한 시간/)
  })
})
