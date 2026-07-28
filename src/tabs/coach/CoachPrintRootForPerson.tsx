/* 성장코칭 일괄 인쇄/PDF 전용 — Roster.tsx의 일괄 처리 루프가 한 번에 한 명씩
   {A, caption}만 갈아 끼우면 되도록 CoachPrintRoot를 감쌌다. 일괄 처리는
   여러 사람을 훑는 것이라 화면 편집 상태(edits)나 강사용 가이드 토글이
   있을 수 없으므로 항상 기본값(엔진이 만든 원문 · 강사용 가이드 제외)으로 찍는다. */

import { useMemo } from 'react'
import type { FullAnalysis } from '../../calc'
import { buildCoachPageProps } from './buildCoachPageProps'
import { CoachPrintRoot } from './CoachPrintRoot'

const NO_EDITS = {}
const NOOP = () => {}

export function CoachPrintRootForPerson({ A, caption }: { A: FullAnalysis; caption: string }) {
  const pageProps = useMemo(() => buildCoachPageProps(A, caption, NO_EDITS, NOOP, false), [A, caption])
  return <CoachPrintRoot {...pageProps} />
}
