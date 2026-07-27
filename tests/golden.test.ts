/* ══════════════════════════════════════════════════════════════════════
   골든 테스트 — 원본 워크북에 캐시된 한 플래너(1b4503)의 셀 값과 대조.
   기대값 옆의 주석이 원본 셀 주소다.

   픽스처는 저장소에 커밋되므로 **신원 필드(사번·성명·입사일자·소속)만 익명화**했다.
   모든 수치는 원본 그대로라 검증력은 그대로다.
   신원 필드도 서로 다른 값이라 VLOOKUP 열 매핑은 계속 검증된다.
   ══════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest'
import fixture from './fixtures/demo01.json'
import { analyze } from '../src/calc'
import type { BenchRow, IncomeMap, PlannerRow } from '../src/data/schema'
import { allShardIds, normalizeCode, shardIdOf } from '../src/data/shard'

const A = analyze(
  fixture.code,
  fixture.planner as PlannerRow,
  fixture.benchmarks as Record<string, BenchRow>,
  fixture.incomeMap as IncomeMap,
  fixture.months,
)

/** 상대오차 1e-9 */
const near = (actual: number, expected: number, tol = 1e-9) => {
  const scale = Math.max(1, Math.abs(expected))
  expect(Math.abs(actual - expected) / scale).toBeLessThan(tol)
}

describe('인적사항 (레포트!B5:N6)', () => {
  const p = A.profile
  it('지역단 / 비전센터 / 지점 / 성명', () => {
    expect(p.hq).toBe('샘플본부') // 레포트!B6  ← input D열
    expect(p.visionCenter).toBe('샘플비전센터') // 레포트!C6  ← input G열
    expect(p.branch).toBe('샘플지점') // 레포트!D6  ← input H열
    expect(p.name).toBe('홍길동') // 레포트!F6  ← input L열(대표자명)
  })
  it('입사일자 / 육성소득 / 차월', () => {
    expect(p.hireDate).toBe('20200101') // 레포트!I6  ← input J열
    expect(p.incomeRaw).toBe('400만원이상') // 레포트!K6
    expect(p.months).toBe(56) // 레포트!M6
  })
  it('총 보유고객 / 인당 평균 보험료 (개요!CT14, CW14)', () => {
    expect(p.totalCustomers).toBe(204)
    near(p.premPerCustomer, 99430.40404040404)
  })
  it('소득 백분위 (개요!B19:F19)', () => {
    near(p.percentile!.rate, 0.22475229244876607)
    expect(p.percentile!.band).toBe('상위')
    expect(p.percentile!.cmp).toBe('이하')
  })
})

describe('비교군 라벨 체인 (C분석!CH22 → CH24 → CH26)', () => {
  it('동급 / 차상급 / TC', () => {
    expect(A.ctx.levelLabel).toBe('400만원이상')
    expect(A.ctx.nextLabel).toBe('500만원이상')
    expect(A.ctx.tcLabel).toBe('TC 표준그룹')
  })

  it('묶음 라벨로 접히는 구간 (소득별Data!C2:F28)', () => {
    const g = fixture.incomeMap.groupOf as Record<string, string>
    expect(g['600만원이상']).toBe('500만원이상')
    expect(g['800만원이상']).toBe('700만원이상')
    expect(g['900만원이상']).toBe('700만원이상')
    expect(g['100만원미만']).toBe('100만원미만')
    expect(g['3000만원이상']).toBe('3,000만원이상')
  })

  it('차상급 체인이 14개 구간 전부에서 끊기지 않는다 (소득별Data!C33:E46)', () => {
    const nx = fixture.incomeMap.nextLevel as Record<string, string>
    const labels = [
      '100만원미만', '100만원이상', '200만원이상', '300만원이상', '400만원이상',
      '500만원이상', '600만원이상', '700만원이상', '800만원이상', '900만원이상',
      '1,000만원이상', '1,500만원이상', '2,000만원이상', '3,000만원이상',
    ]
    for (const l of labels) {
      expect(nx[l], `nextLevel["${l}"]`).toBeTruthy()
      expect(fixture.benchmarks, `benchmarks["${nx[l]}"]`).toHaveProperty(nx[l])
    }
  })
})

describe('현황Ⅰ 전체 (레포트!D13:N20)', () => {
  const o = A.report.overall
  it('유지고객 — 본인 (D13,E13,F13,G13,H13)', () => {
    expect(o.customers.long.self).toBe(198)
    expect(o.customers.auto.self).toBe(16)
    expect(o.customers.link.self).toBe(10)
    expect(o.customers.total.self).toBe(204)
    near(o.customers.monthlyNew.self, 3.54)
  })
  it('유지고객 — TC 표준그룹 (J13,K13,L13,M13,N13)', () => {
    expect(o.customers.long.tc).toBe(248)
    expect(o.customers.auto.tc).toBe(70)
    expect(o.customers.link.tc).toBe(36)
    expect(o.customers.total.tc).toBe(282)
    near(o.customers.monthlyNew.tc, 1.26)
  })
  it('(장기)고객당 건수 (D14 / J14)', () => {
    near(o.casesPerCustomer.self, 1.8232323232323233)
    near(o.casesPerCustomer.tc, 2.588709677419355)
  })
  it('보종별 연계율 (D16,F16,H16 / J16,L16,N16)', () => {
    near(o.mixRate.longOnly.self, 0.9252336448598131)
    near(o.mixRate.autoOnly.self, 0.07476635514018691)
    near(o.mixRate.linkRate.self, 0.050505050505050504)
    near(o.mixRate.longOnly.tc, 0.779874213836478)
    near(o.mixRate.autoOnly.tc, 0.22012578616352202)
    near(o.mixRate.linkRate.tc, 0.14516129032258066)
  })
  it('실손보유비중 (D18:I18 / J18:O18)', () => {
    const s = o.silson
    near(s.self[0], 0.03333333333333333)
    near(s.self[1], 0.03333333333333333)
    near(s.self[2], 0)
    near(s.self[3], 0.9333333333333333)
    near(s.self[4], 0)
    expect(s.selfTotal).toBe(30)
    near(s.tc[0], 0.14577987987962168)
    near(s.tc[1], 0.39403623678766575)
    near(s.tc[2], 0.2564451544752097)
    near(s.tc[3], 0.20177338196879935)
    near(s.tc[4], 0.0019653468887035155)
    near(s.tcTotal, 282.1956365479918)
  })
  it('장기월납 평균 보험료 (D20,F20,H20 / J20,L20,N20)', () => {
    near(o.premium.perCust.self, 99430.40404040404)
    near(o.premium.perCase.self, 54535.23545706371)
    expect(o.premium.max.self).toBe(250210)
    near(o.premium.perCust.tc, 174552.5766129032)
    near(o.premium.perCase.tc, 67428.40965732087)
    expect(o.premium.max.tc).toBe(990658)
  })
})

describe('현황Ⅱ 6개월 (레포트!D25:O41)', () => {
  const r = A.report.recent
  it('(장기)고객당 건수 (D25 / J25)', () => {
    near(r.casesPerCustomer.self, 1.1515151515151516)
    near(r.casesPerCustomer.tc, 1.4444444444444444)
  })
  it('신규/기존 고객·건수 (D28:O28)', () => {
    near(r.newOld.cust.self.nw, 2.8333333333333335)
    near(r.newOld.cust.self.old, 2.3333333333333335)
    near(r.newOld.cust.self.sum, 5.166666666666667)
    near(r.newOld.cases.self.nw, 3.3333333333333335)
    near(r.newOld.cases.self.old, 3)
    near(r.newOld.cases.self.sum, 6.333333333333334)
    near(r.newOld.cust.tc.nw, 1.7049705850617813)
    near(r.newOld.cust.tc.old, 2.630943933783126)
    near(r.newOld.cust.tc.sum, 4.335914518844907)
    near(r.newOld.cases.tc.nw, 2.4631563490669834)
    near(r.newOld.cases.tc.old, 3.9770908856083387)
    near(r.newOld.cases.tc.sum, 6.440247234675322)
  })
  it('월평균건수 (D30,F30,H30 / J30,L30,N30)', () => {
    near(r.monthlyCases.general.self, 0.3)
    near(r.monthlyCases.protect.self, 6.3)
    near(r.monthlyCases.auto.self, 1.3)
    near(r.monthlyCases.general.tc, 1.9525061383966609)
    near(r.monthlyCases.protect.tc, 6.387593170224174)
    near(r.monthlyCases.auto.tc, 9.671983783466763)
  })
  it('주력상품 보험료 구성비율 (D32:O32)', () => {
    const g = (l: string) => r.premiumShare.find((x) => x.label === l)!
    near(g('간편').self, 0.8630464982860069)
    near(g('퍼펙트').self, 0.05583397736486006)
    near(g('어린이').self, 0)
    near(g('스타').self, 0)
    near(g('운전자').self, 0.08111952434913304)
    near(g('실손').self, 0)
    near(g('간편').tc, 0.6094999958282119)
    near(g('퍼펙트').tc, 0.14806202878006816)
    near(g('어린이').tc, 0.03033285160159336)
    near(g('스타').tc, 0.10547070724103845)
    near(g('운전자').tc, 0.059278913016461876)
    near(g('실손').tc, 0.047355503532626235)
  })
  it('주력상품 건수 구성비율 (D34:O34)', () => {
    const g = (l: string) => r.countShare.find((x) => x.label === l)!
    near(g('간편').self, 0.7352941176470589)
    near(g('퍼펙트').self, 0.029411764705882353)
    near(g('운전자').self, 0.23529411764705882)
    near(g('간편').tc, 0.4666666666666667)
    near(g('퍼펙트').tc, 0.1)
    near(g('운전자').tc, 0.16666666666666666)
    near(g('실손').tc, 0.13333333333333333)
    // ⚠️ 원본 레포트!L34/M34 는 TC(32행) 대신 차상급(30행)을 참조하는 오류가 있어
    //    어린이 0.034483 / 스타 0.103448 로 표시된다.
    //    이 앱은 표 머리글대로 TC 값을 쓴다 (M분석!EC32 / EB32).
    near(g('어린이').tc, 0.03333333333333333)
    near(g('스타').tc, 0.1)
  })
  it('장기월납 평균 보험료 6개월 (D36,F36,H36 / J36,L36,N36)', () => {
    near(r.premium.perCust.self, 69631.21212121213)
    near(r.premium.perCase.self, 60469.21052631579)
    expect(r.premium.max.self).toBe(308870)
    near(r.premium.perCust.tc, 116327.11111111111)
    near(r.premium.perCase.tc, 80534.15384615384)
    expect(r.premium.max.tc).toBe(553083)
  })
  it('주력상품 평균 보험료 (D38:O38)', () => {
    const g = (l: string) => r.productAvg.find((x) => x.label === l)!
    near(g('간편').self, 72810.4)
    near(g('퍼펙트').self, 117760)
    near(g('운전자').self, 21386.25)
    near(g('간편').tc, 99139.57142857143)
    near(g('퍼펙트').tc, 112389)
    near(g('어린이').tc, 69074)
    near(g('스타').tc, 80059.33333333333)
    near(g('운전자').tc, 26998)
    near(g('실손').tc, 26959.5)
  })
  it('주요치료비 부보율/평균 보험료 (D41:O41)', () => {
    const c = r.critical
    near(c.cancer.prem.self, 19870.80794832318)
    near(c.cancer.rate.self, 0.13157890166204747)
    near(c.cancer.cases.self, 4.999998)
    near(c.heart.prem.self, 13303.878325969581)
    near(c.heart.rate.self, 0.21052627423822498)
    near(c.heart.cases.self, 7.999998000000001)
    near(c.cancer.prem.tc, 28199.868011961375)
    near(c.cancer.rate.tc, 0.31941859322503763)
    near(c.cancer.cases.tc, 12.447505068148217)
    near(c.heart.prem.tc, 14495.088855884465)
    near(c.heart.rate.tc, 0.23952717670464221)
    near(c.heart.cases.tc, 9.334195971145995)
  })
})

describe('C분석', () => {
  it('6개월 유지고객 추이 (C분석!CU29:CZ29)', () => {
    expect(A.customer.trend.map((t) => t.총유지)).toEqual([190, 192, 194, 195, 199, 204])
  })
  it('소득군별 평균 보유고객 (C분석!CG53:CI62)', () => {
    const b = A.customer.bandChart
    expect(b[0]).toMatchObject({ name: '100↓', 장기: 18, 자동차: 4, 총고객: 20 })
    expect(b[4]).toMatchObject({ name: '400↑', 장기: 160, 자동차: 42, 총고객: 181 })
    expect(b[7]).toMatchObject({ name: '1,000↑', 장기: 408, 자동차: 123, 총고객: 468 })
  })
  it('C 점수 (C분석!CS50) = 2', () => {
    near(A.customer.score, 2)
  })
})

describe('A분석', () => {
  it('전체 인당건수 (A분석!DC25 / DC26 / DC27)', () => {
    near(A.action.perCustomerAll[0].perCust, 1.8232323232323233)
    near(A.action.perCustomerAll[1].perCust, 2.55625)
    near(A.action.perCustomerAll[3].perCust, 2.588709677419355)
  })
  it('6개월 인당건수 (A분석!DC30 / DC31 / DC32)', () => {
    near(A.action.perCustomer6m[0].perCust, 1.1515151515151516)
    near(A.action.perCustomer6m[1].perCust, 1.5263157894736843)
    near(A.action.perCustomer6m[2].perCust, 1.4444444444444444)
  })
  it('보종별 월평균 건수 계 (A분석!DJ25 / DJ26 / DJ27)', () => {
    const t = A.action.byType.find((x) => x.key === 'total')!
    near(t.본인, 7.9)
    near(t.동급, 11.724550898203628)
    near(t.TC표준그룹, 18.012083092087597)
  })
  it('월별 장기 건수 추이 본인 (Q7 장기건수)', () => {
    expect(A.action.trend.map((t) => t.건수본인)).toEqual([5, 5, 6, 6, 8, 8])
    expect(A.action.trend.map((t) => t.고객본인)).toEqual([4, 4, 6, 5, 8, 8])
  })
  it('A 점수 (A분석!DT43) = 1', () => {
    near(A.action.score, 1)
  })
})

describe('M분석', () => {
  it('인보험 건수 구성비 본인 (M분석!DZ27:EE27)', () => {
    const g = (l: string) => A.market.countShare.self.find((x) => x.label === l)!.share
    near(g('간편'), 0.7352941176470589)
    near(g('퍼펙트'), 0.029411764705882353)
    near(g('운전자'), 0.23529411764705882)
  })
  it('M 점수 (M분석!EF31)', () => {
    near(A.market.score, 0.6454106471107189)
  })
})

describe('S분석', () => {
  it('전체 인당/건당/최고 (S분석!BX24, CA24, CC24)', () => {
    const s = A.skill.amountAll[0]
    near(s.perCust, 99430.40404040404)
    near(s.perCase, 54535.23545706371)
    expect(s.max).toBe(250210)
  })
  it('동급 전체 (S분석!BX25, CA25, CC25)', () => {
    const s = A.skill.amountAll[1]
    near(s.perCust, 167685.88125)
    near(s.perCase, 65598.38875305624)
    expect(s.max).toBe(777277)
  })
  it('상품별 평균 보험료 동급 (S분석!CV25:DA25)', () => {
    const g = (l: string) => A.skill.productAvg.find((x) => x.label === l)!
    near(g('간편').동급, 98416.3)
    near(g('퍼펙트').동급, 127873.5)
    near(g('스타').동급, 90727)
    near(g('어린이').동급, 51698)
    near(g('운전자').동급, 27131.75)
    near(g('실손').동급, 24639.333333333332)
  })
  it('암·심뇌 동급 (S분석!DG25, DH25, DI25, DJ25)', () => {
    const c = A.skill.critical[1]
    near(c.cancerRate, 0.33223394259268235)
    near(c.heartRate, 0.2511021866964201)
    near(c.cancerPerCase, 27647.667144879022)
    near(c.heartPerCase, 14165.150395674715)
  })
  it('S 점수는 원본 산식 유실로 null', () => {
    expect(A.skill.score).toBeNull()
  })
})

describe('샤딩', () => {
  it('사번 정규화는 대소문자를 무시한다', () => {
    expect(normalizeCode('1B4503')).toBe('1b4503')
    expect(shardIdOf('1B4503')).toBe(shardIdOf('1b4503'))
  })
  it('샤드 ID 는 000~255 범위의 3자리', () => {
    const ids = allShardIds()
    expect(ids).toHaveLength(256)
    expect(ids[0]).toBe('000')
    expect(ids[255]).toBe('255')
    for (const c of ['demo01', '000008', '014210', 'zz9999', '']) {
      expect(ids).toContain(shardIdOf(c))
    }
  })
})
