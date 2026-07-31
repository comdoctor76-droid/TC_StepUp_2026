/* ══════════════════════════════════════════════════════════════════════
   성장코칭 탭 — 데이터 어댑터

   원본 "TC스텝업 하이플래너 성장 코칭" 도구는 "자가진단 레포트" 출력용 엑셀
   (수식이 전부 계산된 최종본)을 업로드받아 레포트/C/A/M/S 시트의 특정 셀을
   읽었다(예: 레포트!D13, C분석!CJ22). 이 앱은 그 값들을 이미 `analyze()`가
   계산해 두고 있으므로, 파일을 다시 읽는 대신 FullAnalysis 에서 같은 값을
   뽑아 원본과 동일한 모양(me/동급/tc 삼중 객체)으로 재조립한다.

   각 필드 옆 주석은 원본이 읽던 셀 주소 — 매핑 근거는 tests/golden.test.ts
   의 동일 셀 대조 테스트다. 새로 계산한 값은 없다(customer.ts/market.ts/
   action.ts에 추가한 3개 필드 제외 — 그마저도 기존 ctx.peer()/ctx.tc() 를
   한 번 더 부르는 수준).
   ══════════════════════════════════════════════════════════════════════ */

import type { FullAnalysis } from './index'
import { getActiveCohortStats, lookupCohort, type CoachCohort } from './cohort'
import { ym } from './format'

export interface CoachMetric {
  me: number | null
  dg: number | null
  tc: number | null
}

export interface CoachBasic {
  name: string
  hq: string
  visionCenter: string
  branch: string
  hireDate: string
  months: number
  incomeRaw: string
  levelLabel: string
  code: string
  /** 관리자가 설정한 캡션(예: "(영업교육운영파트 / updated by 2026.6.30.)") */
  caption: string
  /** "2026.01 ~ 2026.06" 형태 — 원본의 B42 셀 문구 대신 직접 조립한다 */
  periodLabel: string
}

export interface CoachMonthlyPoint {
  month: number
  me: number
  dg: number
  tc: number
}

export interface CoachData {
  basic: CoachBasic
  full: Record<string, CoachMetric>
  m6: Record<string, CoachMetric>
  monthly: CoachMonthlyPoint[]
  /** 차월 코호트 벤치마크 ("내 연차의 기준") — 통계 문서가 없으면 null → 페이지 숨김 */
  cohort: CoachCohort | null
}

const m = (me: number | null, dg: number | null, tc: number | null): CoachMetric => ({ me, dg, tc })
const pos = (v: number | null | undefined): number | null =>
  typeof v === 'number' && isFinite(v) && v > 0 ? v : null
const shareOf = (arr: { label: string; share: number }[], label: string) =>
  arr.find((x) => x.label === label)?.share ?? null

export function buildCoachData(A: FullAnalysis, caption: string): CoachData {
  const p = A.profile
  const o = A.report.overall
  const r = A.report.recent
  const cb = A.customer.blocks
  const months = A.ctx.months

  const general = A.action.byType.find((x) => x.key === 'general')!
  const auto = A.action.byType.find((x) => x.key === 'auto')!
  const protect = A.action.byType.find((x) => x.key === 'protect')!

  const basic: CoachBasic = {
    name: p.name,
    hq: p.hq, // 레포트!B6
    visionCenter: p.visionCenter, // 레포트!C6
    branch: p.branch, // 레포트!D6
    hireDate: p.hireDate, // 레포트!I6
    months: p.months, // 레포트!M6 — 경력위촉차월
    incomeRaw: p.incomeRaw, // 레포트!K6
    levelLabel: p.levelLabel,
    code: p.code, // 레포트!N6
    caption,
    periodLabel: `${ym(months[0])} ~ ${ym(months[months.length - 1])}`,
  }

  const full: Record<string, CoachMetric> = {
    // 레포트!D13 / C분석!CJ22 / 레포트!J13
    custLong: m(o.customers.long.self, cb.peer.long, o.customers.long.tc),
    custCar: m(o.customers.auto.self, cb.peer.auto, o.customers.auto.tc),
    custLink: m(o.customers.link.self, cb.peer.both, o.customers.link.tc),
    custTotal: m(o.customers.total.self, cb.peer.total, o.customers.total.tc),
    newCust: m(o.customers.monthlyNew.self, cb.peer.monthlyNew, o.customers.monthlyNew.tc),
    linkRate: m(o.mixRate.linkRate.self, cb.peer.linkRate, o.mixRate.linkRate.tc),
    longSoloRate: m(o.mixRate.longOnly.self, A.market.mix[1].longRate, o.mixRate.longOnly.tc),
    perCust: m(o.casesPerCustomer.self, A.action.perCustomerAll[1].perCust, o.casesPerCustomer.tc),
    cntLong: m(
      A.action.perCustomerAll[0].cases,
      A.action.perCustomerAll[1].cases,
      A.action.perCustomerAll[3].cases,
    ),
    // 레포트!AG21 / (동급 없음) / 레포트!AH21
    transferLong: m(A.customer.composition.transferLongCust, null, A.customer.composition.transferLongTc),
    premPer: m(o.premium.perCust.self, A.skill.amountAll[1].perCust, o.premium.perCust.tc),
    premCase: m(o.premium.perCase.self, A.skill.amountAll[1].perCase, o.premium.perCase.tc),
    premMax: m(o.premium.max.self, A.skill.amountAll[1].max, o.premium.max.tc),
    silsonCnt: m(o.silson.selfTotal, A.market.silsonAll.peerTotal, o.silson.tcTotal),
  }

  const m6: Record<string, CoachMetric> = {
    perCust6: m(r.casesPerCustomer.self, A.action.perCustomer6m[1].perCust, r.casesPerCustomer.tc),
    newCust6: m(r.newOld.cust.self.nw, A.action.newOldCust[1].신규, r.newOld.cust.tc.nw),
    oldCust6: m(r.newOld.cust.self.old, A.action.newOldCust[1].기존, r.newOld.cust.tc.old),
    newCnt6: m(r.newOld.cases.self.nw, A.action.newOldCases[1].신규, r.newOld.cases.tc.nw),
    oldCnt6: m(r.newOld.cases.self.old, A.action.newOldCases[1].기존, r.newOld.cases.tc.old),
    moGen: m(r.monthlyCases.general.self, general.동급, r.monthlyCases.general.tc),
    moLong: m(r.monthlyCases.protect.self, protect.동급, r.monthlyCases.protect.tc),
    moCar: m(r.monthlyCases.auto.self, auto.동급, r.monthlyCases.auto.tc),
    simpleCntPct: m(
      shareOf(A.market.countShare.self, '간편'),
      shareOf(A.market.countShare.peer, '간편'),
      shareOf(A.market.countShare.tc, '간편'),
    ),
    simplePremPct: m(
      shareOf(A.market.premiumShare.self, '간편'),
      shareOf(A.market.premiumShare.peer, '간편'),
      shareOf(A.market.premiumShare.tc, '간편'),
    ),
    premPer6: m(r.premium.perCust.self, A.skill.amount6m[1].perCust, r.premium.perCust.tc),
    premCase6: m(r.premium.perCase.self, A.skill.amount6m[1].perCase, r.premium.perCase.tc),
    premMax6: m(r.premium.max.self, A.skill.amount6m[1].max, r.premium.max.tc),
    cancerRate: m(r.critical.cancer.rate.self, A.skill.critical[1].cancerRate, r.critical.cancer.rate.tc),
    brainRate: m(r.critical.heart.rate.self, A.skill.critical[1].heartRate, r.critical.heart.rate.tc),
    // 레포트!D30/G30/J30/M30 상당 — 월평균 인·환산실적 (최근 6개월, 동일그룹 없음).
    // 구버전 엑셀 데이터에는 열이 없어 0 으로 계산되는데, 0 을 그대로 쓰면
    // "TC의 NaN%" 같은 파생 문구가 깨진다 — 0 이하는 미제공(null)으로 취급한다.
    perfIn: m(pos(r.perf.person.self), null, pos(r.perf.person.tc)),
    perfConv: m(pos(r.perf.converted.self), null, pos(r.perf.converted.tc)),
  }

  const monthly: CoachMonthlyPoint[] = A.action.trend.map((t) => ({
    month: t.month,
    me: t.건수본인,
    dg: t.건수동급,
    tc: t.건수TC,
  }))

  const cohort = lookupCohort(
    getActiveCohortStats(),
    basic.months,
    typeof full.custLong.me === 'number' ? full.custLong.me : null,
  )

  return { basic, full, m6, monthly, cohort }
}
