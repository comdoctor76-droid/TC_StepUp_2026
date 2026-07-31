/* ══════════════════════════════════════════════════════════════════════
   일괄 인쇄 / PDF 저장 — 명단에서 체크한 여러 명을 순서대로 처리한다.

   #print-root 는 싱글턴이라(capturePageCanvases 가 getElementById 로 찾음)
   동시에 여러 명을 마운트할 수 없다 — 한 명씩 렌더 → 대기 → 캡처 → 다음
   순서로 돈다. PDF 는 사람마다 저장 위치를 묻지 않고 성명(사번)_출력일시.pdf
   이름으로 즉시 다운로드한다(여러 번 묻는 걸 피하기 위해 — v0.13 사용자 선택).
   인쇄는 브라우저 정책상 창을 닫아야 다음 사람으로 넘어간다.
   ══════════════════════════════════════════════════════════════════════ */

import { analyze, type FullAnalysis } from '../calc'
import type { CoverGender } from '../components/CoverPage'
import { loadPlanner, loadReference } from '../data/repository'
import { printAll, type CaptureOptions } from './captureAll'
import { exportPdf } from './pdf'
import { download, outputFileName, outputFileStem } from './share'

export type BulkMode = 'print' | 'pdf'
/** 'report' = 표지+6페이지 자가진단 레포트, 'coach' = 성장코칭 리포트,
 *  'guide' = 강사용 가이드 2장만.
 *  세 가지는 명단 화면의 서로 다른 버튼이며 **절대 서로 이어붙이지 않는다** —
 *  예전에는 report 인쇄에 코칭이 자동으로 딸려 나와, 코칭 버튼까지 누르면
 *  같은 문서가 두 번 출력됐다. */
export type BulkTarget = 'report' | 'coach' | 'guide'

/** 일괄 처리 대상 1명 — cover 는 report 출력 맨 앞에 붙는 남/여 표지,
 *  guide 는 성장코칭 출력에 강사용 가이드 2장을 덧붙일지 여부다. */
export interface BulkPerson {
  code: string
  cover?: CoverGender
  guide?: boolean
}

/* bodyClass: 캡처하는 동안 인쇄와 같은 조밀 스타일 + A4 고정 높이를 적용한다
   (coach.css 의 body.capturing-coach 규칙 참고) */
const COACH_CAPTURE_OPTS: CaptureOptions = {
  rootId: 'coach-print-root',
  pageSelector: '.sheet',
  bodyClass: 'capturing-coach',
}

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
 * people 을 순서대로 처리한다. setCurrent 는 캡처 대상 PrintRoot 를 그 사람으로
 * 갈아 끼우는 콜백(호출부가 상태로 들고 있다가 <PrintRoot A={...} cover={...}/> 를 렌더한다).
 * 도중에 cancelled() 가 true 를 반환하면 그 시점에서 멈춘다.
 */
export async function runBulkExport(
  people: BulkPerson[],
  mode: BulkMode,
  target: BulkTarget,
  setCurrent: (
    v: {
      A: FullAnalysis
      caption: string
      kind: BulkTarget
      cover?: CoverGender
      guide?: boolean
    } | null,
  ) => void,
  onProgress: (p: BulkProgress) => void,
  cancelled: () => boolean,
): Promise<BulkResult> {
  const ok: BulkResult['ok'] = []
  const failed: BulkResult['failed'] = []
  const ref = await loadReference()

  for (let i = 0; i < people.length; i++) {
    if (cancelled()) break
    const { code, cover, guide } = people[i]
    const base = { index: i + 1, total: people.length, code }
    try {
      onProgress({ ...base, phase: 'loading' })
      const planner = await loadPlanner(code)
      if (!planner) throw new Error('데이터를 찾을 수 없습니다')
      const A = analyze(code, planner, ref.benchmarks, ref.incomeMap, ref.dataset.months)
      const name = A.profile.name

      // 버튼 하나 = 문서 한 종류. 이어붙이지 않는다(같은 문서 두 번 출력 방지).
      const kind = target
      const isCoachSide = kind === 'coach' || kind === 'guide'

      const stem = outputFileStem(name, A.profile.code)
      onProgress({ ...base, name, phase: 'rendering' })
      setCurrent({
        A,
        caption: ref.dataset.caption,
        kind,
        cover: kind === 'report' ? cover : undefined,
        guide: kind === 'coach' ? guide : undefined,
      })
      await nextPaint()
      if (cancelled()) break

      const fileStem =
        kind === 'guide' ? `${stem}_강사용가이드` : kind === 'coach' ? `${stem}_성장코칭` : stem

      if (mode === 'pdf') {
        onProgress({ ...base, name, phase: 'capturing' })
        const blob = await exportPdf(
          (d, t) => onProgress({ ...base, name, phase: 'capturing', page: d, pageTotal: t }),
          isCoachSide ? COACH_CAPTURE_OPTS : undefined,
        )
        download(blob, isCoachSide ? `${fileStem}.pdf` : outputFileName(name, A.profile.code, 'pdf'))
      } else {
        onProgress({ ...base, name, phase: 'printing' })
        await printAll(fileStem, undefined, isCoachSide ? 'printing-coach' : undefined)
        // 인쇄 대화상자가 비동기인 브라우저에서, 다음 사람으로 DOM 을 갈아 끼우기 전에
        // 한 프레임 쉰다 — 두 사람 내용이 한 미리보기에 섞이는 것을 막는다.
        await nextPaint()
      }
      if (cancelled()) break
      ok.push({ code, name })
    } catch (e) {
      failed.push({ code, error: e instanceof Error ? e.message : String(e) })
    }
  }

  setCurrent(null)
  return { ok, failed }
}
