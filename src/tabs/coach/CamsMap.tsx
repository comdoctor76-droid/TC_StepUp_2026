/* C·A·M·S 성장 신호등 — 원본 camsMap() 을 그대로 이식 */

import type { CoachMetric } from '../../calc/coach'
import { isNum, type CoachAnalysis, type MetricCls } from '../../calc/coachAnalyze'

const ST: Record<MetricCls, { c: string; t: string }> = {
  strategic: { c: 'good', t: '강점' },
  levelup: { c: 'mid', t: '성장' },
  bottleneck: { c: 'low', t: '기회' },
  mixed: { c: 'mid', t: '성장' },
  na: { c: 'na', t: '—' },
}

function Chip({ label, st }: { label: string; st: { c: string; t: string } }) {
  return (
    <span className={`mchip ${st.c}`} title={st.t}>
      <i />
      {label}
      <b>{st.t}</b>
    </span>
  )
}

function Col({ k, name, items }: { k: string; name: string; items: { label: string; st: { c: string; t: string } }[] }) {
  return (
    <div className="cg">
      <div className="cg-h">
        <span className="cams-badge">{k}</span>
        <span className="cams-name">{name}</span>
      </div>
      <div className="cg-chips">
        {items.map((it) => (
          <Chip key={it.label} label={it.label} st={it.st} />
        ))}
      </div>
    </div>
  )
}

export function CamsMap({
  analysis,
  m6,
  dgBand,
}: {
  analysis: CoachAnalysis
  m6: Record<string, CoachMetric>
  dgBand: string
}) {
  const st = (k: string) => ST[analysis.metrics[k]?.cls ?? 'na']
  const simpleStrong = analysis.strengthIds.includes('simple')
  const concentrated = isNum(m6.simpleCntPct.me) && isNum(m6.simpleCntPct.tc) && m6.simpleCntPct.me - m6.simpleCntPct.tc > 0.15

  return (
    <>
      <div className="cams2">
        <Col k="C" name="고객" items={[
          { label: '월 신규고객', st: st('newCust') },
          { label: '장기고객 기반', st: st('custLong') },
          { label: '자동차 연계', st: st('linkRate') },
        ]} />
        <Col k="A" name="활동" items={[
          { label: '월 장기건수', st: st('moLong') },
          { label: '고객당 건수', st: st('perCust') },
          { label: '기존 추가계약', st: st('oldCnt6') },
        ]} />
        <Col k="M" name="시장" items={[
          { label: '간편(주력) 체결력', st: simpleStrong ? ST.strategic : ST.mixed },
          { label: '자동차 활동', st: st('moCar') },
          { label: '상품 다양성', st: concentrated ? { c: 'low', t: '기회' } : ST.mixed },
        ]} />
        <Col k="S" name="기술" items={[
          { label: '인당 보험료', st: st('premPer') },
          { label: '암 부보율', st: st('cancerRate') },
          { label: '심뇌 부보율', st: st('brainRate') },
        ]} />
      </div>
      <div className="cams-legend">
        <span>
          <i style={{ background: 'var(--cr-green)' }} />강점 <span style={{ fontWeight: 600, color: 'var(--cr-text3)' }}>두 그룹 모두 앞섬</span>
        </span>
        <span>
          <i style={{ background: 'var(--cr-hi)' }} />성장 <span style={{ fontWeight: 600, color: 'var(--cr-text3)' }}>동일그룹은 넘어섬</span>
        </span>
        <span>
          <i style={{ background: 'var(--cr-blue)' }} />기회 <span style={{ fontWeight: 600, color: 'var(--cr-text3)' }}>성장 공간</span>
        </span>
      </div>
      <div className="basecap num">[기준: 전체 누적 + 최근 6개월 · 본인 vs 동일그룹({dgBand}) vs TC 표준그룹]</div>
    </>
  )
}
