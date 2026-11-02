import { useState } from 'react'
import { wrongAnswers } from './game/review'
import {
  createSessionId,
  hasSpeedBonus,
  startSession,
  toPracticeSummary,
  toResult,
  type GameSession,
} from './game/session'
import { completionRate, questionStats, retryRate } from './game/stats'
import {
  CATEGORIES,
  type AnswerLog,
  type Category,
  type GameMode,
  type GameRecord,
  type Question,
} from './game/types'
import type { RankingRepository } from './storage/RankingRepository'
import { saveRecordOnce, type SaveOutcome } from './storage/saveRecordOnce'
import type { StatsRepository } from './storage/StatsRepository'
import { QuizScreen } from './screens/QuizScreen'
import { RankingScreen } from './screens/RankingScreen'
import { ResultScreen } from './screens/ResultScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { StartScreen, type StartChoice } from './screens/StartScreen'
import { StatsScreen } from './screens/StatsScreen'

interface FinishedGame {
  mode: GameMode
  /** 빠른 정답 보너스가 있었는지 (제한 시간 없는 연습이면 false) */
  withBonus: boolean
  categories: Category[]
  record: GameRecord
  logs: AnswerLog[]
  /** 전체 도전의 랭킹 저장 결과. 연습 모드는 저장하지 않으므로 null */
  outcome: SaveOutcome | null
}

// 화면 전환은 라우터 없이 상태로 처리한다. 진행 중인 판은 메모리에만 있으므로 새로고침하면 시작 화면으로 돌아간다.
type Screen =
  | { name: 'start' }
  | { name: 'quiz'; session: GameSession }
  | { name: 'result'; game: FinishedGame }
  | { name: 'review'; game: FinishedGame }
  | { name: 'ranking'; highlightId: string | null }
  | { name: 'stats'; highlightId: string | null }

interface AppProps {
  /** 문제 은행. 아직 받는 중이면 null (시작 화면은 먼저 보이고 "시작하기"만 기다린다) */
  questions: readonly Question[] | null
  /** 문제 파일을 받지 못했을 때의 이유 */
  loadError?: string | null
  onRetryLoad?: () => void
  repository: RankingRepository
  stats: StatsRepository
}

function App({ questions, loadError = null, onRetryLoad = () => {}, repository, stats }: AppProps) {
  const [screen, setScreen] = useState<Screen>({ name: 'start' })
  const [choice, setChoice] = useState<StartChoice>({
    nickname: '',
    mode: 'full',
    category: CATEGORIES[0],
    untimed: false,
  })

  function handleStart(next: StartChoice) {
    if (questions === null) return
    setChoice(next)
    const now = Date.now()
    const session = startSession({
      id: createSessionId(),
      nickname: next.nickname,
      bank: questions,
      now,
      mode: next.mode,
      // 제한 시간을 끌 수 있는 것은 랭킹에 들어가지 않는 연습뿐이다.
      ...(next.mode === 'practice' && { practiceCategory: next.category }),
      ...(next.mode === 'practice' && next.untimed && { timeLimitMs: null }),
    })
    // 끝내지 않은 판은 이 시작 기록만 남아 완주율 계산에서 중도 이탈로 잡힌다.
    stats.recordStart({
      sessionId: session.id,
      mode: session.mode,
      practiceCategory: session.practiceCategory,
      startedAt: new Date(now).toISOString(),
    })
    setScreen({ name: 'quiz', session })
  }

  // 저장은 렌더나 effect가 아니라 "결과 보기"를 누른 이 핸들러에서만 한다.
  // saveRecordOnce는 같은 기록 id를 두 번 저장하지 않으므로 버튼을 연달아 눌러도 기록은 하나다.
  function handleFinish(session: GameSession) {
    const practice = session.mode === 'practice'
    const { record, logs } = practice ? toPracticeSummary(session) : toResult(session)
    stats.recordFinish(
      session.id,
      record.createdAt,
      logs.map((l) => ({ questionId: l.questionId, isCorrect: l.isCorrect })),
    )
    setScreen({
      name: 'result',
      game: {
        mode: session.mode,
        withBonus: hasSpeedBonus(session),
        categories: CATEGORIES.filter((c) => session.questions.some((p) => p.question.category === c)),
        record,
        logs,
        outcome: practice ? null : saveRecordOnce(repository, record, logs),
      },
    })
  }

  switch (screen.name) {
    case 'start':
      return (
        <StartScreen
          initial={choice}
          loading={questions === null && loadError === null}
          loadError={loadError}
          onRetryLoad={onRetryLoad}
          onStart={handleStart}
          onShowRanking={() => setScreen({ name: 'ranking', highlightId: null })}
        />
      )
    case 'quiz':
      return <QuizScreen key={screen.session.id} initialSession={screen.session} onFinish={handleFinish} />
    case 'result': {
      const { game } = screen
      const highlightId = game.outcome === null ? null : game.record.id
      return (
        <ResultScreen
          record={game.record}
          categories={game.categories}
          questionCount={game.logs.length}
          withBonus={game.withBonus}
          outcome={game.outcome}
          wrongCount={game.logs.filter((l) => !l.isCorrect).length}
          onReview={() => setScreen({ name: 'review', game })}
          onRestart={() => {
            stats.recordRetry(game.record.id)
            setScreen({ name: 'start' })
          }}
          onShowRanking={() => setScreen({ name: 'ranking', highlightId })}
        />
      )
    }
    case 'review': {
      const { game } = screen
      return (
        <ReviewScreen
          items={wrongAnswers(game.logs, questions ?? [])}
          onBack={() => setScreen({ name: 'result', game })}
        />
      )
    }
    case 'ranking':
      return (
        <RankingScreen
          overall={repository.getTop()}
          byCategory={
            Object.fromEntries(CATEGORIES.map((c) => [c, repository.getTopByCategory(c)])) as Record<
              Category,
              GameRecord[]
            >
          }
          highlightId={screen.highlightId}
          onBack={() => setScreen({ name: 'start' })}
          onShowStats={() => setScreen({ name: 'stats', highlightId: screen.highlightId })}
        />
      )
    case 'stats': {
      const plays = stats.getPlays()
      return (
        <StatsScreen
          completion={completionRate(plays)}
          retry={retryRate(plays)}
          questions={questionStats(plays, questions ?? [])}
          onBack={() => setScreen({ name: 'ranking', highlightId: screen.highlightId })}
        />
      )
    }
  }
}

export default App
