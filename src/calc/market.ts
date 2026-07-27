/* ══════════════════════════════════════════════════════════════════════
   M분석 — Market[시장] 분석 (최근 6개월)
   원본 차트 8개(전부 원형):
     인보험 보종별 건수 구성비 ×3 (본인/동급/TC)
     주력상품 보험료 구성비   ×3 (본인/동급/TC)
     실손 세대별 비중         ×2 (본인/TC)
   ══════════════════════════════════════════════════════════════════════ */

import type { BenchFieldKey, FieldKey } from '../data/schema'
import { div, xround } from './format'
import type { Ctx } from './resolve'

/** 원본 M분석!DS26:DX26 · EG26:EL26 의 6개 주력상품 (순서 고정) */
export const PRODUCTS = [
  { key: 'simple', label: '간편' },
  { key: 'perfect', label: '퍼펙트' },
  { key: 'star', label: '스타' },
  { key: 'kid', label: '어린이' },
  { key: 'driver', label: '운전자' },
  { key: 'silson', label: '실손' },
] as const

/** 상품 → input 필드 (건수 / 보험료) */
const PROD_FIELD: Record<string, { cnt: FieldKey; prem: FieldKey }> = {
  simple: { cnt: 'cntSimple', prem: 'premSimple' },
  perfect: { cnt: 'cntPerfect', prem: 'premPerfect' },
  star: { cnt: 'cntKidStar', prem: 'premKidStar' },
  kid: { cnt: 'cntKid', prem: 'premKid' },
  driver: { cnt: 'cntDriver', prem: 'premDriver' },
  silson: { cnt: 'cntSilson', prem: 'premSilson' },
}

/** 상품 → 소득별Data 필드 */
const PROD_BENCH: Record<string, { cnt: BenchFieldKey; prem: BenchFieldKey }> = {
  simple: { cnt: 'cntSimple', prem: 'premSimple' },
  perfect: { cnt: 'cntPerfect', prem: 'premPerfect' },
  star: { cnt: 'cntKidStar', prem: 'premKidStar' },
  kid: { cnt: 'cntKid', prem: 'premKid' },
  driver: { cnt: 'cntDriver', prem: 'premDriver' },
  silson: { cnt: 'cntSilson', prem: 'premSilson' },
}

export interface Share {
  label: string
  value: number
  share: number
}

export interface MarketAnalysis {
  /** 장기/자동차/연계 고객 구성 — M분석!CX27:CZ32 */
  mix: {
    label: string
    long: number
    auto: number
    link: number
    longRate: number
    autoRate: number
    linkRate: number
  }[]

  /** 보험료 구성(일반/자동차/보장성/저축성) — M분석!DH27:DP32 */
  premiumMix: { label: string; 일반: number; 자동차: number; 보장성: number; 저축성: number }[]

  /** chart17~19 — 인보험 보종별 "건수" 구성비 */
  countShare: { self: Share[]; peer: Share[]; tc: Share[] }

  /** chart20~22 — 주력상품 "보험료" 구성비 */
  premiumShare: { self: Share[]; peer: Share[]; tc: Share[] }

  /** chart23~24 — 실손 세대별 비중 (원본은 1~4세대만 그린다) */
  silson: { self: Share[]; tc: Share[]; selfTotal: number; tcTotal: number }
  /** 5세대 포함 전체 비중 (레포트 D18:O18 용) */
  silsonAll: { self: Share[]; tc: Share[]; selfTotal: number; tcTotal: number }

  /** M 점수 — M분석!EF31 */
  score: number
  scoreParts: { autoRate: number; generalPrem: number; perfect: number; star: number; kid: number }
}

function toShares(items: { label: string; value: number }[]): Share[] {
  const total = items.reduce((a, b) => a + b.value, 0)
  return items.map((i) => ({ ...i, share: div(i.value, total) }))
}

export function analyzeMarket(ctx: Ctx, selfName: string): MarketAnalysis {
  // ── 장기/자동차/연계 : M분석!CX27:CZ32 ─────────────────────────────
  const mixRow = (label: string, long: number, auto: number, link: number) => ({
    label,
    long,
    auto,
    link,
    longRate: div(long, long + auto), // DC
    autoRate: div(auto, long + auto), // DD
    linkRate: div(link, long), // DE
  })
  const mix = [
    mixRow(selfName, ctx.f('longCustNet'), ctx.f('autoCustNet'), ctx.f('bothCustNet')),
    mixRow(
      '동급',
      xround(ctx.peer('longCustNet'), 0),
      xround(ctx.peer('autoCustNet'), 0),
      xround(ctx.peer('bothCustNet'), 0),
    ),
    mixRow(
      '차상급',
      xround(ctx.next('longCustNet'), 0),
      // ⚠️ 원본 M분석!CY30 은 인덱스 44(자동차고객수, 이관 포함)를 참조한다.
      //    같은 행의 CX30/CZ30 은 이관제외(54/55)를 쓰므로 원본의 불일치다.
      //    표시값을 원본과 맞추기 위해 그대로 둔다.
      xround(ctx.next('autoCust'), 0),
      xround(ctx.next('bothCustNet'), 0),
    ),
    mixRow(
      'TC 표준그룹',
      xround(ctx.tc('longCustNet'), 0),
      xround(ctx.tc('autoCustNet'), 0),
      xround(ctx.tc('bothCustNet'), 0),
    ),
  ]

  // ── 보험료 구성 : M분석!DH27:DP32 ──────────────────────────────────
  //   원본은 일반÷3, 자동차÷10, 보장성×5, 저축성×2 로 스케일을 맞춘다.
  const premRow = (label: string, gen: number, auto: number, prot: number, sav: number) => ({
    label,
    일반: gen / 3,
    자동차: auto / 10,
    보장성: prot * 5,
    저축성: sav * 2,
  })
  const premiumMix = [
    premRow(
      selfName,
      ctx.f('premGeneral'),
      ctx.f('premAuto'),
      ctx.f('premProtect'),
      ctx.f('premSaving'),
    ),
    premRow(
      '동급',
      xround(ctx.peer('premGeneral'), 0),
      xround(ctx.peer('premAuto'), 0),
      xround(ctx.peer('premProtect'), 0),
      xround(ctx.peer('premSaving'), 0),
    ),
    premRow(
      '차상급',
      xround(ctx.next('premGeneral'), 0),
      xround(ctx.next('premAuto'), 0),
      xround(ctx.next('premProtect'), 0),
      xround(ctx.next('premSaving'), 0),
    ),
    premRow(
      'TC 표준그룹',
      xround(ctx.tc('premGeneral'), 0),
      xround(ctx.tc('premAuto'), 0),
      xround(ctx.tc('premProtect'), 0),
      xround(ctx.tc('premSaving'), 0),
    ),
  ]

  // ── 주력상품 건수/보험료 구성비 : M분석!DS27:EE32, EG27:ES32 ────────
  const selfCounts = PRODUCTS.map((p) => ({ label: p.label, value: ctx.f(PROD_FIELD[p.key].cnt) }))
  const selfPrems = PRODUCTS.map((p) => ({ label: p.label, value: ctx.f(PROD_FIELD[p.key].prem) }))
  const benchCounts = (get: (k: BenchFieldKey) => number) =>
    PRODUCTS.map((p) => ({ label: p.label, value: xround(get(PROD_BENCH[p.key].cnt), 0) }))
  const benchPrems = (get: (k: BenchFieldKey) => number) =>
    PRODUCTS.map((p) => ({ label: p.label, value: xround(get(PROD_BENCH[p.key].prem), 0) }))

  const countShare = {
    self: toShares(selfCounts),
    peer: toShares(benchCounts(ctx.peer)),
    tc: toShares(benchCounts(ctx.tc)),
  }
  const premiumShare = {
    self: toShares(selfPrems),
    peer: toShares(benchPrems(ctx.peer)),
    tc: toShares(benchPrems(ctx.tc)),
  }

  // ── 실손 세대별 비중 : M분석!CZ36:DJ37 ─────────────────────────────
  const selfGen = [
    { label: '1세대', value: ctx.f('silson1') },
    { label: '2세대', value: ctx.f('silson2') },
    { label: '3세대', value: ctx.f('silson3') },
    { label: '4세대', value: ctx.f('silson4') },
    { label: '5세대', value: ctx.f('silson5') },
  ]
  const tcGen = [
    { label: '1세대', value: ctx.tc('silson1') },
    { label: '2세대', value: ctx.tc('silson2') },
    { label: '3세대', value: ctx.tc('silson3') },
    { label: '4세대', value: ctx.tc('silson4') },
    { label: '5세대', value: ctx.tc('silson5') },
  ]
  const silsonAllSelf = toShares(selfGen)
  const silsonAllTc = toShares(tcGen)
  const selfTotal = selfGen.reduce((a, b) => a + b.value, 0)
  const tcTotal = tcGen.reduce((a, b) => a + b.value, 0)

  // ── M 점수 : M분석!DD31:EF31 ───────────────────────────────────────
  //   본인 − 동급 의 차이를 5개 항목에 대해 더한다.
  const autoRate = mix[0].autoRate - mix[1].autoRate // DD31
  const generalPrem =
    div(premiumMix[0].일반, premiumMix[0].일반 + premiumMix[0].자동차 + premiumMix[0].보장성) -
    div(premiumMix[1].일반, premiumMix[1].일반 + premiumMix[1].자동차 + premiumMix[1].보장성) // DM31
  const idx = (label: string, arr: Share[]) => arr.find((x) => x.label === label)?.share ?? 0
  const perfect = idx('퍼펙트', countShare.self) - idx('퍼펙트', countShare.peer) // EA31
  const star = idx('스타', countShare.self) - idx('스타', countShare.peer) // EB31
  const kid = idx('어린이', countShare.self) - idx('어린이', countShare.peer) // EC31

  const raw = 1 + autoRate + generalPrem + perfect + star + kid // EE31
  const score = raw > 0.5 ? raw : 0.5 // EF31

  return {
    mix,
    premiumMix,
    countShare,
    premiumShare,
    silson: {
      self: silsonAllSelf.slice(0, 4),
      tc: silsonAllTc.slice(0, 4),
      selfTotal,
      tcTotal,
    },
    silsonAll: { self: silsonAllSelf, tc: silsonAllTc, selfTotal, tcTotal },
    score,
    scoreParts: { autoRate, generalPrem, perfect, star, kid },
  }
}
