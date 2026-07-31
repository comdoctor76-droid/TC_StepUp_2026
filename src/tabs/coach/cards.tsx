/* 성장코칭 리포트 카드 — 원본 도구의 kpiCard()/vsCard()/ringCard()/trendCard()/
   butterflyCard() 등 HTML 문자열 조립 함수를 그대로 JSX 로 옮긴 것. 수치 계산
   (막대 폭 %, conic-gradient 각도 등)은 원본과 동일하게 유지했다. */

import type { ReactNode } from 'react'
import type { CoachMetric } from '../../calc/coach'
import { f1, f2, isNum, pctFmt, relGap, relTxt, ppTxt } from '../../calc/coachAnalyze'
import type { CoachStrength, CoachBottleneck } from '../../calc/coachAnalyze'
import { Editable, type CoachEdits } from './Editable'

export function TcChip({ me, tc, pp }: { me: number | null; tc: number | null; pp?: boolean }) {
  if (!isNum(me) || !isNum(tc)) return null
  const good = (pp ? me - tc : (relGap(me, tc) ?? 0)) >= 0
  const label = pp ? ppTxt(me - tc) : relTxt(relGap(me, tc))
  return (
    <span className={`chip ${good ? 'good' : 'gap'}`}>
      {good ? '▲' : '▽'} TC 대비 {label}
    </span>
  )
}

export function Capsule({
  label,
  fullV,
  m6V,
  fmt,
  unit,
}: {
  label: string
  fullV: number | null
  m6V: number | null
  fmt: (v: number | null) => string
  unit?: string
}) {
  if (!isNum(fullV) || !isNum(m6V)) return null
  const diff = m6V - fullV
  const up = diff >= 0
  return (
    <>
      {label} <b>{fmt(m6V)}{unit ?? ''}</b>{' '}
      <span className={`delta ${up ? 'up' : 'down'}`}>
        {up ? '▲' : '▼'} {fmt(Math.abs(diff))}{unit ?? ''}
      </span>
    </>
  )
}

export function KpiCard({
  ico,
  label,
  sub,
  value,
  unit,
  chips,
  cap,
}: {
  ico: string
  label: string
  sub: string
  value: string
  unit: string
  chips: ReactNode
  cap?: ReactNode
}) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <div className="kpi-ico">{ico}</div>
        <div className="kpi-label">
          {label}
          <span className="kpi-sub">{sub}</span>
        </div>
      </div>
      <div className="kpi-row">
        <div className="kpi-val num">
          {value}
          <small>{unit}</small>
        </div>
        <div className="kpi-chips">{chips}</div>
      </div>
      {cap && <div className="kpi-cap num">{cap}</div>}
    </div>
  )
}

export function VsCard({
  name,
  sub,
  o,
  fmt,
  msg,
  msgId,
  edits,
  onCommit,
  base,
  callout,
  pp,
}: {
  name: string
  sub: string
  o: CoachMetric
  fmt: (v: number | null) => string
  msg: string | null
  msgId: string
  edits: CoachEdits
  onCommit: (id: string, html: string) => void
  base: string
  callout?: string
  pp?: boolean
}) {
  const mx = Math.max(o.me || 0, o.dg || 0, o.tc || 0) || 1
  const w = (v: number | null) => Math.max(4, Math.round(((v || 0) / mx) * 100))
  return (
    <div className="vs-card">
      <div className="vs-head">
        <div>
          <span className="vs-name">{name}</span>
          <span className="vs-sub">{sub}</span>
          {callout && <span className="co orange vs-co">{callout}</span>}
        </div>
        <TcChip me={o.me} tc={o.tc} pp={pp} />
      </div>
      <div className="vs-rows">
        <div className="vs-row me">
          <span className="vs-who">나</span>
          <div className="vs-track">
            <div className="vs-fill" style={{ width: `${w(o.me)}%` }} />
          </div>
          <span className="vs-val num">{fmt(o.me)}</span>
        </div>
        {isNum(o.dg) && (
          <div className="vs-row dg">
            <span className="vs-who">동일그룹</span>
            <div className="vs-track">
              <div className="vs-fill" style={{ width: `${w(o.dg)}%` }} />
            </div>
            <span className="vs-val num">{fmt(o.dg)}</span>
          </div>
        )}
        <div className="vs-row tc">
          <span className="vs-who">TC그룹</span>
          <div className="vs-track">
            <div className="vs-fill" style={{ width: `${w(o.tc)}%` }} />
          </div>
          <span className="vs-val num">{fmt(o.tc)}</span>
        </div>
      </div>
      {msg && <Editable id={msgId} html={msg} edits={edits} onCommit={onCommit} className="vs-msg" />}
      {base && <div className="basecap num">[{base}]</div>}
    </div>
  )
}

export function RingCard({
  name,
  o,
  desc,
  descId,
  edits,
  onCommit,
  base,
}: {
  name: string
  o: CoachMetric
  desc: string
  descId: string
  edits: CoachEdits
  onCommit: (id: string, html: string) => void
  base: string
}) {
  const p = isNum(o.me) ? Math.min(Math.round(o.me * 100), 100) : 0
  const deg = p * 3.6
  const behind = isNum(o.me) && isNum(o.tc) && o.me < o.tc
  return (
    <div className="ring-card">
      <div className="ring" style={{ background: `conic-gradient(var(--cr-hi) ${deg}deg, var(--cr-surface3) ${deg}deg)` }}>
        <div className="ring-in">
          <b className="num">{pctFmt(o.me)}</b>
          <span>나의 현재</span>
        </div>
      </div>
      <div className="ring-txt">
        <div className="ring-name">{name}</div>
        <Editable id={descId} html={desc} edits={edits} onCommit={onCommit} className="ring-desc" />
        <div className="ring-chips">
          {isNum(o.dg) && <span className="chip neutral num">동일그룹 {pctFmt(o.dg)}</span>}
          <span className="chip gap num">TC 목표 {pctFmt(o.tc)}</span>
          {behind && <span className="chip warn num">TC까지 {ppTxt(isNum(o.me) && isNum(o.tc) ? o.me - o.tc : null)}</span>}
        </div>
        {base && <div className="basecap num">[{base}]</div>}
      </div>
    </div>
  )
}

export function TrendCard({
  monthly,
  msg,
  msgId,
  edits,
  onCommit,
  base,
}: {
  monthly: { month: number; me: number; tc: number; dg: number }[]
  msg: string
  msgId: string
  edits: CoachEdits
  onCommit: (id: string, html: string) => void
  base: string
}) {
  const vals = monthly.flatMap((m) => [m.me, m.tc]).filter(isNum)
  const mx = Math.max(...vals, 1)
  return (
    <div className="trend-card">
      <div className="trend-head">
        <span className="trend-name">최근 6개월 장기건수 흐름</span>
        <div className="trend-legend">
          <span className="tl-me">
            <i />나
          </span>
          <span className="tl-tc">
            <i />TC그룹
          </span>
        </div>
      </div>
      <div className="trend-plot">
        {monthly.map((m, i) => {
          const hMe = Math.max(8, Math.round((m.me || 0) / mx * 100))
          const hTc = Math.max(8, Math.round((m.tc || 0) / mx * 100))
          const mon = String(m.month).slice(4, 6).replace(/^0/, '') + '월'
          return (
            <div className="tcol" key={m.month}>
              <div className="bars2">
                <div className="tbar me" style={{ height: `${hMe}%` }}>
                  <span className="tv num">{f1(m.me)}</span>
                </div>
                <div className="tbar tc" style={{ height: `${hTc}%` }}>
                  <span className="tv num">{f1(m.tc)}</span>
                </div>
              </div>
              <div className="tmon">{mon}</div>
            </div>
          )
        })}
      </div>
      <Editable id={msgId} html={msg} edits={edits} onCommit={onCommit} className="trend-msg" />
      {base && <div className="basecap num">[{base}]</div>}
    </div>
  )
}

export function ButterflyCard({ M, base }: { M: Record<string, CoachMetric>; base: string }) {
  const rows = [
    { lab: '신규고객 확보', unit: '명', me: M.newCust6.me, tc: M.newCust6.tc },
    { lab: '기존고객 재상담', unit: '명', me: M.oldCust6.me, tc: M.oldCust6.tc },
    { lab: '신규고객 계약', unit: '건', me: M.newCnt6.me, tc: M.newCnt6.tc },
    { lab: '기존고객 추가계약', unit: '건', me: M.oldCnt6.me, tc: M.oldCnt6.tc },
  ]
  const mx = Math.max(...rows.flatMap((r) => [r.me, r.tc]).filter(isNum), 1)
  const w = (v: number | null) => Math.max(5, Math.round(((v || 0) / mx) * 100))
  return (
    <div className="bfly">
      <div className="bfly-top">
        <span className="bfly-side l">◀ 나</span>
        <span className="bfly-mid">활동 구조 비교</span>
        <span className="bfly-side r">TC그룹 ▶</span>
      </div>
      {rows.map((r) => {
        const lead = isNum(r.me) && isNum(r.tc) ? r.me >= r.tc : null
        return (
          <div className="bf-row" key={r.lab}>
            <div className="bf-l">
              <span className="bf-val num">
                {f2(r.me)}
                {r.unit}
              </span>
              <div className="bf-bar" style={{ width: `${w(r.me)}%` }} />
            </div>
            <div className="bf-c">
              <div className="bf-lab">
                {r.lab}
                <br />
                <span style={{ fontSize: '10.5px', color: 'var(--cr-text3)' }}>월평균 · {r.unit === '명' ? '상담고객' : '가입건수'}</span>
              </div>
              {lead !== null && <span className={`co ${lead ? 'green' : 'orange'}`}>{lead ? '우위' : '기회'}</span>}
            </div>
            <div className="bf-r">
              <div className="bf-bar" style={{ width: `${w(r.tc)}%` }} />
              <span className="bf-val num">
                {f2(r.tc)}
                {r.unit}
              </span>
            </div>
          </div>
        )
      })}
      {base && <div className="basecap num">[{base}]</div>}
    </div>
  )
}

export function HeroCard({ hero }: { hero: { name: string; body: string; apply: string } }) {
  return (
    <div className="hero-card">
      <div className="hero-name">{hero.name}</div>
      <div className="hero-body" dangerouslySetInnerHTML={{ __html: hero.body }} />
      <div className="hero-apply">
        <b>→ 나에게 적용:</b> <span dangerouslySetInnerHTML={{ __html: hero.apply }} />
      </div>
    </div>
  )
}

export function StrengthCard({
  s,
  index,
  edits,
  onCommit,
}: {
  s: CoachStrength
  index: number
  edits: CoachEdits
  onCommit: (id: string, html: string) => void
}) {
  return (
    <div className="sb-card strength">
      <div className="sb-k">
        <div className="sb-ico">{index + 1}</div>
        <Editable id={`s-title-${s.id}`} html={s.title} edits={edits} onCommit={onCommit} as="span" className="sb-t" />
      </div>
      <span className="sb-num num">{s.num}</span>
      <Editable id={`s-desc-${s.id}`} html={s.desc} edits={edits} onCommit={onCommit} className="sb-d" />
    </div>
  )
}

export function BottleneckCard({
  b,
  index,
  edits,
  onCommit,
}: {
  b: CoachBottleneck
  index: number
  edits: CoachEdits
  onCommit: (id: string, html: string) => void
}) {
  return (
    <div className="sb-card bottleneck">
      <div className="sb-k">
        <div className="sb-ico">{index + 1}</div>
        <Editable id={`b-title-${b.id}`} html={b.title} edits={edits} onCommit={onCommit} as="span" className="sb-t" />
      </div>
      <span className="sb-num num">{b.num}</span>
      <Editable id={`b-desc-${b.id}`} html={b.desc} edits={edits} onCommit={onCommit} className="sb-d" />
      {b.q && <Editable id={`b-q-${b.id}`} html={b.q} edits={edits} onCommit={onCommit} className="sb-q" />}
    </div>
  )
}
