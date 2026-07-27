/* S분석 — Skill[기술] (원본 차트 13개, 전부 막대) */

import { BarTriple } from '../components/charts/BarCompare'
import { ChartCard } from '../components/charts/Frame'
import { SimpleTable } from '../components/CompareTable'
import { dec1, pct, won } from '../calc/format'
import type { FullAnalysis } from '../calc'

/** 큰 금액은 축약해서 라벨이 겹치지 않게 */
const manwon = (v: number) => `${(v / 10000).toFixed(1)}만`

export function SkillTab({ A, dense }: { A: FullAnalysis; dense?: boolean }) {
  const s = A.skill
  const name = A.profile.name

  const S = dense
    ? { trio: { w: 224, h: 136 }, prod: { w: 112, h: 118 }, crit: { w: 168, h: 124 } }
    : { trio: { h: 230 }, prod: { h: 190 }, crit: { h: 210 } }

  const six = (pick: (r: (typeof s.amount6m)[number]) => number) =>
    s.amount6m.map((r) => ({
      name: r.label === name ? '본인' : r.label === 'TC 표준그룹' ? 'TC' : r.label,
      value: pick(r),
    }))

  return (
    <>
      <h2 className="sec">▶ 장기고객 인당 가입금액 / 건당 가입금액 / 건당 최대 보험료</h2>
      <p className="sec-note">※ 그래프는 최근 6개월 기준 · TC 표준그룹 : 육성소득(500 ~ 700) 그룹</p>

      <div className="grid grid--3">
        <ChartCard title="인당 금액 (6개월)">
          <BarTriple {...S.trio} dense={dense} data={six((r) => r.perCust)} format={manwon} />
        </ChartCard>
        <ChartCard title="건당 금액 (6개월)">
          <BarTriple {...S.trio} dense={dense} data={six((r) => r.perCase)} format={manwon} />
        </ChartCard>
        <ChartCard title="최고 금액 (6개월)">
          <BarTriple {...S.trio} dense={dense} data={six((r) => r.max)} format={manwon} />
        </ChartCard>
      </div>

      <SimpleTable
        dense={dense}
        caption="전체 기간 기준"
        head={['구분', '장기고객', '월납금액', '인당금액', '건수', '건당금액', '최고금액']}
        rows={s.amountAll.map((r) => [
          r.label === name ? `${name} (본인)` : r.label,
          dec1(r.cust),
          won(r.total),
          won(r.perCust),
          dec1(r.cases),
          won(r.perCase),
          won(r.max),
        ])}
      />

      <h2 className="sec">▶ 주력상품별 평균 신계약 보험료 현황</h2>
      <div className="grid grid--6">
        {s.productAvg.map((p) => (
          <ChartCard key={p.label} title={p.label}>
            <BarTriple
              {...S.prod}
              dense={dense}
              data={[
                { name: '본인', value: p.본인 },
                { name: '동급', value: p.동급 },
                { name: 'TC', value: p.TC표준그룹 },
              ]}
              format={manwon}
            />
          </ChartCard>
        ))}
      </div>

      <h2 className="sec">▶ 암 · 심뇌 주요치료비 부보율 및 건당 평균보험료 현황</h2>
      <div className="grid grid--4">
        <ChartCard title="암 건당 보험료">
          <BarTriple
            {...S.crit}
            dense={dense}
            data={s.critical.map((c) => ({
              name: c.label === name ? '본인' : c.label === 'TC 표준그룹' ? 'TC' : c.label,
              value: c.cancerPerCase,
            }))}
            format={manwon}
          />
        </ChartCard>
        <ChartCard title="암 부보율">
          <BarTriple
            {...S.crit}
            dense={dense}
            data={s.critical.map((c) => ({
              name: c.label === name ? '본인' : c.label === 'TC 표준그룹' ? 'TC' : c.label,
              value: c.cancerRate,
            }))}
            format={(v) => pct(v, 0)}
          />
        </ChartCard>
        <ChartCard title="심뇌 건당 보험료">
          <BarTriple
            {...S.crit}
            dense={dense}
            data={s.critical.map((c) => ({
              name: c.label === name ? '본인' : c.label === 'TC 표준그룹' ? 'TC' : c.label,
              value: c.heartPerCase,
            }))}
            format={manwon}
          />
        </ChartCard>
        <ChartCard title="심뇌 부보율">
          <BarTriple
            {...S.crit}
            dense={dense}
            data={s.critical.map((c) => ({
              name: c.label === name ? '본인' : c.label === 'TC 표준그룹' ? 'TC' : c.label,
              value: c.heartRate,
            }))}
            format={(v) => pct(v, 0)}
          />
        </ChartCard>
      </div>

      <SimpleTable
        dense={dense}
        caption="암 · 심뇌 상세 (계약수는 6개월 평균)"
        head={['구분', '암 건당', '암 부보율', '암 건수', '심뇌 건당', '심뇌 부보율', '심뇌 건수']}
        rows={s.critical.map((c) => [
          c.label === name ? `${name} (본인)` : c.label,
          won(c.cancerPerCase),
          pct(c.cancerRate),
          dec1(c.cancerCases),
          won(c.heartPerCase),
          pct(c.heartRate),
          dec1(c.heartCases),
        ])}
      />

      <p className="score-line score-line--na">
        <b>S 점수</b> 산식 미확정
        <em>
          원본 워크북의 참조가 유실되어(개요!BU25 = S분석!#REF!) 복원할 수 없습니다. 산식을 주시면
          반영합니다.
        </em>
      </p>
    </>
  )
}
