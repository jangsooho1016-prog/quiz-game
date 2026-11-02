// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { Bootstrap } from './Bootstrap'
import { questions } from './data/testQuestions'
import { LocalStorageRankingRepository } from './storage/LocalStorageRankingRepository'
import { LocalStorageStatsRepository } from './storage/LocalStorageStatsRepository'
import { MemoryStorage } from './storage/MemoryStorage'

// 한 테스트에서 여러 판(80문제 이상)을 jsdom으로 도는 경우가 있어 기본 5초보다 넉넉히 둔다.
vi.setConfig({ testTimeout: 30_000 })

// 날짜만 고정해 두면 답하는 데 걸린 시간이 늘 0초라 보너스가 항상 +5로 같다 (기계가 느려도 점수가 흔들리지 않음).
// 타이머(setInterval 등)는 실제로 돌고, 시간을 흘려야 하는 테스트는 vi.useFakeTimers()로 다시 바꾼다.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.clear()
})

/** 화면에 보이는 문제 본문으로 문제 데이터를 찾는다. */
function shownQuestion() {
  const heading = screen.getByRole('heading', { level: 1 })
  const question = questions.find((q) => heading.textContent?.endsWith(q.content))
  if (!question) throw new Error(`문제를 찾지 못함: ${heading.textContent}`)
  return question
}

function optionButtons() {
  return screen.getAllByRole('button').filter((b) => b.classList.contains('option'))
}

/** 보기 문자열이 정확히 text인 보기 버튼인지 ("H₂O"가 "H₂O₂"에 걸리지 않도록 끝까지 비교). */
function isOption(button: HTMLElement, text: string) {
  return button.querySelector('.option__text')!.textContent!.endsWith(` ${text}`)
}

/** 시작 화면에서 한 판을 끝까지 풀고 결과 화면에서 멈춘다. 앞의 correctCount문제만 맞힌다. */
function startGame(nickname: string) {
  fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: nickname } })
  fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
}

/** 현재 문제에서 정답(correct = true) 또는 오답 보기를 누른다. */
function answer(correct: boolean) {
  const question = shownQuestion()
  const correctText = question.options[question.answer - 1]
  fireEvent.click(optionButtons().find((b) => correct === isOption(b, correctText))!)
  return question
}

/** 한 판을 끝까지 푼다. correct가 숫자면 앞의 그 개수만, 함수면 correct(i)가 참인 문제만 맞힌다. */
function playGame(nickname: string, correct: number | ((i: number) => boolean)) {
  startGame(nickname)
  const isCorrect = typeof correct === 'number' ? (i: number) => i < correct : correct

  for (let i = 0; i < 40; i++) {
    const question = answer(isCorrect(i))

    // 확정 후: 보기 비활성화, 피드백과 해설 표시, "다음" 활성화
    expect(optionButtons().every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getByText(question.explanation)).toBeTruthy()
    const next = screen.getByRole('button', { name: i === 39 ? '결과 보기' : '다음' }) as HTMLButtonElement
    expect(next.disabled).toBe(false)
    fireEvent.click(next)
  }
}

/** 같은 storage를 넘기면 새로고침한 것처럼 저장된 데이터를 이어 쓴다. */
function renderApp(storage = new MemoryStorage()) {
  render(
    <App
      questions={questions}
      repository={new LocalStorageRankingRepository(storage, questions)}
      stats={new LocalStorageStatsRepository(storage)}
    />,
  )
  return storage
}

const savedRecords = (storage: MemoryStorage) => JSON.parse(storage.getItem('quiz-game/v2/records') ?? '[]')

describe('App', () => {
  it('규칙을 어긴 닉네임이면 안내 문구를 보여 주고 시작하지 않는다', () => {
    renderApp()
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '퀴즈 왕' } })
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
    expect(screen.getByText('닉네임에는 공백을 넣을 수 없습니다.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '상식 퀴즈' })).toBeTruthy()
  })

  it('퀴즈 화면 상단에 카테고리, 진행도, 점수를 보여 주고 답하면 점수가 오른다', () => {
    renderApp()
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '퀴즈왕' } })
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))

    expect(screen.getByText('한국사')).toBeTruthy()
    expect(screen.getByText('1 / 40')).toBeTruthy()
    const question = shownQuestion()
    fireEvent.click(optionButtons().find((b) => isOption(b, question.options[question.answer - 1]))!)
    expect(screen.getByText('정답입니다')).toBeTruthy()
    expect(screen.getByText('15')).toBeTruthy() // 바로 맞혔으므로 10점 + 보너스 5점

    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByText('2 / 40')).toBeTruthy()
  })

  it('한 판을 끝까지 풀면 결과를 보여 주고 기록을 한 번만 저장한다', () => {
    const storage = renderApp()
    playGame('퀴즈왕', 15)

    expect(screen.getByRole('heading', { name: '퀴즈왕님의 채점 결과' })).toBeTruthy()
    expect(screen.getByText('225')).toBeTruthy() // 15문제 × (10 + 보너스 5)
    expect(screen.getByText('정답 15개 × 10점 = 150점, 빠른 정답 보너스 75점')).toBeTruthy()
    expect(screen.getByText('/ 600점')).toBeTruthy()
    expect(screen.getByText('15 / 40')).toBeTruthy()
    expect(screen.getByText('1위')).toBeTruthy()
    const categories = screen.getByRole('list')
    expect(within(categories).getByText('한국사').parentElement!.textContent).toContain('10 / 10')
    expect(within(categories).getByText('과학').parentElement!.textContent).toContain('5 / 10')
    expect(within(categories).getByText('지리').parentElement!.textContent).toContain('0 / 10')

    expect(savedRecords(storage)).toHaveLength(1)
  })

  it('같은 닉네임으로 두 판을 하면 랭킹에는 더 높은 기록 하나만 보인다', () => {
    const storage = renderApp()
    playGame('퀴즈왕', 12)
    fireEvent.click(screen.getByRole('button', { name: '다시 하기' }))
    expect((screen.getByLabelText('닉네임') as HTMLInputElement).value).toBe('퀴즈왕')
    playGame('퀴즈왕', 31)
    fireEvent.click(screen.getByRole('button', { name: '랭킹 보기' }))

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('퀴즈왕')
    expect(rows[0].textContent).toContain('465')
    expect(rows[0].textContent).toContain('31/40')

    // 두 판 모두 저장은 되어 있다
    expect(savedRecords(storage)).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: '시작 화면으로' }))
    expect(screen.getByRole('heading', { name: '상식 퀴즈' })).toBeTruthy()
  })

  it('시작 화면에서 랭킹을 볼 수 있고, 기록이 없으면 안내한다', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '랭킹 보기' }))
    expect(screen.getByText(/아직 기록이 없습니다/)).toBeTruthy()
  })

  it('카테고리가 바뀌는 첫 문제에서 전환 안내를 보여 준다 (F-08)', () => {
    renderApp()
    startGame('퀴즈왕')
    expect(screen.queryByText(/문제를 시작합니다/)).toBeNull()
    for (let i = 0; i < 10; i++) {
      answer(i < 6)
      fireEvent.click(screen.getByRole('button', { name: '다음' }))
    }
    const banner = screen.getByText(/문제를 시작합니다/)
    expect(banner.textContent).toContain('과학 문제를 시작합니다')
    expect(banner.textContent).toContain('한국사에서는 10문제 중 6문제를 맞혔습니다')

    answer(true)
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.queryByText(/문제를 시작합니다/)).toBeNull()
  })

  it('15초 안에 답하지 않으면 시간 초과로 오답 처리하고 정답과 해설을 보여 준다 (F-09)', () => {
    vi.useFakeTimers()
    renderApp()
    startGame('퀴즈왕')
    const question = shownQuestion()
    expect(screen.getByText('남은 시간 15초')).toBeTruthy()

    act(() => vi.advanceTimersByTime(4_000))
    expect(screen.getByText('남은 시간 11초')).toBeTruthy()

    act(() => vi.advanceTimersByTime(11_000))
    expect(screen.getByText(/시간 초과입니다/)).toBeTruthy()
    expect(screen.getByText(question.explanation)).toBeTruthy()
    expect(screen.getByText('시간 멈춤')).toBeTruthy()
    expect(optionButtons().every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    expect(optionButtons().some((b) => b.classList.contains('option--answer'))).toBe(true)
    expect(screen.getByText('0')).toBeTruthy()
  })

  it('다음 문제로 넘어가면 시간이 다시 15초부터 흐른다 (F-09)', () => {
    vi.useFakeTimers()
    renderApp()
    startGame('퀴즈왕')
    act(() => vi.advanceTimersByTime(9_000))
    answer(true)
    act(() => vi.advanceTimersByTime(3_000))
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByText('남은 시간 15초')).toBeTruthy()
  })

  it('결과 화면에서 틀린 문제를 다시 볼 수 있다: 문제, 내 답, 정답, 해설 (F-14)', () => {
    vi.useFakeTimers()
    renderApp()
    startGame('퀴즈왕')

    // 1번은 시간 초과, 2번은 오답, 나머지는 정답
    const timedOut = shownQuestion()
    act(() => vi.advanceTimersByTime(15_000))
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    const wrong = answer(false)
    const myWrongText = optionButtons()
      .find((b) => b.classList.contains('option--picked-wrong'))!
      .querySelector('.option__text')!
      .textContent!.replace(/^\d번 /, '')
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    for (let i = 2; i < 40; i++) {
      answer(true)
      fireEvent.click(screen.getByRole('button', { name: i === 39 ? '결과 보기' : '다음' }))
    }

    fireEvent.click(screen.getByRole('button', { name: '틀린 문제 다시 보기 (2)' }))
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items).toHaveLength(2)

    expect(items[0].textContent).toContain(timedOut.content)
    expect(items[0].textContent).toContain('시간 초과 (답하지 못함)')
    expect(items[0].textContent).toContain(timedOut.options[timedOut.answer - 1])
    expect(items[0].textContent).toContain(timedOut.explanation)

    expect(items[1].textContent).toContain(wrong.content)
    expect(items[1].textContent).toContain(myWrongText)
    expect(items[1].textContent).toContain(wrong.options[wrong.answer - 1])

    fireEvent.click(screen.getByRole('button', { name: '결과로 돌아가기' }))
    expect(screen.getByRole('heading', { name: '퀴즈왕님의 채점 결과' })).toBeTruthy()
  })

  it('모두 맞히면 틀린 문제 다시 보기 버튼 대신 안내를 보여 준다', () => {
    renderApp()
    playGame('퀴즈왕', 40)
    expect(screen.queryByRole('button', { name: /틀린 문제 다시 보기/ })).toBeNull()
    expect(screen.getByText(/틀린 문제가 없습니다/)).toBeTruthy()
  })
})

describe('Bootstrap (F-17)', () => {
  const startButton = () => screen.getByRole('button', { name: '시작하기' }) as HTMLButtonElement

  it('시작 화면은 바로 보이고, 문제 파일을 받으면 "시작하기"가 켜진다', async () => {
    let resolve!: (q: typeof questions) => void
    const pending = new Promise<typeof questions>((r) => (resolve = r))
    const load = () => pending
    render(<Bootstrap load={load} />)

    // 첫 화면을 빨리 보여 주기 위해 문제를 기다리지 않고 시작 화면부터 그린다
    expect(screen.getByRole('heading', { name: '상식 퀴즈' })).toBeTruthy()
    expect(screen.getByText('문제를 불러오는 중입니다.')).toBeTruthy()
    expect(startButton().disabled).toBe(true)

    await act(async () => resolve(questions))
    expect(startButton().disabled).toBe(false)
    expect(screen.queryByText('문제를 불러오는 중입니다.')).toBeNull()

    // 받은 문제로 실제 게임이 시작되고, 끝난 판은 받은 문제 은행으로 검증해 저장된다
    playGame('부트왕', 40)
    expect(screen.getByText('1위')).toBeTruthy()
  })

  it('불러오지 못하면 시작 화면에 이유를 보여 주고, 다시 시도할 수 있다', async () => {
    let calls = 0
    const load = () => (++calls === 1 ? Promise.reject(new Error('문제 데이터 3번 항목: answer는 1~4여야 합니다.')) : Promise.resolve(questions))
    render(<Bootstrap load={load} />)
    expect(await screen.findByText(/문제 데이터 3번 항목: answer는 1~4여야 합니다\./)).toBeTruthy()
    expect(startButton().disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('button', { name: '시작하기' })
    await act(async () => {})
    expect(startButton().disabled).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('P2', () => {
  it('랭킹 화면에서 카테고리 탭을 고르면 그 카테고리 최고 기록 순으로 보여 준다 (F-16)', () => {
    renderApp()
    playGame('한국사왕', (i) => i < 10) // 한국사 10/10, 총점 100
    fireEvent.click(screen.getByRole('button', { name: '다시 하기' }))
    playGame('만능', (i) => i >= 10) // 한국사 0/10, 총점 300
    fireEvent.click(screen.getByRole('button', { name: '랭킹 보기' }))

    const names = () =>
      within(screen.getByRole('tabpanel'))
        .getAllByRole('row')
        .slice(1)
        .map((r) => within(r).getByRole('rowheader').textContent!.replace(' (이번 기록)', ''))

    expect(screen.getByRole('tab', { name: '전체' }).getAttribute('aria-selected')).toBe('true')
    expect(names()).toEqual(['만능', '한국사왕'])

    fireEvent.click(screen.getByRole('tab', { name: '한국사' }))
    expect(screen.getByRole('tab', { name: '한국사' }).getAttribute('aria-selected')).toBe('true')
    expect(names()).toEqual(['한국사왕', '만능'])
    expect(screen.getByRole('columnheader', { name: '한국사 정답' })).toBeTruthy()
    expect(within(screen.getByRole('tabpanel')).getAllByRole('row')[1].textContent).toContain('10/10')
  })

  it('탭은 화살표 키와 Home/End로 옮겨 다닌다', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '랭킹 보기' }))
    const tablist = screen.getByRole('tablist')
    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(document.activeElement?.textContent).toBe('한국사')
    expect(screen.getByRole('tab', { name: '한국사' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tablist, { key: 'End' })
    expect(document.activeElement?.textContent).toBe('일반상식')
    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(document.activeElement?.textContent).toBe('전체')
  })

  it('효과음은 기본 켜짐이고, 끄면 다음 판에도 꺼진 채로 기억한다 (F-18)', () => {
    renderApp()
    startGame('퀴즈왕')
    const toggle = () => screen.getByRole('button', { name: '효과음' })
    expect(toggle().getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-pressed')).toBe('false')
    expect(localStorage.getItem('quiz-game/sound')).toBe('off')

    // 오디오가 없는 환경(jsdom)에서도 답을 고르면 오류 없이 진행된다
    answer(true)
    expect(screen.getByText('정답입니다')).toBeTruthy()

    cleanup()
    renderApp()
    startGame('퀴즈왕')
    expect(toggle().getAttribute('aria-pressed')).toBe('false')
  })
})

describe('PRD 미결정 사항 구현', () => {
  it('빨리 맞힐수록 보너스를 더 받는다: 2초 → +15점, 7초 → +13점', () => {
    vi.useFakeTimers()
    renderApp()
    startGame('퀴즈왕')
    act(() => vi.advanceTimersByTime(2_000))
    answer(true)
    expect(screen.getByText('+15점 (빠른 정답 보너스 +5)')).toBeTruthy()
    expect(screen.getByText('15')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    act(() => vi.advanceTimersByTime(7_000))
    answer(true)
    expect(screen.getByText('+13점 (빠른 정답 보너스 +3)')).toBeTruthy()
    expect(screen.getByText('28')).toBeTruthy()
  })

  it('카테고리 연습은 고른 카테고리 10문제만 풀고, 랭킹에 저장하지 않는다', () => {
    const storage = renderApp()
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '연습생' } })
    fireEvent.click(screen.getByRole('radio', { name: /카테고리 연습/ }))
    fireEvent.click(screen.getByRole('radio', { name: '과학' }))
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))

    expect(screen.getByText('과학')).toBeTruthy()
    expect(screen.getByText('1 / 10')).toBeTruthy()
    for (let i = 0; i < 10; i++) {
      expect(shownQuestion().category).toBe('과학')
      answer(i < 7)
      fireEvent.click(screen.getByRole('button', { name: i === 9 ? '결과 보기' : '다음' }))
    }

    expect(screen.getByRole('heading', { name: '연습생님의 과학 연습 결과' })).toBeTruthy()
    // 정답 수와 과학 카테고리 칸에 같은 값이 나온다
    expect(screen.getAllByText('7 / 10')).toHaveLength(2)
    expect(screen.getByText('/ 150점')).toBeTruthy()
    expect(screen.getByText('연습 결과는 랭킹에 저장되지 않습니다.')).toBeTruthy()
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1)
    expect(savedRecords(storage)).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: '틀린 문제 다시 보기 (3)' }))
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: '결과로 돌아가기' }))

    // 다시 하기를 누르면 방금 고른 방식과 카테고리가 그대로 선택돼 있다
    fireEvent.click(screen.getByRole('button', { name: '다시 하기' }))
    expect((screen.getByRole('radio', { name: /카테고리 연습/ }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('radio', { name: '과학' }) as HTMLInputElement).checked).toBe(true)
  })

  it('통계 화면: 중도 이탈은 완주율에, "다시 하기"는 재도전율에 반영된다', () => {
    const storage = renderApp()
    // 1판: 한 문제만 풀고 떠남 (새로고침)
    startGame('이탈자')
    answer(true)
    cleanup()
    renderApp(storage)

    // 2판: 끝까지 풀고 "다시 하기"
    playGame('완주자', 40)
    fireEvent.click(screen.getByRole('button', { name: '다시 하기' }))
    fireEvent.click(screen.getByRole('button', { name: '랭킹 보기' }))
    fireEvent.click(screen.getByRole('button', { name: '통계 보기' }))

    expect(screen.getByRole('heading', { name: '통계' })).toBeTruthy()
    const metrics = screen.getAllByRole('definition').map((d) => d.textContent)
    expect(metrics).toContain('50%') // 완주율: 2판 시작, 1판 완주
    expect(metrics.some((t) => t?.includes('2판 중 1판'))).toBe(true)
    expect(metrics).toContain('✗ 목표 미달 (목표 70% 이상)')
    expect(metrics).toContain('100%') // 재도전율: 끝낸 1판 중 1판
    expect(metrics).toContain('✓ 목표 달성 (목표 30% 이상)')

    // 문제마다 1번씩 풀렸으므로 모두 표본 부족
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(40)
    expect(rows.every((r) => r.textContent!.includes('표본 부족'))).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '랭킹으로 돌아가기' }))
    expect(screen.getByRole('heading', { name: '랭킹' })).toBeTruthy()
  })
})

describe('제한 시간 없는 연습 (WCAG 2.2.1)', () => {
  it('연습에서 "제한 시간 없이 풀기"를 고르면 시계가 없고, 시간이 지나도 오답이 되지 않으며 보너스가 없다', () => {
    vi.useFakeTimers()
    renderApp()
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '천천히' } })
    // 전체 도전에서는 고를 수 없다
    expect(screen.queryByRole('checkbox', { name: /제한 시간 없이 풀기/ })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /카테고리 연습/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /제한 시간 없이 풀기/ }))
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))

    expect(screen.getByText('제한 시간 없이 푸는 중')).toBeTruthy()
    expect(screen.queryByText(/남은 시간/)).toBeNull()
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.queryByText(/시간 초과/)).toBeNull()

    for (let i = 0; i < 10; i++) {
      answer(true)
      if (i === 0) expect(screen.getByText('+10점')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: i === 9 ? '결과 보기' : '다음' }))
    }
    expect(screen.getByText('/ 100점')).toBeTruthy()
    expect(screen.getByText('정답 10개 × 10점 = 100점 (제한 시간 없는 연습이라 보너스 없음)')).toBeTruthy()

    // 다시 하기를 누르면 선택이 그대로 남아 있다
    fireEvent.click(screen.getByRole('button', { name: '다시 하기' }))
    expect((screen.getByRole('checkbox', { name: /제한 시간 없이 풀기/ }) as HTMLInputElement).checked).toBe(true)
  })
})
