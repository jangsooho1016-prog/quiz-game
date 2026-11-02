export type OptionState = 'idle' | 'picked-correct' | 'picked-wrong' | 'answer' | 'dimmed'

interface OptionButtonProps {
  number: number
  text: string
  state: OptionState
  disabled: boolean
  onSelect: () => void
}

// 색에만 기대지 않도록 상태마다 기호와 글자를 함께 보여 준다.
const TAGS: Record<OptionState, string | null> = {
  idle: null,
  'picked-correct': '✓ 내 답 · 정답',
  'picked-wrong': '✗ 내 답',
  answer: '✓ 정답',
  dimmed: null,
}

export function OptionButton({ number, text, state, disabled, onSelect }: OptionButtonProps) {
  const tag = TAGS[state]
  return (
    <button type="button" className={`option option--${state}`} disabled={disabled} onClick={onSelect}>
      <span className="option__bubble" aria-hidden="true">
        {number}
      </span>
      <span className="option__text">
        <span className="visually-hidden">{number}번 </span>
        {text}
      </span>
      {tag && <span className="option__tag">{tag}</span>}
    </button>
  )
}
