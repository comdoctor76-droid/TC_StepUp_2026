/* A분석 — Action[활동] (원본 차트 10개) */

import { BarCompare, BarTriple } from '../components/charts/BarCompare'
import { LineTrend } from '../components/charts/LineTrend'
import { ChartCard } from '../components/charts/Frame'
import { SimpleTable } from '../components/CompareTable'
import { SERIES } from '../components/charts/palette'
import { PeriodNote, type Period } from '../components/PeriodPicker'
import { flowAvg, flowSum, windowOf } from '../calc/period'
import { dec1, dec2, int, ym } from '../calc/format'
import type { FullAnalysis } from '../calc'

export function ActionTab({
  A,
  dense,
  period,
}: {
  A: FullAnalysis
  dense?: boolean
  period?: Period
}) {
  const a = A.action
  const name = A.profile.name

  // 인쇄물은 항상 원본과 같은 '최근 6개월' 기준으로 고정한다
  const showAll = !dense && period?.mode === 'all'
  const perCust = showAll ? a.perCustomerAll : a.perCustomer6m
  const scope = showAll ? '전체기간' : '최근 6개월'

  const w = windowOf(dense ? undefined : period, A.ctx.months)
  const trend = w.isFull ? a.trend : a.trend.filter((t) => w.months.includes(t.month))
  // 장기건수는 흐름 — 구간 합계·월평균이 의미 있다 (calc/period.ts 참조)
  const cntSeries = a.trend.map((t) => t.건수본인)
  const rangeSum = flowSum(cntSeries, w)
  const rangeAvg = flowAvg(cntSeries, w)

  const S = dense
    ? {
        one: { w: 224, h: 106 },
        small: { w: 134, h: 84 },
        trio: { w: 224, h: 128 },
        wide: { w: 700, h: 102 },
      }
    : { one: { h: 230 }, small: { h: 200 }, trio: { h: 230 }, wide: { h: 260 } }

  const triple = (rows: { label: string; perCust: number }[]) =>
    rows.map((r) => ({ name: r.label === name ? '본인' : r.label, value: r.perCust }))

  return (
    <>
      {!dense && (
        <PeriodNote>
          <b>인당 가입건수</b> 그래프는 <b>{scope}</b> 기준입니다.{' '}
          {w.isFull ? (
            <>맨 아래 월별 추이는 저장된 6개월 전체를 보여줍니다.</>
          ) : (
            <>
              맨 아래 월별 추이와 그 요약은 선택 구간{' '}
              <b>{ym(w.months[0])} ~ {ym(w.months[w.months.length - 1])}</b> 기준입니다. 구간을
              좁혀도 인당 가입건수는 분모(중복 제외 고객수)가 구간별로 없어 다시 계산할 수 없어
              위 기준 그대로입니다.
            </>
          )}{' '}
          보종별·신규/기존 항목은 원본에 기간 구분이 없어 그대로입니다.
        </PeriodNote>
      )}

      <h2 className="sec">▶ 장기보험 신계약 가입고객수 및 1인당 계약건수</h2>
      <p className="sec-note">※ TC 표준그룹 : 육성소득(500 ~ 700) 그룹</p>

      <div className="grid grid--3">
        <ChartCard title={`인당 가입건수 (${scope})`}>
          <BarTriple {...S.one} dense={dense} data={triple(perCust)} format={(v) => dec2(v)} />
        </ChartCard>

        <div className="span2">
          <SimpleTable
            dense={dense}
            caption="전체 기간 / 최근 6개월 인당건수"
            head={['구분', '고객(전체)', '건수(전체)', '인당(전체)', '고객(6개월)', '건수(6개월)', '인당(6개월)']}
            rows={[
              ['본인', int(a.perCustomerAll[0].cust), int(a.perCustomerAll[0].cases), dec2(a.perCustomerAll[0].perCust), int(a.perCustomer6m[0].cust), int(a.perCustomer6m[0].cases), dec2(a.perCustomer6m[0].perCust)],
              ['동급', int(a.perCustomerAll[1].cust), int(a.perCustomerAll[1].cases), dec2(a.perCustomerAll[1].perCust), int(a.perCustomer6m[1].cust), int(a.perCustomer6m[1].cases), dec2(a.perCustomer6m[1].perCust)],
              ['차상급', int(a.perCustomerAll[2].cust), int(a.perCustomerAll[2].cases), dec2(a.perCustomerAll[2].perCust), '-', '-', '-'],
              ['TC 표준그룹', int(a.perCustomerAll[3].cust), int(a.perCustomerAll[3].cases), dec2(a.perCustomerAll[3].perCust), int(a.perCustomer6m[2].cust), int(a.perCustomer6m[2].cases), dec2(a.perCustomer6m[2].perCust)],
            ]}
          />
        </div>
      </div>

      <h2 className="sec">▶ 보종별 월평균 가입건수</h2>
      <div className="grid grid--5">
        {a.byType.map((t) => (
          <ChartCard key={t.key} title={t.label}>
            <BarTriple
              {...S.small}
              dense={dense}
              data={[
                { name: '본인', value: t.본인 },
                { name: '동급', value: t.동급 },
                { name: 'TC', value: t.TC표준그룹 },
              ]}
              format={(v) => dec1(v)}
            />
          </ChartCard>
        ))}
      </div>
      <p className="sec-note">※ &lsquo;계&rsquo;는 일반 + 자동차 + 보장성 합계 (원본 A분석!DJ25 기준, 인보험 제외)</p>

      <h2 className="sec">▶ 장기고객 신규 &amp; 기존고객 현황 (월평균)</h2>
      <div className="grid grid--3">
        <ChartCard title="고객수 (신규/기존)">
          <BarCompare
            {...S.trio}
            dense={dense}
            stacked
            data={a.newOldCust.map((r) => ({
              name: r.label === name ? '본인' : r.label === 'TC 표준그룹' ? 'TC' : r.label,
              신규: Number(r.신규.toFixed(2)),
              기존: Number(r.기존.toFixed(2)),
            }))}
            series={[
              { key: '신규', color: SERIES.self },
              { key: '기존', color: SERIES.tc },
            ]}
            format={(v) => dec1(v)}
          />
        </ChartCard>

        <ChartCard title="가입건수 (신규/기존)">
          <BarCompare
            {...S.trio}
            dense={dense}
            stacked
            data={a.newOldCases.map((r) => ({
              name: r.label === name ? '본인' : r.label === 'TC 표준그룹' ? 'TC' : r.label,
              신규: Number(r.신규.toFixed(2)),
              기존: Number(r.기존.toFixed(2)),
            }))}
            series={[
              { key: '신규', color: SERIES.self },
              { key: '기존', color: SERIES.tc },
            ]}
            format={(v) => dec1(v)}
          />
        </ChartCard>

        <ChartCard title="총 고객수">
          <BarTriple
            {...S.trio}
            dense={dense}
            data={a.newOldCust.map((r) => ({
              name: r.label === name ? '본인' : r.label === 'TC 표준그룹' ? 'TC' : r.label,
              value: r.합계,
            }))}
            format={(v) => dec2(v)}
          />
        </ChartCard>
      </div>

      <h2 className="sec">▶ 월별 장기 가입건수 추이</h2>
      <ChartCard>
        <LineTrend
          {...S.wide}
          dense={dense}
          data={trend}
          series={[
            { key: '건수본인', color: SERIES.self },
            { key: '건수TC', color: SERIES.tc, dashed: true },
            { key: '고객본인', color: SERIES.next },
          ]}
          format={(v) => dec1(v)}
        />
      </ChartCard>
      {!dense && (
        <p className="range-summary">
          선택 구간 {ym(w.months[0])} ~ {ym(w.months[w.months.length - 1])} ({w.months.length}개월)
          · 장기 가입건수 합계 <b>{dec1(rangeSum)}건</b> · 월평균 <b>{dec1(rangeAvg)}건</b>
          <em>앱이 월별 데이터로 계산한 값입니다</em>
        </p>
      )}

      <h2 className="sec">▣ 참고 : 소득군별 인당 가입건수</h2>
      <SimpleTable
        dense={dense}
        head={['구분', ...a.bandTable.map((b) => b.name)]}
        rows={[
          ['장기고객', ...a.bandTable.map((b) => int(b.cust))],
          ['장기건수', ...a.bandTable.map((b) => int(b.cases))],
          ['인당건수', ...a.bandTable.map((b) => dec2(b.perCust))],
        ]}
      />

      <p className="score-line">
        <b>A 점수</b> {dec2(a.score)} <span>/ 2.00</span>
        <em>
          일반 {a.scoreParts.general > 0 ? '+' : ''}
          {a.scoreParts.general} · 자동차 {a.scoreParts.auto > 0 ? '+' : ''}
          {a.scoreParts.auto} · 보장성 {a.scoreParts.protect > 0 ? '+' : ''}
          {a.scoreParts.protect} · 유지건수 {a.scoreParts.longCnt > 0 ? '+' : ''}
          {a.scoreParts.longCnt} · 신규고객 {a.scoreParts.newCust > 0 ? '+' : ''}
          {a.scoreParts.newCust}
        </em>
      </p>
    </>
  )
}
