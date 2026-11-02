import { beforeEach, describe, expect, it } from 'vitest'
import { questions } from '../data/testQuestions'
import { buildGame, correctDisplayIndex, judge } from '../game/game'
import { finishGame } from '../game/scoring'
import { seededRng } from '../game/shuffle'
import type { AnswerLog, GameRecord } from '../game/types'
import { LocalStorageRankingRepository } from './LocalStorageRankingRepository'
import { MemoryStorage } from './MemoryStorage'

let seq = 0

/** 앞에서부터 correctCount개를 맞힌 완주 기록을 만든다. 모든 답은 5초 걸렸다고 본다 (보너스 +4). */
function completedGame(nickname: string, correctCount: number, durationSec = 300) {
  seq++
  const startedAt = new Date(Date.UTC(2026, 9, 31, 0, 0, seq))
  const answers = buildGame(questions, seededRng(seq)).map((p, i) => {
    const correct = correctDisplayIndex(p)
    return { ...judge(p, i < correctCount ? correct : (correct + 1) % 4), elapsedMs: 5_000 }
  })
  return finishGame({
    id: `r${seq}`,
    nickname,
    answers,
    questions,
    startedAt,
    finishedAt: new Date(startedAt.getTime() + durationSec * 1000),
  })
}

describe('LocalStorageRankingRepository', () => {
  let storage: MemoryStorage
  let repo: LocalStorageRankingRepository

  beforeEach(() => {
    storage = new MemoryStorage()
    repo = new LocalStorageRankingRepository(storage, questions)
  })

  it('완주한 판을 저장하고 랭킹, 순위, 답안 로그로 다시 읽는다', () => {
    const { record, logs } = completedGame('퀴즈왕', 30)
    repo.save(record, logs)

    expect(repo.getTop()).toEqual([record])
    expect(repo.rankOf(record.id)).toBe(1)
    expect(repo.getAnswerLogs(record.id)).toEqual(logs)
  })

  it('새 저장소 인스턴스에서도 같은 데이터가 보인다', () => {
    const { record, logs } = completedGame('퀴즈왕', 30)
    repo.save(record, logs)
    expect(new LocalStorageRankingRepository(storage, questions).getTop()).toEqual([record])
  })

  it('40문제를 다 풀지 않은 판은 저장하지 않는다', () => {
    const { record, logs } = completedGame('중도포기', 10)
    expect(() => repo.save(record, logs.slice(0, 39))).toThrow(/40문제/)
    expect(repo.getTop()).toEqual([])
    expect(storage.data.size).toBe(0)
  })

  it('답안과 맞지 않는 점수는 저장하지 않는다', () => {
    const { record, logs } = completedGame('조작', 10)
    const tampered: GameRecord = { ...record, score: 400 }
    expect(() => repo.save(tampered, logs)).toThrow(/점수/)
  })

  it('정답 여부가 조작된 답안은 저장하지 않는다', () => {
    const { record, logs } = completedGame('조작', 0)
    const tamperedLogs: AnswerLog[] = logs.map((l, i) => (i === 0 ? { ...l, isCorrect: true } : l))
    expect(() => repo.save({ ...record, score: 10, correctCount: 1 }, tamperedLogs)).toThrow(/채점/)
  })

  it('같은 기록을 두 번 저장하지 않는다', () => {
    const { record, logs } = completedGame('퀴즈왕', 30)
    repo.save(record, logs)
    expect(() => repo.save(record, logs)).toThrow(/이미/)
  })

  it('같은 닉네임의 기록은 모두 저장하되 랭킹에는 최고 기록만 보인다', () => {
    const first = completedGame('퀴즈왕', 20)
    const second = completedGame('퀴즈왕', 35)
    const other = completedGame('도전자', 30)
    for (const g of [first, second, other]) repo.save(g.record, g.logs)

    expect(repo.getTop().map((r) => r.id)).toEqual([second.record.id, other.record.id])
    expect(repo.getAnswerLogs(first.record.id)).toHaveLength(40)
    expect(repo.rankOf(first.record.id)).toBe(2) // 20개 기록은 도전자(30개) 뒤
  })

  it('동점이면 소요 시간이 짧은 쪽이 앞선다', () => {
    const slow = completedGame('느림', 30, 600)
    const fast = completedGame('빠름', 30, 200)
    repo.save(slow.record, slow.logs)
    repo.save(fast.record, fast.logs)
    expect(repo.getTop().map((r) => r.nickname)).toEqual(['빠름', '느림'])
  })

  it('랭킹은 상위 10개만 돌려준다', () => {
    for (let i = 0; i < 12; i++) {
      const g = completedGame(`player${i}`, i)
      repo.save(g.record, g.logs)
    }
    const top = repo.getTop()
    expect(top).toHaveLength(10)
    expect(top[0].correctCount).toBe(11)
    expect(top[9].correctCount).toBe(2)
  })

  it('저장된 값이 손상됐으면 빈 목록으로 본다', () => {
    storage.setItem('quiz-game/v2/records', '{not json')
    expect(repo.getTop()).toEqual([])
    expect(repo.rankOf('없음')).toBeNull()
  })
})

describe('LocalStorageRankingRepository.getTopByCategory (F-16)', () => {
  it('카테고리 정답 수 기준으로 닉네임별 최고 기록을 돌려준다', () => {
    const repo = new LocalStorageRankingRepository(new MemoryStorage(), questions)
    const onlyFirst10 = completedGame('한국사왕', 10) // 한국사 10/10, 총점 100
    const mostly = completedGame('만능', 30) // 한국사·과학·지리 10/10, 총점 300
    const weak = completedGame('초보', 5) // 한국사 5/10
    for (const g of [onlyFirst10, mostly, weak]) repo.save(g.record, g.logs)

    expect(repo.getTop().map((r) => r.nickname)).toEqual(['만능', '한국사왕', '초보'])
    expect(repo.getTopByCategory('한국사').map((r) => r.nickname)).toEqual(['한국사왕', '만능', '초보'])
    expect(repo.getTopByCategory('지리').map((r) => r.nickname)).toEqual(['만능', '한국사왕', '초보'])
  })
})

describe('LocalStorageRankingRepository: 빠른 정답 보너스와 저장 키 (v2)', () => {
  it('보너스만 부풀린 점수는 저장하지 않는다', () => {
    const repo = new LocalStorageRankingRepository(new MemoryStorage(), questions)
    const { record, logs } = completedGame('조작', 20)
    expect(record.score).toBe(20 * 14)
    expect(() => repo.save({ ...record, score: record.score + 1 }, logs)).toThrow(/점수/)
  })

  it('걸린 시간을 줄여 보너스를 키운 답안은 점수가 맞지 않아 저장하지 않는다', () => {
    const repo = new LocalStorageRankingRepository(new MemoryStorage(), questions)
    const { record, logs } = completedGame('조작', 20)
    const faster: AnswerLog[] = logs.map((l) => ({ ...l, elapsedMs: 100 }))
    expect(() => repo.save(record, faster)).toThrow(/점수/)
  })

  it.each([
    ['음수', -1],
    ['제한 시간 초과', 15_001],
    ['숫자가 아님', Number.NaN],
  ])('걸린 시간이 %s이면 저장하지 않는다', (_, elapsedMs) => {
    const repo = new LocalStorageRankingRepository(new MemoryStorage(), questions)
    const { record, logs } = completedGame('조작', 0)
    const bad: AnswerLog[] = logs.map((l, i) => (i === 0 ? { ...l, elapsedMs } : l))
    expect(() => repo.save(record, bad)).toThrow(/걸린 시간/)
  })

  it('제한 시간을 다 쓴 답이 정답으로 되어 있으면 저장하지 않는다', () => {
    const repo = new LocalStorageRankingRepository(new MemoryStorage(), questions)
    const { record, logs } = completedGame('조작', 1)
    const late: AnswerLog[] = logs.map((l, i) => (i === 0 ? { ...l, elapsedMs: 15_000 } : l))
    expect(() => repo.save({ ...record, score: 10 }, late)).toThrow(/시간 초과/)
  })

  it('새 키(quiz-game/v2/...)에 저장하고, 예전 키의 기록은 읽지도 지우지도 않는다', () => {
    const storage = new MemoryStorage()
    const old = JSON.stringify([{ id: 'old', nickname: '예전', score: 400 }])
    storage.setItem('quiz-game/records', old)
    const repo = new LocalStorageRankingRepository(storage, questions)
    const { record, logs } = completedGame('새규칙', 30)
    repo.save(record, logs)

    expect(repo.getTop().map((r) => r.nickname)).toEqual(['새규칙'])
    expect(JSON.parse(storage.getItem('quiz-game/v2/records')!)).toHaveLength(1)
    expect(JSON.parse(storage.getItem('quiz-game/v2/answer-logs')!)).toHaveLength(40)
    expect(storage.getItem('quiz-game/records')).toBe(old)
  })
})

describe('LocalStorageRankingRepository: 저장 도중 실패', () => {
  it('기록 쓰기가 실패하면 먼저 쓴 답안 로그를 되돌리고 예외를 다시 던진다', () => {
    const storage = new MemoryStorage()
    const repo = new LocalStorageRankingRepository(storage, questions)
    const first = completedGame('먼저', 20)
    repo.save(first.record, first.logs)
    const logsBefore = storage.getItem('quiz-game/v2/answer-logs')

    const write = storage.setItem.bind(storage)
    storage.setItem = (key, value) => {
      if (key === 'quiz-game/v2/records') throw new Error('QuotaExceededError')
      write(key, value)
    }
    const second = completedGame('나중', 30)
    expect(() => repo.save(second.record, second.logs)).toThrow('QuotaExceededError')

    expect(storage.getItem('quiz-game/v2/answer-logs')).toBe(logsBefore)
    expect(repo.getAnswerLogs(second.record.id)).toEqual([])
    expect(repo.getTop().map((r) => r.nickname)).toEqual(['먼저'])
  })
})
