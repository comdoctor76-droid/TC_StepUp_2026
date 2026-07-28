/* ══════════════════════════════════════════════════════════════════════
   조회기간 선택 — 화면 전용 (인쇄물에는 나오지 않는다)

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

import { useEffect, useRef, useState } from 'react'
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
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const first = months[0]
  const last = months[months.length - 1]
  const [to, setTo] = useState(value.to ?? last)
  const [from, setFrom] = useState(value.from ?? first)
  const [clamped, setClamped] = useState(false)

  // 열 때마다 현재 선택으로 되돌린다 (닫고 다시 열면 이전 편집이 남지 않게)
  useEffect(() => {
    if (!open) return
    setFrom(value.from ?? first)
    setTo(value.to ?? last)
    setClamped(false)
  }, [open, value.from, value.to, first, last])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!caps.scope && !caps.range) return null

  const idx = (m: number) => months.indexOf(m)

  /** 종료월에서 n개월을 거슬러 올라간다. 데이터 시작보다 앞서면 잘라낸다. */
  const applyDur = (n: number) => {
    const want = idx(to) - (n - 1)
    setFrom(months[Math.max(0, want)])
    setClamped(want < 0)
  }
  const pickTo = (m: number) => {
    setTo(m)
    if (idx(m) < idx(from)) setFrom(m)
    setClamped(false)
  }

  const applyCustom = () => {
    setOpen(false)
    onChange({ mode: 'custom', from, to })
  }

  const durOf = idx(to) - idx(from) + 1

  return (
    <div className="period" ref={wrapRef}>
      <span className="period__label">조회기간</span>
      <div className="period__seg" role="group" aria-label="조회기간 선택">
        {caps.scope && (
          <>
            <button
              type="button"
              className={`period__btn ${value.mode === 'recent6' ? 'is-on' : ''}`}
              onClick={() => {
                setOpen(false)
                onChange(DEFAULT_PERIOD)
              }}
            >
              최근 6개월
            </button>
            <button
              type="button"
              className={`period__btn ${value.mode === 'all' ? 'is-on' : ''}`}
              onClick={() => {
                setOpen(false)
                onChange(ALL_PERIOD)
              }}
            >
              전체기간
            </button>
          </>
        )}
        {caps.range && (
          <button
            type="button"
            className={`period__btn ${value.mode === 'custom' ? 'is-on' : ''}`}
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((v) => !v)}
          >
            {value.mode === 'custom' ? periodLabel(value, months) : '월 구간 선택'} ▾
          </button>
        )}
      </div>

      {open && (
        <div className="period__pop" role="dialog" aria-label="월 구간 선택">
          <p className="period__pop-note">
            저장된 월별 데이터는 {ym(first)} ~ {ym(last)} ({months.length}개월) 입니다.
          </p>

          <div className="period__field">
            <span>종료월</span>
            <select value={to} onChange={(e) => pickTo(Number(e.target.value))}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {ym(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="period__field">
            <span>기간</span>
            <div className="period__chips">
              {[1, 3, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`period__chip ${durOf === n ? 'is-on' : ''}`}
                  onClick={() => applyDur(n)}
                >
                  {n}개월
                </button>
              ))}
            </div>
          </div>

          <div className="period__field">
            <span>시작월</span>
            <select
              value={from}
              onChange={(e) => {
                const m = Number(e.target.value)
                setFrom(m)
                if (idx(m) > idx(to)) setTo(m)
                setClamped(false)
              }}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {ym(m)}
                </option>
              ))}
            </select>
          </div>

          <p className="period__echo">
            선택 구간 {ym(from)} ~ {ym(to)} ({durOf}개월)
          </p>
          {clamped && (
            <p className="period__warn">데이터 시작({ym(first)})까지만 적용됩니다.</p>
          )}

          <div className="period__pop-actions">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              취소
            </button>
            <button type="button" className="btn btn--primary" onClick={applyCustom}>
              적용
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

/** 이 탭에서 기간 선택이 실제로 무엇에 적용되는지 밝히는 한 줄 */
export function PeriodNote({ children }: { children: React.ReactNode }) {
  return <p className="period-note">※ {children}</p>
}
