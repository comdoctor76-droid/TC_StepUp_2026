/* ══════════════════════════════════════════════════════════════════════
   C분석 — Customer[고객] 분석 (전체)
   원본 차트 5개: 유지고객군 / 월평균 신규고객 / 연계고객 / 6개월 추이 /
                 소득군별 평균 보유고객
   ══════════════════════════════════════════════════════════════════════ */

import { INCOME_BANDS, shortLabel } from '../data/schema'
import { div, xround } from './format'
import { benchBlock, selfBlock, type Ctx, type CustomerBlock } from './resolve'

export interface CustomerAnalysis {
  /** 유지고객군 — 본인/동급/차상급/TC */
  blocks: { self: CustomerBlock; peer: CustomerBlock; next: CustomerBlock; tc: CustomerBlock }

  /** chart5 — 유지고객 장기/자동차/총보유고객 (C분석!CG28:CI32) */
  retainChart: { name: string; 본인: number; 동급: number; TC표준그룹: number }[]

  /** chart2 — 월평균 신규고객 (C분석!CK29:CM32) */
  monthlyNewChart: { name: string; value: number }[]

  /** chart3 — 연계고객 (C분석!CO28:CQ32) */
  linkChart: { name: string; value: number }[]

  /** chart6 — 최근 6개월 유지고객 추이 (C분석!CU28:CZ29) */
  trend: { month: number; 총유지: number; 장기: number; 자동차: number }[]

  /** chart4 — 소득군별 평균 보유고객 (C분석!CD53:CI62) */
  bandChart: { name: string; 장기: number; 자동차: number; 총고객: number }[]

  /** 고객 구성 — C분석!CF35:CM36 */
  composition: {
    indiv: number
    corp: number
    vip: number
    transferLongCust: number
    transferLongCnt: number
    transferAutoCust: number
  }

  /** C 점수 — C분석!CS50 (0~2) */
  score: number
  /** 참고: 점수 구성요소 */
  scoreParts: { volumeIndex: number; growthIndex: number; newCustGap: number }
}

export function analyzeCustomer(ctx: Ctx, selfName: string): CustomerAnalysis {
  const self = selfBlock(ctx, selfName)
  const peer = benchBlock(ctx, ctx.levelLabel)
  const next = benchBlock(ctx, ctx.nextLabel)
  const tc = benchBlock(ctx, ctx.tcLabel)

  // ── chart5 : C분석!CG29:CI29(본인) / CG31:CI31(동급) / CG30:CI30(TC)
  const retainChart = [
    { name: '장기', 본인: self.long, 동급: peer.long, TC표준그룹: tc.long },
    { name: '자동차', 본인: self.auto, 동급: peer.auto, TC표준그룹: tc.auto },
    { name: '총보유고객', 본인: self.total, 동급: peer.total, TC표준그룹: tc.total },
  ]

  // ── chart2 : C분석!CL29 / CL31 / CL30
  const monthlyNewChart = [
    { name: selfName, value: self.monthlyNew },
    { name: '동급', value: peer.monthlyNew },
    { name: 'TC 표준그룹', value: tc.monthlyNew },
  ]

  // ── chart3 : C분석!CP29 / CP31 / CP30
  const linkChart = [
    { name: selfName, value: self.both },
    { name: '동급', value: peer.both },
    { name: 'TC 표준그룹', value: tc.both },
  ]

  // ── chart6 : C분석!CU29:CZ29
  //   총유지 = 장기이관제외 + 자동차이관제외 − 자장이관제외 (Q6 유지고객 시트)
  const s = ctx.planner.s
  const months = ctx.months
  const trend = months.map((m, i) => ({
    month: m,
    총유지: (s.retainLong[i] ?? 0) + (s.retainAuto[i] ?? 0) - (s.retainBoth[i] ?? 0),
    장기: s.retainLong[i] ?? 0,
    자동차: s.retainAuto[i] ?? 0,
  }))

  // ── chart4 : C분석!CG53:CI62 — 소득군별 평균 보유고객
  const bandChart = INCOME_BANDS.map((b) => {
    const long = xround(ctx.bench(b.key, 'longCustNet'), 0)
    const auto = xround(ctx.bench(b.key, 'autoCustNet'), 0)
    const both = xround(ctx.bench(b.key, 'bothCustNet'), 0)
    return { name: b.short, 장기: long, 자동차: auto, 총고객: long + auto - both }
  })

  // ── 고객 구성 : C분석!CG36:CM36
  const composition = {
    indiv: ctx.f('indivCust'), // input AZ
    corp: ctx.f('corpCust'), // input BA
    vip: ctx.f('vipCust'), // input BE
    transferLongCust: ctx.f('transferLongCust'), // input BG
    transferLongCnt: ctx.f('transferLongCnt'), // input BF
    transferAutoCust: ctx.f('transferAutoCust'), // input BI
  }

  // ── C 점수 : C분석!CG50:CS50 ────────────────────────────────────────
  //   CG50 = (본인장기 / 동급장기) − 1
  //   CH50 = (본인자동차 / 동급자동차) − 1
  //   CI50 = (본인총고객 / 동급총고객) − 1
  //   CJ50 = 1 + SUM(CG50:CI50)                        ← 보유량 지수
  //   CM31 = 본인 월평균신규 − 동급 월평균신규
  //   CM50 = 계단식 환산 (2 / 1.5 / 1.3 / 1 / 0.7 / 0.5)
  //   CT15 = (본인월평균 / 동급월평균 − 1) / 10
  //   CS50 = MIN(2, MAX(CM50, 0.2) + CT15)
  const cg50 = div(self.long, peer.long) - 1
  const ch50 = div(self.auto, peer.auto) - 1
  const ci50 = div(self.total, peer.total) - 1
  const volumeIndex = 1 + cg50 + ch50 + ci50 // CJ50

  const newCustGap = self.monthlyNew - peer.monthlyNew // CM31
  const cm50 = // CM50
    newCustGap >= 2
      ? 2
      : newCustGap >= 1.5
        ? 1.5
        : newCustGap >= 1
          ? 1.3
          : newCustGap >= 0.5
            ? 1
            : newCustGap >= 0
              ? 0.7
              : 0.5
  const ct15 = div(self.monthlyNew, peer.monthlyNew) - 1 // C분석!CT15 = ((CQ15/CQ22)-100%)/10
  const growthIndex = ct15 / 10
  const base = cm50 > 0.2 ? cm50 : 0.2
  const score = base + growthIndex >= 2 ? 2 : base + growthIndex // CS50

  return {
    blocks: { self, peer, next, tc },
    retainChart,
    monthlyNewChart,
    linkChart,
    trend,
    bandChart,
    composition,
    score,
    scoreParts: { volumeIndex, growthIndex, newCustGap },
  }
}

export { shortLabel }
