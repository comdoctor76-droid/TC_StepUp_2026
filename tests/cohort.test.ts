/* 차월 코호트 통계 — 원본 v18 computeCohort() 와 같은 정의로 집계되는지 검증 */

import { describe, expect, it } from 'vitest'
import { computeCohortStats, lookupCohort } from '../src/calc/cohort'
import type { PlannerRow } from '../src/data/schema'

/** 테스트용 플래너 1명 — Q6/Q7 시계열은 마지막 값만 의미 있게 채운다 */
function planner(
  months: number,
  income: string,
  L: number,
  C: number,
  K: number,
  cntLongAvg: number,
  perfConverted?: number,
): PlannerRow {
  return {
    f: { months, incomeRaw: income, ...(perfConverted !== undefined ? { perfConverted } : {}) },
    s: {
      retainLong: [0, 0, 0, 0, 0, L],
      retainAuto: [0, 0, 0, 0, 0, C],
      retainBoth: [0, 0, 0, 0, 0, K],
      cntLong: Array(6).fill(cntLongAvg),
      custLong: [],
    },
  }
}

describe('computeCohortStats / lookupCohort', () => {
  it('밴드 집계·TC 판정·가중 연계율·상위 % 가 원본 정의와 같다', () => {
    const planners: Record<string, PlannerRow> = {}
    // 13~24차월 밴드에 40명: 30명 일반(장기 10명), 10명 TC(장기 20명)
    for (let i = 0; i < 30; i++) planners[`A${i}`] = planner(13 + (i % 12), '300만원이상', 10, 4, 2, 1.5, 6000000)
    for (let i = 0; i < 10; i++) planners[`T${i}`] = planner(15, '500만원이상', 20, 8, 4, 3, 12000000)

    const stats = computeCohortStats(planners)!
    expect(stats).not.toBeNull()
    const band = stats.bands.find((b) => b.lo === 13)!
    expect(band.all.n).toBe(40)
    // 평균 장기 = (30×10 + 10×20)/40 = 12.5, 총고객 T = L+C-K
    expect(band.all.L).toBeCloseTo(12.5)
    expect(band.all.T).toBeCloseTo((30 * 12 + 10 * 24) / 40)
    // 연계율 = ΣK/ΣL (가중) = (30×2+10×4)/(30×10+10×20) = 100/500
    expect(band.all.link).toBeCloseTo(0.2)
    // 월 장기건수 = cntLong 6개월 평균의 평균
    expect(band.all.mo).toBeCloseTo((30 * 1.5 + 10 * 3) / 40)
    // 환산 = perfConverted/6 의 평균
    expect(band.all.conv).toBeCloseTo((30 * 1000000 + 10 * 2000000) / 40)
    expect(band.tc!.n).toBe(10)
    expect(band.tc!.L).toBeCloseTo(20)
    // 전역 TC 평균 연차 = 15차월/12
    expect(stats.tcAvgYears).toBeCloseTo(15 / 12)

    // 조회: 장기 20명이면 하위 30명(10명대)만 아래 → 상위 25%
    const c = lookupCohort(stats, 18, 20)!
    expect(c.band).toBe('13~24차월')
    expect(c.all.n).toBe(40)
    expect(c.tc!.n).toBe(10)
    expect(c.top).toBe(Math.max(1, Math.round((1 - 30 / 40) * 100)))
  })

  it('가드 — 밴드 n<30 이면 조회가 null, TC n<10 이면 tc 가 null', () => {
    const small: Record<string, PlannerRow> = {}
    for (let i = 0; i < 29; i++) small[`S${i}`] = planner(5, '300만원이상', 10, 4, 2, 1)
    const stats = computeCohortStats(small)!
    expect(lookupCohort(stats, 5, 10)).toBeNull() // n=29 < 30

    const fewTc: Record<string, PlannerRow> = {}
    for (let i = 0; i < 35; i++) fewTc[`F${i}`] = planner(30, i < 5 ? '600만원이상' : '300만원이상', 10, 4, 2, 1)
    const c = lookupCohort(computeCohortStats(fewTc), 30, 10)!
    expect(c.all.n).toBe(35)
    expect(c.tc).toBeNull() // TC 5명 < 10
  })

  it('Q6 시계열이 없는 워크북이면 null (문서를 쓰지 않는다)', () => {
    const none: Record<string, PlannerRow> = {
      X1: { f: { months: 10, incomeRaw: '300만원이상' }, s: { retainLong: [], retainAuto: [], retainBoth: [], cntLong: [], custLong: [] } },
    }
    expect(computeCohortStats(none)).toBeNull()
  })
})
