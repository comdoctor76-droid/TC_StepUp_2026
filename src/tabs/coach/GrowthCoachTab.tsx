/* ══════════════════════════════════════════════════════════════════════
   성장코칭 탭 — 원본 "TC스텝업 하이플래너 성장 코칭" 독립 도구의 render()를
   그대로 이식했다(파일 업로드 없이 이미 계산된 FullAnalysis 에서 값을 뽑음 —
   src/calc/coach.ts 참조). 9페이지(P1~P9) + 강사용 2페이지(토글)로 구성된다.
   ══════════════════════════════════════════════════════════════════════ */

import { useCallback, useRef, useState } from 'react'
import type { FullAnalysis } from '../../calc'
import { f1, f2, isNum, wonK, HEROES } from '../../calc/coachAnalyze'
import { Editable, Html, type CoachEdits } from './Editable'
import { KpiCard, VsCard, RingCard, TrendCard, ButterflyCard, HeroCard, StrengthCard, BottleneckCard, TcChip, Capsule } from './cards'
import { CamsMap } from './CamsMap'
import { GoalCard } from './GoalCard'
import { CoachPrintRoot } from './CoachPrintRoot'
import { buildCoachPageProps, incomeBand } from './buildCoachPageProps'
import type { CoachPageProps } from './types'
import { printAll, captureAllPages } from '../../export/captureAll'
import { exportPdf } from '../../export/pdf'
import { savePdf } from '../../export/pdfSave'
import { canShareFiles, isMobile, outputFileName, outputFileStem, shareOrDownload } from '../../export/share'

const COACH_CAPTURE_OPTS = { rootId: 'coach-print-root', pageSelector: '.sheet' }

function maskId(id: string): string {
  const s = String(id ?? '')
  return s.length > 2 ? s.slice(0, 2) + '****' : '****'
}
function joinYm(v: string | number): string {
  const s = String(v ?? '')
  return s.length >= 6 ? `${s.slice(0, 4)}.${s.slice(4, 6)}` : s
}

function Insight({ id, h, p, edits, onCommit }: { id: string; h: string; p?: string; edits: CoachEdits; onCommit: (id: string, html: string) => void }) {
  return (
    <div className="insight">
      <Editable id={`${id}-h`} html={h} edits={edits} onCommit={onCommit} className="insight-h" />
      {p && <Editable id={`${id}-p`} html={p} edits={edits} onCommit={onCommit} className="insight-p" />}
    </div>
  )
}

function SecHead({ n, title, note }: { n: string; title: string; note?: string }) {
  return (
    <div className="sec-h">
      <span className="sec-n">{n}</span>
      <span className="sec-t">{title}</span>
      {note && <span className="sec-note">{note}</span>}
    </div>
  )
}

function PageHead({ title, sub, tag }: { title: React.ReactNode; sub: React.ReactNode; tag: string }) {
  return (
    <div className="rp-head">
      <div>
        <div className="rp-title">{title}</div>
        <div className="rp-sub num">{sub}</div>
      </div>
      <span className="rp-tag">{tag}</span>
    </div>
  )
}

function PageFoot({ n, t, name }: { n: string; t: string; name: string }) {
  return (
    <div className="sheet-foot">
      <span>현대해상 영업교육운영파트 · TC스텝업</span>
      <span>
        {n} — {t}
      </span>
    </div>
  )
}

const fmtMyeong = (v: number | null) => f2(v) + '명'
const fmtGun1 = (v: number | null) => f1(v) + '건'

export function GrowthCoachTab({ A, caption }: { A: FullAnalysis; caption: string }) {
  const [edits, setEdits] = useState<CoachEdits>({})
  const [showCoachGuide, setShowCoachGuide] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [busyMode, setBusyMode] = useState<'print' | 'pdf' | 'image' | null>(null)
  const [showPrintChoice, setShowPrintChoice] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const opIdRef = useRef(0)
  const isCurrentOp = (id: number) => opIdRef.current === id
  const startOp = () => ++opIdRef.current

  const onCommit = (id: string, html: string) => setEdits((prev) => ({ ...prev, [id]: html }))

  const pageProps: CoachPageProps = buildCoachPageProps(A, caption, edits, onCommit, showCoachGuide)

  const mobile = isMobile()

  const doPrintCoach = useCallback(async () => {
    const id = startOp()
    setBusyMode('print')
    setBusy('준비 중')
    try {
      const fileStem = `${outputFileStem(A.profile.name, A.profile.code)}_성장코칭`
      await printAll(
        fileStem,
        () => {
          if (isCurrentOp(id)) {
            setBusy(null)
            setBusyMode(null)
          }
        },
        'printing-coach',
      )
    } catch (e) {
      if (isCurrentOp(id)) {
        setToast(e instanceof Error ? e.message : '인쇄를 시작하지 못했습니다.')
        setTimeout(() => setToast(null), 5000)
      }
    } finally {
      if (isCurrentOp(id)) {
        setBusy(null)
        setBusyMode(null)
      }
    }
  }, [A])

  const doImageCoach = useCallback(async () => {
    const id = startOp()
    setBusyMode('image')
    setBusy('0')
    try {
      const blob = await captureAllPages((done, total) => {
        if (isCurrentOp(id)) setBusy(`${done} / ${total}`)
      }, COACH_CAPTURE_OPTS)
      const fileName = outputFileName(A.profile.name, A.profile.code)
      const result = await shareOrDownload(blob, fileName, `${A.profile.name} 플래너 성장코칭`)
      if (!isCurrentOp(id)) return
      setToast(
        result === 'shared'
          ? '공유했습니다.'
          : result === 'downloaded'
            ? `이미지를 저장했습니다 — ${fileName}`
            : '공유를 취소했습니다.',
      )
      setTimeout(() => setToast(null), 5000)
    } catch (e) {
      if (!isCurrentOp(id)) return
      setToast(e instanceof Error ? e.message : '이미지를 만들지 못했습니다.')
      setTimeout(() => setToast(null), 5000)
    } finally {
      if (isCurrentOp(id)) {
        setBusy(null)
        setBusyMode(null)
      }
    }
  }, [A])

  const doExportPdfCoach = useCallback(async () => {
    const id = startOp()
    setBusyMode('pdf')
    setBusy('0')
    try {
      const blob = await exportPdf((done, total) => {
        if (isCurrentOp(id)) setBusy(`${done} / ${total}`)
      }, COACH_CAPTURE_OPTS)
      const fileName = outputFileName(A.profile.name, A.profile.code, 'pdf')
      const result = await savePdf(blob, `${fileName.replace(/\.pdf$/, '')}_성장코칭.pdf`)
      if (!isCurrentOp(id)) return
      setToast(result === 'cancelled' ? 'PDF 저장을 취소했습니다.' : `PDF를 저장했습니다.`)
      setTimeout(() => setToast(null), 5000)
    } catch (e) {
      if (!isCurrentOp(id)) return
      setToast(e instanceof Error ? e.message : 'PDF를 만들지 못했습니다.')
      setTimeout(() => setToast(null), 5000)
    } finally {
      if (isCurrentOp(id)) {
        setBusy(null)
        setBusyMode(null)
      }
    }
  }, [A])

  const openPrintChoice = useCallback(() => {
    if (mobile) {
      void doImageCoach()
      return
    }
    setShowPrintChoice(true)
  }, [mobile, doImageCoach])

  const choosePrint = useCallback(() => {
    setShowPrintChoice(false)
    void doPrintCoach()
  }, [doPrintCoach])

  const choosePdf = useCallback(() => {
    setShowPrintChoice(false)
    void doExportPdfCoach()
  }, [doExportPdfCoach])

  return (
    <div className="coach-report">
      <div className="coach-toolbar">
        <label className="toggle">
          <input type="checkbox" checked={showCoachGuide} onChange={(e) => setShowCoachGuide(e.target.checked)} />
          강사용 가이드 포함
        </label>
        <div className="grow" />
        <button className="btn btn--primary" onClick={openPrintChoice} disabled={!!busy}>
          {busy
            ? busyMode === 'print'
              ? '인쇄 준비 중'
              : busyMode === 'pdf'
                ? `PDF 저장 중 ${busy}`
                : `출력 중 ${busy}`
            : mobile
              ? '인쇄·PDF 저장 (이미지 저장·공유)'
              : '인쇄·PDF 저장'}
        </button>
      </div>
      <p className="edit-hint">
        진단 문구는 <b>클릭해서 바로 수정</b>할 수 있습니다 · 수정 내용은 이 화면에서만 유지됩니다(새로고침하면 원래대로 돌아갑니다)
      </p>

      <CoachPages {...pageProps} />
      <CoachPrintRoot {...pageProps} />

      {showPrintChoice && (
        <div
          className="choice-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowPrintChoice(false)}
        >
          <div className="choice-overlay__box" onClick={(e) => e.stopPropagation()}>
            <p className="choice-overlay__title">어떻게 출력할까요?</p>
            <div className="choice-overlay__actions">
              <button className="btn btn--primary" onClick={choosePrint}>
                인쇄
              </button>
              <button className="btn btn--primary" onClick={choosePdf}>
                PDF로 저장
              </button>
            </div>
            <button
              className="btn choice-overlay__cancel"
              onClick={() => setShowPrintChoice(false)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {busy && (
        <div className="overlay" role="status" aria-live="polite">
          <div className="overlay__box">
            <div className="overlay__spin" />
            {busyMode === 'print' ? (
              <p>인쇄 준비 중입니다</p>
            ) : busyMode === 'pdf' ? (
              <p>
                PDF를 만드는 중입니다
                <br />
                <b>{busy}</b>
              </p>
            ) : (
              <p>
                이미지를 만드는 중입니다
                <br />
                <b>{busy}</b>
              </p>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {mobile && !canShareFiles() && (
        <p className="hint">
          이 브라우저는 파일 공유를 지원하지 않아 이미지가 <b>다운로드</b>됩니다.
        </p>
      )}
    </div>
  )
}

/* 화면과 인쇄(CoachPrintRoot)가 정확히 같은 마크업을 그리도록 페이지 전체를
   별도 컴포넌트로 뺐다 — 두 곳에서 동일한 props 로 그대로 재사용한다. */
export function CoachPages(props: CoachPageProps) {
  const { b, d, r, F, M, name, sub1, BASE_ALL, BASE_6, dgBand, insKpi, insVs, insFlow, insBottle, premDrop, premPerK, trendMsg, bflyPattern, carWorst, heroIds, howto, edits, onCommit, showCoachGuide, camsFacts, hypoBank, coachQs, dataNotes, heroRefs, gName, gEx } = props

  return (
    <div className="sheets">
      {/* P1 진단 개요 + CAMS */}
      <article className="sheet">
        <PageHead title={<>하이플래너 <span className="accent">성장 코칭</span></>} sub={sub1} tag="TC STEP-UP" />
        <div className="person num">
          <div className="pchip"><b>성명</b><span>{name} 플래너</span></div>
          <div className="pchip"><b>소속</b><span>{b.hq} · {b.branch}</span></div>
          <div className="pchip"><b>입사</b><span>{joinYm(b.hireDate)} ({b.months}차월)</span></div>
          <div className="pchip"><b>육성소득</b><span>{incomeBand(b.incomeRaw)}</span></div>
          <div className="pchip"><b>사번</b><span>{maskId(b.code)}</span></div>
        </div>
        <div className="sec">
          <SecHead n="1" title="나의 한 줄 진단" />
          <div className="oneliner">
            <div className="ol-k">ONE-LINE DIAGNOSIS</div>
            <Editable id="oneliner" html={r.oneliner} edits={edits} onCommit={onCommit} className="ol-t" />
          </div>
        </div>
        <div className="sec">
          <SecHead n="2" title="나의 영업유형" />
          <div className="type-row">
            <div className="type-card main">
              <span className="type-badge">메인유형</span>
              <Editable id="type-main-name" html={r.type.main.name} edits={edits} onCommit={onCommit} className="type-name" />
              <Editable id="type-main-desc" html={r.type.main.desc} edits={edits} onCommit={onCommit} className="type-desc" />
            </div>
            {r.type.sub && (
              <div className="type-card sub">
                <span className="type-badge">서브유형</span>
                <Editable id="type-sub-name" html={r.type.sub.name} edits={edits} onCommit={onCommit} className="type-name" />
                <Editable id="type-sub-desc" html={r.type.sub.desc} edits={edits} onCommit={onCommit} className="type-desc" />
              </div>
            )}
          </div>
        </div>
        <div className="sec">
          <SecHead n="3" title="C·A·M·S 성장 신호등" note="한눈에 보는 나의 현재" />
          <CamsMap analysis={r} m6={M} dgBand={dgBand} />
        </div>
        <PageFoot n="1" t="진단 개요" name={name} />
      </article>

      {/* P2 핵심지표 + 활동구조 */}
      <article className="sheet">
        <PageHead title={<>핵심 지표와 <span className="accent">활동 구조</span></>} sub={<>{name} 플래너 · 각 카드의 아래 칸은 전체 누적 대비 최근 6개월의 변화예요</>} tag="DATA" />
        <Insight id="ins-kpi" h={insKpi.h} p={insKpi.p} edits={edits} onCommit={onCommit} />
        <div className="sec">
          <SecHead n="4" title="핵심 지표" />
          <div className="kpi-grid">
            <KpiCard ico="🧲" label="월평균 신규고객" sub="전체 기간" value={f2(F.newCust.me)} unit="명"
              chips={<><TcChip me={F.newCust.me} tc={F.newCust.tc} /><span className="chip neutral num">동일그룹 {f2(F.newCust.dg)}명</span></>}
              cap={<Capsule label="최근 6개월 월" fullV={F.newCust.me} m6V={M.newCust6.me} fmt={f2} unit="명" />} />
            <KpiCard ico="👥" label="장기고객" sub="이관 제외 · 전체" value={f1(F.custLong.me)} unit="명"
              chips={<><TcChip me={F.custLong.me} tc={F.custLong.tc} /><span className="chip neutral num">TC {f1(F.custLong.tc)}명</span></>}
              cap={F.transferLong.me === 0 ? <>이관고객 <b>0명</b>, 전원 자력 개척이에요 <span className="delta up">참고: TC그룹 평균 이관 {f1(F.transferLong.tc)}건</span></> : undefined} />
            <KpiCard ico="📑" label="고객당 계약 건수" sub="장기 · 전체" value={f2(F.perCust.me)} unit="건"
              chips={<><TcChip me={F.perCust.me} tc={F.perCust.tc} /><span className="chip neutral num">TC {f2(F.perCust.tc)}건</span></>}
              cap={<Capsule label="최근 6개월" fullV={F.perCust.me} m6V={M.perCust6.me} fmt={f2} unit="건" />} />
            <KpiCard ico="💰" label="인당 월납보험료" sub="장기 · 전체" value={premPerK} unit="천원"
              chips={<><TcChip me={F.premPer.me} tc={F.premPer.tc} />{premDrop && <span className="chip warn">최근 계약일수록 얕아지는 신호</span>}</>}
              cap={<Capsule label="최근 6개월" fullV={isNum(F.premPer.me) ? F.premPer.me / 1000 : null} m6V={isNum(M.premPer6.me) ? M.premPer6.me / 1000 : null} fmt={f1} unit="천원" />} />
          </div>
          <div className="basecap num">[{BASE_ALL}]</div>
        </div>
        <div className="sec">
          <SecHead n="5" title="활동 구조 비교" />
          {bflyPattern && (
            <Insight id="ins-bfly" h="앞은 이기고, 뒤에서 지고 있습니다" p="신규고객을 만나는 활동은 TC그룹보다 강해요. 반면 이미 만난 고객과의 재상담·추가계약에 성장 공간이 있어요. '기회' 표시가 붙은 줄이 90일 목표가 겨냥하는 지점이에요." edits={edits} onCommit={onCommit} />
          )}
          <ButterflyCard M={M} base={BASE_6} />
        </div>
        <PageFoot n="2" t="핵심 지표 · 활동 구조" name={name} />
      </article>

      {/* P3 그룹 비교 */}
      <article className="sheet">
        <PageHead title={<>그룹 <span className="accent">비교</span></>} sub={<>{name} 플래너 · <span style={{ color: 'var(--cr-hi-dk)', fontWeight: 700 }}>주황=나</span> · 회색=동일그룹 · <span style={{ color: 'var(--cr-blue)', fontWeight: 700 }}>파랑=TC그룹</span></>} tag="DATA" />
        <Insight id="ins-vs" h={insVs.h} p={insVs.p} edits={edits} onCommit={onCommit} />
        <div className="sec">
          <SecHead n="6" title="그룹 비교" />
          <VsCard name="월평균 신규고객" sub="명 · 전체" o={F.newCust} fmt={fmtMyeong}
            msg={isNum(F.newCust.me) && isNum(F.newCust.tc) && F.newCust.me > F.newCust.tc ? `새 고객을 만나는 힘은 이미 <b>TC그룹을 앞서 있어요.</b> 이 힘은 그대로 지켜가면 돼요.` : null}
            msgId="vs-newCust" edits={edits} onCommit={onCommit} base={BASE_ALL} />
          <VsCard name="장기계약 건수" sub="이관 제외 · 전체" o={F.cntLong} fmt={fmtGun1}
            msg={`장기고객은 ${f1(F.custLong.me)}명으로 TC(${f1(F.custLong.tc)}명)의 ${isNum(F.custLong.me) && isNum(F.custLong.tc) ? Math.round((F.custLong.me / F.custLong.tc) * 100) : '-'}%인데, 계약 건수는 ${f1(F.cntLong.me)}건으로 TC(${f1(F.cntLong.tc)}건)의 ${isNum(F.cntLong.me) && isNum(F.cntLong.tc) ? Math.round((F.cntLong.me / F.cntLong.tc) * 100) : '-'}%입니다. <b>고객이 부족한 게 아니라, 고객 한 분과의 계약이 아직 얕은 것뿐이에요.</b>`}
            msgId="vs-cntLong" edits={edits} onCommit={onCommit} base={BASE_ALL} callout={r.bottlenecks.some((x) => x.id === 'depth') ? '성장 기회' : undefined} />
          <VsCard name="월평균 자동차 건수" sub="최근 6개월" o={M.moCar} fmt={fmtGun1}
            msg={carWorst ? `TC그룹과 간격이 가장 큰 영역이에요. 자동차는 <b>매년 다시 만나는 명분</b>이 되어 주는 접점이에요.` : null}
            msgId="vs-moCar" edits={edits} onCommit={onCommit} base={BASE_6} callout={carWorst ? '가장 큰 성장 기회' : undefined} />
          <VsCard name="인당 월납보험료" sub="장기 · 전체" o={F.premPer} fmt={wonK}
            msg={isNum(F.premPer.me) && isNum(F.premPer.dg) && F.premPer.me < F.premPer.dg ? `보험료 규모는 동일그룹에도 아직 미치지 못해요. 계약을 늘리는 것과 함께 <b>계약 1건의 보장 깊이</b>를 같이 보면 좋아요.` : null}
            msgId="vs-premPer" edits={edits} onCommit={onCommit} base={BASE_ALL} callout={isNum(F.premPer.me) && isNum(F.premPer.dg) && F.premPer.me < F.premPer.dg ? '함께 볼 지점' : undefined} />
        </div>
        <PageFoot n="3" t="그룹 비교" name={name} />
      </article>

      {/* P4 비율 + 흐름 */}
      <article className="sheet">
        <PageHead title={<>비율과 <span className="accent">흐름</span></>} sub={<>{name} 플래너 · 링의 채워진 만큼이 나의 현재예요</>} tag="DATA" />
        <Insight id="ins-flow" h={insFlow.h} p={insFlow.p} edits={edits} onCommit={onCommit} />
        <div className="sec">
          <SecHead n="7" title="두 개의 비율" />
          <div className="ring-duo">
            <RingCard name="자동차·장기 연계율" o={F.linkRate}
              desc={`장기고객 100명 중 자동차까지 함께하는 고객이 <b>${isNum(F.linkRate.me) ? Math.round(F.linkRate.me * 100) : '-'}명</b>이라는 뜻이에요. TC그룹은 ${isNum(F.linkRate.tc) ? Math.round(F.linkRate.tc * 100) : '-'}명이에요.`}
              descId="ring-linkRate" edits={edits} onCommit={onCommit} base="기준: 전체 누적 · 장기고객 대비" />
            <RingCard name="암 주요치료비 부보율" o={M.cancerRate}
              desc={`최근 6개월 새 계약 10건 중 암 치료과정 보장이 담긴 계약이 <b>약 ${isNum(M.cancerRate.me) ? Math.round(M.cancerRate.me * 10) : '-'}건</b>이라는 뜻이에요.`}
              descId="ring-cancerRate" edits={edits} onCommit={onCommit} base="기준: 최근 6개월 신계약 건 기준" />
          </div>
        </div>
        <div className="sec">
          <SecHead n="8" title="월별 흐름" />
          <TrendCard monthly={d.monthly} msg={trendMsg} msgId="trend-msg" edits={edits} onCommit={onCommit} base={BASE_6} />
        </div>
        <PageFoot n="4" t="비율 · 흐름" name={name} />
      </article>

      {/* P5 무기 */}
      <article className="sheet">
        <PageHead title={<>나의 <span className="accent">무기</span></>} sub={<>{name} 플래너 · 코칭의 순서는 약점이 아니라 무기에서 시작해요</>} tag="STRENGTH" />
        {r.strengths.length > 0 && (
          <Insight id="ins-strength" h="이것은 TC그룹도 부러워할 무기입니다" p="약점을 고치기 전에, 이 무기를 어디에 쓸지 먼저 정하는 것이 이 코칭의 순서예요." edits={edits} onCommit={onCommit} />
        )}
        <div className="sec">
          <SecHead n="9" title="나의 무기" />
          {r.strengths.map((s, i) => (
            <StrengthCard key={s.id} s={s} index={i} edits={edits} onCommit={onCommit} />
          ))}
        </div>
        <PageFoot n="5" t="나의 무기" name={name} />
      </article>

      {/* P6 성장 포인트 */}
      <article className="sheet">
        <PageHead title={<>성장 <span className="accent">포인트</span></>} sub={<>{name} 플래너 · 성장 포인트는 다음 성장이 숨어 있는 자리예요</>} tag="FOCUS" />
        {insBottle && <Insight id="ins-bottle" h={insBottle.h} p={insBottle.p} edits={edits} onCommit={onCommit} />}
        <div className="sec">
          <SecHead n="10" title="성장 포인트" />
          {r.bottlenecks.map((bn, i) => (
            <BottleneckCard key={bn.id} b={bn} index={i} edits={edits} onCommit={onCommit} />
          ))}
        </div>
        <PageFoot n="6" t="성장 포인트" name={name} />
      </article>

      {/* P7 90일 실행 플랜 */}
      <article className="sheet">
        <PageHead title={<>90일 <span className="accent">실행 플랜</span></>} sub={r.goals.length > 1 ? 'AI 코치의 두 가지 제안 중 나의 90일 목표는 내가 선택해요 — 선택은 언제나 플래너의 몫이에요' : 'AI 코치의 제안을 나의 말로 다듬어 90일 목표로 삼아요 — 선택은 언제나 플래너의 몫이에요'} tag="ACTION PLAN" />
        <div className="sec">
          <SecHead n="11" title="AI 코치의 제안" />
          {r.goals.map((g, i) => (
            <GoalCard key={g.id} g={g} index={i} edits={edits} onCommit={onCommit} />
          ))}
        </div>
        <PageFoot n="7" t="90일 실행 플랜" name={name} />
      </article>

      {/* P8 멘토 팁 + HOW TO */}
      <article className="sheet">
        <PageHead title={<>이번 주 <span className="accent">실행</span></>} sub={<>{name} 플래너 · 현장에서 성과를 낸 선배 멘토들의 경험에서 가져온 팁이에요</>} tag="START" />
        <div className="sec">
          <SecHead n="12" title="멘토의 실전 팁" />
          {heroIds.map((id) => (
            <HeroCard key={id} hero={HEROES[id]} />
          ))}
        </div>
        <div className="sec">
          <SecHead n="13" title="이번 주 HOW TO" />
          <div className="howto">
            {howto.slice(0, 5).map((h, i) => (
              <div className="chk" key={i}>
                <div className="box" />
                <Editable id={`howto-${i}`} html={h} edits={edits} onCommit={onCommit} as="span" />
              </div>
            ))}
          </div>
        </div>
        <PageFoot n="8" t="이번 주 실행" name={name} />
      </article>

      {/* P9 나의 선택 */}
      <article className="sheet">
        <PageHead title={<>나의 선택과 <span className="accent">다짐</span></>} sub="목표는 AI가 아니라 내가 정해요 · 손으로 적어도 좋아요" tag="MY CHOICE" />
        <div className="sec">
          <SecHead n="14" title="나의 선택" />
          <div className="ex-card">
            <span className="ex-tag">✎ 작성 예시</span>
            <div className="ex-row"><b>내가 선택한 목표</b> {gName}</div>
            <div className="ex-row"><b>선택한 이유</b> {gEx.reason}</div>
            <div className="ex-row"><b>첫 실행일</b> 다음 주 월요일 &nbsp;·&nbsp; <b>점검일</b> 매주 금요일 오후</div>
            <div className="ex-row"><b>매주 실행할 행동</b> {gEx.action}</div>
            <div className="ex-note">예시는 참고만 하고, 나의 상황과 나의 말로 바꿔 적어요.</div>
          </div>
          <div className="choice">
            <div className="fld full"><label>내가 선택한 목표</label><input type="text" /></div>
            <div className="fld"><label>첫 실행일</label><input type="text" /></div>
            <div className="fld"><label>점검일</label><input type="text" /></div>
            <div className="fld full" style={{ display: 'block' }}>
              <label style={{ display: 'block', marginBottom: 6 }}>선택한 이유</label>
              <div className="write" contentEditable suppressContentEditableWarning />
            </div>
            <div className="fld full" style={{ display: 'block' }}>
              <label style={{ display: 'block', marginBottom: 6 }}>매주 실행할 행동</label>
              <div className="write" contentEditable suppressContentEditableWarning />
            </div>
          </div>
          <div className="declare">
            <span className="dk">실행선언</span>
            나는 앞으로 <input type="text" placeholder="90" />일 동안, 매주 <input type="text" placeholder="5" />명을 대상으로
            <input type="text" className="w" placeholder={gEx.act} />을 실행하여,
            <input type="text" className="w" placeholder={gEx.metric} />을 현재 <input type="text" placeholder={gEx.from} />에서 <input type="text" placeholder={gEx.to} />까지 높이겠다.
          </div>
        </div>
        <PageFoot n="9" t="나의 선택" name={name} />
      </article>

      {/* 강사용 (토글) */}
      {showCoachGuide && (
        <>
          <article className="sheet coach">
            <div className="coach-band">
              <div>
                <div className="cb-t">강사용 코칭 가이드</div>
                <div className="cb-s">플래너 배포용에 포함하지 마십시오 · {name} 플래너 ({maskId(b.code)})</div>
              </div>
            </div>
            <div className="sec">
              <SecHead n="C1" title="데이터 종합판단 (C·A·M·S)" />
              <ul className="tight">
                {camsFacts.map((t, i) => (
                  <Html key={i} html={t} as="div" />
                ))}
              </ul>
            </div>
            <div className="sec">
              <SecHead n="C2" title="진단 논리" />
              <Editable
                id="coach-logic"
                html={`강점(${r.strengths.map((s) => s.title).join(' · ')})과 병목(${r.bottlenecks.map((x) => x.title.split(' ·')[0]).join(' · ')})이 하나의 구조로 연결됩니다. ${r.goals[0] ? `<b>${r.goals[0].title.split(' —')[0]}</b>을 최우선한 이유: ① 소득 직결도 ② 30일 내 실행 가능성 ③ 개선 시 연관 지표(인당보험료·부보율·유지·소개)가 함께 움직이는 파급효과.` : ''} ${r.goals[1] ? `2순위(${r.goals[1].title.split(' —')[0]})는 절대격차는 크지만 1순위 상담 자리에 얹어 실행하는 편이 효율적입니다.` : ''}`}
                edits={edits}
                onCommit={onCommit}
                className="plain"
              />
            </div>
            <div className="sec">
              <SecHead n="C3" title="원인가설 (데이터와 가설 구분)" />
              {hypoBank.slice(0, 3).map((h, i) => (
                <Html key={i} html={h} as="div" className="hypo" />
              ))}
              <p className="plain" style={{ marginTop: 8, fontSize: 13, color: 'var(--cr-text3)' }}>
                ※ 가설은 데이터만으로 단정할 수 없습니다 — 아래 코칭 질문으로 확인해 보세요.
              </p>
            </div>
            <PageFoot n="C-1" t="강사용 · 대외비" name={name} />
          </article>
          <article className="sheet coach">
            <div className="coach-band">
              <div>
                <div className="cb-t">강사용 코칭 가이드 (계속)</div>
                <div className="cb-s">{name} 플래너 ({maskId(b.code)})</div>
              </div>
            </div>
            <div className="sec">
              <SecHead n="C4" title="코칭 질문" />
              <ol className="qs">
                {coachQs.map((q, i) => (
                  <Html key={i} html={q} as="li" />
                ))}
              </ol>
            </div>
            <div className="sec">
              <SecHead n="C5" title="목표 선택 코칭" />
              <ul className="tight">
                <li><b>목표를 바꾸려 할 때 확인</b> — "그 목표는 이번 주에 몇 명에게, 무엇을 하는 것으로 시작됩니까?" 행동 단위로 번역되지 않으면 재선택을 유도.</li>
                <li><b>과다 목표 방지</b> — 두 목표를 모두 선언하려 하면, 2순위는 1순위 상담 자리에 얹는 한 가지 행동으로만 축소해 지도.</li>
                <li><b>2순위 선택을 존중할 조건</b> — 본인이 해당 영역의 심리적 저항을 스스로 언급하고 먼저 깨고 싶어할 때.</li>
              </ul>
            </div>
            <div className="sec">
              <SecHead n="C6" title="멘토 팁 활용 주의사항" />
              <ul className="tight">
                {heroRefs.map((h, i) => (
                  <Html key={i} html={h} as="li" />
                ))}
              </ul>
            </div>
            <div className="sec">
              <SecHead n="C7" title="데이터 확인 필요" />
              {dataNotes.map((n, i) => (
                <Html key={i} html={n} as="div" className="note-card" />
              ))}
            </div>
            <PageFoot n="C-2" t="강사용 · 대외비" name={name} />
          </article>
        </>
      )}
    </div>
  )
}
