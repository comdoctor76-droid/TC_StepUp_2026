import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS, GRID, SERIES } from './palette'
import { ChartFrame, type ChartSize } from './Frame'

export interface Series {
  key: string
  color: string
}

const FONT = (dense?: boolean) => (dense ? 9 : 13)

/**
 * 다계열 막대 — 원본 C분석!chart5, A분석!chart13/14, S분석 등.
 * 카테고리 축이 있고 계열이 여럿인 경우.
 */
export function BarCompare({
  data,
  series,
  dense,
  stacked,
  format,
  showLegend = true,
  w,
  h,
}: ChartSize & {
  data: Record<string, string | number>[]
  series: Series[]
  dense?: boolean
  stacked?: boolean
  format?: (v: number) => string
  showLegend?: boolean
}) {
  const fs = FONT(dense)
  return (
    <ChartFrame w={w} h={h}>
      <BarChart data={data} margin={{ top: dense ? 14 : 18, right: 6, bottom: 2, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: fs, fill: AXIS }} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis hide />
        {!dense && <Tooltip formatter={(v) => (format ? format(Number(v)) : v)} />}
        {showLegend && (
          <Legend
            verticalAlign="bottom"
            height={dense ? 14 : 24}
            iconSize={dense ? 7 : 11}
            wrapperStyle={{ fontSize: fs }}
          />
        )}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={s.color}
            stackId={stacked ? 'a' : undefined}
            isAnimationActive={false}
            radius={stacked ? 0 : [3, 3, 0, 0]}
            maxBarSize={dense ? 22 : 46}
          >
            {!stacked && i === series.length - 1 && null}
            <LabelList
              dataKey={s.key}
              position={stacked ? 'center' : 'top'}
              style={{ fontSize: fs - 1, fill: stacked ? '#fff' : '#333', fontWeight: 600 }}
              formatter={(v: unknown) => (format ? format(Number(v)) : String(v))}
            />
          </Bar>
        ))}
      </BarChart>
    </ChartFrame>
  )
}

/**
 * 단일 지표를 본인/동급/TC 3막대로 비교 — 원본 A분석 chart7~12,
 * S분석 chart25~37 의 소형 다중 차트 형태.
 */
export function BarTriple({
  data,
  dense,
  format,
  w,
  h,
  colors = [SERIES.self, SERIES.peer, SERIES.tc],
}: ChartSize & {
  data: { name: string; value: number }[]
  dense?: boolean
  format?: (v: number) => string
  colors?: string[]
}) {
  const fs = FONT(dense)
  return (
    <ChartFrame w={w} h={h}>
      <BarChart data={data} margin={{ top: dense ? 15 : 20, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: fs - 1, fill: AXIS }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          interval={0}
        />
        <YAxis hide />
        {!dense && <Tooltip formatter={(v) => (format ? format(Number(v)) : v)} />}
        <Bar dataKey="value" isAnimationActive={false} radius={[3, 3, 0, 0]} maxBarSize={dense ? 26 : 54}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            style={{ fontSize: fs, fill: '#333', fontWeight: 700 }}
            formatter={(v: unknown) => (format ? format(Number(v)) : String(v))}
          />
        </Bar>
      </BarChart>
    </ChartFrame>
  )
}
