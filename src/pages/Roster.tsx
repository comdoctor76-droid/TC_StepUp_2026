/* ══════════════════════════════════════════════════════════════════════
   지역단 → 비전센터 → 지점 명단에서 여러 명을 체크해 일괄 인쇄/PDF 저장.

   256개 샤드를 전부 읽어(조직 단위 쿼리가 없음) 클라이언트에서 훑는다 —
   src/data/repository.ts loadAllPlanners() 참조. 세션 1회만 읽도록 캐시된다.
   ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react'
import { loadAllPlanners, type RosterEntry } from '../data/repository'
import { groupByOrg, sortedKeys, sortedPlanners, type OrgTree } from '../data/roster'
import { runBulkExport, type BulkMode, type BulkProgress } from '../export/bulk'
import { PrintRoot } from '../PrintRoot'
import type { FullAnalysis } from '../calc'

export function Roster({ onBack }: { onBack: () => void }) {
  const [tree, setTree] = useState<OrgTree | null>(null)
  const [loadProgress, setLoadProgress] = useState('0 / 256')
  const [err, setErr] = useState<string | null>(null)

  const [hq, setHq] = useState('')
  const [vc, setVc] = useState('')
  const [branch, setBranch] = useState('')
  const [checked, setChecked] = useState<Map<string, RosterEntry>>(new Map())

  const [showChoice, setShowChoice] = useState(false)
  const [showConfirmPrint, setShowConfirmPrint] = useState(false)
  const [current, setCurrent] = useState<{ A: FullAnalysis; caption: string } | null>(null)
  const [bulkBusy, setBulkBusy] = useState<string | null>(null)
  // ref 로 둔다 — 실행 중인 루프가 setState 클로저 caveat 없이 매 반복마다 최신 값을 읽는다
  const cancelRef = useRef(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    loadAllPlanners((done, total) => setLoadProgress(`${done} / ${total}`))
      .then((list) => setTree(groupByOrg(list)))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [])

  const hqOptions = tree ? sortedKeys(tree) : []
  const vcNode = tree && hq ? tree[hq] : null
  const vcOptions = vcNode ? sortedKeys(vcNode.visionCenters) : []
  const brNode = vcNode && vc ? vcNode.visionCenters[vc] : null
  const brOptions = brNode ? sortedKeys(brNode.branches) : []
  const branchNode = brNode && branch ? brNode.branches[branch] : null
  const roster = useMemo(() => (branchNode ? sortedPlanners(branchNode.planners) : []), [branchNode])
  const selected = useMemo(() => [...checked.values()], [checked])

  const toggle = (p: RosterEntry) => {
    setChecked((prev) => {
      const next = new Map(prev)
      if (next.has(p.code)) next.delete(p.code)
      else next.set(p.code, p)
      return next
    })
  }

  const busy = !!current || !!bulkBusy

  const startBulk = async (mode: BulkMode) => {
    setShowChoice(false)
    setShowConfirmPrint(false)
    cancelRef.current = false
    const codes = selected.map((p) => p.code)
    setBulkBusy(`0 / ${codes.length}`)
    const result = await runBulkExport(
      codes,
      mode,
      setCurrent,
      (p: BulkProgress) => {
        const who = p.name ?? p.code
        const pageInfo = p.page && p.pageTotal ? ` · ${p.page}/${p.pageTotal}페이지` : ''
        setBulkBusy(`${p.index} / ${p.total} · ${who}${pageInfo}`)
      },
      () => cancelRef.current,
    )
    setBulkBusy(null)
    setCurrent(null)
    setToast(
      `${codes.length}명 중 ${result.ok.length}명 완료` +
        (result.failed.length ? ` · ${result.failed.length}명 실패` : ''),
    )
    setTimeout(() => setToast(null), 6000)
  }

  return (
    <div className="gate gate--wide">
      <div className="gate__card roster">
        <button type="button" className="roster__back" onClick={onBack}>
          ← 사번으로 조회
        </button>
        <h1 className="gate__title">명단에서 선택</h1>

        {err && <p className="field__err">{err}</p>}
        {!tree && !err && <p className="gate__sub">명단을 불러오는 중… {loadProgress}</p>}

        {tree && (
          <>
            <div className="roster__drill">
              <label className="field">
                <span>지역단</span>
                <select
                  value={hq}
                  onChange={(e) => {
                    setHq(e.target.value)
                    setVc('')
                    setBranch('')
                  }}
                >
                  <option value="">선택</option>
                  {hqOptions.map((k) => (
                    <option key={k} value={k}>
                      {k} ({tree[k].count.toLocaleString('ko-KR')}명)
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>비전센터</span>
                <select
                  value={vc}
                  disabled={!vcNode}
                  onChange={(e) => {
                    setVc(e.target.value)
                    setBranch('')
                  }}
                >
                  <option value="">선택</option>
                  {vcOptions.map((k) => (
                    <option key={k} value={k}>
                      {k} ({vcNode!.visionCenters[k].count.toLocaleString('ko-KR')}명)
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>지점</span>
                <select value={branch} disabled={!brNode} onChange={(e) => setBranch(e.target.value)}>
                  <option value="">선택</option>
                  {brOptions.map((k) => (
                    <option key={k} value={k}>
                      {k} ({brNode!.branches[k].count.toLocaleString('ko-KR')}명)
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {branchNode && (
              <>
                <p className="roster__sum">
                  {hq} · {vc} · {branch} — 총 {branchNode.count.toLocaleString('ko-KR')}명
                </p>
                <ul className="roster__list">
                  <li className="roster__list-head">
                    <span />
                    <span>이름</span>
                    <span>사번</span>
                  </li>
                  {roster.map((p) => (
                    <li key={p.code}>
                      <input
                        type="checkbox"
                        checked={checked.has(p.code)}
                        onChange={() => toggle(p)}
                        aria-label={`${p.name} 선택`}
                      />
                      <span>{p.name}</span>
                      <span className="num">{p.code}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="roster__picked">
              <p className="roster__picked-title">선택됨 ({selected.length}명)</p>
              {selected.length > 0 && (
                <ul className="roster__picked-list">
                  {selected.map((p) => (
                    <li key={p.code}>
                      <span>
                        {p.name} ({p.code})
                      </span>
                      <button type="button" onClick={() => toggle(p)} aria-label={`${p.name} 선택 해제`}>
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled={selected.length === 0 || busy}
                onClick={() => setShowChoice(true)}
              >
                선택한 {selected.length}명 일괄 인쇄
              </button>
            </div>
          </>
        )}
      </div>

      {showChoice && (
        <div
          className="choice-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowChoice(false)}
        >
          <div className="choice-overlay__box" onClick={(e) => e.stopPropagation()}>
            <p className="choice-overlay__title">선택한 {selected.length}명을 어떻게 출력할까요?</p>
            <div className="choice-overlay__actions">
              <button className="btn btn--primary" onClick={() => setShowConfirmPrint(true)}>
                인쇄
              </button>
              <button className="btn btn--primary" onClick={() => void startBulk('pdf')}>
                PDF로 저장
              </button>
            </div>
            <button className="btn choice-overlay__cancel" onClick={() => setShowChoice(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {showConfirmPrint && (
        <div
          className="choice-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowConfirmPrint(false)}
        >
          <div className="choice-overlay__box" onClick={(e) => e.stopPropagation()}>
            <p className="choice-overlay__title">{selected.length}명을 한 번에 인쇄 하겠습니다.</p>
            <p className="choice-overlay__note">
              사람마다 인쇄창이 뜹니다 — 창을 닫아야 다음 사람으로 넘어갑니다.
            </p>
            <div className="choice-overlay__actions">
              <button className="btn btn--primary" onClick={() => void startBulk('print')}>
                OK
              </button>
            </div>
            <button className="btn choice-overlay__cancel" onClick={() => setShowConfirmPrint(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {bulkBusy && (
        <div className="overlay" role="status" aria-live="polite">
          <div className="overlay__box">
            <div className="overlay__spin" />
            <p>
              일괄 처리 중입니다
              <br />
              <b>{bulkBusy}</b>
            </p>
            <button className="btn overlay__dismiss" onClick={() => (cancelRef.current = true)}>
              중단
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {/* 일괄 처리 중 캡처/인쇄 대상 — 한 번에 한 명만 마운트한다 */}
      {current && <PrintRoot A={current.A} caption={current.caption} />}
    </div>
  )
}
