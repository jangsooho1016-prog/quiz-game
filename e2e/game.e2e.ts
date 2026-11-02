import { expect, test } from '@playwright/test'
import { answer, inspect, next, playToEnd, start } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '시작하기' })).toBeEnabled()
})

test('한 판을 끝까지 풀 수 있고, 같은 닉네임으로 두 판을 하면 랭킹에는 더 높은 기록 하나만 보인다', async ({ page }) => {
  await start(page, '퀴즈왕')
  await playToEnd(page, 40, (i) => i < 12)
  await expect(page.getByRole('heading', { name: '퀴즈왕님의 채점 결과' })).toBeVisible()
  await expect(page.getByText('12 / 40', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '다시 하기' }).click()
  await expect(page.getByLabel('닉네임')).toHaveValue('퀴즈왕')
  await start(page, '퀴즈왕')
  await playToEnd(page, 40, (i) => i < 31)

  await page.getByRole('button', { name: '랭킹 보기' }).click()
  const rows = page.getByRole('tabpanel').getByRole('row')
  await expect(rows).toHaveCount(2) // 머리글 + 한 줄
  await expect(rows.nth(1)).toContainText('퀴즈왕')
  await expect(rows.nth(1)).toContainText('31/40')

  // 기록은 두 판 모두 저장돼 있다
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('quiz-game/v2/records') ?? '[]').length)
  expect(saved).toBe(2)
})

test('15초 안에 답하지 않으면 시간 초과로 오답이 되고 정답과 해설을 보여 준다', async ({ page }) => {
  await page.clock.install()
  await page.reload()
  await start(page, '느긋이')
  await expect(page.getByText('남은 시간 15초')).toBeVisible()
  await page.clock.runFor(15_500)
  await expect(page.getByText(/시간 초과입니다/)).toBeVisible()
  await expect(page.locator('.option').first()).toBeDisabled()
  await expect(page.getByRole('button', { name: '다음' })).toBeEnabled()
})

test('제한 시간 없는 카테고리 연습은 시간이 지나도 오답이 되지 않고, 랭킹에 저장되지 않는다', async ({ page }) => {
  await page.clock.install()
  await page.reload()
  await start(page, '연습생', { category: '지리', untimed: true })
  await expect(page.getByText('제한 시간 없이 푸는 중')).toBeVisible()
  await page.clock.runFor(60_000)
  await expect(page.locator('.feedback')).toHaveCount(0)

  await playToEnd(page, 10, (i) => i < 8)
  await expect(page.getByRole('heading', { name: '연습생님의 지리 연습 결과' })).toBeVisible()
  await expect(page.getByText('연습 결과는 랭킹에 저장되지 않습니다.')).toBeVisible()
  const saved = await page.evaluate(() => localStorage.getItem('quiz-game/v2/records'))
  expect(saved).toBeNull()
})

test('문제 파일을 받지 못하면 시작 화면에 이유와 다시 시도 버튼을 보여 준다', async ({ page }) => {
  await page.route('**/questions.json', (route) => route.fulfill({ status: 500, body: '' }))
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('HTTP 500')
  await expect(page.getByRole('button', { name: '시작하기' })).toBeDisabled()

  await page.unroute('**/questions.json')
  await page.getByRole('button', { name: '다시 시도' }).click()
  await expect(page.getByRole('button', { name: '시작하기' })).toBeEnabled()
})

for (const colorScheme of ['light', 'dark'] as const) {
  test(`모든 화면이 접근성(WCAG 2.2 AA)·배치 기준을 지킨다 (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme })
    await page.reload()
    const problems: string[] = []

    problems.push(...(await inspect(page, '시작')))
    await page.getByRole('button', { name: '시작하기' }).click() // 닉네임 없이 → 안내 문구
    problems.push(...(await inspect(page, '시작-닉네임 오류')))
    await page.getByRole('radio', { name: /카테고리 연습/ }).check()
    problems.push(...(await inspect(page, '시작-연습 선택')))
    await page.getByRole('radio', { name: /전체 도전/ }).check()

    await start(page, '점검')
    problems.push(...(await inspect(page, '퀴즈')))
    await answer(page, true)
    problems.push(...(await inspect(page, '퀴즈-정답')))
    await next(page)
    await answer(page, false)
    problems.push(...(await inspect(page, '퀴즈-오답')))
    await next(page)
    for (let i = 2; i < 10; i++) {
      await answer(page, true)
      await next(page)
    }
    problems.push(...(await inspect(page, '퀴즈-카테고리 전환')))

    // 결과·오답·랭킹·통계는 짧은 연습 판으로 확인한다
    await page.reload()
    await expect(page.getByRole('button', { name: '시작하기' })).toBeEnabled()
    await start(page, '점검', { category: '과학' })
    await playToEnd(page, 10, (i) => i < 7)
    problems.push(...(await inspect(page, '결과')))
    await page.getByRole('button', { name: /틀린 문제 다시 보기/ }).click()
    problems.push(...(await inspect(page, '오답 다시 보기')))
    await page.getByRole('button', { name: '결과로 돌아가기' }).click()
    await page.getByRole('button', { name: '랭킹 보기' }).click()
    problems.push(...(await inspect(page, '랭킹')))
    await page.getByRole('tab', { name: '과학' }).click()
    problems.push(...(await inspect(page, '랭킹-카테고리 탭')))
    await page.getByRole('button', { name: '통계 보기' }).click()
    problems.push(...(await inspect(page, '통계')))

    expect(problems).toEqual([])
  })
}
