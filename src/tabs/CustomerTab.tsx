/* C분석 — Customer[고객] (원본 차트 5개) */

import { BarCompare, BarTriple } from '../components/charts/BarCompare'
import { LineTrend } from '../components/charts/LineTrend'
import { ChartCard } from '../components/charts/Frame'
import { SimpleTable } from '../components/CompareTable'
import { SERIES } from '../components/charts/palette'
import { dec1, dec2, int, ymShort } from '../calc/format'
import type { FullAnalysis } from '../calc'

export function CustomerTab({ A, dense }: { A: FullAnalysis; dense?: boolean }) {
  const c = A.customer
  const b = c.blocks
  const name = A.profile.name

  const S = dense
    ? { trio: { w: 224, h: 146 }, wide: { w: 700, h: 150 }, band: { w: 700, h: 158 } }
    : { trio: { h: 240 }, wide: { h: 260 }, band: { h: 280 } }

  return (
    <>
      <h2 className="sec">▶ 유지고객군 분석</h2>
      <p className="sec-note">※ TC 표준그룹 : 육성소득(500 ~ 700) 그룹 · 이관제외 기준</p>

      <SimpleTable
        dense={dense}
        head={['구분', '장기', '자동차', '연계고객', '총보유고객', '월평균 신규고객', '평균차월']}
        rows={[
          [`${name} (본인)`, int(b.self.long), int(b.self.auto), int(b.self.both), int(b.self.total), dec2(b.self.monthlyNew), int(A.profile.months)],
          [`동급 (${b.peer.label})`, int(b.peer.long), int(b.peer.auto), int(b.peer.both), int(b.peer.total), dec2(b.peer.monthlyNew), int(A.ctx.peer('months'))],
          [`차상급 (${b.next.label})`, int(b.next.long), int(b.next.auto), int(b.next.both), int(b.next.total), dec2(b.next.monthlyNew), int(A.ctx.next('months'))],
          ['TC 표준그룹', int(b.tc.long), int(b.tc.auto), int(b.tc.both), int(b.tc.total), dec2(b.tc.monthlyNew), int(A.ctx.tc('months'))],
        ]}
      />

      <div className="grid grid--3">
        <ChartCard title="유지고객 (장기·자동차·총고객)">
          <BarCompare
            {...S.trio}
            dense={dense}
            data={c.retainChart}
            series={[
              { key: '본인', color: SERIES.self },
              { key: '동급', color: SERIES.peer },
              { key: 'TC표준그룹', color: SERIES.tc },
            ]}
            format={(v) => int(v)}
          />
        </ChartCard>

        <ChartCard title="월평균 신규고객 유치인원">
          <BarTriple {...S.trio} dense={dense} data={c.monthlyNewChart} format={(v) => dec2(v)} />
        </ChartCard>

        <ChartCard title="연계고객 (장기 + 자동차)">
          <BarTriple {...S.trio} dense={dense} data={c.linkChart} format={(v) => int(v)} />
        </ChartCard>
      </div>

      <h2 className="sec">▶ 플래너 최근 유지고객 추이</h2>
      <ChartCard>
        {/* 원본 chart6(신·구 공통)은 본인 총유지고객만 그린다 (C분석!CU29:CZ29).
            TC 표준그룹(CU32:CZ32)은 자릿수가 크게 달라 같은 축에 두면 본인 추이가
            눌리므로, 원본대로 차트에서 빼고 아래 표에만 싣는다. */}
        <LineTrend
          {...S.wide}
          dense={dense}
          data={c.trend}
          series={[
            { key: '총유지', color: SERIES.self },
            { key: '장기', color: SERIES.tc, dashed: true },
          ]}
          format={(v) => int(v)}
        />
      </ChartCard>

      {/* C분석!DC31:DG32 — 월별 증감 / 2개월 이동평균 */}
      <SimpleTable
        dense={dense}
        head={['구분', ...c.trend.map((t) => ymShort(t.month))]}
        rows={[
          ['총유지고객', ...c.trend.map((t) => int(t.총유지))],
          [
            '전월 대비',
            ...c.trend.map((t) =>
              t.delta === null ? (
                '-'
              ) : t.delta > 0 ? (
                <span className="pos">▲ {int(t.delta)}명</span>
              ) : t.delta < 0 ? (
                <span className="neg">▼ {int(-t.delta)}명</span>
              ) : (
                '-'
              ),
            ),
          ],
          ['2개월 평균', ...c.trend.map((t) => (t.movingAvg === null ? '-' : dec1(t.movingAvg)))],
          ['TC 표준그룹', ...c.trend.map((t) => int(t.TC표준그룹))],
        ]}
      />

      <h2 className="sec">▣ 참고 : 소득군별 평균 보유고객 인원 현황</h2>
      <ChartCard>
        <BarCompare
          {...S.band}
          dense={dense}
          data={c.bandChart}
          series={[
            { key: '장기', color: SERIES.self },
            { key: '자동차', color: SERIES.tc },
          ]}
          format={(v) => int(v)}
        />
      </ChartCard>

      <div className="grid grid--2">
        <SimpleTable
          dense={dense}
          caption="고객 구성 (이관 포함)"
          head={['개인고객', '법인고객', '우수고객']}
          rows={[[int(c.composition.indiv), int(c.composition.corp), int(c.composition.vip)]]}
        />
        <SimpleTable
          dense={dense}
          caption="이관 현황"
          head={['장기이관 고객', '장기이관 건수', '자동차이관 고객']}
          rows={[
            [
              int(c.composition.transferLongCust),
              int(c.composition.transferLongCnt),
              int(c.composition.transferAutoCust),
            ],
          ]}
        />
      </div>

      <p className="score-line">
        <b>C 점수</b> {dec2(c.score)} <span>/ 2.00</span>
        <em>
          보유량 지수 {dec2(c.scoreParts.volumeIndex)} · 신규고객 격차{' '}
          {dec2(c.scoreParts.newCustGap)}
        </em>
      </p>
    </>
  )
}
