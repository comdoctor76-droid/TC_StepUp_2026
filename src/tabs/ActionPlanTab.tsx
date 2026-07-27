/* ══════════════════════════════════════════════════════════════════════
   액션플랜 — 원본 워크북 그대로: 제목 + 강점/약점 표 + 서명란.

   원본 시트 구성(사용자 제공 캡처 기준): A1 제목, "나의 강점 | 강점 강화
   Action Plan" 표 3행, "나의 약점 | 약점 보완 Action Plan" 표 3행,
   I40/I41 서명란. 틀과 문구는 원본 그대로, 색상만 현대해상 CI(오렌지·네이비)로
   바꾼다. 표 칸의 실천 항목 문구는 **임의로 만들지 않는다** — 인쇄해서
   손으로(또는 화면에서 입력해) 채우는 빈 칸이다.
   ══════════════════════════════════════════════════════════════════════ */

import type { FullAnalysis } from '../calc'

/** 원본 액션플랜!A1 */
const HEADLINE = '나의 "성공의 확신"을 위해 이것만 해봅시다!'

/** 표 한 칸당 작성 줄 수 (원본 표는 3행) */
const ROWS = 3

function PlanTable({
  variant,
  labelHeader,
  planHeader,
  planNote,
}: {
  variant: 'strength' | 'weak'
  labelHeader: string
  planHeader: string
  planNote: string
}) {
  return (
    <div className={`plan__table plan__table--${variant}`}>
      <div className="plan__th plan__th--label">{labelHeader}</div>
      <div className="plan__th plan__th--plan">
        {planHeader}
        <span>{planNote}</span>
      </div>
      {Array.from({ length: ROWS }, (_, i) => (
        <div key={i} className="plan__row">
          <div className={`plan__td plan__td--label ${i % 2 === 1 ? 'plan__td--alt' : ''}`} />
          <div className={`plan__td plan__td--plan ${i % 2 === 1 ? 'plan__td--alt' : ''}`} />
        </div>
      ))}
    </div>
  )
}

export function ActionPlanTab({ dense }: { A: FullAnalysis; dense?: boolean }) {
  return (
    <div className={`plan ${dense ? 'plan--dense' : ''}`}>
      <h2 className="plan__headline">{HEADLINE}</h2>

      <div className="plan__forms">
        <PlanTable
          variant="strength"
          labelHeader="나의 강점"
          planHeader="강점 강화 Action Plan"
          planNote="(What, When, How 반드시 기입)"
        />
        <PlanTable
          variant="weak"
          labelHeader="나의 약점"
          planHeader="약점 보완 Action Plan"
          planNote="(What, When, How 꼭기입)"
        />
      </div>

      {/* 원본 액션플랜!I40 / I41 */}
      <div className="plan__sign">
        <span>2026년 ______월 ______일</span>
        <span>________________________ (서 명)</span>
      </div>
    </div>
  )
}
