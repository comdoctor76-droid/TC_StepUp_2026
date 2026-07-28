/* 성장코칭 리포트 인쇄/캡처 전용 포털 — PrintRoot.tsx 와 같은 패턴이다.
   화면(GrowthCoachTab)과 완전히 같은 CoachPages 를 같은 props 로 다시 그려,
   화면에서 수정한 문구·강사용 가이드 토글이 그대로 인쇄에 반영되게 한다. */

import type { ComponentProps } from 'react'
import { createPortal } from 'react-dom'
import { CoachPages } from './GrowthCoachTab'

export function CoachPrintRoot(props: ComponentProps<typeof CoachPages>) {
  return createPortal(
    <div id="coach-print-root" aria-hidden="true" className="coach-report">
      <CoachPages {...props} />
    </div>,
    document.body,
  )
}
