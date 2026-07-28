import { useState } from 'react'
import { unlockViewer } from '../session'
import { APP_VERSION, CONTACT_LINE } from '../version'

export function Login({ onUnlocked }: { onUnlocked: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const r = await unlockViewer(pw)
      if (r.ok) onUnlocked()
      else setErr(r.message ?? '접속할 수 없습니다.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : '접속 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <form className="gate__card" onSubmit={submit}>
        <h1 className="gate__title">
          현대해상 26년 3분기
          <br />
          TC Step-Up On-line
        </h1>
        <p className="gate__sub">영업교육운영파트</p>

        <label className="field">
          <span>접속 비밀번호</span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>

        {err && <p className="field__err">{err}</p>}

        <button className="btn btn--primary btn--block" disabled={busy || !pw}>
          {busy ? '확인 중…' : '접속'}
        </button>

        <a className="gate__admin" href="#/admin">
          관리자 화면
        </a>

        <p className="gate__foot">
          v{APP_VERSION}
          <br />
          {CONTACT_LINE}
        </p>
      </form>
    </div>
  )
}
