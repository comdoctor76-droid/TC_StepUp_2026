import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Login } from './pages/Login'
import { Report } from './pages/Report'
import { Search } from './pages/Search'
import { analyze, type FullAnalysis } from './calc'
import { clearCache, loadPlanner, loadReference } from './data/repository'
import { isViewerUnlocked } from './session'

/** 관리자 화면은 SheetJS(약 1MB)를 끌고 오므로 뷰어 번들에서 분리한다. */
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })))

/**
 * 개발 전용 미리보기.
 * 픽스처에 실제 플래너 정보가 들어 있으므로 **프로덕션 번들에 남으면 안 된다.**
 * import.meta.env.DEV 는 빌드 시 false 로 치환되어 아래 dynamic import 가 통째로 제거된다.
 * (조건 없이 lazy() 를 쓰면 청크가 그대로 생성되어 URL 로 접근 가능해진다)
 */
const Demo = import.meta.env.DEV
  ? lazy(() => import('./pages/Demo').then((m) => ({ default: m.Demo })))
  : null

function useHashRoute() {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export function App() {
  const hash = useHashRoute()
  const [unlocked, setUnlocked] = useState(isViewerUnlocked)
  const [view, setView] = useState<{ A: FullAnalysis; caption: string } | null>(null)

  /** 캐시를 비우고 현재 사번을 다시 조회 */
  const refresh = useCallback(async () => {
    if (!view) return
    const code = view.A.ctx.code
    clearCache()
    const ref = await loadReference(true)
    const planner = await loadPlanner(code)
    if (!planner) throw new Error(`사번 ${code} 데이터가 더 이상 존재하지 않습니다.`)
    setView({
      A: analyze(code, planner, ref.benchmarks, ref.incomeMap, ref.dataset.months),
      caption: ref.dataset.caption,
    })
  }, [view])

  if (import.meta.env.DEV && Demo && hash.startsWith('#/demo')) {
    return (
      <Suspense fallback={<div className="gate"><div className="gate__card">불러오는 중…</div></div>}>
        <Demo />
      </Suspense>
    )
  }

  if (hash.startsWith('#/admin')) {
    return (
      <Suspense
        fallback={
          <div className="gate">
            <div className="gate__card">관리자 화면을 불러오는 중…</div>
          </div>
        }
      >
        <Admin />
      </Suspense>
    )
  }

  if (!unlocked) return <Login onUnlocked={() => setUnlocked(true)} />

  // Search(및 그 안의 명단/TC스텝업 조회 상태)를 계속 마운트해 둔다 — 레포트를
  // 보고 "뒤로"를 누르면 처음 화면이 아니라 방금까지 보던 화면(드릴다운·붙여넣기·
  // 선택 상태 그대로)으로 돌아가야 하기 때문. 조회 방식과 무관하게 항상 동작한다.
  return (
    <>
      <div style={{ display: view ? 'none' : undefined }}>
        <Search onFound={(A, caption) => setView({ A, caption })} />
      </div>
      {view && (
        <Report
          A={view.A}
          caption={view.caption}
          onBack={() => setView(null)}
          onRefresh={refresh}
        />
      )}
    </>
  )
}
