import { useEffect, useMemo, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { parseWorkbook, type ParsedWorkbook } from '../data/parseWorkbook'
import { uploadParsed } from '../data/upload'
import { clearCache, sha256 } from '../data/repository'
import {
  adminSignIn,
  adminSignOut,
  createAdminAccount,
  isAdminUser,
  loadAdminProfile,
  watchAuth,
  type AdminProfile,
} from '../session'
import { TC_GROUP } from '../data/schema'
import { DEFAULT_CAPTION, REPORT_TITLE_SHORT } from '../version'

const DEFAULT_MONTHS = '202601-202606'

function parseMonths(spec: string): number[] {
  const m = spec.trim().match(/^(\d{6})\s*-\s*(\d{6})$/)
  if (!m) throw new Error("기준월 형식이 올바르지 않습니다. 예: '202601-202606'")
  const out: number[] = []
  let [y, mo] = [Number(m[1].slice(0, 4)), Number(m[1].slice(4))]
  const end = Number(m[2])
  for (let i = 0; i < 24; i++) {
    const cur = y * 100 + mo
    out.push(cur)
    if (cur === end) break
    mo++
    if (mo > 12) {
      mo = 1
      y++
    }
  }
  if (out.length !== 6) {
    throw new Error(`기준월은 6개월이어야 합니다 (현재 ${out.length}개월).`)
  }
  return out
}

export function Admin() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => watchAuth((u) => { setUser(u); setReady(true) }), [])

  if (!ready) return <div className="gate"><div className="gate__card">불러오는 중…</div></div>
  if (!isAdminUser(user)) return <AdminLogin />
  return <AdminPanel user={user!} />
}

function AdminLogin() {
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await adminSignIn(code, pw)
    } catch {
      setErr('사번 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <form className="gate__card" onSubmit={submit}>
        <h1 className="gate__title">관리자 로그인</h1>
        <p className="gate__sub">사번으로 로그인하는 관리자 계정</p>
        <label className="field">
          <span>사번</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoFocus
            spellCheck={false}
            autoCapitalize="characters"
          />
          <em className="field__hint">v0.20 이전에 이메일로 만든 계정은 그 이메일을 그대로 입력하세요.</em>
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        </label>
        {err && <p className="field__err">{err}</p>}
        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
        <a className="gate__admin" href="#/">← 조회 화면</a>
      </form>
    </div>
  )
}

function AdminPanel({ user }: { user: User }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null)
  const [fileName, setFileName] = useState('')
  const [monthSpec, setMonthSpec] = useState(DEFAULT_MONTHS)
  const [caption, setCaption] = useState(DEFAULT_CAPTION)
  const [viewerPw, setViewerPw] = useState('')
  const [resume, setResume] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [profile, setProfile] = useState<AdminProfile | null>(null)
  useEffect(() => {
    loadAdminProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user.uid])

  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [addCode, setAddCode] = useState('')
  const [addPw, setAddPw] = useState('')
  const [addName, setAddName] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addErr, setAddErr] = useState<string | null>(null)

  async function submitAddAdmin(e: React.FormEvent) {
    e.preventDefault()
    setAddBusy(true)
    setAddErr(null)
    try {
      await createAdminAccount(addCode, addPw, addName)
      setStatus(`✅ 관리자 계정을 추가했습니다 — ${addName} (${addCode})`)
      setShowAddAdmin(false)
      setAddCode('')
      setAddPw('')
      setAddName('')
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : '관리자 계정을 만들지 못했습니다.')
    } finally {
      setAddBusy(false)
    }
  }

  const months = useMemo(() => {
    try {
      return { ok: true as const, value: parseMonths(monthSpec) }
    } catch (e) {
      return { ok: false as const, message: (e as Error).message }
    }
  }, [monthSpec])

  async function onFile(f: File) {
    setErr(null)
    setParsed(null)
    setBusy(true)
    setStatus('엑셀을 읽는 중… (15MB 기준 20~30초)')
    try {
      const buf = await f.arrayBuffer()
      const p = parseWorkbook(buf)
      setParsed(p)
      setFileName(f.name)
      setStatus(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '파일을 읽지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function doUpload() {
    if (!parsed || !months.ok) return
    setBusy(true)
    setErr(null)
    try {
      const hash = viewerPw ? await sha256(viewerPw) : undefined
      const r = await uploadParsed(
        parsed,
        {
          months: months.value,
          caption,
          sourceFileName: fileName,
          viewerPasswordHash: hash,
          resume,
        },
        (d, t, label) => setStatus(`업로드 중 ${d}/${t} — ${label}`),
      )
      clearCache()
      setStatus(
        `✅ 완료 — 샤드 ${r.shardsWritten}개 기록${r.skipped ? `, ${r.skipped}개 건너뜀` : ''}. 플래너 ${parsed.rowCount.toLocaleString('ko-KR')}명`,
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : '업로드에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const checks = parsed
    ? [
        { ok: parsed.rowCount > 0, text: `플래너 ${parsed.rowCount.toLocaleString('ko-KR')}명` },
        {
          ok: !!parsed.benchmarks[TC_GROUP],
          text: `벤치마크 ${Object.keys(parsed.benchmarks).length}개 구간 (TC 표준그룹 ${parsed.benchmarks[TC_GROUP] ? '있음' : '없음'})`,
        },
        {
          ok: Object.keys(parsed.incomeMap.groupOf).length > 0,
          text: `소득구간 매핑 ${Object.keys(parsed.incomeMap.groupOf).length}건`,
        },
        {
          ok: Object.values(parsed.planners).some((p) => p.s.retainLong.length === 6),
          text: '최근 6개월 추이 데이터 (Q6 / Q7 시트)',
        },
      ]
    : []

  return (
    <div className="admin">
      <header className="appbar">
        <div className="appbar__who">
          <b>{profile?.name ?? '관리자'}</b>
          <span>{profile?.code ?? ''}</span>
        </div>
        <div className="appbar__actions">
          <button className="btn" onClick={() => setShowAddAdmin(true)}>
            관리자 추가하기
          </button>
          <a className="btn" href="#/">조회 화면</a>
          <button className="btn" onClick={() => void adminSignOut()}>로그아웃</button>
        </div>
      </header>

      {showAddAdmin && (
        <div
          className="choice-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !addBusy && setShowAddAdmin(false)}
        >
          <form
            className="choice-overlay__box admin__add-form"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitAddAdmin}
          >
            <p className="choice-overlay__title">관리자 추가하기</p>
            <label className="field">
              <span>사번</span>
              <input
                value={addCode}
                onChange={(e) => setAddCode(e.target.value)}
                required
                autoFocus
                spellCheck={false}
                autoCapitalize="characters"
              />
            </label>
            <label className="field">
              <span>비밀번호</span>
              <input
                type="password"
                value={addPw}
                onChange={(e) => setAddPw(e.target.value)}
                required
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span>성명</span>
              <input value={addName} onChange={(e) => setAddName(e.target.value)} required />
            </label>
            {addErr && <p className="field__err">{addErr}</p>}
            <div className="choice-overlay__actions">
              <button className="btn btn--primary" disabled={addBusy}>
                {addBusy ? '추가하는 중…' : '추가'}
              </button>
            </div>
            <button
              type="button"
              className="btn choice-overlay__cancel"
              disabled={addBusy}
              onClick={() => setShowAddAdmin(false)}
            >
              취소
            </button>
          </form>
        </div>
      )}

      <main className="admin__body">
        <h2 className="sec">1. 원본 엑셀 업로드</h2>
        <div
          className="drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f) void onFile(f)
          }}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
            }}
          />
          <p>
            <b>{REPORT_TITLE_SHORT} 원본 .xlsx</b> 를 여기에 끌어다 놓거나 클릭해서 선택
          </p>
          <small>읽는 시트 : input · 소득별Data · Q6 유지고객 · Q7 장기건수</small>
          {fileName && <p className="drop__file">{fileName}</p>}
        </div>

        {parsed && (
          <>
            <h2 className="sec">2. 검증</h2>
            <ul className="checks">
              {checks.map((c, i) => (
                <li key={i} className={c.ok ? 'ok' : 'ng'}>
                  {c.ok ? '✓' : '✕'} {c.text}
                </li>
              ))}
            </ul>
            {parsed.warnings.length > 0 && (
              <details className="warns">
                <summary>경고 {parsed.warnings.length}건</summary>
                <ul>
                  {parsed.warnings.slice(0, 50).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}

            <h2 className="sec">3. 설정</h2>
            <div className="admin__form">
              <label className="field">
                <span>기준월 (6개월)</span>
                <input value={monthSpec} onChange={(e) => setMonthSpec(e.target.value)} placeholder="202601-202606" />
                {!months.ok && <em className="field__err">{months.message}</em>}
                {months.ok && <em className="field__hint">{months.value.join(' · ')}</em>}
              </label>
              <label className="field">
                <span>레포트 캡션</span>
                <input value={caption} onChange={(e) => setCaption(e.target.value)} />
              </label>
              <label className="field">
                <span>접속 비밀번호 (변경할 때만 입력)</span>
                <input
                  type="password"
                  value={viewerPw}
                  onChange={(e) => setViewerPw(e.target.value)}
                  placeholder="비워 두면 기존 비밀번호 유지"
                  autoComplete="new-password"
                />
                <em className="field__hint">SHA-256 해시만 저장되며 평문은 어디에도 남지 않습니다.</em>
              </label>
              <label className="field field--check">
                <input type="checkbox" checked={resume} onChange={(e) => setResume(e.target.checked)} />
                <span>이어서 올리기 (같은 파일명으로 중단된 업로드가 있으면 건너뜀)</span>
              </label>
            </div>

            <h2 className="sec">4. 업로드</h2>
            <button className="btn btn--primary btn--block" onClick={doUpload} disabled={busy || !months.ok}>
              {busy ? '업로드 중…' : 'Firestore 에 적재'}
            </button>
          </>
        )}

        {status && <p className="admin__status">{status}</p>}
        {err && <p className="field__err">{err}</p>}
      </main>
    </div>
  )
}
