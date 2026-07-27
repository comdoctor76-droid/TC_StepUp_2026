import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { ymShort } from '../../calc/format'
import { AXIS, GRID } from './palette'
import { ChartFrame, type ChartSize } from './Frame'

export interface TrendSeries {
  key: string
  color: string
  dashed?: boolean
}

/** 월별 추이 — 원본 C분석!chart6, A분석!chart16 */
export function LineTrend({
  data,
  series,
  dense,
  format,
  w,
  h,
}: ChartSize & {
  /** month + 계열 값. null 은 그 지점을 건너뛴다 (첫 달 증감 등) */
  data: (Record<string, number | null> & { month: number })[]
  series: TrendSeries[]
  dense?: boolean
  format?: (v: number) => string
}) {
  const fs = dense ? 9 : 13
  return (
    <ChartFrame w={w} h={h}>
      <LineChart data={data} margin={{ top: dense ? 12 : 18, right: 10, bottom: 2, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={(v) => ymShort(Number(v))}
          tick={{ fontSize: fs, fill: AXIS }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: fs, fill: AXIS }}
          axisLine={false}
          tickLine={false}
          width={dense ? 26 : 40}
          domain={['auto', 'auto']}
        />
        {!dense && (
          <Tooltip
            labelFormatter={(v) => ymShort(Number(v))}
            formatter={(v) => (format ? format(Number(v)) : v)}
          />
        )}
        <Legend
          verticalAlign="bottom"
          height={dense ? 14 : 24}
          iconSize={dense ? 7 : 11}
          wrapperStyle={{ fontSize: fs }}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={dense ? 1.6 : 2.4}
            strokeDasharray={s.dashed ? '4 3' : undefined}
            dot={{ r: dense ? 2 : 3.5, fill: s.color, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartFrame>
  )
}
