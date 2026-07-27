/* ══════════════════════════════════════════════════════════════════════
   액션플랜 — 신버전 워크북에 추가된 시트

   원본 시트는 사실상 비어 있다 (A1 제목, I40/I41 서명란, 표·테두리 없음).
   문구는 원본 그대로 두고, 현대해상 사내 배포물처럼 보이도록 구성만 갖춘다.
   실천 항목 문구는 **임의로 만들지 않는다** — 인쇄해서 손으로 적는 빈 칸이다.
   ══════════════════════════════════════════════════════════════════════ */

import { dec2 } from '../calc/format'
import type { FullAnalysis } from '../calc'

/** 원본 액션플랜!A1 */
const HEADLINE = '나의 "성공의 확신"을 위해 이것만 해봅시다!'

/** 작성란 개수 */
const SLOTS = 5

export function ActionPlanTab({ A, dense }: { A: FullAnalysis; dense?: boolean }) {
  const p = A.profile
  const { cams } = A.report

  return (
    <div className={`plan ${dense ? 'plan--dense' : ''}`}>
      <h2 className="plan__headline">{HEADLINE}</h2>

      {/* 진단 요약 — 앞 5개 탭에서 이미 계산된 값만 옮긴다 */}
      <div className="plan__cams">
        <span className="plan__cams-label">나의 진단 결과</span>
        <ul>
          <li>
            <b>C</b> 고객 <em>{dec2(cams.C)}</em>
          </li>
          <li>
            <b>A</b> 활동 <em>{dec2(cams.A)}</em>
          </li>
          <li>
            <b>M</b> 시장 <em>{dec2(cams.M)}</em>
          </li>
          <li className="is-na">
            <b>S</b> 기술 <em>—</em>
          </li>
        </ul>
        <span className="plan__cams-note">
          {p.name} 플래너 · {p.branch} · 육성소득 {p.incomeRaw} · {p.months}차월
        </span>
      </div>

      <ol className="plan__slots">
        {Array.from({ length: SLOTS }, (_, i) => (
          <li key={i}>
            <span className="plan__no">{i + 1}</span>
            <span className="plan__lines">
              <i />
              <i />
            </span>
          </li>
        ))}
      </ol>

      {/* 원본 액션플랜!I40 / I41 */}
      <div className="plan__sign">
        <span>2026년 ______월 ______일</span>
        <span>________________________ (서 명)</span>
      </div>
    </div>
  )
}
