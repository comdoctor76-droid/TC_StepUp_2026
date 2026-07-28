/* ══════════════════════════════════════════════════════════════════════
   기간 선택 — C/A/M/S 분석 탭 상단 (화면 전용, 인쇄물에는 나오지 않는다)

   ⚠ 데이터 제약
   Firestore 에 저장되는 것은 엑셀이 이미 집계해 둔 스칼라 값과 6개월치
   시계열뿐이라, 임의 기간을 원본에서 다시 계산할 수는 없다. 따라서
     · '전체기간' / '최근 6개월' → 엑셀이 두 벌 다 만들어 둔 항목만 전환
     · '기간선택'               → 저장된 6개월 안에서 구간을 좁혀 보는 것만
   가능하다. 어떤 항목이 반응하는지는 각 탭이 PeriodNote 로 밝힌다.
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

export const DEFAULT_PERIOD: Period = { mode: 'recent6' }

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

/** 현재 선택을 한 줄로 — '최근 6개월' / '전체기간' / '2026.02 ~ 2026.05' */
export function periodLabel(period: Period, months: number[]): string {
  if (period.mode === 'all') return '전체기간'
  if (period.mode === 'recent6') return '최근 6개월'
  const picked = monthsInPeriod(period, months)
  return `${ym(picked[0])} ~ ${ym(picked[picked.length - 1])}`
}

export function PeriodPicker({
  value,
  months,
  onChange,
}: {
  value: Period
  /** 데이터가 있는 월 목록 (보통 6개) */
  months: number[]
  onChange: (p: Period) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const first = months[0]
  const last = months[months.length - 1]
  const [from, setFrom] = useState(value.from ?? first)
  const [to, setTo] = useState(value.to ?? last)

  // 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const pick = (mode: PeriodMode) => {
    if (mode === 'custom') {
      setOpen((v) => !v)
      return
    }
    setOpen(false)
    onChange({ mode })
  }

  const applyCustom = () => {
    setOpen(false)
    onChange({ mode: 'custom', from, to })
  }

  return (
    <div className="period" ref={wrapRef}>
      <span className="period__label">조회기간</span>
      <div className="period__seg" role="group" aria-label="조회기간 선택">
        <button
          type="button"
          className={`period__btn ${value.mode === 'recent6' ? 'is-on' : ''}`}
          onClick={() => pick('recent6')}
        >
          최근 6개월
        </button>
        <button
          type="button"
          className={`period__btn ${value.mode === 'all' ? 'is-on' : ''}`}
          onClick={() => pick('all')}
        >
          전체기간
        </button>
        <button
          type="button"
          className={`period__btn ${value.mode === 'custom' ? 'is-on' : ''}`}
          aria-expanded={open}
          onClick={() => pick('custom')}
        >
          {value.mode === 'custom' ? periodLabel(value, months) : '기간선택'} ▾
        </button>
      </div>

      {open && (
        <div className="period__pop">
          <p className="period__pop-note">
            저장된 데이터는 {ym(first)} ~ {ym(last)} 입니다. 이 범위 안에서 고르세요.
          </p>
          <div className="period__row">
            <label>
              <span>시작</span>
              <select value={from} onChange={(e) => setFrom(Number(e.target.value))}>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {ym(m)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>종료</span>
              <select value={to} onChange={(e) => setTo(Number(e.target.value))}>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {ym(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
