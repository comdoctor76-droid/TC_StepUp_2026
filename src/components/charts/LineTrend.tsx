import { CartesianGrid, Legend, Line, LineChart, Tooltip, useXAxisScale, useYAxisScale, XAxis, YAxis } from 'recharts'
import { ymShort } from '../../calc/format'
import { AXIS, GRID } from './palette'
import { ChartFrame, type ChartSize } from './Frame'

export interface TrendSeries {
  key: string
  color: string
  dashed?: boolean
}

type TrendDatum = Record<string, number | null> & { month: number }

/**
 * 첫 계열의 연속한 두 점 사이에 증감 라벨을 그린다.
 *
 * recharts 3 는 옛 `<Customized>`(formattedGraphicalItems 주입)를 더 이상 지원하지
 * 않는다 — deprecated, props 를 그대로 내려주지 않는다. 대신 차트 안에서 직접
 * useXAxisScale/useYAxisScale 로 스케일 함수를 받아 픽셀 좌표를 계산한다.
 */
function DeltaLabels({ data, yKey, deltaKey, dense }: { data: TrendDatum[]; yKey: string; deltaKey: string; dense?: boolean }) {
  const xScale = useXAxisScale()
  const yScale = useYAxisScale()
  if (!xScale || !yScale) return null
  return (
    <g>
      {data.slice(1).map((row, i) => {
        const prev = data[i]
        const d = row[deltaKey]
        if (d === null || d === undefined || d === 0) return null
        const x1 = xScale(prev.month)
        const x2 = xScale(row.month)
        const y1 = yScale(prev[yKey])
        const y2 = yScale(row[yKey])
        if (x1 === undefined || x2 === undefined || y1 === undefined || y2 === undefined) return null
        const x = (x1 + x2) / 2
        const y = Math.min(y1, y2) - (dense ? 8 : 11)
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            fontSize={dense ? 11 : 12}
            fontWeight={700}
            fill={d > 0 ? '#1b8a4b' : '#d93025'}
          >
            {d > 0 ? `▲${Math.round(d)}` : `▼${Math.round(-d)}`}
          </text>
        )
      })}
    </g>
  )
}

/** 월별 추이 — 원본 C분석!chart6, A분석!chart16 */
export function LineTrend({
  data,
  series,
  dense,
  format,
  deltaKey,
  w,
  h,
}: ChartSize & {
  /** month + 계열 값. null 은 그 지점을 건너뛴다 (첫 달 증감 등) */
  data: TrendDatum[]
  series: TrendSeries[]
  dense?: boolean
  format?: (v: number) => string
  /** data 안에서 "전 지점 대비 증감" 값을 담은 필드 키 — 지정하면 첫 계열의 점 사이에 라벨을 그린다 */
  deltaKey?: string
}) {
  const fs = dense ? 15 : 13
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
        {deltaKey && <DeltaLabels data={data} yKey={series[0].key} deltaKey={deltaKey} dense={dense} />}
      </LineChart>
    </ChartFrame>
  )
}
