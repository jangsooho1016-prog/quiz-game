import { describe, expect, it } from 'vitest'
import { LocalStorageStatsRepository } from './LocalStorageStatsRepository'
import { MemoryStorage } from './MemoryStorage'

const start = (sessionId: string) => ({
  sessionId,
  mode: 'full' as const,
  practiceCategory: null,
  startedAt: '2026-11-02T00:00:00.000Z',
})

describe('LocalStorageStatsRepository', () => {
  it('시작만 한 판은 끝나지 않은 기록(중도 이탈)으로 남는다', () => {
    const repo = new LocalStorageStatsRepository(new MemoryStorage())
    repo.recordStart(start('a'))
    expect(repo.getPlays()).toEqual([{ ...start('a'), finishedAt: null, answers: [], retried: false }])
  })

  it('끝낸 판에 종료 시각과 답을, "다시 하기"를 누르면 retried를 기록한다', () => {
    const storage = new MemoryStorage()
    const repo = new LocalStorageStatsRepository(storage)
    repo.recordStart(start('a'))
    repo.recordFinish('a', '2026-11-02T00:08:00.000Z', [{ questionId: 1, isCorrect: true }])
    repo.recordRetry('a')

    const [play] = new LocalStorageStatsRepository(storage).getPlays()
    expect(play).toMatchObject({
      finishedAt: '2026-11-02T00:08:00.000Z',
      answers: [{ questionId: 1, isCorrect: true }],
      retried: true,
    })
    expect(storage.getItem('quiz-game/v2/plays')).not.toBeNull()
  })

  it('같은 판을 두 번 시작·종료해도 기록은 하나이고 처음 종료 내용이 유지된다', () => {
    const repo = new LocalStorageStatsRepository(new MemoryStorage())
    repo.recordStart(start('a'))
    repo.recordStart(start('a'))
    repo.recordFinish('a', '2026-11-02T00:08:00.000Z', [{ questionId: 1, isCorrect: true }])
    repo.recordFinish('a', '2026-11-02T00:09:00.000Z', [])
    expect(repo.getPlays()).toHaveLength(1)
    expect(repo.getPlays()[0].finishedAt).toBe('2026-11-02T00:08:00.000Z')
  })

  it('시작 기록이 없는 판의 종료·다시 하기는 무시한다', () => {
    const repo = new LocalStorageStatsRepository(new MemoryStorage())
    repo.recordFinish('없음', '2026-11-02T00:08:00.000Z', [])
    repo.recordRetry('없음')
    expect(repo.getPlays()).toEqual([])
  })

  it('저장된 값이 손상됐으면 빈 목록으로 본다', () => {
    const storage = new MemoryStorage()
    storage.setItem('quiz-game/v2/plays', '{not json')
    expect(new LocalStorageStatsRepository(storage).getPlays()).toEqual([])
  })

  it('저장에 실패해도 예외를 던지지 않는다 (게임을 막지 않음)', () => {
    const full = new MemoryStorage()
    full.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    const repo = new LocalStorageStatsRepository(full)
    expect(() => repo.recordStart(start('a'))).not.toThrow()
  })
})
