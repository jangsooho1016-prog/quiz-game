import { useState, type FormEvent } from 'react'
import { nicknameError, NICKNAME_MAX, NICKNAME_MIN } from '../game/nickname'
import {
  BONUS_STEP_SEC,
  CATEGORIES,
  MAX_SPEED_BONUS,
  maxScore,
  POINTS_PER_CORRECT,
  QUESTIONS_PER_CATEGORY,
  TIME_LIMIT_SEC,
  TOTAL_QUESTIONS,
  type Category,
  type GameMode,
} from '../game/types'

export interface StartChoice {
  nickname: string
  mode: GameMode
  /** 연습 모드에서 고른 카테고리 */
  category: Category
  /** 연습 모드에서 제한 시간 없이 풀지 (WCAG 2.2.1). 전체 도전은 항상 15초 */
  untimed: boolean
}

interface StartScreenProps {
  initial: StartChoice
  /** 문제 파일을 받는 중이면 true. 그동안 "시작하기"는 꺼져 있다. */
  loading: boolean
  /** 문제 파일을 받지 못했을 때의 이유 */
  loadError: string | null
  onRetryLoad: () => void
  onStart: (choice: StartChoice) => void
  onShowRanking: () => void
}

export function StartScreen({
  initial,
  loading,
  loadError,
  onRetryLoad,
  onStart,
  onShowRanking,
}: StartScreenProps) {
  const [nickname, setNickname] = useState(initial.nickname)
  const [mode, setMode] = useState<GameMode>(initial.mode)
  const [category, setCategory] = useState<Category>(initial.category)
  const [untimed, setUntimed] = useState(initial.untimed)
  const [touched, setTouched] = useState(false)
  const error = nicknameError(nickname)
  const showError = touched && error !== null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (error === null && !loading && loadError === null) onStart({ nickname, mode, category, untimed })
  }

  return (
    <main className="screen screen--start">
      <header className="start__head">
        <h1 className="start__title">상식 퀴즈</h1>
        <p className="start__lead">
          {CATEGORIES.join(' · ')}, {TOTAL_QUESTIONS}문제를 풀고 순위에 이름을 올려 보세요.
        </p>
      </header>

      <form className="start__form" onSubmit={handleSubmit} noValidate>
        <label className="field__label" htmlFor="nickname">
          닉네임
        </label>
        <input
          id="nickname"
          className="field__input"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value)
            if (e.target.value !== '') setTouched(true)
          }}
          autoComplete="nickname"
          autoFocus
          aria-invalid={showError}
          aria-describedby="nickname-help"
        />
        <p id="nickname-help" className={showError ? 'field__help field__help--error' : 'field__help'} role="status">
          {showError ? error : `${NICKNAME_MIN}~${NICKNAME_MAX}자, 띄어쓰기 없이 입력하세요.`}
        </p>

        <fieldset className="choice">
          <legend className="field__label">게임 방식</legend>
          <label className="choice__option">
            <input type="radio" name="mode" checked={mode === 'full'} onChange={() => setMode('full')} />
            <span>
              전체 도전 <span className="choice__note">{TOTAL_QUESTIONS}문제, 랭킹에 기록</span>
            </span>
          </label>
          <label className="choice__option">
            <input type="radio" name="mode" checked={mode === 'practice'} onChange={() => setMode('practice')} />
            <span>
              카테고리 연습 <span className="choice__note">{QUESTIONS_PER_CATEGORY}문제, 랭킹에 기록하지 않음</span>
            </span>
          </label>
        </fieldset>

        {mode === 'practice' && (
          <fieldset className="choice choice--inline">
            <legend className="field__label">연습할 카테고리</legend>
            {CATEGORIES.map((c) => (
              <label key={c} className="choice__option">
                <input type="radio" name="category" checked={category === c} onChange={() => setCategory(c)} />
                <span>{c}</span>
              </label>
            ))}
          </fieldset>
        )}
        {mode === 'practice' && (
          <label className="choice__option choice__option--single">
            <input type="checkbox" checked={untimed} onChange={(e) => setUntimed(e.target.checked)} />
            <span>
              제한 시간 없이 풀기
              <span className="choice__note">시간에 쫓기지 않고 풀 수 있습니다. 빠른 정답 보너스는 없습니다.</span>
            </span>
          </label>
        )}

        {loadError !== null && (
          <div className="notice" role="alert">
            <p>문제를 불러오지 못해 시작할 수 없습니다. {loadError}</p>
            <button type="button" className="button notice__action" onClick={onRetryLoad}>
              다시 시도
            </button>
          </div>
        )}
        {loading && (
          <p className="start__status" role="status">
            문제를 불러오는 중입니다.
          </p>
        )}

        <div className="actions">
          <button type="submit" className="button button--primary" disabled={loading || loadError !== null}>
            시작하기
          </button>
          <button type="button" className="button" onClick={onShowRanking}>
            랭킹 보기
          </button>
        </div>
      </form>

      <section className="rules" aria-labelledby="rules-title">
        <h2 id="rules-title" className="rules__title">
          규칙
        </h2>
        <ul className="rules__list">
          <li>
            {CATEGORIES.join(' → ')} 순서로 카테고리마다 {QUESTIONS_PER_CATEGORY}문제씩 나옵니다.
          </li>
          <li>보기를 누르면 바로 답이 확정되고, 바꿀 수 없습니다. 키보드 1~4로도 고를 수 있습니다.</li>
          <li>문제마다 {TIME_LIMIT_SEC}초 안에 답해야 합니다. 시간이 지나면 오답이 됩니다.</li>
          <li>답을 고르면 정답과 해설을 바로 보여 줍니다.</li>
          <li>
            정답 1개에 {POINTS_PER_CORRECT}점이고, 빨리 맞힐수록 보너스를 더 받습니다. 남은 시간 {BONUS_STEP_SEC}초마다
            1점, 최대 {MAX_SPEED_BONUS}점입니다. 오답과 시간 초과는 0점이며, 만점은 {maxScore(TOTAL_QUESTIONS)}
            점입니다.
          </li>
          <li>점수가 같으면 더 빨리 끝낸 사람이 높은 순위가 됩니다.</li>
          <li>전체 도전 {TOTAL_QUESTIONS}문제를 모두 풀어야 랭킹에 기록이 남습니다. 카테고리 연습은 기록하지 않습니다.</li>
          <li>카테고리 연습은 제한 시간 없이 풀 수도 있습니다. 이때는 빠른 정답 보너스가 없습니다.</li>
        </ul>
      </section>
    </main>
  )
}
