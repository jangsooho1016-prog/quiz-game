import { useEffect, useState } from 'react'
import App from './App'
import { loadQuestions } from './data/loadQuestions'
import type { Question } from './game/types'
import { createRankingRepository } from './storage/createRankingRepository'
import { createStatsRepository } from './storage/LocalStorageStatsRepository'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; questions: Question[] }

interface BootstrapProps {
  load?: () => Promise<Question[]>
}

/**
 * 문제 파일을 불러와 게임에 넘긴다 (F-17).
 * 첫 화면을 빨리 보이도록(PRD: 2초 이내) 시작 화면은 바로 그리고, 문제는 뒤에서 받는다.
 * 받기 전에는 "시작하기"가 꺼져 있고, 형식이 틀린 파일이면 시작 화면에 어디가 틀렸는지 보여 준다.
 */
export function Bootstrap({ load = loadQuestions }: BootstrapProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // 저장소는 문제를 받기 전에 만들고, 저장할 때(판이 끝난 뒤) 받은 문제 은행으로 점수를 검증한다.
  // 화면에 그리는 값이 아니므로 상태가 아닌 보관함(bank)에 넣어 두고 저장소가 필요할 때 읽는다.
  const [services] = useState(() => {
    const bank: { questions: readonly Question[] } = { questions: [] }
    return {
      bank,
      repository: createRankingRepository(() => bank.questions),
      stats: createStatsRepository(),
    }
  })

  useEffect(() => {
    let cancelled = false
    load().then(
      (questions) => {
        if (cancelled) return
        services.bank.questions = questions
        setState({ status: 'ready', questions })
      },
      (e: unknown) => {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [load, attempt, services])

  return (
    <App
      questions={state.status === 'ready' ? state.questions : null}
      loadError={state.status === 'error' ? state.message : null}
      onRetryLoad={() => {
        setState({ status: 'loading' })
        setAttempt((n) => n + 1)
      }}
      repository={services.repository}
      stats={services.stats}
    />
  )
}
