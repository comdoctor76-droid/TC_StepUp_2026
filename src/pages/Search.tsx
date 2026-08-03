import { useEffect, useState } from 'react'
import { loadAllPlanners, loadPlanner, loadReference, type RosterEntry } from '../data/repository'
import { analyze, type FullAnalysis } from '../calc'
import { normalizeCode } from '../data/shard'
import { searchByName } from '../data/roster'
import { ym } from '../calc/format'
import { lockViewer } from '../session'
import { Roster } from './Roster'
import { usePersonPreview, PersonPreviewDialog } from '../components/PersonPreviewDialog'
import { APP_VERSION, CONTACT_LINE } from '../version'

const LAST_KEY = 'tc-stepup:lastCode'

export function Search({
  onFound,
}: {
  onFound: (a: FullAnalysis, caption: string) => void
}) {
  const [mode, setMode] = useState<'code' | 'paste' | 'roster' | 'browse'>('code')
  const [query, setQuery] = useState(() => localStorage.getItem(LAST_KEY) ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 사번은 바로 레포트로 넘어가지만, 성명 검색은 몇 명이 나오든 여기 목록에
  // 담아 항상 클릭해 확인하게 한다 — 동명이인 오검색 방지.
  const [results, setResults] = useState<RosterEntry[] | null>(null)
  const [meta, setMeta] = useState<{ months: number[]; rowCount: number; caption: string } | null>(
    null,
  )
  const preview = usePersonPreview(onFound, (message) => setErr(message))

  useEffect(() => {
    loadReference()
      .then((r) =>
        setMeta({ months: r.dataset.months, rowCount: r.dataset.rowCount, caption: r.dataset.caption }),
      )
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const raw = query.trim()
    if (!raw) return
    setBusy(true)
    setErr(null)
    setResults(null)
    try {
      const ref = await loadReference()
      // 사번 정확 조회를 먼저 시도한다 — 샤드 1건만 읽어 빠르고, 기존 동작과 동일하게
      // 바로 레포트로 진입한다(회귀 없음).
      const c = normalizeCode(raw)
      const planner = c ? await loadPlanner(c) : null
      if (planner) {
        localStorage.setItem(LAST_KEY, c)
        const A = analyze(c, planner, ref.benchmarks, ref.incomeMap, ref.dataset.months)
        onFound(A, ref.dataset.caption)
        return
      }
      // 사번이 아니거나 못 찾았으면 성명으로 폴백 — 전체 명단을 훑는다(세션 캐시).
      const list = await loadAllPlanners()
      const matches = searchByName(list, raw)
      if (matches.length === 0) {
        setErr(`'${raw}' 에 해당하는 사번 또는 성명을 찾지 못했습니다.`)
      } else {
        setResults(matches)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '조회 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (mode !== 'code') {
    return (
      <Roster
        pickMode={mode === 'paste' ? 'paste' : mode === 'browse' ? 'browse' : 'tree'}
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
          <button type="button" className="gate__mode-btn" onClick={() => setMode('browse')}>
            지역단별 조회
          </button>
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
          <span>사번 · 성명</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setResults(null)
              setErr(null)
            }}
            placeholder="사번 또는 성명을 입력하세요"
            autoFocus
            required
            spellCheck={false}
            autoCapitalize="characters"
          />
          <em className="field__hint">사번, 성명을 입력하시면 조회됩니다.</em>
        </label>

        {err && <p className="field__err">{err}</p>}

        {results && (
          <ul className="search-results">
            {results.map((p) => (
              <li key={p.code}>
                <button
                  type="button"
                  className="search-results__row"
                  onClick={() => preview.setTarget(p)}
                >
                  <span className="search-results__who">
                    <span className="search-results__name">{p.name}</span>
                    <span className="search-results__org">
                      {p.hq} · {p.branch}
                    </span>
                  </span>
                  <span className="search-results__code num">{p.code}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button className="btn btn--primary btn--block" disabled={busy || !query.trim()}>
          {busy ? '조회 중…' : '조회'}
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

      {preview.target && (
        <PersonPreviewDialog
          target={preview.target}
          busy={preview.busy}
          onConfirm={() => void preview.confirm()}
          onCancel={() => preview.setTarget(null)}
        />
      )}
    </div>
  )
}
