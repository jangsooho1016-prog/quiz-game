import { describe, expect, it } from 'vitest'
import { questions } from '../data/testQuestions'
import { correctDisplayIndex } from '../game/game'
import { answerCurrent, currentQuestion, goToNext, startSession, toResult } from '../game/session'
import { LocalStorageRankingRepository } from './LocalStorageRankingRepository'
import { MemoryStorage } from './MemoryStorage'
import { saveRecordOnce } from './saveRecordOnce'

function finishedGame(id: string, nickname: string, correctCount: number) {
  let s = startSession({ id, nickname, bank: questions, now: 0 })
  for (let i = 0; i < 40; i++) {
    const correct = correctDisplayIndex(currentQuestion(s))
    s = goToNext(answerCurrent(s, i < correctCount ? correct : (correct + 1) % 4, (i + 1) * 1000), (i + 1) * 1000)
  }
  return toResult(s)
}

describe('saveRecordOnce', () => {
  it('저장하고 순위를 돌려준다', () => {
    const repo = new LocalStorageRankingRepository(new MemoryStorage(), questions)
    const { record, logs } = finishedGame('g1', '퀴즈왕', 30)
    expect(saveRecordOnce(repo, record, logs)).toEqual({ saved: true, rank: 1 })
  })

  it('같은 기록으로 여러 번 불러도 한 번만 저장한다', () => {
    const storage = new MemoryStorage()
    const repo = new LocalStorageRankingRepository(storage, questions)
    const { record, logs } = finishedGame('g1', '퀴즈왕', 30)

    saveRecordOnce(repo, record, logs)
    expect(saveRecordOnce(repo, record, logs)).toEqual({ saved: true, rank: 1 })
    expect(JSON.parse(storage.getItem('quiz-game/v2/records')!)).toHaveLength(1)
    expect(repo.getAnswerLogs('g1')).toHaveLength(40)
  })

  it('저장에 실패하면 예외 대신 실패 결과를 돌려준다', () => {
    const failing = new MemoryStorage()
    failing.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    const repo = new LocalStorageRankingRepository(failing, questions)
    const { record, logs } = finishedGame('g1', '퀴즈왕', 30)
    expect(saveRecordOnce(repo, record, logs)).toEqual({ saved: false, error: 'QuotaExceededError' })
  })
})
