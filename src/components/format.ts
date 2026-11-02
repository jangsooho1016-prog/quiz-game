/** 450 → "7분 30초" */
export function formatDuration(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  if (minutes === 0) return `${seconds}초`
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`
}

/** 450 → "7:30" (좁은 표 칸용) */
export function formatClock(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** ISO 시각 → 사용자 지역 기준 "26.10.31" */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  const yy = String(d.getFullYear() % 100).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}.${mm}.${dd}`
}

export const OPTION_MARKS = ['①', '②', '③', '④'] as const
