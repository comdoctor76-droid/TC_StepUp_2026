/* M분석 — Market[시장] (원본 차트 8개, 전부 원형) */

import { PieShare } from '../components/charts/PieShare'
import { ChartCard } from '../components/charts/Frame'
import { SimpleTable } from '../components/CompareTable'
import { GEN_COLORS } from '../components/charts/palette'
import { PeriodNote, type Period } from '../components/PeriodPicker'
import { dec1, int, pct } from '../calc/format'
import type { FullAnalysis } from '../calc'

export function MarketTab({
  A,
  dense,
}: {
  A: FullAnalysis
  dense?: boolean
  /** 이 탭은 기간을 나눌 수 있는 데이터가 없어 값이 바뀌지 않는다 (안내만 표시) */
  period?: Period
}) {
  const m = A.market
  const name = A.profile.name

  const S = dense ? { pie: { w: 224, h: 162 }, gen: { w: 224, h: 162 } } : { pie: { h: 270 }, gen: { h: 270 } }

  const lbl = (l: string) => (l === name ? `${name} (본인)` : l)

  return (
    <>
      {!dense && (
        <PeriodNote>
          M분석은 원본 워크북이 <b>전체기간 누계</b> 하나만 제공해 기간을 나눌 수 없습니다.
          바꿀 수 있는 것이 없어 조회기간 선택을 두지 않았습니다.
        </PeriodNote>
      )}

      <h2 className="sec">▶ 보장성 보험의 주요 상품별 보험료 구성비율</h2>
      <div className="grid grid--3">
        <ChartCard title={`본인 (${name})`}>
          <PieShare {...S.pie} dense={dense} data={m.premiumShare.self} leaderLines />
        </ChartCard>
        <ChartCard title={`동급 (${A.ctx.levelLabel})`}>
          <PieShare {...S.pie} dense={dense} data={m.premiumShare.peer} leaderLines />
        </ChartCard>
        <ChartCard title="TC 표준그룹">
          <PieShare {...S.pie} dense={dense} data={m.premiumShare.tc} leaderLines />
        </ChartCard>
      </div>

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
          <PieShare {...S.pie} dense={dense} data={m.countShare.self} leaderLines />
        </ChartCard>
        <ChartCard title={`동급 (${A.ctx.levelLabel})`}>
          <PieShare {...S.pie} dense={dense} data={m.countShare.peer} leaderLines />
        </ChartCard>
        <ChartCard title="TC 표준그룹">
          <PieShare {...S.pie} dense={dense} data={m.countShare.tc} leaderLines />
        </ChartCard>
      </div>

      <h2 className="sec">▶ 플래너 · TC그룹 보유실손 비중 현황 (전체 기간)</h2>
      <div className="grid grid--3">
        <ChartCard title={`본인 · 총 ${int(m.silson.selfTotal)}건`}>
          <PieShare {...S.gen} dense={dense} data={m.silson.self} colors={GEN_COLORS} leaderLines />
        </ChartCard>
        <ChartCard title={`TC 표준그룹 · 총 ${dec1(m.silson.tcTotal)}건`}>
          <PieShare {...S.gen} dense={dense} data={m.silson.tc} colors={GEN_COLORS} leaderLines />
        </ChartCard>
        {/* 6열(구분+1~5세대)을 한 줄에 다 넣으면 좁은 3번째 칸에서 글자가 너무
            작아져 가독성이 떨어진다 — 1·2세대와 3·4·5세대 두 줄로 나눠 표시 */}
        <div className="silson-gen-tables">
          <SimpleTable
            dense={dense}
            wrap
            caption="실손 세대별 비중 (5세대 포함)"
            head={['구분', '1세대', '2세대']}
            rows={[
              ['본인', ...m.silsonAll.self.slice(0, 2).map((x) => pct(x.share))],
              ['TC', ...m.silsonAll.tc.slice(0, 2).map((x) => pct(x.share))],
            ]}
          />
          <SimpleTable
            dense={dense}
            wrap
            head={['구분', '3세대', '4세대', '5세대']}
            rows={[
              ['본인', ...m.silsonAll.self.slice(2, 5).map((x) => pct(x.share))],
              ['TC', ...m.silsonAll.tc.slice(2, 5).map((x) => pct(x.share))],
            ]}
          />
        </div>
      </div>
    </>
  )
}
