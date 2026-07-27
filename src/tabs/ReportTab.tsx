/* 레포트 — 요약 (원본 레포트 시트, 차트 없음 + CAMS 레이더) */

import { CompareTable, type Group } from '../components/CompareTable'
import { RadarCAMS } from '../components/charts/RadarCAMS'
import { dec1, dec2, int, pct, won } from '../calc/format'
import type { FullAnalysis } from '../calc'

const sign = (a: number, b: number) => (a > b ? 1 : a < b ? -1 : 0)

export function ReportTab({ A, dense }: { A: FullAnalysis; dense?: boolean }) {
  const { overall: o, recent: r, cams } = A.report
  const p = A.profile

  // ── ■ 현황Ⅰ (전체) ────────────────────────────────────────────────
  const groupsI: Group[] = [
    {
      section: '고객분석',
      title: '유지고객(명)',
      note: '※ 이관제외',
      cells: [
        { label: '장기', self: int(o.customers.long.self), tc: int(o.customers.long.tc), sign: sign(o.customers.long.self, o.customers.long.tc) },
        { label: '자동차', self: int(o.customers.auto.self), tc: int(o.customers.auto.tc), sign: sign(o.customers.auto.self, o.customers.auto.tc) },
        { label: '연계고객', self: int(o.customers.link.self), tc: int(o.customers.link.tc), sign: sign(o.customers.link.self, o.customers.link.tc) },
        { label: '총고객', self: int(o.customers.total.self), tc: int(o.customers.total.tc), sign: sign(o.customers.total.self, o.customers.total.tc) },
        { label: '월 신규고객', self: dec2(o.customers.monthlyNew.self), tc: dec2(o.customers.monthlyNew.tc), sign: sign(o.customers.monthlyNew.self, o.customers.monthlyNew.tc) },
      ],
    },
    {
      section: '활동분석',
      title: '(장기)고객당 건수',
      cells: [
        { label: '인당건수', self: dec2(o.casesPerCustomer.self), tc: dec2(o.casesPerCustomer.tc), sign: sign(o.casesPerCustomer.self, o.casesPerCustomer.tc) },
      ],
    },
    {
      section: '시장분석',
      title: '보종별 연계율',
      cells: [
        { label: '장기(단독)', self: pct(o.mixRate.longOnly.self), tc: pct(o.mixRate.longOnly.tc) },
        { label: '자동차(단독)', self: pct(o.mixRate.autoOnly.self), tc: pct(o.mixRate.autoOnly.tc) },
        { label: '연계율', self: pct(o.mixRate.linkRate.self), tc: pct(o.mixRate.linkRate.tc), sign: sign(o.mixRate.linkRate.self, o.mixRate.linkRate.tc) },
      ],
    },
    {
      section: '시장분석',
      title: '실손보유비중',
      cells: [
        ...['1세대', '2세대', '3세대', '4세대', '5세대'].map((g, i) => ({
          label: g,
          self: pct(o.silson.self[i]),
          tc: pct(o.silson.tc[i]),
        })),
        { label: '총 건수', self: int(o.silson.selfTotal), tc: int(o.silson.tcTotal) },
      ],
    },
    {
      section: '기술분석',
      title: '장기월납 평균 보험료',
      cells: [
        { label: '인당', self: won(o.premium.perCust.self), tc: won(o.premium.perCust.tc), sign: sign(o.premium.perCust.self, o.premium.perCust.tc) },
        { label: '건당', self: won(o.premium.perCase.self), tc: won(o.premium.perCase.tc), sign: sign(o.premium.perCase.self, o.premium.perCase.tc) },
        { label: '최고', self: won(o.premium.max.self), tc: won(o.premium.max.tc), sign: sign(o.premium.max.self, o.premium.max.tc) },
      ],
    },
  ]

  // ── ■ 현황Ⅱ (6개월) ───────────────────────────────────────────────
  const groupsII: Group[] = [
    {
      section: '활동분석',
      title: '(장기)고객당 건수',
      cells: [
        { label: '인당건수', self: dec2(r.casesPerCustomer.self), tc: dec2(r.casesPerCustomer.tc), sign: sign(r.casesPerCustomer.self, r.casesPerCustomer.tc) },
      ],
    },
    {
      section: '활동분석',
      title: '신규/기존 (장기)고객·건수',
      cells: [
        { label: '고객 신규', self: dec2(r.newOld.cust.self.nw), tc: dec2(r.newOld.cust.tc.nw), sign: sign(r.newOld.cust.self.nw, r.newOld.cust.tc.nw) },
        { label: '고객 기존', self: dec2(r.newOld.cust.self.old), tc: dec2(r.newOld.cust.tc.old) },
        { label: '고객 합계', self: dec2(r.newOld.cust.self.sum), tc: dec2(r.newOld.cust.tc.sum), sign: sign(r.newOld.cust.self.sum, r.newOld.cust.tc.sum) },
        { label: '가입 신규', self: dec2(r.newOld.cases.self.nw), tc: dec2(r.newOld.cases.tc.nw), sign: sign(r.newOld.cases.self.nw, r.newOld.cases.tc.nw) },
        { label: '가입 기존', self: dec2(r.newOld.cases.self.old), tc: dec2(r.newOld.cases.tc.old) },
        { label: '가입 합계', self: dec2(r.newOld.cases.self.sum), tc: dec2(r.newOld.cases.tc.sum), sign: sign(r.newOld.cases.self.sum, r.newOld.cases.tc.sum) },
      ],
    },
    {
      section: '활동분석',
      title: '월평균건수',
      cells: [
        { label: '일반', self: dec1(r.monthlyCases.general.self), tc: dec1(r.monthlyCases.general.tc), sign: sign(r.monthlyCases.general.self, r.monthlyCases.general.tc) },
        { label: '장기', self: dec1(r.monthlyCases.protect.self), tc: dec1(r.monthlyCases.protect.tc), sign: sign(r.monthlyCases.protect.self, r.monthlyCases.protect.tc) },
        { label: '자동차', self: dec1(r.monthlyCases.auto.self), tc: dec1(r.monthlyCases.auto.tc), sign: sign(r.monthlyCases.auto.self, r.monthlyCases.auto.tc) },
      ],
    },
    {
      section: '시장분석',
      title: '주력상품 보험료 구성비율',
      cells: r.premiumShare.map((x) => ({
        label: x.label,
        self: pct(x.self),
        tc: pct(x.tc),
      })),
    },
    {
      section: '시장분석',
      title: '주력상품 건수 구성비율',
      cells: r.countShare.map((x) => ({
        label: x.label,
        self: pct(x.self),
        tc: pct(x.tc),
      })),
    },
    {
      section: '기술분석',
      title: '장기월납 평균 보험료',
      cells: [
        { label: '인당', self: won(r.premium.perCust.self), tc: won(r.premium.perCust.tc), sign: sign(r.premium.perCust.self, r.premium.perCust.tc) },
        { label: '건당', self: won(r.premium.perCase.self), tc: won(r.premium.perCase.tc), sign: sign(r.premium.perCase.self, r.premium.perCase.tc) },
        { label: '최고', self: won(r.premium.max.self), tc: won(r.premium.max.tc), sign: sign(r.premium.max.self, r.premium.max.tc) },
      ],
    },
    {
      section: '기술분석',
      title: '주력상품 평균 보험료',
      cells: r.productAvg.map((x) => ({
        label: x.label,
        self: won(x.self),
        tc: won(x.tc),
        sign: sign(x.self, x.tc),
      })),
    },
    {
      section: '기술분석',
      title: '주요치료비 부보율 / 평균 보험료',
      cells: [
        { label: '암 보험료', self: won(r.critical.cancer.prem.self), tc: won(r.critical.cancer.prem.tc), sign: sign(r.critical.cancer.prem.self, r.critical.cancer.prem.tc) },
        { label: '암 부보율', self: pct(r.critical.cancer.rate.self), tc: pct(r.critical.cancer.rate.tc), sign: sign(r.critical.cancer.rate.self, r.critical.cancer.rate.tc) },
        { label: '암 건수', self: dec1(r.critical.cancer.cases.self), tc: dec1(r.critical.cancer.cases.tc) },
        { label: '심뇌 보험료', self: won(r.critical.heart.prem.self), tc: won(r.critical.heart.prem.tc), sign: sign(r.critical.heart.prem.self, r.critical.heart.prem.tc) },
        { label: '심뇌 부보율', self: pct(r.critical.heart.rate.self), tc: pct(r.critical.heart.rate.tc), sign: sign(r.critical.heart.rate.self, r.critical.heart.rate.tc) },
        { label: '심뇌 건수', self: dec1(r.critical.heart.cases.self), tc: dec1(r.critical.heart.cases.tc) },
      ],
    },
  ]

  const pctText = p.percentile
    ? `현대해상 하이플래너 전체 기준 ${p.percentile.band} ${pct(p.percentile.rate)} ${p.percentile.cmp} 소득수준`
    : ''

  return (
    <>
      {/* 요약 스트립 */}
      <section className={`summary ${dense ? 'summary--dense' : ''}`}>
        <div className="summary__tiles">
          <Tile label="총 보유고객" value={int(p.totalCustomers)} unit="명" />
          <Tile label="인당 월납보험료" value={won(p.premPerCustomer)} unit="원" />
          <Tile label="월 신규고객" value={dec2(o.customers.monthlyNew.self)} unit="명" />
          <Tile label="고객당 건수" value={dec2(o.casesPerCustomer.self)} unit="건" />
        </div>
        <div className="summary__cams">
          <RadarCAMS cams={cams} dense={dense} w={dense ? 190 : undefined} h={dense ? 150 : 210} />
          <ul className="summary__scores">
            <li>
              <b>C</b> {dec2(cams.C)}
            </li>
            <li>
              <b>A</b> {dec2(cams.A)}
            </li>
            <li>
              <b>M</b> {dec2(cams.M)}
            </li>
            <li className="summary__scores--na">
              <b>S</b> 산식 미확정
            </li>
          </ul>
        </div>
      </section>

      {pctText && <p className="lede">{pctText}</p>}

      {/* 인쇄(A4)에서는 두 단으로 나눠 한 장에 담는다 */}
      <div className={dense ? 'rep-cols' : undefined}>
        <div>
          <h2 className="sec">■ 현황Ⅰ (전체)</h2>
          <p className="sec-note">※ TC 표준그룹 : 육성소득(500 ~ 700) 그룹 · 단위: 건, 명, 원</p>
          <CompareTable groups={groupsI} selfLabel={`${p.name} 플래너`} dense={dense} />
        </div>
        <div>
          <h2 className="sec">■ 현황Ⅱ (6개월)</h2>
          <p className="sec-note">
            ※ 6개월 산출기준 : 최근 6개월 합산 평균 ({A.ctx.months[0]} ~ {A.ctx.months[5]})
          </p>
          <CompareTable groups={groupsII} selfLabel={`${p.name} 플래너`} dense={dense} />
        </div>
      </div>
    </>
  )
}

function Tile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="tile">
      <span className="tile__label">{label}</span>
      <span className="tile__value num">
        {value}
        <i>{unit}</i>
      </span>
    </div>
  )
}
