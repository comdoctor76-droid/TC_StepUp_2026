import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageTitle } from '../components/PageTitle'
import { PrintRoot } from '../PrintRoot'
import { ReportTab } from '../tabs/ReportTab'
import { CustomerTab } from '../tabs/CustomerTab'
import { ActionTab } from '../tabs/ActionTab'
import { MarketTab } from '../tabs/MarketTab'
import { SkillTab } from '../tabs/SkillTab'
import { ActionPlanTab } from '../tabs/ActionPlanTab'
import { GrowthCoachTab } from '../tabs/coach/GrowthCoachTab'
import { HighlightDeck } from '../tabs/coach/HighlightDeck'
import {
  ALL_PERIOD,
  DEFAULT_PERIOD,
  PeriodPicker,
  type Period,
  type PeriodCaps,
} from '../components/PeriodPicker'
import { captureAllPagesChunked, printAll } from '../export/captureAll'
import type { CoverGender } from '../components/CoverPage'
import { exportPdf } from '../export/pdf'
import { savePdf } from '../export/pdfSave'
import {
  canShareFiles,
  isMobile,
  outputFileName,
  outputFileStem,
  outputImageFileNames,
  shareOrDownloadMany,
} from '../export/share'
import type { FullAnalysis } from '../calc'
import { APP_VERSION, CONTACT_LINE, REPORT_TITLE, TOTAL_PAGES } from '../version'

const TABS = [
  { id: 'report', label: '레포트', title: REPORT_TITLE, eyebrow: '' },
  { id: 'c', label: 'C분석', title: 'Customer [고객] 분석', eyebrow: '전체' },
  { id: 'a', label: 'A분석', title: 'Action [활동] 분석', eyebrow: '최근 6개월' },
  { id: 'm', label: 'M분석', title: 'Market [시장] 분석', eyebrow: '최근 6개월' },
  { id: 's', label: 'S분석', title: 'Skill [기술] 분석', eyebrow: '최근 6개월' },
  { id: 'plan', label: '액션플랜', title: '액션플랜', eyebrow: 'Action Plan' },
  { id: 'coach', label: '성장코칭', title: '성장 코칭', eyebrow: '' },
  { id: 'highlight', label: '하이라이트', title: 'TC스텝업 하이라이트', eyebrow: '강의용' },
] as const

type TabId = (typeof TABS)[number]['id']

/* 탭별로 "실제 값을 바꾸는" 컨트롤만 노출한다 (근거: src/calc/period.ts).
     scope = 최근 6개월 ↔ 전체기간   — 엑셀이 두 벌 계산해 둔 항목이 있는 탭
     range = 월 구간 선택            — 월별 계열이 있는 탭
   유지고객 같은 재고는 6개월/전체 구분이 무의미하다(둘 다 '현재 시점')여서
   C분석·레포트에는 scope 를 두지 않는다. M분석은 둘 다 없어 피커가 사라진다. */
const PERIOD_CAPS: Record<TabId, PeriodCaps> = {
  report: { range: true },
  c: { range: true },
  a: { scope: true, range: true },
  m: {},
  s: { scope: true },
  plan: {},
  coach: {},
  highlight: {},
}

export function Report({
  A,
  caption,
  onBack,
  onRefresh,
}: {
  A: FullAnalysis
  caption?: string
  onBack: () => void
  /** 최신 데이터로 다시 조회 */
  onRefresh: () => Promise<void>
}) {
  const [tab, setTab] = useState<TabId>('report')
  // 탭마다 조회기간을 따로 기억한다 — 기본값도 탭마다 다르다.
  // 레포트는 현황Ⅰ(전체)이 주인공이라 전체기간으로 연다.
  const [periods, setPeriods] = useState<Record<TabId, Period>>(() => ({
    report: ALL_PERIOD,
    c: DEFAULT_PERIOD,
    a: DEFAULT_PERIOD,
    m: DEFAULT_PERIOD,
    s: DEFAULT_PERIOD,
    plan: DEFAULT_PERIOD,
    coach: DEFAULT_PERIOD,
    // 하이라이트는 강의 자료라 조회기간과 무관하다 (피커도 뜨지 않는다)
    highlight: DEFAULT_PERIOD,
  }))
  const period = periods[tab]
  const setPeriod = (p: Period) => setPeriods((prev) => ({ ...prev, [tab]: p }))
  const [busy, setBusy] = useState<string | null>(null)
  const [busyMode, setBusyMode] = useState<'print' | 'image' | 'pdf' | null>(null)
  const [showDismiss, setShowDismiss] = useState(false)
  const [showPrintChoice, setShowPrintChoice] = useState(false)
  // 이미지로 저장(및 모바일 전체 인쇄) 전 남/여 표지 선택 팝업
  const [showImageChoice, setShowImageChoice] = useState(false)
  // 출력물 맨 앞에 붙는 표지 — 팝업에서 선택해야만 출력이 가능하다
  const [coverGender, setCoverGender] = useState<CoverGender | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // 작업 순번. 사용자가 "닫기"로 먼저 빠져나간 뒤 뒤늦게 끝난 이전 작업이
  // 상태를 되살리지 못하도록 매 시도마다 증가시키고 결과 처리 전에 대조한다.
  const opIdRef = useRef(0)
  const isCurrent = (id: number) => opIdRef.current === id
  const startOp = () => ++opIdRef.current

  const active = useMemo(() => TABS.find((t) => t.id === tab)!, [tab])
  const mobile = isMobile()
  const shareable = canShareFiles()

  // busy 상태가 10초 넘게 이어지면 "닫기"를 노출한다 — 어떤 이유로든 멈췄을 때
  // 새로고침 없이 빠져나갈 수 있게 하는 안전판.
  useEffect(() => {
    if (!busy) {
      setShowDismiss(false)
      return
    }
    const t = setTimeout(() => setShowDismiss(true), 10_000)
    return () => clearTimeout(t)
  }, [busy])

  const dismissBusy = useCallback(() => {
    startOp() // 이후 도착하는 이전 작업의 결과를 무효화
    setBusy(null)
    setBusyMode(null)
    setToast('시간이 오래 걸려 창을 닫았습니다. 다시 시도해 주세요.')
    setTimeout(() => setToast(null), 5000)
  }, [])

  /* setCoverGender 로 표지를 붙인 뒤 PrintRoot 가 실제로 다시 그려질 때까지
     두 프레임 양보 — 캡처가 표지 없는 이전 DOM 을 찍지 않도록 한다 */
  const nextPaint = () =>
    new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

  const makeImage = useCallback(async (gender: CoverGender) => {
    const id = startOp()
    setBusyMode('image')
    setBusy(`0 / ${TOTAL_PAGES + 1}`)
    setCoverGender(gender)
    try {
      await nextPaint()
      const blobs = await captureAllPagesChunked((d, t) => {
        if (isCurrent(id)) setBusy(`${d} / ${t}`)
      })
      // 캔버스 픽셀 한도 때문에 여러 장으로 나뉠 수 있다 — 공유 시트는 한 번만 뜬다.
      const fileNames = outputImageFileNames(A.profile.name, A.profile.code, blobs.length)
      const result = await shareOrDownloadMany(blobs, fileNames)
      if (!isCurrent(id)) return
      setToast(
        result === 'shared'
          ? '공유했습니다.'
          : result === 'downloaded'
            ? blobs.length > 1
              ? `이미지 ${blobs.length}장을 저장했습니다`
              : `이미지를 저장했습니다 — ${fileNames[0]}`
            : '공유를 취소했습니다.',
      )
      setTimeout(() => setToast(null), 5000)
    } catch (e) {
      if (!isCurrent(id)) return
      setToast(e instanceof Error ? e.message : '이미지를 만들지 못했습니다.')
      setTimeout(() => setToast(null), 5000)
    } finally {
      setCoverGender(null)
      if (isCurrent(id)) {
        setBusy(null)
        setBusyMode(null)
      }
    }
  }, [A])

  /* 모바일은 window.print() 가 안정적이지 않아 "전체 인쇄" 버튼이 바로 PDF 를
     만들어 OS 공유 시트로 넘긴다(카카오톡 등으로 바로 전송 가능) — 예전에는
     PNG 로 캡처해 이어붙였는데, PDF 는 원본 그대로 전달되어(메신저의 사진
     압축을 타지 않음) 더 선명하다. 데스크톱 전용 "이미지로 저장" 버튼은
     그대로 makeImage 를 쓴다. */
  const makePdfMobile = useCallback(async (gender: CoverGender) => {
    const id = startOp()
    setBusyMode('pdf')
    setBusy(`0 / ${TOTAL_PAGES + 1}`)
    setCoverGender(gender)
    try {
      await nextPaint()
      const blob = await exportPdf((d, t) => {
        if (isCurrent(id)) setBusy(`${d} / ${t}`)
      })
      const fileName = outputFileName(A.profile.name, A.profile.code, 'pdf')
      const result = await shareOrDownloadMany([blob], [fileName])
      if (!isCurrent(id)) return
      setToast(
        result === 'shared'
          ? '공유했습니다.'
          : result === 'downloaded'
            ? `PDF를 저장했습니다 — ${fileName}`
            : '공유를 취소했습니다.',
      )
      setTimeout(() => setToast(null), 5000)
    } catch (e) {
      if (!isCurrent(id)) return
      setToast(e instanceof Error ? e.message : 'PDF를 만들지 못했습니다.')
      setTimeout(() => setToast(null), 5000)
    } finally {
      setCoverGender(null)
      if (isCurrent(id)) {
        setBusy(null)
        setBusyMode(null)
      }
    }
  }, [A])

  const doPrintAll = useCallback(async (gender: CoverGender) => {
    if (mobile) {
      await makePdfMobile(gender)
      return
    }
    const id = startOp()
    setBusyMode('print')
    setBusy('준비 중')
    setCoverGender(gender)
    try {
      await nextPaint()
      const fileStem = outputFileStem(A.profile.name, A.profile.code)
      await printAll(fileStem, () => {
        // 폰트 대기가 끝나 인쇄창을 여는 시점 — 자체 오버레이를 바로 닫는다.
        // window.print() 의 결과를 기다리지 않으므로 오버레이가 무한정 떠 있을 수 없다.
        if (isCurrent(id)) {
          setBusy(null)
          setBusyMode(null)
        }
      })
    } catch (e) {
      if (isCurrent(id)) {
        setToast(e instanceof Error ? e.message : '인쇄를 시작하지 못했습니다.')
        setTimeout(() => setToast(null), 5000)
      }
    } finally {
      setCoverGender(null)
      if (isCurrent(id)) {
        setBusy(null)
        setBusyMode(null)
      }
    }
  }, [mobile, makePdfMobile, A])

  const doExportPdf = useCallback(async (gender: CoverGender) => {
    const id = startOp()
    setBusyMode('pdf')
    setBusy(`0 / ${TOTAL_PAGES + 1}`)
    setCoverGender(gender)
    try {
      await nextPaint()
      const blob = await exportPdf((d, t) => {
        if (isCurrent(id)) setBusy(`${d} / ${t}`)
      })
      const fileName = outputFileName(A.profile.name, A.profile.code, 'pdf')
      const result = await savePdf(blob, fileName)
      if (!isCurrent(id)) return
      setToast(
        result === 'cancelled' ? 'PDF 저장을 취소했습니다.' : `PDF를 저장했습니다 — ${fileName}`,
      )
      setTimeout(() => setToast(null), 5000)
    } catch (e) {
      if (!isCurrent(id)) return
      setToast(e instanceof Error ? e.message : 'PDF를 만들지 못했습니다.')
      setTimeout(() => setToast(null), 5000)
    } finally {
      setCoverGender(null)
      if (isCurrent(id)) {
        setBusy(null)
        setBusyMode(null)
      }
    }
  }, [A])

  /* 팝업을 열 때마다 표지 선택을 초기화한다 — 매번 명시적으로 고르게 (요청 사항) */
  const openPrintChoice = useCallback(() => {
    setCoverGender(null)
    if (mobile) {
      // 모바일 전체 인쇄 = PDF 저장·공유이므로 남/여 선택 팝업을 먼저 띄운다
      // (같은 팝업을 데스크톱의 "이미지로 저장" 버튼도 쓴다 — chooseImage 가 mobile 로 갈라 쓴다)
      setShowImageChoice(true)
      return
    }
    setShowPrintChoice(true)
  }, [mobile])

  const openImageChoice = useCallback(() => {
    setCoverGender(null)
    setShowImageChoice(true)
  }, [])

  const choosePrint = useCallback(() => {
    if (!coverGender) return
    setShowPrintChoice(false)
    void doPrintAll(coverGender)
  }, [doPrintAll, coverGender])

  const choosePdf = useCallback(() => {
    if (!coverGender) return
    setShowPrintChoice(false)
    void doExportPdf(coverGender)
  }, [doExportPdf, coverGender])

  /* 이 팝업은 두 자리에서 연다 — 모바일의 "전체 인쇄"(PDF 저장·공유를 원함)와
     데스크톱 전용 "이미지로 저장" 버튼(항상 이미지를 원함). openImageChoice 는
     mobile 이 아닐 때만 눌리는 버튼이므로, mobile 여부만으로 어느 쪽인지 갈린다. */
  const chooseImage = useCallback(() => {
    if (!coverGender) return
    setShowImageChoice(false)
    if (mobile) void makePdfMobile(coverGender)
    else void makeImage(coverGender)
  }, [mobile, makePdfMobile, makeImage, coverGender])

  return (
    <div className="app">
      <header className="appbar">
        <button className="appbar__back" onClick={onBack} aria-label="사번 다시 조회">
          ←
        </button>
        <div className="appbar__brand">
          <b className="appbar__brand-title">현대해상 26년 3분기 TC Step-Up On-line</b>
          <span className="appbar__brand-meta">
            v{APP_VERSION} · {CONTACT_LINE}
          </span>
        </div>
        <div className="appbar__actions">
          <button
            className="btn btn--icon"
            onClick={async () => {
              setRefreshing(true)
              try {
                await onRefresh()
                setToast('최신 데이터로 새로고침했습니다.')
              } catch (e) {
                setToast(e instanceof Error ? e.message : '새로고침에 실패했습니다.')
              } finally {
                setRefreshing(false)
                setTimeout(() => setToast(null), 4000)
              }
            }}
            disabled={!!busy || refreshing}
            title="최신 데이터로 새로고침"
          >
            <span className={refreshing ? 'spin' : undefined} aria-hidden="true">
              ⟳
            </span>
            <span className="btn__text">새로고침</span>
          </button>
          <button className="btn btn--primary" onClick={openPrintChoice} disabled={!!busy || refreshing}>
            {busy
              ? busyMode === 'print'
                ? '인쇄 준비 중'
                : busyMode === 'pdf'
                  ? `PDF 저장 중 ${busy}`
                  : `출력 중 ${busy}`
              : mobile
                ? '전체 인쇄 (PDF 저장·공유)'
                : `전체 인쇄 (표지+A4 ${TOTAL_PAGES}장)`}
          </button>
          {!mobile && (
            <button className="btn" onClick={openImageChoice} disabled={!!busy || refreshing}>
              이미지로 저장
            </button>
          )}
        </div>
      </header>

      <nav className="tabbar" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tabbar__tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="screen">
        <PageTitle
          title={active.title}
          eyebrow={active.eyebrow || undefined}
          profile={A.profile}
          months={A.ctx.months}
          credit={tab === 'coach' ? '성장코칭 제작 : 이경석 전임강사' : undefined}
        />
        {/* 기간 선택 — 그 탭에서 실제로 값을 바꾸는 컨트롤만 띄운다 (PERIOD_CAPS) */}
        <PeriodPicker
          value={period}
          months={A.ctx.months}
          caps={PERIOD_CAPS[tab]}
          onChange={setPeriod}
        />
        <div className="screen__body">
          {tab === 'report' && <ReportTab A={A} period={period} />}
          {tab === 'c' && <CustomerTab A={A} period={period} />}
          {tab === 'a' && <ActionTab A={A} period={period} />}
          {tab === 'm' && <MarketTab A={A} period={period} />}
          {tab === 's' && <SkillTab A={A} period={period} />}
          {tab === 'plan' && <ActionPlanTab A={A} />}
          {tab === 'coach' && <GrowthCoachTab A={A} caption={caption ?? ''} />}
          {tab === 'highlight' && <HighlightDeck />}
        </div>
        <p className="screen__caption">
          {caption} · v{APP_VERSION} · {CONTACT_LINE}
        </p>
      </main>

      {showPrintChoice && (
        <div
          className="choice-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowPrintChoice(false)}
        >
          <div className="choice-overlay__box" onClick={(e) => e.stopPropagation()}>
            <p className="choice-overlay__title">어떻게 출력할까요?</p>
            <div className="choice-overlay__gender" role="radiogroup" aria-label="표지 선택">
              <button
                className={`btn gender-btn ${coverGender === 'M' ? 'is-active' : ''}`}
                role="radio"
                aria-checked={coverGender === 'M'}
                onClick={() => setCoverGender('M')}
              >
                남자표지
              </button>
              <button
                className={`btn gender-btn ${coverGender === 'F' ? 'is-active' : ''}`}
                role="radio"
                aria-checked={coverGender === 'F'}
                onClick={() => setCoverGender('F')}
              >
                여자표지
              </button>
            </div>
            {!coverGender && (
              <p className="choice-overlay__note">표지를 선택해야 출력할 수 있습니다.</p>
            )}
            <div className="choice-overlay__actions">
              <button className="btn btn--primary" disabled={!coverGender} onClick={choosePrint}>
                인쇄
              </button>
              <button className="btn btn--primary" disabled={!coverGender} onClick={choosePdf}>
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

      {showImageChoice && (
        <div
          className="choice-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowImageChoice(false)}
        >
          <div className="choice-overlay__box" onClick={(e) => e.stopPropagation()}>
            <p className="choice-overlay__title">어떤 표지로 저장할까요?</p>
            <div className="choice-overlay__gender" role="radiogroup" aria-label="표지 선택">
              <button
                className={`btn gender-btn ${coverGender === 'M' ? 'is-active' : ''}`}
                role="radio"
                aria-checked={coverGender === 'M'}
                onClick={() => setCoverGender('M')}
              >
                남자표지
              </button>
              <button
                className={`btn gender-btn ${coverGender === 'F' ? 'is-active' : ''}`}
                role="radio"
                aria-checked={coverGender === 'F'}
                onClick={() => setCoverGender('F')}
              >
                여자표지
              </button>
            </div>
            {!coverGender && (
              <p className="choice-overlay__note">표지를 선택해야 저장할 수 있습니다.</p>
            )}
            <div className="choice-overlay__actions">
              <button className="btn btn--primary" disabled={!coverGender} onClick={chooseImage}>
                저장
              </button>
            </div>
            <button
              className="btn choice-overlay__cancel"
              onClick={() => setShowImageChoice(false)}
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
                표지+A4 {TOTAL_PAGES}장을 이미지로 만드는 중입니다
                <br />
                <b>{busy}</b>
              </p>
            )}
            {showDismiss && (
              <button className="btn overlay__dismiss" onClick={dismissBusy}>
                닫기
              </button>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {/* 인쇄/캡처 전용 — 화면 밖에 상시 마운트. cover 는 출력 팝업에서 고른 표지 */}
      <PrintRoot A={A} caption={caption} cover={coverGender} />

      {mobile && !shareable && (
        <p className="hint">
          이 브라우저는 파일 공유를 지원하지 않아 PDF가 <b>다운로드</b>됩니다. 저장된 파일을
          카카오톡에서 직접 첨부해 주세요.
        </p>
      )}
    </div>
  )
}
