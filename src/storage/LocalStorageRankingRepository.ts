import { rankOf, RANKING_SIZE, topRanking, topRankingByCategory } from '../game/ranking'
import type { AnswerLog, Category, GameRecord, Question } from '../game/types'
import type { RankingRepository } from './RankingRepository'
import { validateRecord } from './validateRecord'

/** localStorage 중 이 저장소가 쓰는 부분. 테스트에서는 메모리 구현을 넣는다. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

/** 저장할 때 점수를 다시 검증할 기준이 되는 문제 은행. 앱에서는 문제 파일을 받기 전에 저장소를 만들므로 함수로도 받는다. */
export type QuestionSource = readonly Question[] | (() => readonly Question[])

// v2: 빠른 정답 보너스가 생기면서 점수 규칙이 바뀌어 새 키로 시작한다. 예전 키(quiz-game/records 등)는 건드리지 않는다.
const RECORDS_KEY = 'quiz-game/v2/records'
const ANSWER_LOGS_KEY = 'quiz-game/v2/answer-logs'

/** 서버 없이 브라우저 localStorage에 PRD 데이터 모델과 같은 구조로 저장한다. */
export class LocalStorageRankingRepository implements RankingRepository {
  private readonly storage: KeyValueStorage
  private readonly questions: QuestionSource

  constructor(storage: KeyValueStorage, questions: QuestionSource) {
    this.storage = storage
    this.questions = questions
  }

  save(record: GameRecord, logs: readonly AnswerLog[]): void {
    validateRecord(record, logs, typeof this.questions === 'function' ? this.questions() : this.questions)
    const records = this.readRecords()
    if (records.some((r) => r.id === record.id)) throw new Error(`이미 저장된 기록입니다: ${record.id}`)

    // 두 키를 차례로 쓴다. 기록 쓰기가 실패하면(저장 공간 부족 등) 먼저 쓴 답안 로그를 되돌려
    // 기록 없이 답안만 남는 일이 없게 한다.
    const previousLogs = this.storage.getItem(ANSWER_LOGS_KEY)
    this.write(ANSWER_LOGS_KEY, [...this.readAnswerLogs(), ...logs])
    try {
      this.write(RECORDS_KEY, [...records, record])
    } catch (e) {
      this.storage.setItem(ANSWER_LOGS_KEY, previousLogs ?? '[]')
      throw e
    }
  }

  getTop(limit = RANKING_SIZE): GameRecord[] {
    return topRanking(this.readRecords(), limit)
  }

  getTopByCategory(category: Category, limit = RANKING_SIZE): GameRecord[] {
    return topRankingByCategory(this.readRecords(), category, limit)
  }

  rankOf(recordId: string): number | null {
    const records = this.readRecords()
    const target = records.find((r) => r.id === recordId)
    return target === undefined ? null : rankOf(records, target)
  }

  getAnswerLogs(recordId: string): AnswerLog[] {
    return this.readAnswerLogs().filter((l) => l.recordId === recordId)
  }

  private readRecords(): GameRecord[] {
    return this.read<GameRecord>(RECORDS_KEY)
  }

  private readAnswerLogs(): AnswerLog[] {
    return this.read<AnswerLog>(ANSWER_LOGS_KEY)
  }

  // 저장된 값이 없거나 손상됐으면 빈 목록으로 본다.
  private read<T>(key: string): T[] {
    try {
      const parsed: unknown = JSON.parse(this.storage.getItem(key) ?? '[]')
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }

  private write(key: string, value: unknown): void {
    this.storage.setItem(key, JSON.stringify(value))
  }
}
