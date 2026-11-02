import type { Question } from '../game/types'
import { parseQuestions } from './questions'

/** 배포된 사이트에서 이 파일만 바꾸면 다시 빌드하지 않아도 문제가 교체된다 (F-17). */
export const QUESTIONS_URL = `${import.meta.env.BASE_URL}questions.json`

export async function loadQuestions(url = QUESTIONS_URL, fetchFn: typeof fetch = fetch): Promise<Question[]> {
  // 파일을 교체했을 때 브라우저 캐시의 옛 문제가 나오지 않도록 매번 서버에 확인한다.
  const response = await fetchFn(url, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`문제 파일을 받지 못했습니다 (HTTP ${response.status}).`)

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error('문제 파일이 올바른 JSON이 아닙니다.')
  }
  return parseQuestions(data)
}
