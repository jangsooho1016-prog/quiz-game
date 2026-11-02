interface TimerProps {
  /** 남은 시간 (ms). 답을 확정해 시계가 멈췄으면 null */
  remainingMs: number | null
  limitMs: number
}

const WARNING_SEC = 5

/** F-09 남은 시간. 막대는 장식이고, 남은 초는 글자로도 보여 준다. */
export function Timer({ remainingMs, limitMs }: TimerProps) {
  const stopped = remainingMs === null
  const seconds = stopped ? null : Math.ceil(remainingMs / 1000)
  const ratio = stopped ? 0 : remainingMs / limitMs
  const warning = seconds !== null && seconds <= WARNING_SEC

  return (
    <div className={warning ? 'timer timer--warning' : 'timer'}>
      <span className="timer__label">{stopped ? '시간 멈춤' : `남은 시간 ${seconds}초`}</span>
      <span className="timer__track" aria-hidden="true">
        <span className="timer__fill" style={{ transform: `scaleX(${ratio})` }} />
      </span>
    </div>
  )
}
