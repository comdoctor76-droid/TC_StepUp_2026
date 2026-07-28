/* 90일 실행 플랜 카드 — 원본 goalHtml 조립부를 그대로 이식 */

import type { CoachGoal } from '../../calc/coachAnalyze'
import { Editable, type CoachEdits } from './Editable'

export function GoalCard({
  g,
  index,
  edits,
  onCommit,
}: {
  g: CoachGoal
  index: number
  edits: CoachEdits
  onCommit: (id: string, html: string) => void
}) {
  const row = (k: string, label: string, html: string, num?: boolean) => (
    <div className="g-row">
      <span className="g-k">{label}</span>
      <Editable id={`g-${k}-${g.id}`} html={html} edits={edits} onCommit={onCommit} className={`g-v${num ? ' num' : ''}`} />
    </div>
  )

  return (
    <div className={`goal g${index + 1}`}>
      <div className="goal-head">
        <span className="goal-rank">{index === 0 ? '제안 1 · 먼저 권해요' : '제안 2 · 이런 선택도 좋아요'}</span>
        <Editable id={`g-title-${g.id}`} html={g.title} edits={edits} onCommit={onCommit} as="span" className="goal-title" />
      </div>
      <div className="goal-body">
        {row('point', '핵심', g.point)}
        {row('now', '현재', g.now, true)}
        {row('d30', '30일 목표', g.d30)}
        {row('d90', '90일 목표', g.d90)}
        {row('week', '주간 행동', g.week)}
        {row('measure', '측정 방법', g.measure)}
        <div className="goal-why">
          <span className="why-pill">WHY</span>
          <Editable id={`g-why-${g.id}`} html={g.why} edits={edits} onCommit={onCommit} className="why-t" />
        </div>
      </div>
    </div>
  )
}
