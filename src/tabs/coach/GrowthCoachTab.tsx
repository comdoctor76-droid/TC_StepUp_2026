/* ══════════════════════════════════════════════════════════════════════
   성장코칭 탭 — 원본 "TC스텝업 하이플래너 성장 코칭" 도구(v18)의 render()를
   그대로 이식했다(파일 업로드 없이 이미 계산된 FullAnalysis 에서 값을 뽑음 —
   src/calc/coach.ts 참조). 플래너 최대 15페이지 + 강사용 3페이지(토글)로
   구성되며, 코호트 페이지("내 연차의 기준")와 실행 플랜 2번째 장은 데이터가
   있을 때만 끼어든다 — 페이지 번호는 카운터로 자동 매긴다.
   ══════════════════════════════════════════════════════════════════════ */

import { useCallback, useRef, useState } from 'react'
import type { FullAnalysis } from '../../calc'
import { f1, f2, isNum, pctFmt, wonK } from '../../calc/coachAnalyze'
import { Editable, Html, type CoachEdits } from './Editable'
import { KpiCard, VsCard, RingCard, TrendCard, ButterflyCard, HeroCard, StrengthCard, BottleneckCard, TcChip, Capsule } from './cards'
import { CamsMap } from './CamsMap'
import { GoalCard } from './GoalCard'
import { CoachPrintRoot } from './CoachPrintRoot'
import { buildCoachPageProps, incomeBand } from './buildCoachPageProps'
import type { CoachPageProps } from './types'
import { printAll } from '../../export/captureAll'
import { exportPdf } from '../../export/pdf'
import { savePdf } from '../../export/pdfSave'
import { canShareFiles, isMobile, outputFileName, outputFileStem, shareOrDownloadMany } from '../../export/share'

/* bodyClass: 캡처하는 동안 인쇄와 같은 조밀 스타일 + A4 고정 높이를 적용한다
   (coach.css 의 body.capturing-coach 규칙 참고) */
const COACH_CAPTURE_OPTS = {
  rootId: 'coach-print-root',
  pageSelector: '.sheet',
  bodyClass: 'capturing-coach',
}

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
  const [busyMode, setBusyMode] = useState<'print' | 'pdf' | null>(null)
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

  /* 모바일은 window.print() 가 안정적이지 않아 "인쇄·PDF 저장" 버튼이 바로
     PDF 를 만들어 OS 공유 시트로 넘긴다(카카오톡 등으로 바로 전송 가능) —
     예전에는 PNG 로 캡처해 이어붙였는데, 장수가 많으면 캔버스 픽셀 한도를
     넘겨 흐리게 나올 수 있었다(v0.53). PDF 는 페이지를 합치지 않아 그 문제가
     없고 원본 그대로 전달되어(메신저의 사진 압축을 타지 않음) 더 선명하다. */
  const doPdfCoachMobile = useCallback(async () => {
    const id = startOp()
    setBusyMode('pdf')
    setBusy('0')
    try {
      const blob = await exportPdf((done, total) => {
        if (isCurrentOp(id)) setBusy(`${done} / ${total}`)
      }, COACH_CAPTURE_OPTS)
      const fileName = `${outputFileStem(A.profile.name, A.profile.code)}_성장코칭.pdf`
      const result = await shareOrDownloadMany([blob], [fileName], `${A.profile.name} 플래너 성장코칭`)
      if (!isCurrentOp(id)) return
      setToast(
        result === 'shared'
          ? '공유했습니다.'
          : result === 'downloaded'
            ? `PDF를 저장했습니다 — ${fileName}`
            : '공유를 취소했습니다.',
      )
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
      void doPdfCoachMobile()
      return
    }
    setShowPrintChoice(true)
  }, [mobile, doPdfCoachMobile])

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
          강사용 가이드 포함 (3p)
        </label>
        <div className="grow" />
        <button className="btn btn--primary" onClick={openPrintChoice} disabled={!!busy}>
          {busy
            ? busyMode === 'print'
              ? '인쇄 준비 중'
              : `PDF 저장 중 ${busy}`
            : mobile
              ? '인쇄·PDF 저장 (PDF 저장·공유)'
              : '인쇄·PDF 저장'}
        </button>
      </div>
      <p className="edit-hint">
        진단 문구는 <b>클릭해서 바로 수정</b>할 수 있습니다 · 수정 내용은 이 화면에서만 유지됩니다(새로고침하면 원래대로 돌아갑니다)
      </p>

      <CoachPages {...pageProps} />
      {/* 하이라이트(강의용 PDF)는 성장코칭 맨 아래가 아니라 **독립 탭**에 있다 —
          탭 바에 버튼이 없으면 리포트를 끝까지 내려야 보여서 찾지 못한다(v0.48).
          여기에 다시 두면 같은 PDF 를 두 번 렌더하게 되므로 넣지 않는다. */}
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
            ) : (
              <p>
                PDF를 만드는 중입니다
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
          이 브라우저는 파일 공유를 지원하지 않아 PDF가 <b>다운로드</b>됩니다.
        </p>
      )}
    </div>
  )
}


/* 화면과 인쇄(CoachPrintRoot)가 정확히 같은 마크업을 그리도록 페이지 전체를
   별도 컴포넌트로 뺐다 — 두 곳에서 동일한 props 로 그대로 재사용한다.
   페이지 번호는 pf() 카운터로 매긴다 — 코호트·실행플랜② 같은 조건부 장이
   빠져도 번호가 이어진다(강사용은 C-1~C-3 고정). */
export function CoachPages(props: CoachPageProps) {
  const { b, d, r, F, M, name, sub1, BASE_ALL, BASE_6, dgBand, insKpi, insBfly, insVs, insFlow, insStrength, insBottle, premDrop, premPerK, trendMsg, vsMsgs, vsCallouts, ringDescs, coMsg, heroes, howto, edits, onCommit, showCoachGuide, guideOnly, camsFacts, coachLogic, cguides, hypoBank, coachQs, dataNotes, goalCoach, heroRefs, gName, gEx } = props

  let pg = 0
  const pf = (t: string) => {
    pg += 1
    return <PageFoot n={String(pg)} t={t} name={name} />
  }
  const mwon = (v: number | null) => (isNum(v) ? Math.round(v / 10000).toLocaleString('ko-KR') : '-')

  return (
    <div className="sheets">
      {/* guideOnly 는 강사용 가이드 3장만 뽑는 모드 — 앞의 플래너 장을 통째로 건너뛴다.
          가이드 장은 아래쪽에 독립 fragment 로 붙어 있고 페이지 번호도 C-1~C-3 으로
          고정이라 앞 장을 빼도 그대로 성립한다. */}
      {!guideOnly && (
        <>
      {/* P1 진단 개요 + 성장 신호등 (v0.45 — 여백을 좁혀 한 장에 통합) */}
      <article className="sheet sheet--intro">
        <PageHead title={<>하이플래너 <span className="accent">성장 코칭</span></>} sub={sub1} tag="TC 스텝업" />
        {/* 사번은 성명과 같은 칩에 붙인다 — 따로 두면 칩 5개가 한 줄(210mm 기준 688px)에
            안 들어가 사번만 둘째 줄로 밀려 한 줄치 높이를 통째로 낭비했다. */}
        <div className="person num">
          <div className="pchip"><b>성명</b><span>{name} 플래너</span><em>{maskId(b.code)}</em></div>
          <div className="pchip"><b>소속</b><span>{b.hq} · {b.branch}</span></div>
          <div className="pchip"><b>입사</b><span>{joinYm(b.hireDate)} ({b.months}차월)</span></div>
          <div className="pchip"><b>육성소득</b><span>{incomeBand(b.incomeRaw)}</span></div>
        </div>
        <div className="sec">
          <SecHead n="1" title="지금의 나, 다음 90일" />
          <div className="oneliner">
            <div className="ol-k">ONE POINT LESSON</div>
            <div className="ol-row"><span className="ol-chip">지금</span><Editable id="lesson-now" html={r.lesson.now} edits={edits} onCommit={onCommit} className="ol-body" /></div>
            <div className="ol-row"><span className="ol-chip">잘하는 것</span><Editable id="lesson-str" html={r.lesson.str} edits={edits} onCommit={onCommit} className="ol-body" /></div>
            <div className="ol-row next"><span className="ol-chip">다음 한 걸음</span><Editable id="lesson-next" html={r.lesson.next} edits={edits} onCommit={onCommit} className="ol-body" /></div>
          </div>
        </div>
        <div className="sec">
          <SecHead n="2" title="나의 영업유형" />
          <div className="type-row">
            <div className="type-card main">
              <span className="type-badge">메인유형</span>
              {r.type.main.axis && <span className="type-axis">{r.type.main.axis}</span>}
              <Editable id="type-main-name" html={r.type.main.name} edits={edits} onCommit={onCommit} className="type-name" />
              <Editable id="type-main-desc" html={r.type.main.desc} edits={edits} onCommit={onCommit} className="type-desc" />
            </div>
            {r.type.sub && (
              <div className="type-card sub">
                <span className="type-badge">서브유형</span>
                {r.type.sub.axis && <span className="type-axis">{r.type.sub.axis}</span>}
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
        {pf('진단 개요 · 성장 신호등')}
      </article>

      {/* P3 데이터가 본 진짜 이야기 */}
      <article className="sheet">
        <PageHead title={<>데이터가 본 <span className="accent">진짜 이야기</span></>} sub="두 숫자를 겹쳐 보면, 하나만 볼 때는 안 보이던 것이 보여요" tag="INSIGHT" />
        <section className="sec">
          <SecHead n="1" title="강점의 그늘" />
          <div className="truth-card">
            {r.truth.sL && r.truth.sR && (
              <div className="truth-vs num">
                <div className="tv"><div className="tv-v">{r.truth.sL.v}</div><div className="tv-k">{r.truth.sL.k}</div><div className="tv-s">{r.truth.sL.s}</div></div>
                <div className="tv-x">×</div>
                <div className="tv"><div className="tv-v dim">{r.truth.sR.v}</div><div className="tv-k">{r.truth.sR.k}</div><div className="tv-s">{r.truth.sR.s}</div></div>
              </div>
            )}
            <div className="truth-head">{r.truth.head}</div>
            <Editable id="truth-shadow" html={r.truth.shadow} edits={edits} onCommit={onCommit} className="truth-body" />
          </div>
        </section>
        <section className="sec">
          <SecHead n="2" title="약점 속 기회" />
          <div className="truth-card opp">
            <div className="opp-badge num">{r.truth.opp.badge}</div>
            <Editable id="truth-opp" html={r.truth.opp.html} edits={edits} onCommit={onCommit} className="truth-body" />
          </div>
          <div className="basecap num">[산출: 잠재 계약 = (TC 고객당 건수 − 나의 고객당 건수) × 나의 총고객 · 환산 간격 = TC와 나의 월평균 환산실적 차이 · 모든 수치는 현재 데이터 기준의 가늠값입니다]</div>
        </section>
        <div className="onepoint">
          <span className="op-k">단 하나만 고른다면</span>
          <div className="op-t" dangerouslySetInnerHTML={{ __html: `90일 동안 다른 건 잊으셔도 좋아요. ${r.truth.one}, 이것 하나면 돼요. <span class="op-link">→ 자세한 방법은 실행 플랜 ①</span>` }} />
        </div>
        {pf('데이터가 본 진짜 이야기')}
      </article>

      {/* P4 내 연차의 기준 — 코호트 통계가 있을 때만 */}
      {d.cohort && coMsg && (() => {
        const ct = d.cohort!
        return (
          <article className="sheet">
            <PageHead title={<>내 연차의 <span className="accent">기준</span></>} sub="같은 차월대와 비교하면 이야기가 달라져요" tag="BENCHMARK" />
            <div className="sec">
              <SecHead n="4" title="내 연차의 기준" note="같은 차월대와 비교하면 이야기가 달라져요" />
              <div className="cohort">
                <div className="co-head">
                  <span className="co-band">{ct.band}</span>
                  <span className="co-n num">같은 차월대 전체 {ct.all.n.toLocaleString('ko-KR')}명 · 그중 TC 소득 도달 {ct.tc ? `${ct.tc.n}명` : '표본 부족'}</span>
                </div>
                <table className="co-t num">
                  <thead><tr><th>지표</th><th>나</th><th>같은 차월대 전체</th><th>같은 차월대 TC</th><th>TC 표준그룹</th></tr></thead>
                  <tbody>
                    <tr><td>장기고객</td><td className="me">{f1(F.custLong.me)}명</td><td>{f1(ct.all.L)}명</td><td className="ctc">{ct.tc ? `${f1(ct.tc.L)}명` : '—'}</td><td>{f1(F.custLong.tc)}명</td></tr>
                    <tr><td>총고객</td><td className="me">{f1(F.custTotal.me)}명</td><td>{f1(ct.all.T)}명</td><td className="ctc">{ct.tc ? `${f1(ct.tc.T)}명` : '—'}</td><td>{f1(F.custTotal.tc)}명</td></tr>
                    <tr><td>자동차 연계율</td><td className="me">{pctFmt(F.linkRate.me)}</td><td>{pctFmt(ct.all.link)}</td><td className="ctc">{ct.tc ? pctFmt(ct.tc.link) : '—'}</td><td>{pctFmt(F.linkRate.tc)}</td></tr>
                    <tr><td>월 장기건수(6개월)</td><td className="me">{f1(M.moLong.me)}건</td><td>{f1(ct.all.mo)}건</td><td className="ctc">{ct.tc ? `${f1(ct.tc.mo)}건` : '—'}</td><td>{f1(M.moLong.tc)}건</td></tr>
                    {isNum(M.perfConv.me) && isNum(ct.all.conv) && (
                      <tr><td>월평균 환산실적</td><td className="me">{mwon(M.perfConv.me)}만원</td><td>{mwon(ct.all.conv)}만원</td><td className="ctc">{ct.tc && isNum(ct.tc.conv) ? `${mwon(ct.tc.conv)}만원` : '—'}</td><td>{isNum(M.perfConv.tc) ? `${mwon(M.perfConv.tc)}만원` : '—'}</td></tr>
                    )}
                  </tbody>
                </table>
                <Editable id="cohort-msg" html={coMsg} edits={edits} onCommit={onCommit} className="co-msg" />
                <div className="basecap num">[산출: 업로드된 전 플래너 원자료(input·Q6·Q7) · 유지고객은 이관 제외 기준 · 같은 차월대 TC = 해당 차월 구간에서 육성소득 500~700에 도달한 플래너]</div>
              </div>
            </div>
            {pf('내 연차의 기준')}
          </article>
        )
      })()}

      {/* P5 핵심 지표 */}
      <article className="sheet">
        <PageHead title={<>핵심 <span className="accent">지표</span></>} sub="각 카드의 아래 칸은 전체 누적 대비 최근 6개월의 변화예요" tag="DATA" />
        <Insight id="ins-kpi" h={insKpi.h} p={insKpi.p} edits={edits} onCommit={onCommit} />
        <div className="sec">
          <SecHead n="5" title="핵심 지표" />
          <div className="kpi-grid">
            <KpiCard ico="🧲" label="월평균 신규고객" sub="전체 기간" value={f2(F.newCust.me)} unit="명"
              chips={<><TcChip me={F.newCust.me} tc={F.newCust.tc} />{isNum(F.newCust.dg) && <span className="chip neutral num">동일그룹 {f2(F.newCust.dg)}명</span>}</>}
              cap={<Capsule label="최근 6개월 월" fullV={F.newCust.me} m6V={M.newCust6.me} fmt={f2} unit="명" />} />
            <KpiCard ico="👥" label="장기고객" sub="이관 제외 · 전체" value={f1(F.custLong.me)} unit="명"
              chips={<><TcChip me={F.custLong.me} tc={F.custLong.tc} /><span className="chip neutral num">TC {f1(F.custLong.tc)}명</span></>}
              cap={F.transferLong.me === 0 ? <>이관고객 <b>0명</b>, 전원 자력 발굴이에요 <span className="delta up">참고: TC그룹 평균 이관 {f1(F.transferLong.tc)}건</span></> : undefined} />
            <KpiCard ico="📑" label="고객당 계약 건수" sub="장기 · 전체" value={f2(F.perCust.me)} unit="건"
              chips={<><TcChip me={F.perCust.me} tc={F.perCust.tc} /><span className="chip neutral num">TC {f2(F.perCust.tc)}건</span></>}
              cap={<Capsule label="최근 6개월" fullV={F.perCust.me} m6V={M.perCust6.me} fmt={f2} unit="건" />} />
            <KpiCard ico="💰" label="인당 월납보험료" sub="장기 · 전체" value={premPerK} unit="천원"
              chips={<><TcChip me={F.premPer.me} tc={F.premPer.tc} />{premDrop && <span className="chip warn">최근 계약일수록 얕아지는 신호</span>}</>}
              cap={<Capsule label="최근 6개월" fullV={isNum(F.premPer.me) ? F.premPer.me / 1000 : null} m6V={isNum(M.premPer6.me) ? M.premPer6.me / 1000 : null} fmt={f1} unit="천원" />} />
            {isNum(M.perfConv.me) && isNum(M.perfConv.tc) && (
              <KpiCard ico="🏁" label="월평균 환산실적" sub="최근 6개월 평균" value={mwon(M.perfConv.me)} unit="만원"
                chips={<><TcChip me={M.perfConv.me} tc={M.perfConv.tc} /><span className="chip neutral num">TC {mwon(M.perfConv.tc)}만원</span></>}
                cap={isNum(M.perfIn.me) && isNum(M.perfIn.tc) ? <>인실적 월평균 <b>{mwon(M.perfIn.me)}만원</b> <span className={`delta ${(M.perfIn.me ?? 0) >= (M.perfIn.tc ?? 0) ? 'up' : 'down'}`}>TC {mwon(M.perfIn.tc)}만원</span></> : undefined} />
            )}
          </div>
          <div className="basecap num">[{BASE_ALL}]</div>
        </div>
        {pf('핵심 지표')}
      </article>

      {/* P6 활동 구조 */}
      <article className="sheet">
        <PageHead title={<>활동 <span className="accent">구조</span></>} sub="왼쪽 주황이 나, 오른쪽 파랑이 TC그룹이에요" tag="DATA" />
        {insBfly && <Insight id="ins-bfly" h={insBfly.h} p={insBfly.p} edits={edits} onCommit={onCommit} />}
        <div className="sec">
          <SecHead n="6" title="활동 구조 비교" />
          <ButterflyCard M={M} base={BASE_6} />
        </div>
        {pf('활동 구조')}
      </article>

      {/* P7 그룹 비교 ① */}
      <article className="sheet">
        <PageHead title={<>그룹 <span className="accent">비교</span></>} sub={<><span style={{ color: 'var(--cr-hi-dk)', fontWeight: 700 }}>주황=나</span> · 회색=동일그룹 · <span style={{ color: 'var(--cr-blue)', fontWeight: 700 }}>파랑=TC그룹</span></>} tag="DATA" />
        <Insight id="ins-vs" h={insVs.h} p={insVs.p} edits={edits} onCommit={onCommit} />
        <div className="sec">
          <SecHead n="7" title="그룹 비교" />
          <VsCard name="월평균 신규고객" sub="명 · 전체" o={F.newCust} fmt={fmtMyeong}
            msg={vsMsgs[0]} msgId="vs-newCust" edits={edits} onCommit={onCommit} base={BASE_ALL} callout={vsCallouts[0]} />
          {/* 장기계약 건수는 원자료가 없으면(값 결측) 카드를 통째로 뺀다 — v20 */}
          {isNum(F.cntLong.me) && isNum(F.cntLong.tc) && (
            <VsCard name="장기계약 건수" sub="이관 제외 · 전체" o={F.cntLong} fmt={fmtGun1}
              msg={vsMsgs[1]} msgId="vs-cntLong" edits={edits} onCommit={onCommit} base={BASE_ALL} callout={vsCallouts[1]} />
          )}
        </div>
        {pf('그룹 비교 ①')}
      </article>

      {/* P8 그룹 비교 ② */}
      <article className="sheet">
        <PageHead title={<>그룹 <span className="accent">비교</span></>} sub="이어서 봅니다" tag="DATA" />
        <div className="sec">
          <SecHead n="7" title="그룹 비교 (계속)" />
          <VsCard name="월평균 자동차 건수" sub="최근 6개월" o={M.moCar} fmt={fmtGun1}
            msg={vsMsgs[2]} msgId="vs-moCar" edits={edits} onCommit={onCommit} base={BASE_6} callout={vsCallouts[2]} />
          <VsCard name="인당 월납보험료" sub="장기 · 전체" o={F.premPer} fmt={wonK}
            msg={vsMsgs[3]} msgId="vs-premPer" edits={edits} onCommit={onCommit} base={BASE_ALL} callout={vsCallouts[3]} />
        </div>
        {pf('그룹 비교 ②')}
      </article>

      {/* P9 비율과 흐름 */}
      <article className="sheet">
        <PageHead title={<>비율과 <span className="accent">흐름</span></>} sub="링의 채워진 만큼이 나의 현재예요" tag="DATA" />
        <Insight id="ins-flow" h={insFlow.h} p={insFlow.p} edits={edits} onCommit={onCommit} />
        <div className="sec">
          <SecHead n="8" title="두 개의 비율" />
          <div className="ring-duo">
            <RingCard name="자동차·장기 연계율" o={F.linkRate}
              desc={ringDescs.link} descId="ring-linkRate" edits={edits} onCommit={onCommit} base="기준: 전체 누적 · 장기고객 대비" />
            <RingCard name="암 주요치료비 부보율" o={M.cancerRate}
              desc={ringDescs.cancer} descId="ring-cancerRate" edits={edits} onCommit={onCommit} base="기준: 최근 6개월 신계약 건 기준" />
          </div>
        </div>
        <div className="sec">
          <SecHead n="9" title="월별 흐름" />
          <TrendCard monthly={d.monthly} msg={trendMsg} msgId="trend-msg" edits={edits} onCommit={onCommit} base={BASE_6} />
        </div>
        {pf('비율 · 흐름')}
      </article>

      {/* P10 나의 무기 */}
      <article className="sheet">
        <PageHead title={<>나의 <span className="accent">무기</span></>} sub="코칭의 순서는 약점이 아니라 무기에서 시작해요" tag="STRENGTH" />
        {insStrength && <Insight id="ins-strength" h={insStrength.h} p={insStrength.p} edits={edits} onCommit={onCommit} />}
        <div className="sec">
          <SecHead n="10" title="나의 무기" />
          {r.strengths.map((s, i) => (
            <StrengthCard key={s.id} s={s} index={i} edits={edits} onCommit={onCommit} />
          ))}
        </div>
        {pf('나의 무기')}
      </article>

      {/* P11 성장 포인트 */}
      <article className="sheet">
        <PageHead title={<>성장 <span className="accent">포인트</span></>} sub="성장 포인트는 다음 성장이 숨어 있는 자리예요" tag="FOCUS" />
        {insBottle && <Insight id="ins-bottle" h={insBottle.h} p={insBottle.p} edits={edits} onCommit={onCommit} />}
        <div className="sec">
          <SecHead n="11" title="성장 포인트" />
          {r.bottlenecks.map((bn, i) => (
            <BottleneckCard key={bn.id} b={bn} index={i} edits={edits} onCommit={onCommit} />
          ))}
        </div>
        {pf('성장 포인트')}
      </article>

      {/* P12 실행 플랜 · 제안 1 */}
      <article className="sheet">
        <PageHead title={<>90일 <span className="accent">실행 플랜</span></>} sub={`${r.goals.length > 1 ? 'AI 코치의 두 가지 제안 중 나의 90일 목표는 내가 선택해요' : 'AI 코치의 제안을 나의 말로 다듬어 90일 목표로 삼아요'} — 선택은 언제나 플래너의 몫이에요`} tag="ACTION PLAN" />
        <div className="sec">
          <SecHead n="12" title="AI 코치의 제안" />
          {r.goals[0] && <GoalCard g={r.goals[0]} index={0} edits={edits} onCommit={onCommit} />}
        </div>
        {pf('실행 플랜 ①')}
      </article>

      {/* P13 실행 플랜 · 제안 2 — 두 번째 제안이 있을 때만 */}
      {r.goals[1] && (
        <article className="sheet">
          <PageHead title={<>90일 <span className="accent">실행 플랜</span></>} sub="이어서, 이런 선택도 좋아요" tag="ACTION PLAN" />
          <div className="sec">
            <SecHead n="12" title="AI 코치의 제안 (계속)" />
            <GoalCard g={r.goals[1]} index={1} edits={edits} onCommit={onCommit} />
          </div>
          {pf('실행 플랜 ②')}
        </article>
      )}

      {/* P14 멘토 팁 + HOW TO */}
      <article className="sheet">
        <PageHead title={<>이번 주 <span className="accent">실행</span></>} sub="현장에서 성과를 낸 선배 멘토들의 경험에서 가져온 팁이에요" tag="START" />
        <div className="sec">
          <SecHead n="13" title="멘토의 실전 팁" />
          {heroes.map((h) => (
            <HeroCard key={h.ref + h.name} hero={h} />
          ))}
        </div>
        <div className="sec">
          <SecHead n="14" title="이번 주 HOW TO" />
          <div className="howto">
            {howto.slice(0, 5).map((h, i) => (
              <div className="chk" key={i}>
                <div className="box" />
                <Editable id={`howto-${i}`} html={h} edits={edits} onCommit={onCommit} as="span" />
              </div>
            ))}
          </div>
        </div>
        {pf('이번 주 실행')}
      </article>

      {/* P15 나의 선택 */}
      <article className="sheet">
        <PageHead title={<>나의 선택과 <span className="accent">다짐</span></>} sub="목표는 AI가 아니라 내가 정해요 · 손으로 적어도 좋아요" tag="MY CHOICE" />
        <div className="sec">
          <SecHead n="15" title="나의 선택" />
          <div className="ex-card">
            <span className="ex-tag">✎ 작성 예시</span>
            <div className="ex-row"><b>내가 선택한 목표</b> {gName}</div>
            <div className="ex-row"><b>선택한 이유</b> <Html html={gEx.reason} as="span" /></div>
            <div className="ex-row"><b>첫 실행일</b> 다음 주 월요일 &nbsp;·&nbsp; <b>점검일</b> 매주 금요일 오후</div>
            <div className="ex-row"><b>매주 실행할 행동</b> <Html html={gEx.action} as="span" /></div>
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
            <span className="declare-note">회색 글씨는 작성 예시예요 — 클릭해서 나의 숫자와 행동으로 바꿔 적어요</span>
            나는 앞으로 <input type="text" placeholder="90" />일 동안, 매주 <input type="text" placeholder="5" />명을 대상으로
            <input type="text" className="w" placeholder={gEx.act} />을 실행하여,
            <input type="text" className="w" placeholder={gEx.metric} />을 현재 <input type="text" placeholder={gEx.from} />에서 <input type="text" placeholder={gEx.to} />까지 높이겠다.
          </div>
        </div>
        {pf('나의 선택')}
      </article>
        </>
      )}

      {/* 강사용 (토글) — guideOnly 면 이 블록만 남는다 */}
      {(showCoachGuide || guideOnly) && (
        <>
          <article className="sheet coach">
            <div className="coach-band">
              <div>
                <div className="cb-t">강사용 코칭 가이드</div>
                <div className="cb-s">코칭 대화 준비용 · 플래너 배포용에는 포함하지 마세요 · {name} 플래너 ({maskId(b.code)})</div>
              </div>
            </div>
            <div className="sec">
              <SecHead n="C1" title="데이터 종합판단 (C·A·M·S)" />
              <Html html={cguides.c1} as="div" className="cguide" />
              {camsFacts.map((t, i) => (
                <Html key={i} html={t} as="div" className="cfact" />
              ))}
            </div>
            <div className="sec">
              <SecHead n="C2" title="진단 논리" />
              <Editable id="coach-logic" html={coachLogic} edits={edits} onCommit={onCommit} className="plain" />
            </div>
            <PageFoot n="C-1" t="강사용 · 대외비" name={name} />
          </article>
          <article className="sheet coach">
            <div className="coach-band">
              <div>
                <div className="cb-t">강사용 코칭 가이드</div>
                <div className="cb-s">{name} 플래너 ({maskId(b.code)})</div>
              </div>
            </div>
            <div className="sec">
              <SecHead n="C3" title="원인가설 — 데이터에서 떠올릴 수 있는 '가능성'" />
              <Html html={cguides.c3} as="div" className="cguide" />
              {hypoBank.slice(0, 3).map((h, i) => (
                <Html key={i} html={h} as="div" className="hypo" />
              ))}
              <p className="plain" style={{ marginTop: 8, fontSize: 13, color: 'var(--cr-text3)' }}>
                ※ 가설은 어디까지나 '가능성'입니다. 플래너에게 단정해서 말하지 말고, C4의 질문으로 본인의 입에서 확인되도록 해주세요.
              </p>
            </div>
            <div className="sec">
              <SecHead n="C4" title="코칭 질문 — 이 순서대로 물어보세요" />
              <Html html={cguides.c4} as="div" className="cguide" />
              <ol className="qs">
                {coachQs.map((q, i) => (
                  <Html key={i} html={q} as="li" />
                ))}
              </ol>
            </div>
            <PageFoot n="C-2" t="강사용 · 대외비" name={name} />
          </article>
          <article className="sheet coach">
            <div className="coach-band">
              <div>
                <div className="cb-t">강사용 코칭 가이드</div>
                <div className="cb-s">{name} 플래너 ({maskId(b.code)})</div>
              </div>
            </div>
            <div className="sec">
              <SecHead n="C5" title="목표 선택 코칭" />
              <ul className="tight">
                {goalCoach.map((t, i) => (
                  <Html key={i} html={t} as="li" />
                ))}
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
              <SecHead n="C7" title="데이터 확인 필요 — 플래너가 물어볼 수 있는 지점" />
              <Html html={cguides.c7} as="div" className="cguide" />
              {dataNotes.map((n, i) => (
                <Html key={i} html={n} as="div" className="note-card" />
              ))}
            </div>
            <PageFoot n="C-3" t="강사용 · 대외비" name={name} />
          </article>
        </>
      )}
    </div>
  )
}
