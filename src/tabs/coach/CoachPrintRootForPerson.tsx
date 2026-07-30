/* 성장코칭 일괄 인쇄/PDF 전용 — Roster.tsx의 일괄 처리 루프가 한 번에 한 명씩
   {A, caption}만 갈아 끼우면 되도록 CoachPrintRoot를 감쌌다. 일괄 처리는
   여러 사람을 훑는 것이라 화면 편집 상태(edits)는 있을 수 없어 항상 기본값
   (엔진이 만든 원문)으로 찍고, 강사용 가이드는 명단에서 사람마다 체크한
   includeGuide 값을 따른다. */

import { useMemo } from 'react'
import type { FullAnalysis } from '../../calc'
import { buildCoachPageProps } from './buildCoachPageProps'
import { CoachPrintRoot } from './CoachPrintRoot'

const NO_EDITS = {}
const NOOP = () => {}

export function CoachPrintRootForPerson({
  A,
  caption,
  includeGuide,
}: {
  A: FullAnalysis
  caption: string
  /** 강사용 코칭 가이드 2장 포함 여부 (기본 제외) */
  includeGuide?: boolean
}) {
  const pageProps = useMemo(
    () => buildCoachPageProps(A, caption, NO_EDITS, NOOP, includeGuide ?? false),
    [A, caption, includeGuide],
  )
  return <CoachPrintRoot {...pageProps} />
}
