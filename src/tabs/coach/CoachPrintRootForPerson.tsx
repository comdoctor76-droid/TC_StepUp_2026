/* 성장코칭 일괄 인쇄/PDF 전용 — Roster.tsx의 일괄 처리 루프가 한 번에 한 명씩
   {A, caption}만 갈아 끼우면 되도록 CoachPrintRoot를 감쌌다. 일괄 처리는
   여러 사람을 훑는 것이라 화면 편집 상태(edits)는 있을 수 없어 항상 기본값
   (엔진이 만든 원문)으로 찍고, 강사용 가이드는 명단에서 사람마다 체크한
   includeGuide 값을 따른다.
   guideOnly 를 켜면 앞의 9장을 빼고 강사용 가이드 2장만 뽑는다("가이드 인쇄"). */

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
  guideOnly,
}: {
  A: FullAnalysis
  caption: string
  /** 강사용 코칭 가이드 2장 포함 여부 (기본 제외) */
  includeGuide?: boolean
  /** 강사용 가이드 2장만 출력 (앞 9장 생략) */
  guideOnly?: boolean
}) {
  const pageProps = useMemo(
    () =>
      buildCoachPageProps(
        A,
        caption,
        NO_EDITS,
        NOOP,
        // guideOnly 면 가이드가 반드시 켜져 있어야 한다
        guideOnly ? true : (includeGuide ?? false),
        guideOnly ?? false,
      ),
    [A, caption, includeGuide, guideOnly],
  )
  return <CoachPrintRoot {...pageProps} />
}
