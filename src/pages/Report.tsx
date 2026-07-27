import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageTitle } from '../components/PageTitle'
import { PrintRoot } from '../PrintRoot'
import { ReportTab } from '../tabs/ReportTab'
import { CustomerTab } from '../tabs/CustomerTab'
import { ActionTab } from '../tabs/ActionTab'
import { MarketTab } from '../tabs/MarketTab'
import { SkillTab } from '../tabs/SkillTab'
import { ActionPlanTab } from '../tabs/ActionPlanTab'
import { captureAllPages, printAll } from '../export/captureAll'
import { canShareFiles, isMobile, outputFileName, shareOrDownload } from '../export/share'
import type { FullAnalysis } from '../calc'
import {
  APP_VERSION,
  CONTACT_LINE,
  REPORT_TITLE,
  REPORT_TITLE_SHORT,
  TOTAL_PAGES,
} from '../version'

const TABS = [
  { id: 'report', label: '레포트', title: REPORT_TITLE, eyebrow: '' },
  { id: 'c', label: 'C분석', title: 'Customer [고객] 분석', eyebrow: '전체' },
  { id: 'a', label: 'A분석', title: 'Action [활동] 분석', eyebrow: '최근 6개월' },
  { id: 'm', label: 'M분석', title: 'Market [시장] 분석', eyebrow: '최근 6개월' },
  { id: 's', label: 'S분석', title: 'Skill [기술] 분석', eyebrow: '최근 6개월' },
  { id: 'plan', label: '액션플랜', title: '액션플랜', eyebrow: 'Action Plan' },
] as const

type TabId = (typeof TABS)[number]['id']

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
  const [busy, setBusy] = useState<string | null>(null)
  const [busyMode, setBusyMode] = useState<'print' | 'image' | null>(null)
  const [showDismiss, setShowDismiss] = useState(false)
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

  const makeImage = useCallback(async () => {
    const id = startOp()
    setBusyMode('image')
    setBusy(`0 / ${TOTAL_PAGES}`)
    try {
      const blob = await captureAllPages((d, t) => {
        if (isCurrent(id)) setBusy(`${d} / ${t}`)
      })
      const fileName = outputFileName(A.profile.name, A.profile.code)
      const result = await shareOrDownload(
        blob,
        fileName,
        `${A.profile.name} 플래너 ${REPORT_TITLE_SHORT}`,
      )
      if (!isCurrent(id)) return
      setToast(
        result === 'shared'
          ? '공유했습니다.'
          : result === 'downloaded'
            ? `이미지를 저장했습니다 — ${fileName}`
            : '공유를 취소했습니다.',
      )
      setTimeout(() => setToast(null), 5000)
    } catch (e) {
      if (!isCurrent(id)) return
      setToast(e instanceof Error ? e.message : '이미지를 만들지 못했습니다.')
      setTimeout(() => setToast(null), 5000)
    } finally {
      if (isCurrent(id)) {
        setBusy(null)
        setBusyMode(null)
      }
    }
  }, [A])

  const doPrintAll = useCallback(async () => {
    if (mobile) {
      await makeImage()
      return
    }
    const id = startOp()
    setBusyMode('print')
    setBusy('준비 중')
    try {
      await printAll(() => {
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
      if (isCurrent(id)) {
        setBusy(null)
        setBusyMode(null)
      }
    }
  }, [mobile, makeImage])

  return (
    <div className="app">
      <header className="appbar">
        <button className="appbar__back" onClick={onBack} aria-label="사번 다시 조회">
          ←
        </button>
        <div className="appbar__who">
          <b>{A.profile.name}</b>
          <span>{A.profile.code}</span>
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
          <button className="btn btn--primary" onClick={doPrintAll} disabled={!!busy || refreshing}>
            {busy
              ? busyMode === 'print'
                ? '인쇄 준비 중'
                : `출력 중 ${busy}`
              : mobile
                ? '전체 인쇄 (이미지 저장·공유)'
                : `전체 인쇄 (A4 ${TOTAL_PAGES}장)`}
          </button>
          {!mobile && (
            <button className="btn" onClick={makeImage} disabled={!!busy || refreshing}>
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
        />
        <div className="screen__body">
          {tab === 'report' && <ReportTab A={A} />}
          {tab === 'c' && <CustomerTab A={A} />}
          {tab === 'a' && <ActionTab A={A} />}
          {tab === 'm' && <MarketTab A={A} />}
          {tab === 's' && <SkillTab A={A} />}
          {tab === 'plan' && <ActionPlanTab A={A} />}
        </div>
        <p className="screen__caption">
          {caption} · v{APP_VERSION} · {CONTACT_LINE}
        </p>
      </main>

      {busy && (
        <div className="overlay" role="status" aria-live="polite">
          <div className="overlay__box">
            <div className="overlay__spin" />
            {busyMode === 'print' ? (
              <p>인쇄 준비 중입니다</p>
            ) : (
              <p>
                A4 {TOTAL_PAGES}장을 이미지로 만드는 중입니다
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

      {/* 인쇄/캡처 전용 — 화면 밖에 상시 마운트 */}
      <PrintRoot A={A} caption={caption} />

      {mobile && !shareable && (
        <p className="hint">
          이 브라우저는 파일 공유를 지원하지 않아 이미지가 <b>다운로드</b>됩니다. 저장된 파일을
          카카오톡에서 직접 첨부해 주세요.
        </p>
      )}
    </div>
  )
}
