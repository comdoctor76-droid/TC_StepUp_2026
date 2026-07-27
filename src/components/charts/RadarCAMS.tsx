import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from 'recharts'
import { ChartFrame, type ChartSize } from './Frame'
import { SERIES } from './palette'

/**
 * CAMS 레이더 — 원본 개요!chart1 (개요!BT22:BV25)
 *
 * ⚠️ S 점수 산식은 원본에서 유실됐다 (개요!BU25 = S분석!#REF!).
 *    S 축은 값을 비우고 '산식 미확정'으로 표기한다.
 */
export function RadarCAMS({
  cams,
  dense,
  w,
  h,
}: ChartSize & {
  cams: { C: number; A: number; M: number; S: number | null }
  dense?: boolean
}) {
  const data = [
    { axis: 'C 고객', me: cams.C, base: 1 },
    { axis: 'A 활동', me: cams.A, base: 1 },
    { axis: 'M 시장', me: cams.M, base: 1 },
    { axis: 'S 기술', me: cams.S ?? 0, base: 1 },
  ]
  const fs = dense ? 9 : 13

  return (
    <ChartFrame w={w} h={h}>
      <RadarChart data={data} outerRadius={dense ? '68%' : '72%'}>
        <PolarGrid stroke="#E7ECF1" />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: fs, fill: '#4A5560' }} />
        <PolarRadiusAxis domain={[0, 2]} tick={false} axisLine={false} />
        <Radar
          name="유사등급 100%"
          dataKey="base"
          stroke={SERIES.peer}
          fill={SERIES.peer}
          fillOpacity={0.14}
          isAnimationActive={false}
        />
        <Radar
          name="본인"
          dataKey="me"
          stroke={SERIES.self}
          fill={SERIES.self}
          fillOpacity={0.34}
          strokeWidth={dense ? 1.4 : 2}
          isAnimationActive={false}
        />
      </RadarChart>
    </ChartFrame>
  )
}
