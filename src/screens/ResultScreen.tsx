import { formatDuration } from '../components/format'
import { maxScore, POINTS_PER_CORRECT, QUESTIONS_PER_CATEGORY, type Category, type GameRecord } from '../game/types'
import type { SaveOutcome } from '../storage/saveRecordOnce'

interface ResultScreenProps {
  record: GameRecord
  /** 이번 판에 나온 카테고리 (연습 모드면 하나) */
  categories: readonly Category[]
  questionCount: number
  /** 빠른 정답 보너스가 있었는지 (제한 시간 없는 연습이면 false) */
  withBonus: boolean
  /** 전체 도전의 저장 결과. 연습 모드는 저장하지 않으므로 null */
  outcome: SaveOutcome | null
  wrongCount: number
  onReview: () => void
  onRestart: () => void
  onShowRanking: () => void
}

export function ResultScreen({
  record,
  categories,
  questionCount,
  withBonus,
  outcome,
  wrongCount,
  onReview,
  onRestart,
  onShowRanking,
}: ResultScreenProps) {
  const practice = outcome === null
  const base = record.correctCount * POINTS_PER_CORRECT
  const bonus = record.score - base

  return (
    <main className="screen screen--result">
      <header className="result__head">
        <h1 className="result__title">
          {record.nickname}님의 {practice ? `${categories[0]} 연습` : '채점'} 결과
        </h1>
        <p className="result__score">
          <strong>{record.score}</strong>점
          <span className="result__max"> / {maxScore(questionCount, withBonus)}점</span>
        </p>
        <p className="result__breakdown">
          정답 {record.correctCount}개 × {POINTS_PER_CORRECT}점 = {base}점
          {withBonus ? `, 빠른 정답 보너스 ${bonus}점` : ' (제한 시간 없는 연습이라 보너스 없음)'}
        </p>
      </header>

      <dl className="result__facts">
        <div>
          <dt>정답 수</dt>
          <dd>
            {record.correctCount} / {questionCount}
          </dd>
        </div>
        <div>
          <dt>소요 시간</dt>
          <dd>{formatDuration(record.durationSec)}</dd>
        </div>
        <div>
          <dt>이번 기록 순위</dt>
          <dd>{practice ? '연습 (기록 안 함)' : outcome.saved ? `${outcome.rank}위` : '집계 안 됨'}</dd>
        </div>
      </dl>
      {practice && <p className="muted">연습 결과는 랭킹에 저장되지 않습니다.</p>}
      {outcome !== null && !outcome.saved && (
        <p className="notice" role="alert">
          기록을 저장하지 못해 순위에 반영되지 않았습니다. ({outcome.error})
        </p>
      )}

      <section aria-labelledby="by-category">
        <h2 id="by-category" className="section-title">
          카테고리별 정답
        </h2>
        <ul className="categories">
          {categories.map((category) => {
            const correct = record.categoryCorrect[category]
            return (
              <li key={category} className="categories__row">
                <span className="categories__name">{category}</span>
                <span className="categories__marks" aria-hidden="true">
                  {Array.from({ length: QUESTIONS_PER_CATEGORY }, (_, i) => (
                    <span key={i} className={i < correct ? 'sheet__mark sheet__mark--correct' : 'sheet__mark'} />
                  ))}
                </span>
                <span className="categories__count">
                  {correct} / {QUESTIONS_PER_CATEGORY}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="actions">
        <button type="button" className="button button--primary" onClick={onRestart} autoFocus>
          다시 하기
        </button>
        <button type="button" className="button" onClick={onShowRanking}>
          랭킹 보기
        </button>
        {wrongCount > 0 && (
          <button type="button" className="button" onClick={onReview}>
            틀린 문제 다시 보기 ({wrongCount})
          </button>
        )}
      </div>
      {wrongCount === 0 && <p className="muted">{questionCount}문제를 모두 맞혔습니다. 틀린 문제가 없습니다.</p>}
    </main>
  )
}
