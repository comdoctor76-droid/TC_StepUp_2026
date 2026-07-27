/* ══════════════════════════════════════════════════════════════════════
   비교군 해석 — 모든 시트가 공유하는 3단 체인.

   원본 (C분석!CH22 / CH24 / CH26, A분석!DB18 / DB20, M분석!CY16 / CY18,
        S분석!BW17 / BW19 에서 동일하게 반복)

     동급   CH22 = VLOOKUP(개요!$CP$14, 소득별Data!$C$2:$F$28, 4, 0)
     차상급 CH24 = VLOOKUP($CH$22,      소득별Data!$C$33:$E$46, 3, 0)
     TC     CH26 = 'TC 표준그룹'  (소득별Data 47행 · 육성소득 500~700 그룹)
   ══════════════════════════════════════════════════════════════════════ */

import {
  BENCH_FIELDS,
  FIELDS,
  TC_GROUP,
  type BenchFieldKey,
  type BenchRow,
  type FieldKey,
  type IncomeMap,
  type PlannerRow,
  n,
  s,
} from '../data/schema'
import { div, xround } from './format'

export interface Ctx {
  code: string
  planner: PlannerRow
  benchmarks: Record<string, BenchRow>
  incomeMap: IncomeMap

  /** 육성소득 원본 (input C열) */
  incomeRaw: string
  /** 동급 라벨 */
  levelLabel: string
  /** 차상급 라벨 */
  nextLabel: string
  /** TC 표준그룹 라벨 (고정) */
  tcLabel: string

  /** 본인 필드 조회 */
  f(key: FieldKey): number
  /** 본인 문자열 필드 */
  t(key: FieldKey): string
  /** 동급 벤치마크 */
  peer(key: BenchFieldKey): number
  /** 차상급 벤치마크 */
  next(key: BenchFieldKey): number
  /** TC 표준그룹 벤치마크 */
  tc(key: BenchFieldKey): number
  /** 임의 라벨 벤치마크 */
  bench(label: string, key: BenchFieldKey): number

  /** 기준월 6개 [202601 … 202606] — C분석!CU28:CZ28 (원본에는 상수) */
  months: number[]
}

export function buildCtx(
  code: string,
  planner: PlannerRow,
  benchmarks: Record<string, BenchRow>,
  incomeMap: IncomeMap,
  months: number[],
): Ctx {
  const incomeRaw = s(planner.f[('incomeRaw' as FieldKey)])
  const levelLabel = incomeMap.groupOf[incomeRaw] ?? incomeRaw
  const nextLabel = incomeMap.nextLevel[levelLabel] ?? levelLabel

  const bench = (label: string, key: BenchFieldKey) => n(benchmarks[label]?.b[key])

  return {
    code,
    planner,
    benchmarks,
    incomeMap,
    incomeRaw,
    levelLabel,
    nextLabel,
    tcLabel: TC_GROUP,
    f: (key) => n(planner.f[key]),
    t: (key) => s(planner.f[key]),
    peer: (key) => bench(levelLabel, key),
    next: (key) => bench(nextLabel, key),
    tc: (key) => bench(TC_GROUP, key),
    bench,
    months,
  }
}

/* ── 비교군 3종의 "유지고객 인원분석" 블록 ────────────────────────────
   C분석!CJ22:CQ26 · A분석!DD18:DK20 · M분석!CX29:CZ32 · S분석!BV25:CC28
   에서 반복되는 계산. 벤치마크는 항상 ROUND(…,0) 을 먼저 적용한다.      */

export interface CustomerBlock {
  label: string
  /** 장기 (이관제외) */
  long: number
  /** 자동차 (이관제외) */
  auto: number
  /** 연계(자장) 고객 */
  both: number
  /** 총 유지고객 = 장기 + 자동차 − 연계 */
  total: number
  /** 월평균 신규고객 = 장기 ÷ 평균차월 */
  monthlyNew: number
  /** 장기/자동차 연계율 = 연계 ÷ 장기 */
  linkRate: number
}

/** 본인 블록 — C분석!CJ15:CQ15, CF29:CR29 */
export function selfBlock(ctx: Ctx, name: string): CustomerBlock {
  const long = ctx.f('longCustNet') // input BL 장기이관제외고객
  const auto = ctx.f('autoCustNet') // input BM 자동차이관제외고객
  const bothNet = ctx.f('bothCustNet') // input BN 자장이관제외고객
  const total = long + auto - bothNet // C분석!CN15
  const months = ctx.f('months') // input K 경력위촉차월
  const both = long + auto - total // C분석!CP29 (= bothNet)
  return {
    label: name,
    long,
    auto,
    both,
    total,
    monthlyNew: xround(div(long, months), 2), // C분석!CQ15
    linkRate: div(both, long), // C분석!CQ29
  }
}

/** 벤치마크 블록 — C분석!CJ22:CQ22 (동급) / CJ24 (차상급) / CJ26 (TC) */
export function benchBlock(ctx: Ctx, label: string): CustomerBlock {
  const long = xround(ctx.bench(label, 'longCustNet'), 0) // 소득별Data BD
  const auto = xround(ctx.bench(label, 'autoCustNet'), 0) // 소득별Data BC
  const bothNet = xround(ctx.bench(label, 'bothCustNet'), 0) // 소득별Data BE
  const total = long + auto - bothNet
  const months = ctx.bench(label, 'months') // 소득별Data K 입사차월 (평균차월)
  const both = long + auto - total
  return {
    label,
    long,
    auto,
    both,
    total,
    monthlyNew: xround(div(long, months), 2),
    linkRate: div(both, long),
  }
}

/** 본인 + 동급 + 차상급 + TC 4종을 한 번에 */
export interface FourWay<T> {
  self: T
  peer: T
  next: T
  tc: T
}

export function fourWayCustomer(ctx: Ctx, selfName: string): FourWay<CustomerBlock> {
  return {
    self: selfBlock(ctx, selfName),
    peer: benchBlock(ctx, ctx.levelLabel),
    next: benchBlock(ctx, ctx.nextLabel),
    tc: benchBlock(ctx, ctx.tcLabel),
  }
}

/** 인적사항 — 레포트!B5:N6 */
export interface Profile {
  code: string
  name: string
  hq: string
  visionCenter: string
  branch: string
  hireDate: string
  incomeRaw: string
  months: number
  levelLabel: string
  nextLabel: string
  /** 소득 백분위 문구 (개요!B19:F19) */
  percentile?: { rate: number; band: string; cmp: string }
  /** 총 보유고객 (개요!CT14 = 자동차고객수 + 장기고객수 − 자장고객수) */
  totalCustomers: number
  /** 고객 1인당 평균 월납보험료 (개요!CW14 = 월납금액 ÷ 장기고객수) */
  premPerCustomer: number
}

export function profile(ctx: Ctx): Profile {
  return {
    code: ctx.code.toUpperCase(),
    // 레포트!F6 = VLOOKUP(…,11) = input L 대표자명
    name: ctx.t('repName') || ctx.t('name'),
    hq: ctx.t('hq'),
    visionCenter: ctx.t('visionCenter'),
    branch: ctx.t('branch'),
    hireDate: ctx.t('hireDate'),
    incomeRaw: ctx.incomeRaw,
    months: ctx.f('months'),
    levelLabel: ctx.levelLabel,
    nextLabel: ctx.nextLabel,
    percentile: ctx.incomeMap.percentile[ctx.incomeRaw],
    // 개요!CT14 = AP12 + AQ12 − AR12 = 자동차고객수 + 장기고객수 − 자장고객수
    totalCustomers: ctx.f('autoCust') + ctx.f('longCust') - ctx.f('bothCust'),
    // 개요!CW14 = VLOOKUP(…,49) / AQ12 = 월납금액 ÷ 장기고객수
    premPerCustomer: div(ctx.f('monthlyPrem'), ctx.f('longCust')),
  }
}

export { BENCH_FIELDS, FIELDS }
