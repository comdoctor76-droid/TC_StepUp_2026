/* ══════════════════════════════════════════════════════════════════════
   조회기간 선택 — 화면 전용 (인쇄물에는 나오지 않는다)

   팝업 없이 조회기간 줄 안에 컨트롤을 나란히 두고, 고르는 즉시 반영한다.

   ⚠ 탭마다 "실제로 바뀌는 것"이 다르므로, 그 탭에서 의미 있는 컨트롤만 띄운다.
   아무것도 바꾸지 못하는 버튼은 두지 않는다.

     · 집계 기준(최근 6개월 / 전체기간)
       엑셀이 두 벌 계산해 둔 항목에만 의미가 있다 → A분석·S분석
     · 월 구간(종료월 + 기간)
       월별 계열이 있는 항목에만 의미가 있다 → 레포트·C분석·A분석
       유지고객 같은 재고는 '종료월 시점' 값이, 건수 같은 흐름은 '구간 합계'가 바뀐다
     · M분석은 둘 다 없다 → 피커를 아예 띄우지 않는다

   근거가 되는 데이터 성격은 src/calc/period.ts 주석 참조.
   ══════════════════════════════════════════════════════════════════════ */

import { ym } from '../calc/format'

export type PeriodMode = 'recent6' | 'all' | 'custom'

export interface Period {
  mode: PeriodMode
  /** custom 일 때만 — YYYYMM */
  from?: number
  to?: number
}

/** 이 탭에서 의미 있는 컨트롤 */
export interface PeriodCaps {
  /** 최근 6개월 / 전체기간 전환이 값을 바꾸는가 */
  scope?: boolean
  /** 월 구간 선택이 값을 바꾸는가 */
  range?: boolean
}

export const DEFAULT_PERIOD: Period = { mode: 'recent6' }
export const ALL_PERIOD: Period = { mode: 'all' }

/** 선택된 기간에 해당하는 월 목록 (저장된 6개월 범위 안에서) */
export function monthsInPeriod(period: Period, months: number[]): number[] {
  if (period.mode !== 'custom') return months
  const from = period.from ?? months[0]
  const to = period.to ?? months[months.length - 1]
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const picked = months.filter((m) => m >= lo && m <= hi)
  return picked.length > 0 ? picked : months
}

/** 현재 선택을 한 줄로 */
export function periodLabel(period: Period, months: number[]): string {
  if (period.mode === 'all') return '전체기간'
  if (period.mode === 'recent6') return '최근 6개월'
  const picked = monthsInPeriod(period, months)
  return `${ym(picked[0])} ~ ${ym(picked[picked.length - 1])}`
}

const DUR_CHIPS = [1, 3, 6] as const

export function PeriodPicker({
  value,
  months,
  caps,
  onChange,
}: {
  value: Period
  /** 데이터가 있는 월 목록 (보통 6개) */
  months: number[]
  caps: PeriodCaps
  onChange: (p: Period) => void
}) {
  if (!caps.scope && !caps.range) return null

  const first = months[0]
  const last = months[months.length - 1]
  const idx = (m: number) => months.indexOf(m)

  // custom 이 아니면 화면상 종료월/시작월은 저장된 전체 구간으로 보여준다
  const to = value.mode === 'custom' ? (value.to ?? last) : last
  const from = value.mode === 'custom' ? (value.from ?? first) : first
  const durOf = idx(to) - idx(from) + 1

  /** 종료월에서 n개월을 거슬러 올라간다. 데이터 시작보다 앞서면 잘라낸다. */
  const pickDur = (n: number) => {
    const want = idx(to) - (n - 1)
    onChange({ mode: 'custom', from: months[Math.max(0, want)], to })
  }
  const pickTo = (m: number) => {
    onChange({ mode: 'custom', from: idx(m) < idx(from) ? m : from, to: m })
  }
  const pickFrom = (m: number) => {
    onChange({ mode: 'custom', from: m, to: idx(m) > idx(to) ? m : to })
  }
  const pickAll = () => onChange({ mode: 'custom', from: first, to: last })

  return (
    <div className="period">
      <span className="period__label">조회기간</span>

      {caps.scope && (
        <div className="period__seg" role="group" aria-label="집계 기준">
          <button
            type="button"
            className={`period__btn ${value.mode === 'recent6' ? 'is-on' : ''}`}
            onClick={() => onChange(DEFAULT_PERIOD)}
          >
            최근 6개월
          </button>
          <button
            type="button"
            className={`period__btn ${value.mode === 'all' ? 'is-on' : ''}`}
            onClick={() => onChange(ALL_PERIOD)}
          >
            전체기간
          </button>
        </div>
      )}

      {caps.range && (
        <div className="period__inline">
          <label className="period__mini">
            <span>종료월</span>
            <select value={to} onChange={(e) => pickTo(Number(e.target.value))}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {ym(m)}
                </option>
              ))}
            </select>
          </label>

          <div className="period__chips">
            {DUR_CHIPS.filter((n) => n <= months.length).map((n) => (
              <button
                key={n}
                type="button"
                className={`period__chip ${durOf === n ? 'is-on' : ''}`}
                onClick={() => pickDur(n)}
              >
                {n}개월
              </button>
            ))}
            {/* 오늘처럼 저장 기간이 짧으면 '6개월' 칩과 '전체'가 같은 값이 된다 —
                이미 칩으로 커버되면 중복 버튼을 띄우지 않는다 */}
            {!DUR_CHIPS.includes(months.length as (typeof DUR_CHIPS)[number]) && (
              <button
                type="button"
                className={`period__chip ${durOf === months.length ? 'is-on' : ''}`}
                onClick={pickAll}
              >
                전체
              </button>
            )}
          </div>

          <label className="period__mini">
            <span>시작월</span>
            <select value={from} onChange={(e) => pickFrom(Number(e.target.value))}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {ym(m)}
                </option>
              ))}
            </select>
          </label>

          <span className="period__echo">
            {ym(to)} ~ {ym(from)} ({durOf}개월)
          </span>
        </div>
      )}
    </div>
  )
}

/** 이 탭에서 기간 선택이 실제로 무엇에 적용되는지 밝히는 한 줄 */
export function PeriodNote({ children }: { children: React.ReactNode }) {
  return <p className="period-note">※ {children}</p>
}
