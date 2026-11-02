import type { PlayLog } from '../game/types'
import type { KeyValueStorage } from './LocalStorageRankingRepository'
import { MemoryStorage } from './MemoryStorage'
import type { StatsRepository } from './StatsRepository'

const PLAYS_KEY = 'quiz-game/v2/plays'

export class LocalStorageStatsRepository implements StatsRepository {
  private readonly storage: KeyValueStorage

  constructor(storage: KeyValueStorage) {
    this.storage = storage
  }

  recordStart(play: Pick<PlayLog, 'sessionId' | 'mode' | 'practiceCategory' | 'startedAt'>): void {
    const plays = this.getPlays()
    if (plays.some((p) => p.sessionId === play.sessionId)) return
    this.write([...plays, { ...play, finishedAt: null, answers: [], retried: false }])
  }

  recordFinish(sessionId: string, finishedAt: string, answers: PlayLog['answers']): void {
    this.update(sessionId, (p) => (p.finishedAt === null ? { ...p, finishedAt, answers: [...answers] } : p))
  }

  recordRetry(sessionId: string): void {
    this.update(sessionId, (p) => ({ ...p, retried: true }))
  }

  // 값이 없거나 손상됐으면 빈 목록으로 본다.
  getPlays(): PlayLog[] {
    try {
      const parsed: unknown = JSON.parse(this.storage.getItem(PLAYS_KEY) ?? '[]')
      return Array.isArray(parsed) ? (parsed as PlayLog[]) : []
    } catch {
      return []
    }
  }

  private update(sessionId: string, change: (play: PlayLog) => PlayLog): void {
    const plays = this.getPlays()
    if (!plays.some((p) => p.sessionId === sessionId)) return
    this.write(plays.map((p) => (p.sessionId === sessionId ? change(p) : p)))
  }

  // 통계 저장에 실패해도(저장 공간 부족 등) 게임은 계속되어야 하므로 오류를 삼킨다.
  private write(plays: PlayLog[]): void {
    try {
      this.storage.setItem(PLAYS_KEY, JSON.stringify(plays))
    } catch {
      // 무시
    }
  }
}

/** 브라우저 localStorage를 쓰되, 막혀 있으면 이번 방문 동안만 유지되는 메모리 저장소를 쓴다. */
export function createStatsRepository(): StatsRepository {
  try {
    return new LocalStorageStatsRepository(window.localStorage)
  } catch {
    return new LocalStorageStatsRepository(new MemoryStorage())
  }
}
