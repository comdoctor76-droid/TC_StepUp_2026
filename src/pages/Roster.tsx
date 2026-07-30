/* ══════════════════════════════════════════════════════════════════════
   지역단 → 비전센터 → 지점 명단에서 여러 명을 체크해 일괄 인쇄/PDF 저장.

   256개 샤드를 전부 읽어(조직 단위 쿼리가 없음) 클라이언트에서 훑는다 —
   src/data/repository.ts loadAllPlanners() 참조. 세션 1회만 읽도록 캐시된다.
   ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addStepupTargets,
  loadAllPlanners,
  loadPlanner,
  loadReference,
  loadStepupTargets,
  removeStepupTarget,
  type RosterEntry,
} from '../data/repository'
import {
  buildCodeIndex,
  groupByHq,
  groupByOrg,
  matchPastedCodes,
  parsePastedCodes,
  sortedKeys,
  sortedPlanners,
  STEPUP_VISION_CENTER,
  type HqGroup,
  type OrgTree,
} from '../data/roster'
import { runBulkExport, type BulkMode, type BulkProgress, type BulkTarget } from '../export/bulk'
import { PrintRoot } from '../PrintRoot'
import { CoachPrintRootForPerson } from '../tabs/coach/CoachPrintRootForPerson'
import type { CoverGender } from '../components/CoverPage'
import { analyze, type FullAnalysis } from '../calc'

export type PickMode = 'tree' | 'paste'

export function Roster({
  pickMode,
  onBack,
  onView,
}: {
  /** Search.tsx 상단 메뉴에서 고른 진입 방식 — 이 화면 안에서는 바꾸지 않는다 */
  pickMode: PickMode
  onBack: () => void
  /** 명단에서 사번을 클릭해 그 사람의 레포트를 바로 볼 때 */
  onView: (A: FullAnalysis, caption: string) => void
}) {
  const [planners, setPlanners] = useState<RosterEntry[] | null>(null)
  const [tree, setTree] = useState<OrgTree | null>(null)
  const [loadProgress, setLoadProgress] = useState('0 / 256')
  const [err, setErr] = useState<string | null>(null)

  const [hq, setHq] = useState('')
  const [vc, setVc] = useState('')
  const [branch, setBranch] = useState('')
  const [checked, setChecked] = useState<Map<string, RosterEntry>>(new Map())
  // 사람별 표지 성별 — 지정 안 하면 'F'(여, 기본값). 표지는 report 일괄 인쇄에만 쓰인다.
  const [genderMap, setGenderMap] = useState<Map<string, CoverGender>>(new Map())
  const [pasteText, setPasteText] = useState('')

  const [showChoice, setShowChoice] = useState(false)
  const [showConfirmPrint, setShowConfirmPrint] = useState(false)
  const [bulkTarget, setBulkTarget] = useState<BulkTarget>('report')
  const [current, setCurrent] = useState<{
    A: FullAnalysis
    caption: string
    cover?: CoverGender
  } | null>(null)
  const [bulkBusy, setBulkBusy] = useState<string | null>(null)
  // ref 로 둔다 — 실행 중인 루프가 setState 클로저 caveat 없이 매 반복마다 최신 값을 읽는다
  const cancelRef = useRef(false)
  const [toast, setToast] = useState<string | null>(null)

  // TC스텝업 대상자 (지역단별 저장 명단)
  const [stepupMap, setStepupMap] = useState<Record<string, string[]>>({})
  const [saveStepupPrompt, setSaveStepupPrompt] = useState<HqGroup[] | null>(null)
  const [savingStepup, setSavingStepup] = useState(false)

  // 명단 행의 사번을 클릭해 그 사람 레포트를 미리 볼 때
  const [previewTarget, setPreviewTarget] = useState<RosterEntry | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)

  useEffect(() => {
    loadAllPlanners((done, total) => setLoadProgress(`${done} / ${total}`))
      .then((list) => {
        setPlanners(list)
        setTree(groupByOrg(list))
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
    loadStepupTargets()
      .then(setStepupMap)
      .catch(() => {}) // 저장 명단은 부가 기능이라 실패해도 조회 자체는 막지 않는다
  }, [])

  const hqOptions = tree ? sortedKeys(tree) : []
  const vcNode = tree && hq ? tree[hq] : null
  const stepupCodes = hq ? (stepupMap[hq] ?? []) : []
  const vcOptions = useMemo(() => {
    const real = vcNode ? sortedKeys(vcNode.visionCenters) : []
    return stepupCodes.length > 0 ? [STEPUP_VISION_CENTER, ...real] : real
  }, [vcNode, stepupCodes])
  const isStepupView = vc === STEPUP_VISION_CENTER
  const brNode = !isStepupView && vcNode && vc ? vcNode.visionCenters[vc] : null
  const brOptions = brNode ? sortedKeys(brNode.branches) : []
  const branchNode = brNode && branch ? brNode.branches[branch] : null

  const codeIndex = useMemo(() => buildCodeIndex(planners ?? []), [planners])
  const stepupRoster = useMemo(
    () => (isStepupView ? sortedPlanners(matchPastedCodes(codeIndex, stepupCodes).matched) : []),
    [isStepupView, stepupCodes, codeIndex],
  )
  const roster = useMemo(
    () => (isStepupView ? stepupRoster : branchNode ? sortedPlanners(branchNode.planners) : []),
    [isStepupView, stepupRoster, branchNode],
  )
  const selected = useMemo(() => [...checked.values()], [checked])
  const { matched: pasteMatched, missing: pasteMissing } = useMemo(
    () => matchPastedCodes(codeIndex, parsePastedCodes(pasteText)),
    [codeIndex, pasteText],
  )
  const addPasteMatches = () => {
    if (pasteMatched.length === 0) return
    setChecked((prev) => {
      const next = new Map(prev)
      for (const p of pasteMatched) next.set(p.code, p)
      return next
    })
    setPasteText('')
  }

  const toggle = (p: RosterEntry) => {
    setChecked((prev) => {
      const next = new Map(prev)
      if (next.has(p.code)) next.delete(p.code)
      else next.set(p.code, p)
      return next
    })
  }

  const genderOf = (code: string): CoverGender => genderMap.get(code) ?? 'F'
  const setGender = (code: string, g: CoverGender) => {
    setGenderMap((prev) => {
      const next = new Map(prev)
      next.set(code, g)
      return next
    })
  }

  /** 이름 뒤 남/여 미니 토글 — 명단 행과 선택됨 목록에서 같이 쓴다 */
  const GenderMini = ({ code, name }: { code: string; name: string }) => (
    <span className="gender-mini" role="radiogroup" aria-label={`${name} 표지 성별`}>
      {(['M', 'F'] as const).map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={genderOf(code) === g}
          className={genderOf(code) === g ? 'is-active' : undefined}
          onClick={() => setGender(code, g)}
        >
          {g === 'M' ? '남' : '여'}
        </button>
      ))}
    </span>
  )

  const allChecked = roster.length > 0 && roster.every((p) => checked.has(p.code))
  const toggleAll = () => {
    setChecked((prev) => {
      const next = new Map(prev)
      if (allChecked) {
        for (const p of roster) next.delete(p.code)
      } else {
        for (const p of roster) next.set(p.code, p)
      }
      return next
    })
  }

  const busy = !!current || !!bulkBusy

  const removeFromStepup = async (targetHq: string, code: string) => {
    try {
      await removeStepupTarget(targetHq, code)
      setStepupMap((prev) => {
        const next = { ...prev, [targetHq]: (prev[targetHq] ?? []).filter((c) => c !== code) }
        if (next[targetHq].length === 0) delete next[targetHq]
        return next
      })
      if (targetHq === hq && (stepupMap[targetHq]?.length ?? 0) <= 1) setVc('')
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'TC스텝업 명단에서 빼지 못했습니다.')
      setTimeout(() => setToast(null), 5000)
    }
  }

  const confirmPreview = async () => {
    if (!previewTarget) return
    setPreviewBusy(true)
    try {
      const ref = await loadReference()
      const planner = await loadPlanner(previewTarget.code)
      if (!planner) throw new Error(`사번 '${previewTarget.code}' 데이터를 찾지 못했습니다.`)
      const A = analyze(previewTarget.code, planner, ref.benchmarks, ref.incomeMap, ref.dataset.months)
      onView(A, ref.dataset.caption)
    } catch (e) {
      setToast(e instanceof Error ? e.message : '레포트를 불러오지 못했습니다.')
      setTimeout(() => setToast(null), 5000)
    } finally {
      setPreviewBusy(false)
      setPreviewTarget(null)
    }
  }

  const confirmSaveStepup = async () => {
    if (!saveStepupPrompt) return
    setSavingStepup(true)
    try {
      for (const g of saveStepupPrompt) {
        await addStepupTargets(
          g.hq,
          g.entries.map((p) => p.code),
        )
        setStepupMap((prev) => ({
          ...prev,
          [g.hq]: [...new Set([...(prev[g.hq] ?? []), ...g.entries.map((p) => p.code)])],
        }))
      }
      setToast('TC스텝업 대상자로 저장했습니다.')
    } catch (e) {
      setToast(e instanceof Error ? e.message : '저장하지 못했습니다.')
    } finally {
      setTimeout(() => setToast(null), 5000)
      setSavingStepup(false)
      setSaveStepupPrompt(null)
    }
  }

  const startBulk = async (mode: BulkMode) => {
    setShowChoice(false)
    setShowConfirmPrint(false)
    cancelRef.current = false
    const codes = selected.map((p) => p.code)
    const people = selected.map((p) => ({ code: p.code, cover: genderOf(p.code) }))
    setBulkBusy(`0 / ${codes.length}`)
    const result = await runBulkExport(
      people,
      mode,
      bulkTarget,
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

    // 방금 처리에 성공한 사람 중, 아직 그 지역단의 TC스텝업 명단에 없는 사람이 있으면
    // 저장할지 물어본다(이미 전부 저장돼 있으면 — 즉 TC스텝업 목록을 그대로 재인쇄한
    // 경우 — 다시 묻지 않는다).
    const okCodes = new Set(result.ok.map((o) => o.code))
    const okEntries = selected.filter((p) => okCodes.has(p.code))
    const groups = groupByHq(okEntries).filter((g) =>
      g.entries.some((p) => !(stepupMap[g.hq] ?? []).includes(p.code)),
    )
    if (groups.length > 0) setSaveStepupPrompt(groups)
    setTimeout(() => setToast(null), 6000)
  }

  return (
    <div className="gate gate--wide">
      <div className="gate__card roster">
        <button type="button" className="roster__back" onClick={onBack}>
          ← 사번으로 조회
        </button>
        <h1 className="gate__title">{pickMode === 'paste' ? '사번 붙여넣기' : '명단에서 선택'}</h1>

        {err && <p className="field__err">{err}</p>}
        {!tree && !err && <p className="gate__sub">명단을 불러오는 중… {loadProgress}</p>}

        {tree && (
          <>
            {pickMode === 'paste' && (
              <div className="roster__paste">
                <label className="field">
                  <span>사번 붙여넣기 (헤더 없이 한 줄에 하나씩)</span>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={'1B4503\n1C1234\n...'}
                    rows={8}
                    spellCheck={false}
                  />
                </label>
                {pasteText.trim() && (
                  <p className="roster__paste-status">
                    인식됨 {pasteMatched.length}명
                    {pasteMissing.length > 0 && (
                      <>
                        {' '}
                        · 찾지 못함 {pasteMissing.length}개 (
                        {pasteMissing.slice(0, 5).join(', ')}
                        {pasteMissing.length > 5 ? ' 외' : ''})
                      </>
                    )}
                  </p>
                )}
                <button
                  type="button"
                  className="btn btn--primary btn--block"
                  disabled={pasteMatched.length === 0}
                  onClick={addPasteMatches}
                >
                  선택에 추가{pasteMatched.length > 0 ? ` (${pasteMatched.length}명)` : ''}
                </button>
              </div>
            )}

            {pickMode === 'tree' && (
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
                          {k} (
                          {(k === STEPUP_VISION_CENTER
                            ? stepupCodes.length
                            : vcNode!.visionCenters[k].count
                          ).toLocaleString('ko-KR')}
                          명)
                        </option>
                      ))}
                    </select>
                  </label>
                  {!isStepupView && (
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
                  )}
                </div>

                {(branchNode || isStepupView) && (
                  <>
                    <p className="roster__sum">
                      {isStepupView
                        ? `${hq} · TC스텝업 — 총 ${stepupRoster.length.toLocaleString('ko-KR')}명`
                        : `${hq} · ${vc} · ${branch} — 총 ${branchNode!.count.toLocaleString('ko-KR')}명`}
                    </p>
                    <ul className="roster__list">
                      <li className={`roster__list-head ${isStepupView ? 'roster__list--stepup' : ''}`}>
                        <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="전체선택" />
                        <span>이름</span>
                        <span className="roster__gender-head">표지</span>
                        <span>사번</span>
                        {isStepupView && <span />}
                      </li>
                      {roster.map((p) => (
                        <li key={p.code} className={isStepupView ? 'roster__list--stepup' : undefined}>
                          <input
                            type="checkbox"
                            checked={checked.has(p.code)}
                            onChange={() => toggle(p)}
                            aria-label={`${p.name} 선택`}
                          />
                          <span>{p.name}</span>
                          <GenderMini code={p.code} name={p.name} />
                          <button
                            type="button"
                            className="roster__code-link num"
                            onClick={() => setPreviewTarget(p)}
                          >
                            {p.code}
                          </button>
                          {isStepupView && (
                            <button
                              type="button"
                              className="roster__stepup-remove"
                              onClick={() => void removeFromStepup(hq, p.code)}
                              aria-label={`${p.name} TC스텝업 명단에서 빼기`}
                            >
                              빼기
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
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
                      <GenderMini code={p.code} name={p.name} />
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
                onClick={() => {
                  setBulkTarget('report')
                  setShowChoice(true)
                }}
              >
                선택한 {selected.length}명 일괄 인쇄
              </button>
              <button
                type="button"
                className="btn btn--block roster__coach-print"
                disabled={selected.length === 0 || busy}
                onClick={() => {
                  setBulkTarget('coach')
                  setShowChoice(true)
                }}
              >
                성장코칭 인쇄하기
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
            <p className="choice-overlay__title">
              선택한 {selected.length}명{bulkTarget === 'coach' ? '의 성장코칭 리포트를' : ''} 어떻게
              출력할까요?
            </p>
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
            <p className="choice-overlay__title">
              {selected.length}명{bulkTarget === 'coach' ? '의 성장코칭 리포트를' : ''} 한 번에 인쇄
              하겠습니다.
            </p>
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

      {previewTarget && (
        <div
          className="choice-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !previewBusy && setPreviewTarget(null)}
        >
          <div className="choice-overlay__box" onClick={(e) => e.stopPropagation()}>
            <p className="choice-overlay__title">
              {previewTarget.name}({previewTarget.code})님의 자가진단 레포트를 확인하시겠습니까?
            </p>
            <div className="choice-overlay__actions">
              <button className="btn btn--primary" disabled={previewBusy} onClick={() => void confirmPreview()}>
                {previewBusy ? '불러오는 중…' : '예'}
              </button>
            </div>
            <button
              className="btn choice-overlay__cancel"
              disabled={previewBusy}
              onClick={() => setPreviewTarget(null)}
            >
              아니오
            </button>
          </div>
        </div>
      )}

      {saveStepupPrompt && (
        <div
          className="choice-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !savingStepup && setSaveStepupPrompt(null)}
        >
          <div className="choice-overlay__box" onClick={(e) => e.stopPropagation()}>
            {saveStepupPrompt.length === 1 ? (
              <p className="choice-overlay__title">
                '{saveStepupPrompt[0].hq}' 지역단 TC스텝업 대상자로 저장하시겠습니까?
                <br />({saveStepupPrompt[0].entries.length}명)
              </p>
            ) : (
              <>
                <p className="choice-overlay__title">
                  선택한 인원이 여러 지역단에 걸쳐 있습니다. 각 지역단의 TC스텝업 대상자로
                  저장하시겠습니까?
                </p>
                <p className="choice-overlay__note">
                  {saveStepupPrompt.map((g) => `${g.hq} ${g.entries.length}명`).join(' · ')}
                </p>
              </>
            )}
            <div className="choice-overlay__actions">
              <button
                className="btn btn--primary"
                disabled={savingStepup}
                onClick={() => void confirmSaveStepup()}
              >
                {savingStepup ? '저장 중…' : '저장'}
              </button>
            </div>
            <button
              className="btn choice-overlay__cancel"
              disabled={savingStepup}
              onClick={() => setSaveStepupPrompt(null)}
            >
              저장 안 함
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {/* 일괄 처리 중 캡처/인쇄 대상 — 한 번에 한 명만 마운트한다 */}
      {current &&
        (bulkTarget === 'coach' ? (
          <CoachPrintRootForPerson A={current.A} caption={current.caption} />
        ) : (
          <PrintRoot A={current.A} caption={current.caption} cover={current.cover} />
        ))}
    </div>
  )
}
