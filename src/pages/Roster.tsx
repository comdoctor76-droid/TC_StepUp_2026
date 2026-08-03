/* ══════════════════════════════════════════════════════════════════════
   지역단 → 비전센터 → 지점 명단에서 여러 명을 체크해 일괄 인쇄/PDF 저장.

   256개 샤드를 전부 읽어(조직 단위 쿼리가 없음) 클라이언트에서 훑는다 —
   src/data/repository.ts loadAllPlanners() 참조. 세션 1회만 읽도록 캐시된다.
   ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  addStepupTargets,
  loadAllPlanners,
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
import { usePersonPreview, PersonPreviewDialog } from '../components/PersonPreviewDialog'
import { type FullAnalysis } from '../calc'

export type PickMode = 'tree' | 'paste' | 'browse'

/** 남/여 표지 선택값을 기기에 기억하는 localStorage 키 */
const GENDER_STORE_KEY = 'tcstepup.coverGender'

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
  // 한 번 고른 값은 이 기기(localStorage)에 저장되어 다음에 들어와도 그대로 남는다.
  const [genderMap, setGenderMap] = useState<Map<string, CoverGender>>(() => {
    try {
      const raw = localStorage.getItem(GENDER_STORE_KEY)
      if (raw) return new Map(Object.entries(JSON.parse(raw)) as [string, CoverGender][])
    } catch {
      /* 저장값이 깨져 있으면 무시하고 빈 상태로 시작 */
    }
    return new Map()
  })
  // 사람별 성장코칭 인쇄 여부 / 강사용 가이드 포함 여부 (일괄 인쇄 시)
  const [coachSet, setCoachSet] = useState<Set<string>>(new Set())
  const [guideSet, setGuideSet] = useState<Set<string>>(new Set())
  const [pasteText, setPasteText] = useState('')

  const [showChoice, setShowChoice] = useState(false)
  const [showConfirmPrint, setShowConfirmPrint] = useState(false)
  const [bulkTarget, setBulkTarget] = useState<BulkTarget>('report')
  const [current, setCurrent] = useState<{
    A: FullAnalysis
    caption: string
    kind: BulkTarget
    cover?: CoverGender
    guide?: boolean
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
  const preview = usePersonPreview(onView, (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 5000)
  })

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
  // 지역단별 조회(browse)에서도 저장된 TC스텝업 명단을 보여준다 — 명단 렌더링은
  // pickMode 별로 이미 분리돼 있어(browse 는 이름+사번만, 체크박스·빼기 없음)
  // 여기서 걸러낼 필요가 없다.
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
  // 코칭·가이드는 왼쪽 선택 체크와 무관하게 그 행의 체크만으로 인쇄 대상이 된다.
  // (사용자 요청: "행의 코칭/가이드 체크만으로 바로 인쇄")
  const coachEntries = useMemo(
    () => sortedPlanners(matchPastedCodes(codeIndex, [...coachSet]).matched),
    [codeIndex, coachSet],
  )
  const guideEntries = useMemo(
    () => sortedPlanners(matchPastedCodes(codeIndex, [...guideSet]).matched),
    [codeIndex, guideSet],
  )
  /** 지금 누른 버튼이 대상으로 삼는 사람들 */
  const bulkEntries =
    bulkTarget === 'coach' ? coachEntries : bulkTarget === 'guide' ? guideEntries : selected
  const targetLabel =
    bulkTarget === 'coach'
      ? '의 성장코칭 리포트를'
      : bulkTarget === 'guide'
        ? '의 강사용 가이드를'
        : '의 스텝업 레포트를'
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

  const persistGenders = (m: Map<string, CoverGender>) => {
    try {
      localStorage.setItem(GENDER_STORE_KEY, JSON.stringify(Object.fromEntries(m)))
    } catch {
      /* 저장 실패(시크릿 모드 등)해도 화면 동작에는 지장 없다 */
    }
  }
  const genderOf = (code: string): CoverGender => genderMap.get(code) ?? 'F'
  const setGender = (code: string, g: CoverGender) => {
    setGenderMap((prev) => {
      const next = new Map(prev)
      next.set(code, g)
      persistGenders(next)
      return next
    })
  }
  /** 지금 보이는 명단 전체에 성별 일괄 적용 */
  const setGenderAll = (g: CoverGender) => {
    setGenderMap((prev) => {
      const next = new Map(prev)
      for (const p of roster) next.set(p.code, g)
      persistGenders(next)
      return next
    })
  }

  const toggleInSet =
    (setFn: Dispatch<SetStateAction<Set<string>>>) => (code: string) => {
      setFn((prev) => {
        const next = new Set(prev)
        if (next.has(code)) next.delete(code)
        else next.add(code)
        return next
      })
    }
  const toggleCoach = toggleInSet(setCoachSet)
  const toggleGuide = toggleInSet(setGuideSet)
  /** 지금 보이는 명단 전체 켬/끔 — 전부 켜져 있으면 끄고, 아니면 켠다 */
  const toggleAllInSet = (setFn: Dispatch<SetStateAction<Set<string>>>) => {
    setFn((prev) => {
      const allOn = roster.length > 0 && roster.every((p) => prev.has(p.code))
      const next = new Set(prev)
      for (const p of roster) {
        if (allOn) next.delete(p.code)
        else next.add(p.code)
      }
      return next
    })
  }

  /** 남/여 미니 토글 — 명단 행과 선택됨 목록에서 같이 쓴다 */
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
    const people = bulkEntries.map((p) => ({
      code: p.code,
      cover: genderOf(p.code),
      guide: guideSet.has(p.code),
    }))
    setBulkBusy(`0 / ${people.length}`)
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
      `${people.length}명 중 ${result.ok.length}명 완료` +
        (result.failed.length ? ` · ${result.failed.length}명 실패` : ''),
    )

    // 방금 처리에 성공한 사람 중, 아직 그 지역단의 TC스텝업 명단에 없는 사람이 있으면
    // 저장할지 물어본다(이미 전부 저장돼 있으면 — 즉 TC스텝업 목록을 그대로 재인쇄한
    // 경우 — 다시 묻지 않는다).
    const okCodes = new Set(result.ok.map((o) => o.code))
    const okEntries = bulkEntries.filter((p) => okCodes.has(p.code))
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
        <h1 className="gate__title">
          {pickMode === 'paste' ? '사번 붙여넣기' : pickMode === 'browse' ? '지역단별 조회' : '명단에서 선택'}
        </h1>

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

            {(pickMode === 'tree' || pickMode === 'browse') && (
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
                    {pickMode === 'browse' ? (
                      <ul className="roster__browse-list">
                        {roster.map((p) => (
                          <li key={p.code}>
                            <span className="roster__browse-name">{p.name}</span>
                            <button
                              type="button"
                              className="roster__code-link num"
                              onClick={() => preview.setTarget(p)}
                            >
                              {p.code}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="roster__list">
                        {/* 머리글의 표지/코칭/가이드 컨트롤은 "한번에 선택" — 보이는 명단 전체에 적용 */}
                        <li className={`roster__list-head ${isStepupView ? 'roster__list--stepup' : ''}`}>
                          <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="전체선택" />
                          <span>이름 · 사번</span>
                          <span className="gender-mini" role="group" aria-label="표지 성별 전체 적용">
                            {(['M', 'F'] as const).map((g) => (
                              <button
                                key={g}
                                type="button"
                                className={
                                  roster.length > 0 && roster.every((p) => genderOf(p.code) === g)
                                    ? 'is-active'
                                    : undefined
                                }
                                onClick={() => setGenderAll(g)}
                                title={`전체 ${g === 'M' ? '남자' : '여자'}표지로`}
                              >
                                {g === 'M' ? '남' : '여'}
                              </button>
                            ))}
                          </span>
                          <label className="roster__opt-head" title="성장코칭 인쇄 전체 선택">
                            코칭
                            <input
                              type="checkbox"
                              checked={roster.length > 0 && roster.every((p) => coachSet.has(p.code))}
                              onChange={() => toggleAllInSet(setCoachSet)}
                              aria-label="성장코칭 인쇄 전체 선택"
                            />
                          </label>
                          <label className="roster__opt-head" title="강사용 가이드 포함 전체 선택">
                            가이드
                            <input
                              type="checkbox"
                              checked={roster.length > 0 && roster.every((p) => guideSet.has(p.code))}
                              onChange={() => toggleAllInSet(setGuideSet)}
                              aria-label="강사용 가이드 포함 전체 선택"
                            />
                          </label>
                          {/* 마지막 1fr 여백 트랙 자리 (스텝업 뷰에서는 행의 "빼기"가 여기 온다) */}
                          <span />
                        </li>
                        {roster.map((p) => (
                          <li key={p.code} className={isStepupView ? 'roster__list--stepup' : undefined}>
                            <input
                              type="checkbox"
                              checked={checked.has(p.code)}
                              onChange={() => toggle(p)}
                              aria-label={`${p.name} 선택`}
                            />
                            <span className="roster__who">
                              {p.name}
                              <button
                                type="button"
                                className="roster__code-link num"
                                onClick={() => preview.setTarget(p)}
                              >
                                {p.code}
                              </button>
                            </span>
                            <GenderMini code={p.code} name={p.name} />
                            <input
                              type="checkbox"
                              className="roster__opt"
                              checked={coachSet.has(p.code)}
                              onChange={() => toggleCoach(p.code)}
                              aria-label={`${p.name} 성장코칭 인쇄`}
                            />
                            <input
                              type="checkbox"
                              className="roster__opt"
                              checked={guideSet.has(p.code)}
                              onChange={() => toggleGuide(p.code)}
                              aria-label={`${p.name} 강사용 가이드 포함`}
                            />
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
                    )}
                  </>
                )}
              </>
            )}

            {pickMode !== 'browse' && (
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
                        <label className="roster__picked-opt">
                          코칭
                          <input
                            type="checkbox"
                            checked={coachSet.has(p.code)}
                            onChange={() => toggleCoach(p.code)}
                            aria-label={`${p.name} 성장코칭 인쇄`}
                          />
                        </label>
                        <label className="roster__picked-opt">
                          가이드
                          <input
                            type="checkbox"
                            checked={guideSet.has(p.code)}
                            onChange={() => toggleGuide(p.code)}
                            aria-label={`${p.name} 강사용 가이드 포함`}
                          />
                        </label>
                        <button type="button" onClick={() => toggle(p)} aria-label={`${p.name} 선택 해제`}>
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {/* 버튼 3개가 서로 다른 대상을 본다 — 레포트는 왼쪽 선택 체크,
                    코칭·가이드는 그 행의 코칭/가이드 체크만으로 바로 인쇄된다.
                    (서로 이어붙이지 않으므로 같은 문서가 두 번 나오지 않는다) */}
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
                  disabled={coachEntries.length === 0 || busy}
                  onClick={() => {
                    setBulkTarget('coach')
                    setShowChoice(true)
                  }}
                >
                  성장코칭 인쇄 ({coachEntries.length}명)
                </button>
                <button
                  type="button"
                  className="btn btn--block roster__coach-print"
                  disabled={guideEntries.length === 0 || busy}
                  onClick={() => {
                    setBulkTarget('guide')
                    setShowChoice(true)
                  }}
                >
                  강사용 가이드만 인쇄 ({guideEntries.length}명)
                </button>
              </div>
            )}
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
              {bulkEntries.length}명{targetLabel} 어떻게 출력할까요?
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
              {bulkEntries.length}명{targetLabel} 한 번에 인쇄하겠습니다.
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

      {preview.target && (
        <PersonPreviewDialog
          target={preview.target}
          busy={preview.busy}
          onConfirm={() => void preview.confirm()}
          onCancel={() => preview.setTarget(null)}
        />
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

      {/* 일괄 처리 중 캡처/인쇄 대상 — 한 번에 한 명만 마운트한다.
          어떤 종류를 마운트할지는 루프가 단계별로 정한다(kind) — 레포트+성장코칭을
          이어서 출력하는 사람은 같은 사람이 두 번(kind 만 바꿔) 마운트된다. */}
      {current &&
        (current.kind === 'report' ? (
          <PrintRoot A={current.A} caption={current.caption} cover={current.cover} />
        ) : (
          <CoachPrintRootForPerson
            A={current.A}
            caption={current.caption}
            includeGuide={current.guide}
            guideOnly={current.kind === 'guide'}
          />
        ))}
    </div>
  )
}
