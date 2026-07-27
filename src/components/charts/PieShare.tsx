import { Cell, Legend, Pie, PieChart, Tooltip } from 'recharts'
import { ChartFrame, type ChartSize } from './Frame'
import { PIE_COLORS } from './palette'

export interface ShareDatum {
  label: string
  share: number
  value?: number
}

/** 구성비 원형 — 원본 M분석!chart17~24 */
export function PieShare({
  data,
  dense,
  colors = PIE_COLORS,
  showLegend = true,
  w,
  h,
}: ChartSize & {
  data: ShareDatum[]
  dense?: boolean
  colors?: string[]
  showLegend?: boolean
}) {
  const fs = dense ? 8.5 : 12
  const rows = data.map((d) => ({ name: d.label, value: Math.max(0, d.share) }))
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

  const outer = dense ? Math.min((h ?? 110) * 0.36, 44) : 78

  return (
    <ChartFrame w={w} h={h}>
      <PieChart margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy={showLegend ? '43%' : '50%'}
          outerRadius={outer}
          isAnimationActive={false}
          stroke="#fff"
          strokeWidth={dense ? 0.6 : 1.5}
          label={
            dense
              ? false
              : ({ name, value }: { name?: string; value?: number }) =>
                  (value ?? 0) >= 0.06 ? `${name} ${((value ?? 0) * 100).toFixed(0)}%` : ''
          }
          labelLine={false}
        >
          {rows.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        {!dense && <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />}
        {showLegend && (
          <Legend
            verticalAlign="bottom"
            height={dense ? 22 : 30}
            iconSize={dense ? 6 : 10}
            wrapperStyle={{ fontSize: fs, lineHeight: 1.25 }}
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
