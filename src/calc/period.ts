/* ══════════════════════════════════════════════════════════════════════
   조회기간을 실제 수치에 적용하는 규칙

   저장된 월별 계열은 6개 점뿐이고, 항목마다 성격이 다르다. 픽스처로 검증한
   사실(tests/fixtures/demo02.json):

     · 재고(stock) — retainLong/Auto/Both
       그 달 시점의 보유량. 마지막 달 값이 곧 전체기간 스칼라다.
         retainLong[5]=67 == longCustNet=67
         retainAuto[5]=4  == autoCustNet=4
         retainBoth[5]=3  == bothCustNet=3
       → 구간을 좁혀도 "종료월 시점" 값만 의미가 있다.

     · 흐름(flow) — cntLong
       그 달에 발생한 건수. 6개월 합계가 곧 6개월 스칼라다.
         sum(cntLong)=33 == longCnt6m=33
       → 구간 합계·월평균을 계산할 수 있다.

     · custLong 은 흐름이지만 6개월 총계가 중복 제거된 값이라
       (sum=26 ≠ longCust6m=22) 구간별 인당건수는 계산할 수 없다.
   ══════════════════════════════════════════════════════════════════════ */

import type { Period } from '../components/PeriodPicker'

export interface MonthWindow {
  /** 선택된 월 목록 */
  months: number[]
  /** ctx.months 기준 시작·종료 인덱스 */
  startIdx: number
  endIdx: number
  /** 저장된 6개월 전체인가 */
  isFull: boolean
}

/** Period 를 인덱스 구간으로. 범위를 벗어나면 전체로 되돌린다. */
export function windowOf(period: Period | undefined, months: number[]): MonthWindow {
  const last = months.length - 1
  const full: MonthWindow = { months, startIdx: 0, endIdx: last, isFull: true }
  if (!period || period.mode !== 'custom') return full

  const from = period.from ?? months[0]
  const to = period.to ?? months[last]
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const startIdx = months.findIndex((m) => m >= lo)
  let endIdx = -1
  for (let i = 0; i < months.length; i++) if (months[i] <= hi) endIdx = i
  if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return full

  return {
    months: months.slice(startIdx, endIdx + 1),
    startIdx,
    endIdx,
    isFull: startIdx === 0 && endIdx === last,
  }
}

/** 재고 — 종료월 시점 값 */
export function stockAt(series: number[] | undefined, w: MonthWindow): number {
  return series?.[w.endIdx] ?? 0
}

/** 흐름 — 구간 합계 */
export function flowSum(series: number[] | undefined, w: MonthWindow): number {
  if (!series) return 0
  let sum = 0
  for (let i = w.startIdx; i <= w.endIdx; i++) sum += series[i] ?? 0
  return sum
}

/** 흐름 — 구간 월평균 */
export function flowAvg(series: number[] | undefined, w: MonthWindow): number {
  const n = w.endIdx - w.startIdx + 1
  return n > 0 ? flowSum(series, w) / n : 0
}
