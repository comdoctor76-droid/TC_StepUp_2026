/* M분석 — Market[시장] (원본 차트 8개, 전부 원형) */

import { PieShare } from '../components/charts/PieShare'
import { ChartCard } from '../components/charts/Frame'
import { SimpleTable } from '../components/CompareTable'
import { GEN_COLORS } from '../components/charts/palette'
import { dec1, dec2, int, pct } from '../calc/format'
import type { FullAnalysis } from '../calc'

export function MarketTab({ A, dense }: { A: FullAnalysis; dense?: boolean }) {
  const m = A.market
  const name = A.profile.name

  const S = dense ? { pie: { w: 224, h: 150 }, gen: { w: 224, h: 152 } } : { pie: { h: 250 }, gen: { h: 250 } }

  const lbl = (l: string) => (l === name ? `${name} (본인)` : l)

  return (
    <>
      <h2 className="sec">▶ 장기 / 자동차 고객 및 연계고객 분포</h2>
      <p className="sec-note">※ TC 표준그룹 : 육성소득(500 ~ 700) 그룹</p>

      <SimpleTable
        dense={dense}
        head={['구분', '장기', '자동차', '연계고객', '장기비중', '자동차비중', '연계율']}
        rows={m.mix.map((r) => [
          lbl(r.label),
          int(r.long),
          int(r.auto),
          int(r.link),
          pct(r.longRate),
          pct(r.autoRate),
          pct(r.linkRate),
        ])}
      />

      <h2 className="sec">▶ 주력 인보험 보종별 건수 구성비율</h2>
      <div className="grid grid--3">
        <ChartCard title={`본인 (${name})`}>
          <PieShare {...S.pie} dense={dense} data={m.countShare.self} />
        </ChartCard>
        <ChartCard title={`동급 (${A.ctx.levelLabel})`}>
          <PieShare {...S.pie} dense={dense} data={m.countShare.peer} />
        </ChartCard>
        <ChartCard title="TC 표준그룹">
          <PieShare {...S.pie} dense={dense} data={m.countShare.tc} />
        </ChartCard>
      </div>

      <h2 className="sec">▶ 보장성 보험의 주요 상품별 보험료 구성비율</h2>
      <div className="grid grid--3">
        <ChartCard title={`본인 (${name})`}>
          <PieShare {...S.pie} dense={dense} data={m.premiumShare.self} />
        </ChartCard>
        <ChartCard title={`동급 (${A.ctx.levelLabel})`}>
          <PieShare {...S.pie} dense={dense} data={m.premiumShare.peer} />
        </ChartCard>
        <ChartCard title="TC 표준그룹">
          <PieShare {...S.pie} dense={dense} data={m.premiumShare.tc} />
        </ChartCard>
      </div>

      <h2 className="sec">▶ 플래너 · TC그룹 보유실손 비중 현황 (전체 기간)</h2>
      <div className="grid grid--3">
        <ChartCard title={`본인 · 총 ${int(m.silson.selfTotal)}건`}>
          <PieShare {...S.gen} dense={dense} data={m.silson.self} colors={GEN_COLORS} />
        </ChartCard>
        <ChartCard title={`TC 표준그룹 · 총 ${dec1(m.silson.tcTotal)}건`}>
          <PieShare {...S.gen} dense={dense} data={m.silson.tc} colors={GEN_COLORS} />
        </ChartCard>
        <SimpleTable
          dense={dense}
          caption="실손 세대별 비중 (5세대 포함)"
          head={['구분', '1세대', '2세대', '3세대', '4세대', '5세대']}
          rows={[
            ['본인', ...m.silsonAll.self.map((x) => pct(x.share))],
            ['TC', ...m.silsonAll.tc.map((x) => pct(x.share))],
          ]}
        />
      </div>

      <p className="score-line">
        <b>M 점수</b> {dec2(m.score)} <span>/ 2.00</span>
        <em>
          자동차비중 {dec2(m.scoreParts.autoRate)} · 일반보험료 {dec2(m.scoreParts.generalPrem)} ·
          퍼펙트 {dec2(m.scoreParts.perfect)} · 스타 {dec2(m.scoreParts.star)} · 어린이{' '}
          {dec2(m.scoreParts.kid)}
        </em>
      </p>
    </>
  )
}
