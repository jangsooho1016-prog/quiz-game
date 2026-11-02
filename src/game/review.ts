import type { Answer } from './game'
import type { Question } from './types'

export interface ReviewItem {
  /** 판에서 몇 번째 문제였는지 (1부터) */
  number: number
  question: Question
  /** 내가 고른 보기 문자열. 시간 초과면 null */
  myAnswer: string | null
  correctAnswer: string
}

/**
 * F-14: 틀린 문제 목록. 답안 로그(answer_log)를 문제(question)와 조인해 만든다.
 * 보기 번호는 원래 번호로 저장되어 있으므로 화면에서 섞였던 순서와 관계없이 문자열을 찾을 수 있다.
 */
export function wrongAnswers(
  answers: readonly Pick<Answer, 'questionId' | 'selected' | 'isCorrect'>[],
  questions: readonly Question[],
): ReviewItem[] {
  const byId = new Map(questions.map((q) => [q.id, q]))
  return answers.flatMap((answer, i) => {
    if (answer.isCorrect) return []
    const question = byId.get(answer.questionId)
    if (question === undefined) throw new Error(`알 수 없는 문제 id: ${answer.questionId}`)
    return [
      {
        number: i + 1,
        question,
        myAnswer: answer.selected === null ? null : question.options[answer.selected - 1],
        correctAnswer: question.options[question.answer - 1],
      },
    ]
  })
}
