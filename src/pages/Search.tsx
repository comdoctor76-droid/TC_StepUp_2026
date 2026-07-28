import { useEffect, useState } from 'react'
import { loadPlanner, loadReference } from '../data/repository'
import { analyze, type FullAnalysis } from '../calc'
import { normalizeCode } from '../data/shard'
import { ym } from '../calc/format'
import { lockViewer } from '../session'
import { Roster } from './Roster'
import { APP_VERSION, CONTACT_LINE } from '../version'

const LAST_KEY = 'tc-stepup:lastCode'

export function Search({
  onFound,
}: {
  onFound: (a: FullAnalysis, caption: string) => void
}) {
  const [mode, setMode] = useState<'code' | 'paste' | 'roster'>('code')
  const [code, setCode] = useState(() => localStorage.getItem(LAST_KEY) ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [meta, setMeta] = useState<{ months: number[]; rowCount: number; caption: string } | null>(
    null,
  )

  useEffect(() => {
    loadReference()
      .then((r) =>
        setMeta({ months: r.dataset.months, rowCount: r.dataset.rowCount, caption: r.dataset.caption }),
      )
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const c = normalizeCode(code)
    if (!c) return
    setBusy(true)
    setErr(null)
    try {
      const ref = await loadReference()
      const planner = await loadPlanner(c)
      if (!planner) {
        setErr(`사번 '${code}' 에 해당하는 플래너를 찾지 못했습니다.`)
        return
      }
      localStorage.setItem(LAST_KEY, c)
      const A = analyze(c, planner, ref.benchmarks, ref.incomeMap, ref.dataset.months)
      onFound(A, ref.dataset.caption)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '조회 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (mode !== 'code') {
    return (
      <Roster
        pickMode={mode === 'paste' ? 'paste' : 'tree'}
        onBack={() => setMode('code')}
        onView={onFound}
      />
    )
  }

  return (
    <div className="gate">
      <form className="gate__card" onSubmit={submit}>
        <h1 className="gate__title">
          현대해상 26년 3분기
          <br />
          TC Step-Up On-line
        </h1>
        <p className="gate__sub">
          {meta
            ? `기준 ${ym(meta.months[0])} ~ ${ym(meta.months[meta.months.length - 1])} · 플래너 ${meta.rowCount.toLocaleString('ko-KR')}명`
            : '기준 데이터를 불러오는 중…'}
        </p>

        <div className="gate__mode" role="group" aria-label="조회 방식">
          <button type="button" className="gate__mode-btn is-on">
            사번으로 조회
          </button>
          <button type="button" className="gate__mode-btn" onClick={() => setMode('paste')}>
            사번 붙여넣기
          </button>
          <button type="button" className="gate__mode-btn" onClick={() => setMode('roster')}>
            명단에서 선택
          </button>
        </div>

        <label className="field">
          <span>사번</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="사번을 입력하세요"
            autoFocus
            required
            spellCheck={false}
            autoCapitalize="characters"
          />
        </label>

        {err && <p className="field__err">{err}</p>}

        <button className="btn btn--primary btn--block" disabled={busy || !code}>
          {busy ? '조회 중…' : '레포트 보기'}
        </button>

        <button
          type="button"
          className="gate__admin gate__admin--btn"
          onClick={() => {
            lockViewer()
            location.reload()
          }}
        >
          로그아웃
        </button>

        <p className="gate__foot">
          v{APP_VERSION}
          <br />
          {CONTACT_LINE}
        </p>
      </form>
    </div>
  )
}
