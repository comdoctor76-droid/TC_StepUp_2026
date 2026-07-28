import { Cell, Legend, Pie, PieChart, Tooltip } from 'recharts'
import { ChartFrame, type ChartSize } from './Frame'
import { PIE_COLORS } from './palette'

export interface ShareDatum {
  label: string
  share: number
  value?: number
}

const RADIAN = Math.PI / 180

interface LeaderRow {
  name: string
  value: number
  fill?: string
}

/**
 * 슬라이스 가장자리 → 꺾이는 점 → 여백의 라벨까지 이어지는 꺾쇠선(리더라인) + 텍스트.
 *
 * recharts 는 라벨을 슬라이스마다 한 번씩 순서대로 호출하는데, 작은 조각이 여럿
 * 붙어 있으면(예: 어린이 5% · 운전자 5%) 각자 계산한 라벨 위치가 서로 겹친다.
 * cx/cy/outerRadius 는 파이 하나에서 모든 슬라이스가 공유하므로, 첫 호출 때 그
 * 값으로 전체 라벨 위치를 한 번에 계산해 좌/우 쪽별로 겹치지 않게 세로 간격을
 * 벌려 두고 캐시한다 — 이후 호출은 인덱스로 캐시에서 꺼내 쓴다.
 */
function leaderLabel(fs: number, rows: LeaderRow[]) {
  type Placed = { sx: number; sy: number; mx: number; y: number; anchor: 'start' | 'end'; name: string; pct: number; fill?: string }
  let cache: (Placed | null)[] | null = null

  const build = (cx: number, cy: number, outerRadius: number) => {
    const total = rows.reduce((a, b) => a + b.value, 0) || 1
    let cum = 0
    const raw = rows.map((r) => {
      const startFrac = cum / total
      cum += r.value
      const midFrac = startFrac + r.value / total / 2
      const midAngle = 90 - midFrac * 360
      const sin = Math.sin(-RADIAN * midAngle)
      const cos = Math.cos(-RADIAN * midAngle)
      const pct = r.value / total
      const my = cy + (outerRadius + 8) * sin
      return {
        name: r.name,
        pct,
        fill: r.fill,
        sx: cx + outerRadius * cos,
        sy: cy + outerRadius * sin,
        mx: cx + (outerRadius + 8) * cos,
        my,
        y: my,
        anchor: (cos >= 0 ? 'start' : 'end') as 'start' | 'end',
        skip: pct < 0.02,
      }
    })

    const gap = fs + 3
    ;(['start', 'end'] as const).forEach((side) => {
      const group = raw.filter((r) => !r.skip && r.anchor === side).sort((a, b) => a.my - b.my)
      group.forEach((r, i) => {
        if (i > 0) r.y = Math.max(r.my, group[i - 1].y + gap)
      })
    })

    return raw.map((r) => (r.skip ? null : { ...r }))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (props: any) => {
    const { cx, cy, outerRadius, index } = props
    if (!cache) cache = build(cx, cy, outerRadius)
    const p = cache[index]
    if (!p) return null
    const ex = p.mx + (p.anchor === 'start' ? 1 : -1) * 10
    return (
      <g>
        <path d={`M${p.sx},${p.sy}L${p.mx},${p.y}L${ex},${p.y}`} stroke={p.fill} fill="none" />
        <circle cx={p.sx} cy={p.sy} r={1.6} fill={p.fill} stroke="none" />
        <text
          x={ex + (p.anchor === 'start' ? 1 : -1) * 3}
          y={p.y}
          textAnchor={p.anchor}
          dominantBaseline="central"
          fontSize={fs}
          fontWeight={700}
          fill="var(--ink-2, #4a5560)"
        >
          {`${p.name} ${(p.pct * 100).toFixed(0)}%`}
        </text>
      </g>
    )
  }
}

/** 구성비 원형 — 원본 M분석!chart17~24 */
export function PieShare({
  data,
  dense,
  colors = PIE_COLORS,
  showLegend = true,
  leaderLines = false,
  w,
  h,
}: ChartSize & {
  data: ShareDatum[]
  dense?: boolean
  colors?: string[]
  showLegend?: boolean
  /** 큰 값의 원형 라벨을 꺾쇠선으로 여백에 빼서 표시한다 */
  leaderLines?: boolean
}) {
  const fs = dense ? 14.5 : 12
  const legendFs = dense ? 14.5 : 10.5

  // 카테고리 이름 기준 색 — 값 기준 정렬 후에도 같은 항목은 항상 같은 색을 유지한다
  const colorOf = new Map(data.map((d, i) => [d.label, colors[i % colors.length]]))
  const rows = data
    .map((d) => ({ name: d.label, value: Math.max(0, d.share) }))
    .sort((a, b) => b.value - a.value)
  const total = rows.reduce((a, b) => a + b.value, 0)

  if (total <= 0) {
    return (
      <div
        style={{
          width: w ?? '100%',
          height: h ?? 180,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--ink-3)',
          fontSize: fs + 1,
        }}
      >
        데이터 없음
      </div>
    )
  }

  const outer = dense
    ? Math.min((h ?? 110) * 0.33, 44) * (leaderLines ? 0.86 : 1)
    : 78 * (leaderLines ? 0.8 : 1)

  return (
    <ChartFrame w={w} h={h}>
      <PieChart
        margin={
          leaderLines
            ? { top: 2, right: dense ? 22 : 34, bottom: 2, left: dense ? 22 : 34 }
            : { top: 2, right: 2, bottom: 2, left: 2 }
        }
      >
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy={showLegend ? '40%' : '50%'}
          outerRadius={outer}
          startAngle={90}
          endAngle={-270}
          isAnimationActive={false}
          stroke="#fff"
          strokeWidth={dense ? 0.6 : 1.5}
          label={
            leaderLines
              ? leaderLabel(
                  dense ? 11 : 10.5,
                  rows.map((r) => ({ ...r, fill: colorOf.get(r.name) })),
                )
              : dense
                ? false
                : ({ name, value }: { name?: string; value?: number }) =>
                    (value ?? 0) >= 0.06 ? `${name} ${((value ?? 0) * 100).toFixed(0)}%` : ''
          }
          labelLine={false}
        >
          {rows.map((r, i) => (
            <Cell key={i} fill={colorOf.get(r.name)} />
          ))}
        </Pie>
        {!dense && <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />}
        {showLegend && (
          <Legend
            verticalAlign="bottom"
            height={dense ? 34 : 30}
            iconSize={dense ? 6 : 8}
            wrapperStyle={{ fontSize: legendFs, lineHeight: 1.2 }}
            formatter={(value, entry) => {
              const v = (entry?.payload as { value?: number } | undefined)?.value ?? 0
              return `${value} ${(v * 100).toFixed(0)}%`
            }}
          />
        )}
      </PieChart>
    </ChartFrame>
  )
}
