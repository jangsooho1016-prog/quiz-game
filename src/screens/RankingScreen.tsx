import { useRef, useState, type KeyboardEvent } from 'react'
import { formatClock, formatDate, formatDuration } from '../components/format'
import { CATEGORIES, QUESTIONS_PER_CATEGORY, TOTAL_QUESTIONS, type Category, type GameRecord } from '../game/types'

type Tab = '전체' | Category
const TABS: readonly Tab[] = ['전체', ...CATEGORIES]

interface RankingScreenProps {
  overall: readonly GameRecord[]
  /** F-16: 카테고리별 최고 기록 */
  byCategory: Record<Category, readonly GameRecord[]>
  /** 방금 끝낸 판의 기록 id. 목록에 있으면 강조한다. */
  highlightId: string | null
  onBack: () => void
  onShowStats: () => void
}

export function RankingScreen({ overall, byCategory, highlightId, onBack, onShowStats }: RankingScreenProps) {
  const [tab, setTab] = useState<Tab>('전체')
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const records = tab === '전체' ? overall : byCategory[tab]

  // 탭 목록 키보드 조작: 좌우 화살표로 이동, Home/End로 처음/끝
  function handleTabKey(e: KeyboardEvent<HTMLDivElement>) {
    const current = TABS.indexOf(tab)
    const next =
      e.key === 'ArrowRight'
        ? (current + 1) % TABS.length
        : e.key === 'ArrowLeft'
          ? (current - 1 + TABS.length) % TABS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? TABS.length - 1
              : null
    if (next === null) return
    e.preventDefault()
    setTab(TABS[next])
    tabRefs.current[next]?.focus()
  }

  return (
    <main className="screen screen--ranking">
      <h1 className="ranking__title">랭킹</h1>
      <p className="ranking__lead">
        {tab === '전체'
          ? '닉네임마다 가장 좋은 기록 하나만 보여 줍니다.'
          : `${tab} 정답 수로 순위를 매깁니다. 같으면 판 전체를 더 빨리 끝낸 기록이 앞섭니다.`}
      </p>

      <div className="tabs" role="tablist" aria-label="랭킹 종류" onKeyDown={handleTabKey}>
        {TABS.map((t, i) => (
          <button
            key={t}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`ranking-tab-${i}`}
            className="tabs__tab"
            aria-selected={t === tab}
            aria-controls="ranking-panel"
            tabIndex={t === tab ? 0 : -1}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="ranking-panel" aria-labelledby={`ranking-tab-${TABS.indexOf(tab)}`}>
        {records.length === 0 ? (
          <p className="empty">아직 기록이 없습니다. 40문제를 끝까지 풀면 첫 기록이 됩니다.</p>
        ) : (
          <RankingTable records={records} tab={tab} highlightId={highlightId} />
        )}
      </div>

      <div className="actions">
        <button type="button" className="button button--primary" onClick={onBack} autoFocus>
          시작 화면으로
        </button>
        <button type="button" className="button" onClick={onShowStats}>
          통계 보기
        </button>
      </div>
    </main>
  )
}

interface RankingTableProps {
  records: readonly GameRecord[]
  tab: Tab
  highlightId: string | null
}

function RankingTable({ records, tab, highlightId }: RankingTableProps) {
  const overall = tab === '전체'
  return (
    <table className="ranking">
      <caption className="visually-hidden">
        {tab} 상위 {records.length}위 기록
      </caption>
      <thead>
        <tr>
          <th scope="col">순위</th>
          <th scope="col">닉네임</th>
          {overall && (
            <th scope="col" className="num">
              점수
            </th>
          )}
          <th scope="col" className="num">
            {overall ? '정답' : `${tab} 정답`}
          </th>
          <th scope="col" className="num">
            시간
          </th>
          <th scope="col" className="num">
            날짜
          </th>
        </tr>
      </thead>
      <tbody>
        {records.map((r, i) => (
          <tr key={r.id} className={r.id === highlightId ? 'ranking__row--mine' : undefined}>
            <td className="ranking__rank">{i + 1}</td>
            <th scope="row" className="ranking__name">
              {r.nickname}
              {r.id === highlightId && <span className="ranking__me"> (이번 기록)</span>}
            </th>
            {overall && <td className="num">{r.score}</td>}
            <td className="num">
              {overall
                ? `${r.correctCount}/${TOTAL_QUESTIONS}`
                : `${r.categoryCorrect[tab]}/${QUESTIONS_PER_CATEGORY}`}
            </td>
            <td className="num">
              <span aria-hidden="true">{formatClock(r.durationSec)}</span>
              <span className="visually-hidden">{formatDuration(r.durationSec)}</span>
            </td>
            <td className="num">
              <time dateTime={r.createdAt}>{formatDate(r.createdAt)}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
