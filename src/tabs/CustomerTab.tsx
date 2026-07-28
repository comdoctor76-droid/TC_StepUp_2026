/* C분석 — Customer[고객] (원본 차트 5개) */

import { BarCompare, BarTriple } from '../components/charts/BarCompare'
import { LineTrend } from '../components/charts/LineTrend'
import { ChartCard } from '../components/charts/Frame'
import { SimpleTable } from '../components/CompareTable'
import { SERIES } from '../components/charts/palette'
import { PeriodNote, type Period } from '../components/PeriodPicker'
import { stockAt, windowOf } from '../calc/period'
import { dec1, dec2, int, ym, ymShort } from '../calc/format'
import type { FullAnalysis } from '../calc'

export function CustomerTab({
  A,
  dense,
  period,
}: {
  A: FullAnalysis
  dense?: boolean
  period?: Period
}) {
  const c = A.customer
  const b = c.blocks
  const name = A.profile.name

  // 인쇄물은 항상 원본과 같은 6개월 전체를 보여준다
  const w = windowOf(dense ? undefined : period, A.ctx.months)
  const trend = w.isFull ? c.trend : c.trend.filter((t) => w.months.includes(t.month))

  // 유지고객은 재고 — 선택 구간의 '종료월 시점' 값이 의미 있는 값이다.
  // 전체 구간이면 종료월 = 마지막 달이라 기존 blocks.self 와 완전히 같다.
  const selfLong = stockAt(c.series.long, w)
  const selfAuto = stockAt(c.series.auto, w)
  const selfBoth = stockAt(c.series.both, w)
  const selfTotal = selfLong + selfAuto - selfBoth
  /** 종료월 라벨 — 구간을 좁혔을 때만 붙인다 */
  const asOf = w.isFull ? '' : ` (${ym(w.months[w.months.length - 1])} 시점)`

  // 본인 막대만 종료월 값으로 바꾼다 (벤치마크는 월별 분해가 없어 비교 기준선으로 고정)
  const retainChart = w.isFull
    ? c.retainChart
    : c.retainChart.map((r) => ({
        ...r,
        본인: r.name === '장기' ? selfLong : r.name === '자동차' ? selfAuto : selfTotal,
      }))

  const S = dense
    ? { trio: { w: 224, h: 112 }, wide: { w: 700, h: 120 }, band: { w: 700, h: 126 } }
    : { trio: { h: 240 }, wide: { h: 260 }, band: { h: 280 } }

  return (
    <>
      {!dense && (
        <PeriodNote>
          {w.isFull ? (
            <>
              유지고객은 <b>재고</b>라 선택 구간의 <b>종료월 시점</b> 값으로 표시됩니다. 지금은
              저장된 6개월 전체({ym(A.ctx.months[0])} ~ {ym(A.ctx.months[A.ctx.months.length - 1])})
              라 마지막 달 기준입니다. 동급·차상급·TC는 월별 분해가 없어 비교 기준선으로
              고정되며, 월평균 신규고객·소득군별 항목은 원본이 전체기간 누계라 기간을 나눌 수
              없습니다.
            </>
          ) : (
            <>
              선택 구간 <b>{ym(w.months[0])} ~ {ym(w.months[w.months.length - 1])}</b> 기준입니다.
              유지고객군 표·막대그래프의 <b>본인</b> 값과 아래 추이 그래프가 이 구간을 따릅니다
              (유지고객은 재고라 종료월 시점 값). 동급·차상급·TC는 월별 분해가 없어 비교
              기준선으로 고정되며, 월평균 신규고객·소득군별 항목은 기간을 나눌 수 없습니다.
            </>
          )}
        </PeriodNote>
      )}

      <h2 className="sec">▶ 유지고객군 분석</h2>
      <p className="sec-note">
        ※ TC 표준그룹 : 육성소득(500 ~ 700) 그룹 · 이관제외 기준{asOf && ` · 본인 값은${asOf}`}
      </p>

      <SimpleTable
        dense={dense}
        head={['구분', '장기', '자동차', '연계고객', '총보유고객', '월평균 신규고객', '평균차월']}
        rows={[
          [`${name} (본인)`, int(selfLong), int(selfAuto), int(selfBoth), int(selfTotal), dec2(b.self.monthlyNew), int(A.profile.months)],
          [`동급 (${b.peer.label})`, int(b.peer.long), int(b.peer.auto), int(b.peer.both), int(b.peer.total), dec2(b.peer.monthlyNew), int(A.ctx.peer('months'))],
          [`차상급 (${b.next.label})`, int(b.next.long), int(b.next.auto), int(b.next.both), int(b.next.total), dec2(b.next.monthlyNew), int(A.ctx.next('months'))],
          ['TC 표준그룹', int(b.tc.long), int(b.tc.auto), int(b.tc.both), int(b.tc.total), dec2(b.tc.monthlyNew), int(A.ctx.tc('months'))],
        ]}
      />

      <div className="grid grid--3">
        <ChartCard title={`유지고객 (장기·자동차·총고객)${asOf}`}>
          <BarCompare
            {...S.trio}
            dense={dense}
            data={retainChart}
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

      <h2 className="sec">▶ 플래너 최근 유지고객 추이 (최근 {trend.length}개월)</h2>
      <ChartCard>
        {/* 원본 chart6(신·구 공통)은 본인 총유지고객만 그린다 (C분석!CU29:CZ29).
            TC 표준그룹(CU32:CZ32)은 자릿수가 크게 달라 같은 축에 두면 본인 추이가
            눌리므로, 원본대로 차트에서 빼고 아래 표에만 싣는다. */}
        <LineTrend
          {...S.wide}
          dense={dense}
          data={trend}
          series={[
            { key: '총유지', color: SERIES.self },
            { key: '장기', color: SERIES.tc, dashed: true },
          ]}
          format={(v) => int(v)}
          deltaKey="delta"
        />
      </ChartCard>

      {/* C분석!DC31:DG32 — 월별 증감 / 2개월 이동평균 */}
      <SimpleTable
        dense={dense}
        head={['구분', ...trend.map((t) => ymShort(t.month))]}
        rows={[
          ['총유지고객', ...trend.map((t) => int(t.총유지))],
          [
            '전월 대비',
            ...trend.map((t) =>
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
          ['2개월 평균', ...trend.map((t) => (t.movingAvg === null ? '-' : dec1(t.movingAvg)))],
          ['TC 표준그룹', ...trend.map((t) => int(t.TC표준그룹))],
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

    </>
  )
}
