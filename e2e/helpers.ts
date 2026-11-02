import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

interface Question {
  id: number
  category: string
  content: string
  options: string[]
  answer: number
}

/** 앱이 실행 중에 불러오는 것과 같은 문제 파일 */
export const questions: Question[] = JSON.parse(
  readFileSync(new URL('../public/questions.json', import.meta.url), 'utf8'),
)

export async function start(page: Page, nickname: string, practice?: { category: string; untimed?: boolean }) {
  await page.getByLabel('닉네임').fill(nickname)
  if (practice) {
    await page.getByRole('radio', { name: /카테고리 연습/ }).check()
    await page.getByRole('radio', { name: practice.category, exact: true }).check()
    if (practice.untimed) await page.getByRole('checkbox', { name: /제한 시간 없이 풀기/ }).check()
  }
  await page.getByRole('button', { name: '시작하기' }).click()
  await expect(page.locator('.quiz__question')).toBeVisible()
}

/** 화면에 보이는 문제의 정답(correct = true) 또는 오답 보기를 누른다. */
export async function answer(page: Page, correct: boolean) {
  const heading = (await page.locator('.quiz__question').textContent()) ?? ''
  const question = questions.find((q) => heading.endsWith(q.content))
  if (!question) throw new Error(`문제를 찾지 못함: ${heading}`)
  const correctText = question.options[question.answer - 1]
  const texts = await page.locator('.option .option__text').allTextContents()
  // "H₂O"가 "H₂O₂"에 걸리지 않도록 끝까지 비교한다
  const index = texts.findIndex((t) => (correct ? t.endsWith(` ${correctText}`) : !t.endsWith(` ${correctText}`)))
  await page.locator('.option').nth(index).click()
  await expect(page.locator('.feedback')).toBeVisible()
}

export async function next(page: Page) {
  await page.locator('.actions--end .button').click()
}

/** 남은 문제를 끝까지 풀고 결과 화면에서 멈춘다. correct(i)가 참인 문제만 맞힌다. */
export async function playToEnd(page: Page, total: number, correct: (i: number) => boolean) {
  for (let i = 0; i < total; i++) {
    await answer(page, correct(i))
    await next(page)
  }
  await expect(page.locator('.result__score')).toBeVisible()
}

/**
 * 한 화면의 품질 점검: axe(WCAG 2.2 AA) 위반, 가로 스크롤, 44px보다 작은 누름 대상.
 * 실패 메시지에 화면 이름이 나오도록 문제 목록을 돌려준다.
 */
export async function inspect(page: Page, screen: string): Promise<string[]> {
  const problems: string[] = []
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  for (const v of axe.violations) {
    problems.push(`[${screen}] axe ${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  }
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    small: [...document.querySelectorAll('button:not([disabled]), .choice__option, input:not([type=radio]):not([type=checkbox])')]
      .filter((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().height < 44)
      .map((el) => `${el.className} "${(el.textContent ?? '').trim().slice(0, 12)}"`),
  }))
  if (layout.overflow) problems.push(`[${screen}] 가로 스크롤이 생긴다`)
  for (const s of layout.small) problems.push(`[${screen}] 44px보다 작은 누름 대상: ${s}`)
  return problems
}
