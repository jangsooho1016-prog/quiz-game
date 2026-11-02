import type { Answer, PresentedQuestion } from '../game/game'
import { CATEGORIES } from '../game/types'

interface AnswerSheetProps {
  questions: readonly PresentedQuestion[]
  answers: readonly Answer[]
  currentIndex: number
}

/**
 * OMR 답안지처럼 카테고리별 10칸씩 보여 주는 진행 표시 (전체 도전 40칸, 연습 10칸).
 * 맞힘은 채운 칸, 틀림은 빗금 칸으로 모양까지 다르게 그린다. 숫자 진행도는 따로 글자로 보여 주므로 보조 장식이다.
 */
export function AnswerSheet({ questions, answers, currentIndex }: AnswerSheetProps) {
  return (
    <div className="sheet" aria-hidden="true">
      {CATEGORIES.filter((c) => questions.some((p) => p.question.category === c)).map((category) => (
        <div className="sheet__group" key={category}>
          {questions.map((p, i) => {
            if (p.question.category !== category) return null
            const answer = answers[i]
            const state =
              answer === undefined ? (i === currentIndex ? 'current' : 'empty') : answer.isCorrect ? 'correct' : 'wrong'
            return <span key={p.question.id} className={`sheet__mark sheet__mark--${state}`} />
          })}
        </div>
      ))}
    </div>
  )
}
