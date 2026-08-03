/* ══════════════════════════════════════════════════════════════════════
   명단 행에서 사번을 클릭 → "OOO님의 자가진단 레포트를 확인하시겠습니까?"
   확인 다이얼로그 → 예 누르면 그 사람 레포트로 진입. Roster.tsx 의 지역단별
   조회/명단에서 선택/사번·성명 통합검색 결과 목록이 모두 이 훅+컴포넌트를 쓴다.
   ══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react'
import { loadPlanner, loadReference, type RosterEntry } from '../data/repository'
import { analyze, type FullAnalysis } from '../calc'

export function usePersonPreview(
  onView: (A: FullAnalysis, caption: string) => void,
  onError?: (message: string) => void,
) {
  const [target, setTarget] = useState<RosterEntry | null>(null)
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    if (!target) return
    setBusy(true)
    try {
      const ref = await loadReference()
      const planner = await loadPlanner(target.code)
      if (!planner) throw new Error(`사번 '${target.code}' 데이터를 찾지 못했습니다.`)
      const A = analyze(target.code, planner, ref.benchmarks, ref.incomeMap, ref.dataset.months)
      onView(A, ref.dataset.caption)
    } catch (e) {
      onError?.(e instanceof Error ? e.message : '레포트를 불러오지 못했습니다.')
    } finally {
      setBusy(false)
      setTarget(null)
    }
  }

  return { target, setTarget, busy, confirm }
}

export function PersonPreviewDialog({
  target,
  busy,
  onConfirm,
  onCancel,
}: {
  target: RosterEntry
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="choice-overlay" role="dialog" aria-modal="true" onClick={() => !busy && onCancel()}>
      <div className="choice-overlay__box" onClick={(e) => e.stopPropagation()}>
        <p className="choice-overlay__title">
          {target.name}({target.code})님의 자가진단 레포트를 확인하시겠습니까?
        </p>
        <div className="choice-overlay__actions">
          <button className="btn btn--primary" disabled={busy} onClick={onConfirm}>
            {busy ? '불러오는 중…' : '예'}
          </button>
        </div>
        <button className="btn choice-overlay__cancel" disabled={busy} onClick={onCancel}>
          아니오
        </button>
      </div>
    </div>
  )
}
