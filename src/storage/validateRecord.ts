import { countByCategory, countCorrect, scoreOf } from '../game/scoring'
import {
  CATEGORIES,
  TIME_LIMIT_SEC,
  TOTAL_QUESTIONS,
  type AnswerLog,
  type GameRecord,
  type Question,
} from '../game/types'

/**
 * 저장 전에 기록과 답안 로그가 서로 맞는지 다시 계산해 확인한다.
 * 클라이언트에서 넘어온 점수를 그대로 믿지 않기 위한 검사다.
 */
export function validateRecord(
  record: GameRecord,
  logs: readonly AnswerLog[],
  questions: readonly Question[],
): void {
  const fail = (reason: string): never => {
    throw new Error(`기록을 저장할 수 없습니다: ${reason}`)
  }
  if (logs.length !== TOTAL_QUESTIONS) fail(`${TOTAL_QUESTIONS}문제를 모두 풀지 않았습니다 (${logs.length}개).`)
  if (logs.some((l) => l.recordId !== record.id)) fail('다른 판의 답안이 섞여 있습니다.')
  if (new Set(logs.map((l) => l.questionId)).size !== logs.length) fail('같은 문제의 답안이 중복됐습니다.')

  const limitMs = TIME_LIMIT_SEC * 1000
  const byId = new Map(questions.map((q) => [q.id, q]))
  for (const log of logs) {
    const question = byId.get(log.questionId)
    if (question === undefined) fail(`알 수 없는 문제 id: ${log.questionId}`)
    else if (log.isCorrect !== (log.selected === question.answer)) fail(`문제 ${log.questionId}의 채점이 맞지 않습니다.`)
    // 걸린 시간은 보너스 점수의 근거이므로 범위를 확인한다. 제한 시간을 넘긴 답은 정답일 수 없다.
    if (typeof log.elapsedMs !== 'number' || !(log.elapsedMs >= 0 && log.elapsedMs <= limitMs)) {
      fail(`문제 ${log.questionId}의 걸린 시간이 올바르지 않습니다.`)
    }
    if (log.isCorrect && log.elapsedMs >= limitMs) fail(`문제 ${log.questionId}는 시간 초과인데 정답 처리됐습니다.`)
  }

  if (record.score !== scoreOf(logs)) fail('점수가 답안과 맞지 않습니다.')
  if (record.correctCount !== countCorrect(logs)) fail('정답 수가 답안과 맞지 않습니다.')
  const categoryCorrect = countByCategory(logs, questions)
  if (CATEGORIES.some((c) => record.categoryCorrect[c] !== categoryCorrect[c])) {
    fail('카테고리별 정답 수가 답안과 맞지 않습니다.')
  }
  if (!Number.isInteger(record.durationSec) || record.durationSec < 0) fail('소요 시간이 올바르지 않습니다.')
  if (Number.isNaN(Date.parse(record.createdAt))) fail('기록 시각이 올바르지 않습니다.')
}
