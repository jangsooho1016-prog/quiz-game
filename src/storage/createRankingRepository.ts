import { LocalStorageRankingRepository, type QuestionSource } from './LocalStorageRankingRepository'
import { MemoryStorage } from './MemoryStorage'
import type { RankingRepository } from './RankingRepository'

/** 브라우저 localStorage를 쓰되, 막혀 있으면 이번 방문 동안만 유지되는 메모리 저장소를 쓴다. */
export function createRankingRepository(questions: QuestionSource): RankingRepository {
  try {
    const storage = window.localStorage
    const probe = '__quiz-game-probe__'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return new LocalStorageRankingRepository(storage, questions)
  } catch {
    return new LocalStorageRankingRepository(new MemoryStorage(), questions)
  }
}
