import { describe, expect, it } from 'vitest'
import { bestPerNickname, compareRecords, rankOf, topRanking, topRankingByCategory } from './ranking'
import { makeRecord } from './testUtils'

const ids = (records: { id: string }[]) => records.map((r) => r.id)

describe('compareRecords', () => {
  it('점수가 높은 기록이 앞선다', () => {
    const records = [
      makeRecord({ id: 'a', score: 200 }),
      makeRecord({ id: 'b', score: 400 }),
      makeRecord({ id: 'c', score: 300 }),
    ]
    expect(ids(records.sort(compareRecords))).toEqual(['b', 'c', 'a'])
  })

  it('점수가 같으면 소요 시간이 짧은 기록이 앞선다', () => {
    const records = [
      makeRecord({ id: 'slow', score: 300, durationSec: 500 }),
      makeRecord({ id: 'fast', score: 300, durationSec: 200 }),
    ]
    expect(ids(records.sort(compareRecords))).toEqual(['fast', 'slow'])
  })

  it('점수와 소요 시간이 같으면 먼저 기록한 쪽이 앞선다', () => {
    const records = [
      makeRecord({ id: 'later', score: 300, durationSec: 200, createdAt: '2026-10-31T12:00:00.000Z' }),
      makeRecord({ id: 'earlier', score: 300, durationSec: 200, createdAt: '2026-10-31T09:00:00.000Z' }),
    ]
    expect(ids(records.sort(compareRecords))).toEqual(['earlier', 'later'])
  })

  it('점수가 1순위다: 소요 시간이 길어도 점수가 높으면 앞선다', () => {
    const records = [
      makeRecord({ id: 'quick', score: 290, durationSec: 60 }),
      makeRecord({ id: 'high', score: 300, durationSec: 900 }),
    ]
    expect(ids(records.sort(compareRecords))).toEqual(['high', 'quick'])
  })
})

describe('bestPerNickname', () => {
  it('닉네임마다 가장 좋은 기록만 남긴다 (동점이면 더 빠른 기록)', () => {
    const records = [
      makeRecord({ id: 'a1', nickname: 'A', score: 200 }),
      makeRecord({ id: 'a2', nickname: 'A', score: 350, durationSec: 400 }),
      makeRecord({ id: 'a3', nickname: 'A', score: 350, durationSec: 300 }),
      makeRecord({ id: 'b1', nickname: 'B', score: 100 }),
    ]
    expect(ids(bestPerNickname(records)).sort()).toEqual(['a3', 'b1'])
  })
})

describe('topRanking', () => {
  it('닉네임별 최고 기록을 정렬해 상위 10개만 돌려준다', () => {
    const records = Array.from({ length: 15 }, (_, i) =>
      makeRecord({ id: `p${i}`, nickname: `player${i}`, score: i * 10 }),
    )
    expect(ids(topRanking(records))).toEqual(['p14', 'p13', 'p12', 'p11', 'p10', 'p9', 'p8', 'p7', 'p6', 'p5'])
  })

  it('같은 닉네임의 기록은 목록에 한 번만 나온다', () => {
    const records = [
      makeRecord({ id: 'a1', nickname: 'A', score: 400 }),
      makeRecord({ id: 'a2', nickname: 'A', score: 390 }),
      makeRecord({ id: 'b1', nickname: 'B', score: 380 }),
    ]
    expect(ids(topRanking(records))).toEqual(['a1', 'b1'])
  })
})

describe('rankOf', () => {
  const records = [
    makeRecord({ id: 'a1', nickname: 'A', score: 400 }),
    makeRecord({ id: 'b1', nickname: 'B', score: 300, durationSec: 200 }),
    makeRecord({ id: 'c1', nickname: 'C', score: 300, durationSec: 250 }),
    makeRecord({ id: 'b2', nickname: 'B', score: 100 }),
  ]

  it('닉네임별 최고 기록 목록에서의 순위를 돌려준다 (동점은 소요 시간으로)', () => {
    expect(rankOf(records, records[0])).toBe(1)
    expect(rankOf(records, records[1])).toBe(2)
    expect(rankOf(records, records[2])).toBe(3)
  })

  it('닉네임의 최고 기록이 아니면, 그 기록이 목록에 있을 때의 순위를 돌려준다', () => {
    // B의 100점 기록: A(400), C(300)보다 뒤 → 3위
    expect(rankOf(records, records[3])).toBe(3)
  })
})

describe('topRankingByCategory (F-16)', () => {
  const cat = (한국사: number, 과학 = 0) => ({ 한국사, 과학, 지리: 0, 일반상식: 0 })

  it('그 카테고리 정답 수로 정렬하고, 같으면 판 전체 소요 시간이 짧은 쪽이 앞선다', () => {
    const records = [
      makeRecord({ id: 'a', nickname: 'A', score: 400, categoryCorrect: cat(6, 10) }),
      makeRecord({ id: 'b', nickname: 'B', score: 100, categoryCorrect: cat(9), durationSec: 500 }),
      makeRecord({ id: 'c', nickname: 'C', score: 100, categoryCorrect: cat(9), durationSec: 200 }),
    ]
    expect(ids(topRankingByCategory(records, '한국사'))).toEqual(['c', 'b', 'a'])
    expect(ids(topRankingByCategory(records, '과학'))).toEqual(['a', 'c', 'b'])
  })

  it('닉네임마다 그 카테고리에서 가장 좋은 기록을 고른다 (전체 최고 기록과 다를 수 있다)', () => {
    const records = [
      makeRecord({ id: 'a-high', nickname: 'A', score: 390, categoryCorrect: cat(9) }),
      makeRecord({ id: 'a-low', nickname: 'A', score: 150, categoryCorrect: cat(10) }),
    ]
    expect(ids(topRanking(records))).toEqual(['a-high'])
    expect(ids(topRankingByCategory(records, '한국사'))).toEqual(['a-low'])
  })

  it('상위 10개만 돌려준다', () => {
    const records = Array.from({ length: 12 }, (_, i) => makeRecord({ id: `p${i}`, nickname: `p${i}` }))
    expect(topRankingByCategory(records, '지리')).toHaveLength(10)
  })
})
