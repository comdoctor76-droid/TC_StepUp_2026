import type { ReactElement, ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'

export interface ChartSize {
  /** 지정하면 고정 크기(인쇄/캡처용), 없으면 ResponsiveContainer(화면용) */
  w?: number
  h?: number
}

/**
 * 인쇄/캡처 페이지에서는 반드시 고정 px 크기를 준다.
 * ResponsiveContainer 는 화면 밖(left:-20000px) 컨테이너에서 0으로 측정돼
 * 차트가 빈 채로 캡처되는 일이 있다.
 */
export function ChartFrame({ w, h, children }: ChartSize & { children: ReactElement }) {
  if (w && h) {
    return (
      <div style={{ width: w, height: h }}>
        <ResponsiveContainer width={w} height={h}>
          {children}
        </ResponsiveContainer>
      </div>
    )
  }
  return (
    <div style={{ width: '100%', height: h ?? 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export function ChartCard({
  title,
  note,
  children,
  className = '',
}: {
  title?: ReactNode
  note?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`chart-card ${className}`}>
      {title && <h3 className="chart-card__title">{title}</h3>}
      <div className="chart-card__body">{children}</div>
      {note && <p className="chart-card__note">{note}</p>}
    </section>
  )
}
