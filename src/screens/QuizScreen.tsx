import { useCallback, useEffect, useRef, useState } from 'react'
import { AnswerSheet } from '../components/AnswerSheet'
import { OPTION_MARKS } from '../components/format'
import { OptionButton, type OptionState } from '../components/OptionButton'
import { Timer } from '../components/Timer'
import { correctDisplayIndex } from '../game/game'
import { pointsFor, speedBonus } from '../game/scoring'
import {
  answerCurrent,
  categoryTransition,
  currentAnswer,
  currentQuestion,
  expireIfOverdue,
  goToNext,
  hasSpeedBonus,
  isLastQuestion,
  remainingMs,
  selectedDisplayIndex,
  sessionScore,
  type GameSession,
} from '../game/session'
import { playEffect } from '../sound/effects'
import { loadSoundEnabled, saveSoundEnabled } from '../sound/soundSetting'

interface QuizScreenProps {
  initialSession: GameSession
  onFinish: (session: GameSession) => void
}

// 남은 시간 표시를 갱신하는 간격. 판정은 시각 비교로 하므로 이 값은 표시 매끄러움에만 영향을 준다.
const TICK_MS = 100

export function QuizScreen({ initialSession, onFinish }: QuizScreenProps) {
  const [session, setSession] = useState(initialSession)
  const [now, setNow] = useState(() => Date.now())
  const [soundOn, setSoundOn] = useState(loadSoundEnabled)
  const presented = currentQuestion(session)
  const answer = currentAnswer(session)
  const answered = answer !== undefined
  const correctIndex = correctDisplayIndex(presented)
  const pickedIndex = answer === undefined ? null : selectedDisplayIndex(presented, answer)
  const last = isLastQuestion(session)
  const transition = categoryTransition(session)
  const left = remainingMs(session, now)

  const questionRef = useRef<HTMLHeadingElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const soundOnRef = useRef(soundOn)

  const choose = useCallback((displayIndex: number) => {
    const t = Date.now()
    setSession((s) => answerCurrent(s, displayIndex, t))
  }, [])

  // F-09: 답하기 전에는 시계를 돌리고, 제한 시간이 지나면 시간 초과로 확정한다.
  useEffect(() => {
    if (answered || session.timeLimitMs === null) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      setSession((s) => expireIfOverdue(s, t))
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [answered, session.index, session.timeLimitMs])

  // 키보드 1~4로 보기 선택. 이미 답한 문제는 answerCurrent가 무시한다.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= 4) choose(n - 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [choose])

  // F-18: 답이 확정되는 순간(클릭·키보드·시간 초과 모두) 효과음을 낸다.
  // 소리 설정은 ref로 읽어서, 답한 뒤 설정을 바꿔도 소리가 다시 나지 않게 한다.
  useEffect(() => {
    soundOnRef.current = soundOn
  }, [soundOn])
  useEffect(() => {
    if (answer && soundOnRef.current) playEffect(answer.isCorrect ? 'correct' : 'wrong')
  }, [answer])

  function toggleSound() {
    saveSoundEnabled(!soundOn)
    setSoundOn(!soundOn)
  }

  // 새 문제가 나오면 문제로, 답을 확정하면 "다음" 버튼으로 초점을 옮긴다.
  useEffect(() => {
    questionRef.current?.focus()
  }, [session.index])
  useEffect(() => {
    if (answered) nextRef.current?.focus()
  }, [answered])

  function handleNext() {
    if (last) {
      onFinish(session)
      return
    }
    const t = Date.now()
    setNow(t)
    setSession((s) => goToNext(s, t))
  }

  function optionState(i: number): OptionState {
    if (!answered) return 'idle'
    if (i === pickedIndex) return i === correctIndex ? 'picked-correct' : 'picked-wrong'
    if (i === correctIndex) return 'answer'
    return 'dimmed'
  }

  return (
    <main className="screen screen--quiz">
      <header className="quiz__bar">
        <p className="quiz__category">{presented.question.category}</p>
        <dl className="quiz__stats">
          <div>
            <dt>진행</dt>
            <dd>
              {session.index + 1} / {session.questions.length}
            </dd>
          </div>
          <div>
            <dt>점수</dt>
            <dd>{sessionScore(session)}</dd>
          </div>
        </dl>
        <button type="button" className="sound-toggle" aria-pressed={soundOn} onClick={toggleSound}>
          효과음 <span aria-hidden="true">{soundOn ? '켬' : '끔'}</span>
        </button>
        <AnswerSheet questions={session.questions} answers={session.answers} currentIndex={session.index} />
      </header>

      {transition && (
        <p className="transition" role="status">
          <strong>{transition.to}</strong> 문제를 시작합니다. {transition.from}에서는 {transition.fromTotal}문제 중{' '}
          {transition.fromCorrect}문제를 맞혔습니다.
        </p>
      )}

      <section className="quiz__body" aria-labelledby="question">
        {session.timeLimitMs !== null ? (
          <Timer remainingMs={answered ? null : left} limitMs={session.timeLimitMs} />
        ) : (
          <p className="timer__label">제한 시간 없이 푸는 중</p>
        )}

        <h1 id="question" className="quiz__question" ref={questionRef} tabIndex={-1}>
          <span className="quiz__number">{session.index + 1}.</span> {presented.question.content}
        </h1>

        <div className="options">
          {presented.options.map((text, i) => (
            <OptionButton
              key={`${presented.question.id}-${i}`}
              number={i + 1}
              text={text}
              state={optionState(i)}
              disabled={answered}
              onSelect={() => choose(i)}
            />
          ))}
        </div>

        <div className="feedback-slot" role="status" aria-live="polite">
          {answer && (
            <div className={answer.isCorrect ? 'feedback feedback--correct' : 'feedback feedback--wrong'}>
              <p className="feedback__verdict">
                {answer.isCorrect ? (
                  <>
                    <span className="feedback__icon" aria-hidden="true">
                      ✓
                    </span>{' '}
                    정답입니다
                  </>
                ) : (
                  <>
                    <span className="feedback__icon" aria-hidden="true">
                      ✗
                    </span>{' '}
                    {answer.selected === null ? '시간 초과입니다' : '오답입니다'}. 정답은 {OPTION_MARKS[correctIndex]}{' '}
                    {presented.options[correctIndex]}
                  </>
                )}
              </p>
              {answer.isCorrect && (
                <p className="feedback__points">
                  {hasSpeedBonus(session)
                    ? `+${pointsFor(answer)}점 (빠른 정답 보너스 +${speedBonus(answer.elapsedMs)})`
                    : `+${pointsFor(answer, false)}점`}
                </p>
              )}
              <p className="feedback__explanation">{presented.question.explanation}</p>
            </div>
          )}
        </div>

        <div className="actions actions--end">
          <button
            type="button"
            ref={nextRef}
            className="button button--primary"
            disabled={!answered}
            onClick={handleNext}
          >
            {last ? '결과 보기' : '다음'}
          </button>
        </div>
      </section>
    </main>
  )
}
