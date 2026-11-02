import {
  COMPLETION_TARGET,
  MIN_ATTEMPTS,
  RETRY_TARGET,
  TOO_EASY_ABOVE,
  TOO_HARD_BELOW,
  type QuestionStat,
  type QuestionStatus,
  type Rate,
} from '../game/stats'

interface StatsScreenProps {
  completion: Rate
  retry: Rate
  questions: readonly QuestionStat[]
  onBack: () => void
}

const percent = (value: number) => `${Math.round(value * 100)}%`

const STATUS_LABEL: Record<QuestionStatus, string> = {
  'too-hard': '✗ 너무 어려움',
  'too-easy': '✗ 너무 쉬움',
  ok: '✓ 정상',
  insufficient: '표본 부족',
}

/** PRD '성공 지표': 완주율, 재도전율, 문제별 정답률. 이 브라우저의 기록만 집계한다. */
export function StatsScreen({ completion, retry, questions, onBack }: StatsScreenProps) {
  const flagged = questions.filter((q) => q.status === 'too-hard' || q.status === 'too-easy').length

  return (
    <main className="screen screen--stats">
      <header>
        <h1 className="page-title">통계</h1>
        <p className="page-lead">이 브라우저에서 플레이한 기록만 집계합니다.</p>
      </header>

      <section aria-labelledby="metrics-title">
        <h2 id="metrics-title" className="section-title">
          성공 지표
        </h2>
        <dl className="metrics">
          <Metric
            label="완주율"
            description="전체 도전을 시작한 판 중 40문제를 끝낸 비율"
            value={completion}
            target={COMPLETION_TARGET}
            unit="판"
          />
          <Metric
            label="재도전율"
            description='끝낸 판 중 결과 화면에서 "다시 하기"를 누른 비율'
            value={retry}
            target={RETRY_TARGET}
            unit="판"
          />
        </dl>
      </section>

      <section aria-labelledby="questions-title">
        <h2 id="questions-title" className="section-title">
          문제별 정답률
        </h2>
        <p className="muted stats__note">
          정답률이 {percent(TOO_HARD_BELOW)} 미만이거나 {percent(TOO_EASY_ABOVE)}를 넘는 문제는 검토 대상입니다.{' '}
          {MIN_ATTEMPTS}번 미만 풀린 문제는 판단하지 않습니다. 지금 검토 대상은 {flagged}문제입니다.
        </p>
        <table className="ranking stats-table">
          <caption className="visually-hidden">문제별 시도 수와 정답률</caption>
          <thead>
            <tr>
              <th scope="col">문제</th>
              <th scope="col" className="num">
                시도
              </th>
              <th scope="col" className="num">
                정답률
              </th>
              <th scope="col">상태</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((s) => (
              <tr key={s.question.id} className={`stats-table__row stats-table__row--${s.status}`}>
                <th scope="row" className="stats-table__question">
                  <span className="stats-table__meta">
                    {s.question.id}번 · {s.question.category}
                  </span>
                  {s.question.content}
                </th>
                <td className="num">{s.attempts}</td>
                <td className="num">{s.rate === null ? '-' : percent(s.rate)}</td>
                <td className="stats-table__status">{STATUS_LABEL[s.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="actions">
        <button type="button" className="button button--primary" onClick={onBack} autoFocus>
          랭킹으로 돌아가기
        </button>
      </div>
    </main>
  )
}

interface MetricProps {
  label: string
  description: string
  value: Rate
  target: number
  unit: string
}

function Metric({ label, description, value, target, unit }: MetricProps) {
  const met = value.rate !== null && value.rate >= target
  return (
    <div className="metric">
      <dt className="metric__label">{label}</dt>
      <dd className="metric__value">{value.rate === null ? '-' : percent(value.rate)}</dd>
      <dd className="metric__detail">
        {description}. {value.total}
        {unit} 중 {value.count}
        {unit}
      </dd>
      <dd className={value.rate === null ? 'metric__goal' : met ? 'metric__goal metric__goal--met' : 'metric__goal metric__goal--miss'}>
        {value.rate === null ? `목표 ${percent(target)} 이상 (아직 기록 없음)` : `${met ? '✓ 목표 달성' : '✗ 목표 미달'} (목표 ${percent(target)} 이상)`}
      </dd>
    </div>
  )
}
