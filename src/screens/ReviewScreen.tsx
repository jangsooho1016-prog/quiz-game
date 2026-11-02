import type { ReviewItem } from '../game/review'

interface ReviewScreenProps {
  items: readonly ReviewItem[]
  onBack: () => void
}

/** F-14: 틀린 문제 다시 보기 (문제, 내 답, 정답, 해설) */
export function ReviewScreen({ items, onBack }: ReviewScreenProps) {
  return (
    <main className="screen screen--review">
      <header>
        <h1 className="page-title">틀린 문제 다시 보기</h1>
        <p className="page-lead">{items.length}문제를 틀렸습니다. 정답과 해설을 확인해 보세요.</p>
      </header>

      <ol className="review">
        {items.map((item) => (
          <li key={item.question.id} className="review__item">
            <p className="review__meta">
              {item.number}번 문제 · {item.question.category}
            </p>
            <h2 className="review__question">{item.question.content}</h2>
            <dl className="review__answers">
              <div className="review__row review__row--mine">
                <dt>
                  <span aria-hidden="true">✗</span> 내 답
                </dt>
                <dd>{item.myAnswer ?? '시간 초과 (답하지 못함)'}</dd>
              </div>
              <div className="review__row review__row--correct">
                <dt>
                  <span aria-hidden="true">✓</span> 정답
                </dt>
                <dd>{item.correctAnswer}</dd>
              </div>
            </dl>
            <p className="review__explanation">{item.question.explanation}</p>
          </li>
        ))}
      </ol>

      <div className="actions">
        <button type="button" className="button button--primary" onClick={onBack} autoFocus>
          결과로 돌아가기
        </button>
      </div>
    </main>
  )
}
