/* ══════════════════════════════════════════════════════════════════════
   일괄 인쇄 / PDF 저장 — 명단에서 체크한 여러 명을 순서대로 처리한다.

   #print-root 는 싱글턴이라(capturePageCanvases 가 getElementById 로 찾음)
   동시에 여러 명을 마운트할 수 없다 — 한 명씩 렌더 → 대기 → 캡처 → 다음
   순서로 돈다. PDF 는 사람마다 저장 위치를 묻지 않고 성명(사번)_출력일시.pdf
   이름으로 즉시 다운로드한다(여러 번 묻는 걸 피하기 위해 — v0.13 사용자 선택).
   인쇄는 브라우저 정책상 창을 닫아야 다음 사람으로 넘어간다.
   ══════════════════════════════════════════════════════════════════════ */

import { analyze, type FullAnalysis } from '../calc'
import { loadPlanner, loadReference } from '../data/repository'
import { printAll } from './captureAll'
import { exportPdf } from './pdf'
import { download, outputFileName, outputFileStem } from './share'

export type BulkMode = 'print' | 'pdf'

export interface BulkProgress {
  index: number
  total: number
  code: string
  name?: string
  phase: 'loading' | 'rendering' | 'capturing' | 'printing'
  page?: number
  pageTotal?: number
}

export interface BulkResult {
  ok: { code: string; name: string }[]
  failed: { code: string; error: string }[]
}

/** 두 프레임 양보 — setA() 로 바뀐 PrintRoot 내용이 실제로 페인트될 시간을 준다 */
function nextPaint(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
}

/**
 * codes 를 순서대로 처리한다. setCurrent 는 캡처 대상 PrintRoot 를 그 사람으로
 * 갈아 끼우는 콜백(호출부가 상태로 들고 있다가 <PrintRoot A={...}/> 를 렌더한다).
 * 도중에 cancelled() 가 true 를 반환하면 그 시점에서 멈춘다.
 */
export async function runBulkExport(
  codes: string[],
  mode: BulkMode,
  setCurrent: (v: { A: FullAnalysis; caption: string } | null) => void,
  onProgress: (p: BulkProgress) => void,
  cancelled: () => boolean,
): Promise<BulkResult> {
  const ok: BulkResult['ok'] = []
  const failed: BulkResult['failed'] = []
  const ref = await loadReference()

  for (let i = 0; i < codes.length; i++) {
    if (cancelled()) break
    const code = codes[i]
    const base = { index: i + 1, total: codes.length, code }
    try {
      onProgress({ ...base, phase: 'loading' })
      const planner = await loadPlanner(code)
      if (!planner) throw new Error('데이터를 찾을 수 없습니다')
      const A = analyze(code, planner, ref.benchmarks, ref.incomeMap, ref.dataset.months)
      const name = A.profile.name

      onProgress({ ...base, name, phase: 'rendering' })
      setCurrent({ A, caption: ref.dataset.caption })
      await nextPaint()
      if (cancelled()) break

      if (mode === 'pdf') {
        onProgress({ ...base, name, phase: 'capturing' })
        const blob = await exportPdf((d, t) => onProgress({ ...base, name, phase: 'capturing', page: d, pageTotal: t }))
        download(blob, outputFileName(name, A.profile.code, 'pdf'))
      } else {
        onProgress({ ...base, name, phase: 'printing' })
        await printAll(outputFileStem(name, A.profile.code))
      }
      ok.push({ code, name })
    } catch (e) {
      failed.push({ code, error: e instanceof Error ? e.message : String(e) })
    }
  }

  setCurrent(null)
  return { ok, failed }
}
