/* ══════════════════════════════════════════════════════════════════════
   레포트 — 요약 시트 (차트 없음, 표 전용)
   원본은 C/A/M/S 시트의 계산 결과를 참조만 한다.
   여기서도 동일하게 각 분석 모듈의 결과를 조합한다.
   ══════════════════════════════════════════════════════════════════════ */

import { div, xround } from './format'
import type { ActionAnalysis } from './action'
import type { CustomerAnalysis } from './customer'
import type { MarketAnalysis } from './market'
import type { SkillAnalysis } from './skill'
import type { Ctx } from './resolve'

/** 본인 / 비교군 한 쌍 */
export interface Pair {
  self: number
  tc: number
}

export interface ReportSummary {
  /** ■ 현황Ⅰ (전체) */
  overall: {
    /** 고객분석 — 레포트!D13:N13 */
    customers: {
      long: Pair
      auto: Pair
      link: Pair
      total: Pair
      monthlyNew: Pair
    }
    /** 활동분석 — 레포트!D14 / J14 */
    casesPerCustomer: Pair
    /** 시장분석: 보종별 연계율 — 레포트!D16:N16 */
    mixRate: { longOnly: Pair; autoOnly: Pair; linkRate: Pair }
    /** 시장분석: 실손보유비중 — 레포트!D18:O18 */
    silson: { self: number[]; tc: number[]; selfTotal: number; tcTotal: number }
    /** 기술분석: 장기월납 평균 보험료 — 레포트!D20:N20 */
    premium: { perCust: Pair; perCase: Pair; max: Pair }
  }

  /** ■ 현황Ⅱ (6개월) */
  recent: {
    /** 실적현황: 월평균 인/환산실적 — 레포트!D26:M27 */
    perf: { person: Pair; converted: Pair }
    /** 활동분석 — 레포트!D25 / J25 */
    casesPerCustomer: Pair
    /** 신규/기존 고객·건수 (월평균) — 레포트!D28:O28 */
    newOld: {
      cust: { self: { nw: number; old: number; sum: number }; tc: { nw: number; old: number; sum: number } }
      cases: { self: { nw: number; old: number; sum: number }; tc: { nw: number; old: number; sum: number } }
    }
    /** 월평균건수 — 레포트!D30:N30 */
    monthlyCases: { general: Pair; protect: Pair; auto: Pair }
    /** 주력상품 보험료 구성비율 — 레포트!D32:O32 */
    premiumShare: { label: string; self: number; tc: number }[]
    /** 주력상품 건수 구성비율 — 레포트!D34:O34 */
    countShare: { label: string; self: number; tc: number }[]
    /** 장기월납 평균 보험료 — 레포트!D36:N36 */
    premium: { perCust: Pair; perCase: Pair; max: Pair }
    /** 주력상품 평균 보험료 — 레포트!D38:O38 */
    productAvg: { label: string; self: number; tc: number }[]
    /** 주요치료비 부보율/평균 보험료 — 레포트!D41:O41 */
    critical: {
      cancer: { prem: Pair; rate: Pair; cases: Pair }
      heart: { prem: Pair; rate: Pair; cases: Pair }
    }
  }

  /** CAMS 점수 — 개요!BT22:BU25 */
  cams: { C: number; A: number; M: number; S: number | null }
}

export function buildReport(
  ctx: Ctx,
  c: CustomerAnalysis,
  a: ActionAnalysis,
  m: MarketAnalysis,
  sk: SkillAnalysis,
): ReportSummary {
  const P = (self: number, tc: number): Pair => ({ self, tc })

  const cs = c.blocks.self
  const ctc = c.blocks.tc

  // ── 실적현황 : 레포트!D26:M27 = 월평균 인/환산실적
  //   본인 = IF(경력위촉차월>5, 누계/6, 누계/경력위촉차월), TC = C분석!DK30·DL30 / 6 (항상 6으로 나눔)
  const selfMonths = ctx.f('months')
  const selfDivisor = selfMonths > 5 ? 6 : selfMonths
  const perf = {
    person: P(div(ctx.f('perfPerson'), selfDivisor), div(xround(ctx.tc('perfPerson'), 0), 6)),
    converted: P(div(ctx.f('perfConverted'), selfDivisor), div(xround(ctx.tc('perfConverted'), 0), 6)),
  }

  // ── 활동분석(전체) : 레포트!D14 = 장기이관제외건수 ÷ 장기이관제외고객
  const casesPerCustAll = P(
    div(ctx.f('longCntNet'), ctx.f('longCustNet')),
    div(xround(ctx.tc('longCntNet'), 0), xround(ctx.tc('longCustNet'), 0)),
  )

  // ── 시장분석 연계율 : 레포트!D16:N16 (M분석!DC27/DD27, DC32/DD32)
  const mSelf = m.mix[0]
  const mTc = m.mix[3]

  // ── 기술분석(전체) : 레포트!D20:N20 (S분석!BX24/CA24/CC24, BX28/CA28/CC28)
  const sAll = sk.amountAll
  const sSelfAll = sAll[0]
  const sTcAll = sAll[3]

  // ── 6개월 : 레포트!D36:N36 (S분석!BX29/CA29/CC29, BX30/CA30/CC30)
  const s6 = sk.amount6m
  const sSelf6 = s6[0]
  const sTc6 = s6[2]

  const pick = (arr: { label: string; share: number }[], label: string) =>
    arr.find((x) => x.label === label)?.share ?? 0

  const shareRow = (
    label: string,
    selfArr: { label: string; share: number }[],
    tcArr: { label: string; share: number }[],
  ) => ({ label, self: pick(selfArr, label), tc: pick(tcArr, label) })

  /* 건수 구성비의 TC 열은 원본이 일관되지 않다.
       레포트!J34 = M분석!DZ32 (TC)      간편
       레포트!K34 = M분석!EA32 (TC)      퍼펙트
       레포트!L34 = M분석!EC30 (차상급)  어린이  ← 머리글은 TC 인데 차상급을 본다
       레포트!M34 = M분석!EB30 (차상급)  스타    ←
       레포트!N34 = M분석!ED32 (TC)      운전자
       레포트!O34 = M분석!EE32 (TC)      실손
     신버전 워크북에도 그대로 남아 있어, 엑셀과 숫자를 맞추기 위해 원본대로 재현한다. */
  const countShareRow = (label: string) => ({
    label,
    self: pick(m.countShare.self, label),
    tc:
      label === '어린이' || label === '스타'
        ? pick(m.countShare.next, label)
        : pick(m.countShare.tc, label),
  })

  const critSelf = sk.critical[0]
  const critTc = sk.critical[2]

  const nc = (r: { 신규: number; 기존: number; 합계: number }) => ({
    nw: r.신규,
    old: r.기존,
    sum: r.합계,
  })

  return {
    overall: {
      customers: {
        long: P(cs.long, ctc.long),
        auto: P(cs.auto, ctc.auto),
        link: P(cs.both, ctc.both),
        total: P(cs.total, ctc.total),
        monthlyNew: P(cs.monthlyNew, ctc.monthlyNew),
      },
      casesPerCustomer: casesPerCustAll,
      mixRate: {
        longOnly: P(mSelf.longRate, mTc.longRate),
        autoOnly: P(mSelf.autoRate, mTc.autoRate),
        linkRate: P(cs.linkRate, mTc.linkRate),
      },
      silson: {
        self: m.silsonAll.self.map((x) => x.share),
        tc: m.silsonAll.tc.map((x) => x.share),
        selfTotal: m.silsonAll.selfTotal,
        tcTotal: m.silsonAll.tcTotal,
      },
      premium: {
        perCust: P(sSelfAll.perCust, sTcAll.perCust),
        perCase: P(sSelfAll.perCase, sTcAll.perCase),
        max: P(sSelfAll.max, sTcAll.max),
      },
    },

    recent: {
      perf,
      casesPerCustomer: P(a.perCustomer6m[0].perCust, a.perCustomer6m[2].perCust),
      newOld: {
        cust: { self: nc(a.newOldCust[0]), tc: nc(a.newOldCust[2]) },
        cases: { self: nc(a.newOldCases[0]), tc: nc(a.newOldCases[2]) },
      },
      monthlyCases: {
        general: P(a.byType[0].본인, a.byType[0].TC표준그룹),
        protect: P(a.byType[2].본인, a.byType[2].TC표준그룹),
        auto: P(a.byType[1].본인, a.byType[1].TC표준그룹),
      },
      premiumShare: ['간편', '퍼펙트', '어린이', '스타', '운전자', '실손'].map((l) =>
        shareRow(l, m.premiumShare.self, m.premiumShare.tc),
      ),
      countShare: ['간편', '퍼펙트', '어린이', '스타', '운전자', '실손'].map(countShareRow),
      premium: {
        perCust: P(sSelf6.perCust, sTc6.perCust),
        perCase: P(sSelf6.perCase, sTc6.perCase),
        max: P(sSelf6.max, sTc6.max),
      },
      productAvg: ['간편', '퍼펙트', '어린이', '스타', '운전자', '실손'].map((l) => {
        const r = sk.productAvg.find((x) => x.label === l)
        return { label: l, self: r?.본인 ?? 0, tc: r?.TC표준그룹 ?? 0 }
      }),
      critical: {
        cancer: {
          prem: P(critSelf.cancerPerCase, critTc.cancerPerCase),
          rate: P(critSelf.cancerRate, critTc.cancerRate),
          cases: P(critSelf.cancerCases, critTc.cancerCases),
        },
        heart: {
          prem: P(critSelf.heartPerCase, critTc.heartPerCase),
          rate: P(critSelf.heartRate, critTc.heartRate),
          cases: P(critSelf.heartCases, critTc.heartCases),
        },
      },
    },

    cams: { C: c.score, A: a.score, M: m.score, S: sk.score },
  }
}
