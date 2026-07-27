/* ══════════════════════════════════════════════════════════════════════
   S분석 — Skill[기술] 분석 (최근 6개월)
   원본 차트 13개(전부 막대):
     인당/건당/최고 금액 ×3
     주력상품 평균 보험료 ×6
     암·심뇌 건당보험료 / 부보율 ×4

   ⚠️ S 점수 산식은 원본에서 유실됐다 (개요!BU25 = S분석!#REF!).
      복원이 불가능하므로 score 는 null 로 두고 CAMS 레이더에서 비운다.
   ══════════════════════════════════════════════════════════════════════ */

import { div, xround } from './format'
import { PRODUCTS } from './market'
import type { BenchFieldKey, FieldKey } from '../data/schema'
import type { Ctx } from './resolve'

const PROD_FIELD: Record<string, { cnt: FieldKey; prem: FieldKey }> = {
  simple: { cnt: 'cntSimple', prem: 'premSimple' },
  perfect: { cnt: 'cntPerfect', prem: 'premPerfect' },
  star: { cnt: 'cntKidStar', prem: 'premKidStar' },
  kid: { cnt: 'cntKid', prem: 'premKid' },
  driver: { cnt: 'cntDriver', prem: 'premDriver' },
  silson: { cnt: 'cntSilson', prem: 'premSilson' },
}
const PROD_BENCH: Record<string, { cnt: BenchFieldKey; prem: BenchFieldKey }> = {
  simple: { cnt: 'cntSimple', prem: 'premSimple' },
  perfect: { cnt: 'cntPerfect', prem: 'premPerfect' },
  star: { cnt: 'cntKidStar', prem: 'premKidStar' },
  kid: { cnt: 'cntKid', prem: 'premKid' },
  driver: { cnt: 'cntDriver', prem: 'premDriver' },
  silson: { cnt: 'cntSilson', prem: 'premSilson' },
}

export interface AmountRow {
  label: string
  /** 장기고객 */
  cust: number
  /** 월납금액 */
  total: number
  /** 인당금액 */
  perCust: number
  /** 건수 */
  cases: number
  /** 건당금액 */
  perCase: number
  /** 최고금액 */
  max: number
}

export interface SkillAnalysis {
  /** 전체 기간 인당/건당/최고 — S분석!BU24:CC28 */
  amountAll: AmountRow[]
  /** 최근 6개월 — S분석!BU29:CC31 (chart25/27/28) */
  amount6m: AmountRow[]

  /** 주력상품 평균 보험료 — S분석!CV24:DA28 (chart26,29~33) */
  productAvg: { label: string; 본인: number; 동급: number; TC표준그룹: number }[]

  /** 암·심뇌 — S분석!DB24:DJ28 (chart34~37) */
  critical: {
    label: string
    /** 암 건당 보험료 */
    cancerPerCase: number
    /** 암 부보율 */
    cancerRate: number
    /** 암 계약수(6개월 환산) */
    cancerCases: number
    /** 심뇌 건당 보험료 */
    heartPerCase: number
    /** 심뇌 부보율 */
    heartRate: number
    /** 심뇌 계약수(6개월 환산) */
    heartCases: number
  }[]

  /** S 점수 — 원본 산식 유실 */
  score: null
}

export function analyzeSkill(ctx: Ctx, selfName: string): SkillAnalysis {
  // ── 전체 기간 : S분석!BV24:CC28 ────────────────────────────────────
  const row = (
    label: string,
    cust: number,
    total: number,
    cases: number,
    max: number,
  ): AmountRow => ({
    label,
    cust,
    total,
    perCust: div(total, cust),
    cases,
    perCase: div(total, cases),
    max,
  })

  const amountAll: AmountRow[] = [
    row(selfName, ctx.f('longCustNet'), ctx.f('monthlyPrem'), ctx.f('longCntNet'), ctx.f('maxPrem')),
    row(
      '동급',
      xround(ctx.peer('longCustNet'), 0),
      xround(ctx.peer('monthlyPrem'), 0),
      xround(ctx.peer('longCntNet'), 0),
      xround(ctx.peer('maxPrem'), 0),
    ),
    row(
      '차상급',
      xround(ctx.next('longCustNet'), 0),
      xround(ctx.next('monthlyPrem'), 0),
      xround(ctx.next('longCntNet'), 0),
      xround(ctx.next('maxPrem'), 0),
    ),
    row(
      'TC 표준그룹',
      xround(ctx.tc('longCustNet'), 0),
      xround(ctx.tc('monthlyPrem'), 0),
      xround(ctx.tc('longCntNet'), 0),
      xround(ctx.tc('maxPrem'), 0),
    ),
  ]

  // ── 최근 6개월 : S분석!BV29:CC31 ──────────────────────────────────
  const amount6m: AmountRow[] = [
    row(
      selfName,
      ctx.f('longCust6m'),
      ctx.f('longPrem6m'),
      ctx.f('longCnt6m'),
      ctx.f('longMaxPrem6m'),
    ),
    row(
      '동급',
      xround(ctx.peer('longCust6m'), 0),
      xround(ctx.peer('longPrem6m'), 0),
      xround(ctx.peer('longCnt6m'), 0),
      xround(ctx.peer('longMaxPrem6m'), 0),
    ),
    row(
      'TC 표준그룹',
      xround(ctx.tc('longCust6m'), 0),
      xround(ctx.tc('longPrem6m'), 0),
      xround(ctx.tc('longCnt6m'), 0),
      xround(ctx.tc('longMaxPrem6m'), 0),
    ),
  ]

  // ── 주력상품 평균 보험료 : S분석!CV24 / CV25 / CV28 ────────────────
  const productAvg = PRODUCTS.map((p) => {
    const sf = PROD_FIELD[p.key]
    const sb = PROD_BENCH[p.key]
    return {
      label: p.label,
      본인: div(ctx.f(sf.prem), ctx.f(sf.cnt)),
      동급: div(xround(ctx.peer(sb.prem), 0), xround(ctx.peer(sb.cnt), 0)),
      TC표준그룹: div(xround(ctx.tc(sb.prem), 0), xround(ctx.tc(sb.cnt), 0)),
    }
  })

  // ── 암·심뇌 : S분석!DB24:DJ28 ─────────────────────────────────────
  //   본인   DB24=암주치보험료 DC24=심뇌보험료 DD24=암주치계약수 DE24=심뇌계약수
  //          DF24=전체계약수  DG24=DD/DF     DH24=DE/DF
  //          DI24=DB/DD (암 건당) DJ24=DC/DE (심뇌 건당)
  //   ※ 계약수는 6개월 "평균"이므로 건수 표시 시 ×6 한다 (레포트!F41 = DD24*6)
  const crit = (
    label: string,
    cancerPrem: number,
    heartPrem: number,
    cancerCnt: number,
    heartCnt: number,
    totalCnt: number,
  ) => ({
    label,
    cancerPerCase: div(cancerPrem, cancerCnt),
    cancerRate: div(cancerCnt, totalCnt),
    cancerCases: cancerCnt * 6,
    heartPerCase: div(heartPrem, heartCnt),
    heartRate: div(heartCnt, totalCnt),
    heartCases: heartCnt * 6,
  })

  const critical = [
    crit(
      selfName,
      ctx.f('premCancerMain'),
      ctx.f('premHeart'),
      ctx.f('cntCancer6m'),
      ctx.f('cntHeart6m'),
      ctx.f('cnt6mAvg'),
    ),
    crit(
      '동급',
      xround(ctx.peer('premCancerMain'), 0),
      xround(ctx.peer('premHeart'), 0),
      ctx.peer('cntCancer6m'),
      ctx.peer('cntHeart6m'),
      ctx.peer('cnt6mSum'),
    ),
    crit(
      'TC 표준그룹',
      xround(ctx.tc('premCancerMain'), 0),
      xround(ctx.tc('premHeart'), 0),
      ctx.tc('cntCancer6m'),
      ctx.tc('cntHeart6m'),
      ctx.tc('cnt6mSum'),
    ),
  ]

  return { amountAll, amount6m, productAvg, critical, score: null }
}
