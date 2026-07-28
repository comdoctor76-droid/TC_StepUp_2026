/* CoachPages(화면 9~11페이지 렌더)의 props 타입 — GrowthCoachTab(화면)과
   buildCoachPageProps(공용 조립 함수)이 서로를 값으로 import 하지 않도록
   별도 파일로 뺐다(순환 참조 방지). */

import type { buildCoachData, CoachMetric } from '../../calc/coach'
import type { analyzeCoach } from '../../calc/coachAnalyze'
import type { CoachEdits } from './Editable'

export interface CoachPageProps {
  b: ReturnType<typeof buildCoachData>['basic']
  d: ReturnType<typeof buildCoachData>
  r: ReturnType<typeof analyzeCoach>
  F: Record<string, CoachMetric>
  M: Record<string, CoachMetric>
  name: string
  sub1: string
  BASE_ALL: string
  BASE_6: string
  dgBand: string
  insKpi: { h: string; p: string }
  insVs: { h: string; p: string }
  insFlow: { h: string; p: string }
  insBottle: { h: string; p: string } | null
  premDrop: boolean | null
  premPerK: string
  trendMsg: string
  bflyPattern: boolean | null
  carWorst: boolean | null
  heroIds: string[]
  howto: string[]
  edits: CoachEdits
  onCommit: (id: string, html: string) => void
  showCoachGuide: boolean
  camsFacts: string[]
  hypoBank: string[]
  coachQs: string[]
  dataNotes: string[]
  heroRefs: string[]
  gName: string
  gEx: { reason: string; act: string; action: string; metric: string; from: string; to: string }
}
