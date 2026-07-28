/* ══════════════════════════════════════════════════════════════════════
   A분석 — Action[활동] 분석 (최근 6개월)
   원본 차트 10개: 인당건수 / 보종별 월평균 건수 5종 / 신규·기존 고객·건수 /
                  총고객 / 월별 장기 가입건수 추이
   ══════════════════════════════════════════════════════════════════════ */

import { ACTION_BANDS } from '../data/schema'
import { div, xround } from './format'
import type { Ctx } from './resolve'

export interface ActionAnalysis {
  /** 인당건수 (전체 기간) — A분석!DA25:DC28 */
  perCustomerAll: { label: string; cust: number; cases: number; perCust: number }[]

  /** 인당건수 (최근 6개월) — A분석!DA30:DC32 · chart7 */
  perCustomer6m: { label: string; cust: number; cases: number; perCust: number }[]

  /** 보종별 월평균 건수 — A분석!DF24:DJ28 · chart8~12 */
  byType: {
    key: string
    label: string
    본인: number
    동급: number
    TC표준그룹: number
  }[]

  /** 신규/기존 고객 (월평균) — A분석!DL25:DN28 · chart13, chart15 */
  newOldCust: { label: string; 신규: number; 기존: number; 합계: number }[]

  /** 신규/기존 건수 (월평균) — A분석!DO25:DQ28 · chart14 */
  newOldCases: { label: string; 신규: number; 기존: number; 합계: number }[]

  /** 월별 장기 가입건수·고객수 추이 — A분석!DL30:DZ32 · chart16 */
  trend: {
    month: number
    건수본인: number
    건수TC: number
    고객본인: number
    고객TC: number
    /** 동급 — 원본 차트엔 없어 성장코칭 탭용으로 새로 뽑는다 */
    건수동급: number
    고객동급: number
  }[]

  /** 소득군별 인당건수 참고표 — A분석!CY45:DC56 */
  bandTable: { name: string; cust: number; cases: number; perCust: number }[]

  /** A 점수 — A분석!DT43 */
  score: number
  scoreParts: { general: number; auto: number; protect: number; longCnt: number; newCust: number }
}

export function analyzeAction(ctx: Ctx, selfName: string): ActionAnalysis {
  // ── 전체 기간 인당건수 : A분석!CZ25:DC28 ────────────────────────────
  //   본인   DA25 = 장기이관제외고객, DB25 = 장기이관제외건수
  //   동급   DA26 = ROUND(bench.longCustNet), DB26 = ROUND(bench.longCntNet)
  const selfCustAll = ctx.f('longCustNet')
  const selfCasesAll = ctx.f('longCntNet')
  const rowAll = (label: string, cust: number, cases: number) => ({
    label,
    cust,
    cases,
    perCust: div(cases, cust),
  })
  const perCustomerAll = [
    rowAll(selfName, selfCustAll, selfCasesAll),
    rowAll('동급', xround(ctx.peer('longCustNet'), 0), xround(ctx.peer('longCntNet'), 0)),
    rowAll('차상급', xround(ctx.next('longCustNet'), 0), xround(ctx.next('longCntNet'), 0)),
    rowAll('TC 표준그룹', xround(ctx.tc('longCustNet'), 0), xround(ctx.tc('longCntNet'), 0)),
  ]

  // ── 최근 6개월 인당건수 : A분석!DA30:DC32 (chart7) ──────────────────
  //   본인 DA30 = 6개월총장기고객수, DB30 = 6개월총장기건수
  //   동급/TC = ROUND(bench.longCust6m), ROUND(bench.longCnt6m)
  const perCustomer6m = [
    rowAll(selfName, ctx.f('longCust6m'), ctx.f('longCnt6m')),
    rowAll('동급', xround(ctx.peer('longCust6m'), 0), xround(ctx.peer('longCnt6m'), 0)),
    rowAll('TC 표준그룹', xround(ctx.tc('longCust6m'), 0), xround(ctx.tc('longCnt6m'), 0)),
  ]

  // ── 보종별 월평균 건수 : A분석!DF25:DJ27 (chart8~12) ────────────────
  //   일반 = input S 일반건수 / 자동차 = U / 보장성 = O / 인보험 = BP
  //   동급·TC 는 소득별Data 의 같은 열 (일반 17, 자동차 19, 보장성 13, 인보험 58)
  const selfGeneral = ctx.f('cntGeneral')
  const selfAuto = ctx.f('cntAuto')
  const selfProtect = ctx.f('cntProtect')
  const selfPerson = ctx.f('cntPerson')

  //   동급은 원본에서 ROUND(…,0) 을 씌운다 (A분석!DF26/DG26)
  const peerGeneral = xround(ctx.peer('cntGeneral'), 0)
  const peerAuto = xround(ctx.peer('cntAuto'), 0)
  const peerProtect = ctx.peer('cntProtect') // DH26 은 ROUND 없음
  const peerPerson = ctx.peer('cntPerson') // DI26 은 ROUND 없음

  //   TC 는 ROUND 없이 원값 (A분석!DF27:DI27)
  const tcGeneral = ctx.tc('cntGeneral')
  const tcAuto = ctx.tc('cntAuto')
  const tcProtect = ctx.tc('cntProtect')
  const tcPerson = ctx.tc('cntPerson')

  const byType = [
    { key: 'general', label: '일반', 본인: selfGeneral, 동급: peerGeneral, TC표준그룹: tcGeneral },
    { key: 'auto', label: '자동차', 본인: selfAuto, 동급: peerAuto, TC표준그룹: tcAuto },
    { key: 'protect', label: '보장성', 본인: selfProtect, 동급: peerProtect, TC표준그룹: tcProtect },
    { key: 'person', label: '인보험', 본인: selfPerson, 동급: peerPerson, TC표준그룹: tcPerson },
    {
      // A분석!DJ25 = SUM(DF25:DH25) — 인보험은 합계에서 제외된다
      key: 'total',
      label: '계',
      본인: selfGeneral + selfAuto + selfProtect,
      동급: peerGeneral + peerAuto + peerProtect,
      TC표준그룹: tcGeneral + tcAuto + tcProtect,
    },
  ]

  // ── 신규/기존 (6개월 합 ÷ 6) : A분석!DL25:DQ28 ──────────────────────
  const nc = (label: string, nw: number, old: number, tot?: number) => ({
    label,
    신규: nw,
    기존: old,
    합계: tot ?? nw + old,
  })
  const newOldCust = [
    nc(selfName, ctx.f('newCust') / 6, ctx.f('oldCust') / 6),
    nc('동급', ctx.peer('newCust') / 6, ctx.peer('oldCust') / 6, ctx.peer('curCust') / 6),
    nc('TC 표준그룹', ctx.tc('newCust') / 6, ctx.tc('oldCust') / 6, ctx.tc('curCust') / 6),
  ]
  const newOldCases = [
    nc(selfName, ctx.f('newCnt') / 6, ctx.f('oldCnt') / 6),
    nc('동급', ctx.peer('newCnt') / 6, ctx.peer('oldCnt') / 6, ctx.peer('curCnt') / 6),
    nc('TC 표준그룹', ctx.tc('newCnt') / 6, ctx.tc('oldCnt') / 6, ctx.tc('curCnt') / 6),
  ]

  // ── 월별 추이 : A분석!DL30:DZ32 (chart16) ───────────────────────────
  //   본인 = Q7 장기건수 시트, TC = 소득별Data CI~CN(건수) / CO~CT(고객수)
  const s = ctx.planner.s
  const tcCnt = [
    ctx.tc('cntLongM5'),
    ctx.tc('cntLongM4'),
    ctx.tc('cntLongM3'),
    ctx.tc('cntLongM2'),
    ctx.tc('cntLongM1'),
    // ⚠️ 원본 A분석!DQ31 은 인덱스 90(=CN 장기건수_M) 대신 85(=CI 장기건수_M5)를
    //    다시 참조하는 오류가 있다. 여기서는 올바른 값(CN)을 쓴다.
    //    ─ 이 값은 원본 어떤 표에도 숫자로 표시되지 않고 추이 그래프 마지막 점에만
    //      쓰이므로, 바로잡아도 레포트의 표 수치와는 어긋나지 않는다.
    ctx.tc('cntLongM'),
  ]
  const tcCust = [
    ctx.tc('custLongM5'),
    ctx.tc('custLongM4'),
    ctx.tc('custLongM3'),
    ctx.tc('custLongM2'),
    ctx.tc('custLongM1'),
    ctx.tc('custLongM'),
  ]
  const peerCnt = [
    ctx.peer('cntLongM5'),
    ctx.peer('cntLongM4'),
    ctx.peer('cntLongM3'),
    ctx.peer('cntLongM2'),
    ctx.peer('cntLongM1'),
    ctx.peer('cntLongM'),
  ]
  const peerCust = [
    ctx.peer('custLongM5'),
    ctx.peer('custLongM4'),
    ctx.peer('custLongM3'),
    ctx.peer('custLongM2'),
    ctx.peer('custLongM1'),
    ctx.peer('custLongM'),
  ]
  const trend = ctx.months.map((m, i) => ({
    month: m,
    건수본인: s.cntLong[i] ?? 0,
    건수TC: tcCnt[i] ?? 0,
    고객본인: s.custLong[i] ?? 0,
    고객TC: tcCust[i] ?? 0,
    건수동급: peerCnt[i] ?? 0,
    고객동급: peerCust[i] ?? 0,
  }))

  // ── 소득군별 인당건수 참고표 : A분석!CY45:DC54 ──────────────────────
  //   ⚠️ A분석의 구간 목록은 C분석(INCOME_BANDS)과 다르다.
  //      400↑ 이 없고 1,500↑ 이 있다. 재사용하면 한 칸씩 밀린다.
  const bandTable = ACTION_BANDS.map((b) => {
    const cust = xround(ctx.bench(b.key, 'longCust'), 0) // 소득별Data AU 장기고객수
    const cases = xround(ctx.bench(b.key, 'longCnt'), 0) // 소득별Data AW 장기건수
    return { name: b.short, cust, cases, perCust: div(cases, cust) }
  })

  // ── A 점수 : A분석!DF43:DT43 ────────────────────────────────────────
  //   각 항목이 동급 이상이면 +, 미만이면 − (일반/자동차 ±0.1, 나머지 ±0.2)
  const general = selfGeneral >= peerGeneral ? 0.1 : -0.1 // DF43
  const auto = selfAuto >= peerAuto ? 0.1 : -0.1 // DG43
  const protect = selfProtect >= peerProtect ? 0.2 : -0.2 // DH43
  //   DK43 : 장기보험 유지건수 본인(input AW) vs 동급(소득별Data AW)
  const longCnt = ctx.f('longCnt') >= xround(ctx.peer('longCnt'), 0) ? 0.2 : -0.2
  //   DL43 : 월평균 신규고객 본인 vs 동급
  const selfMonthlyNew = xround(div(ctx.f('longCustNet'), ctx.f('months')), 2)
  const peerMonthlyNew = xround(div(xround(ctx.peer('longCustNet'), 0), ctx.peer('months')), 2)
  const newCust = selfMonthlyNew >= peerMonthlyNew ? 0.2 : -0.2

  const raw = 1 + general + auto + protect + longCnt + newCust // DM43
  const score = raw > 0.5 ? raw : 0.5 // DT43

  return {
    perCustomerAll,
    perCustomer6m,
    byType,
    newOldCust,
    newOldCases,
    trend,
    bandTable,
    score,
    scoreParts: { general, auto, protect, longCnt, newCust },
  }
}
