/* CoachPages(화면 최대 15+3페이지 렌더)의 props 타입 — GrowthCoachTab(화면)과
   buildCoachPageProps(공용 조립 함수)이 서로를 값으로 import 하지 않도록
   별도 파일로 뺐다(순환 참조 방지). */

import type { buildCoachData, CoachMetric } from '../../calc/coach'
import type { analyzeCoach } from '../../calc/coachAnalyze'
import type { CoachEdits } from './Editable'

export interface CoachInsight {
  h: string
  p: string
}

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
  insKpi: CoachInsight
  /** 활동 구조(버터플라이) 페이지 헤드라인 — 패턴 미해당 시 null */
  insBfly: CoachInsight | null
  insVs: CoachInsight
  insFlow: CoachInsight
  insStrength: CoachInsight | null
  insBottle: CoachInsight | null
  premDrop: boolean | null
  premPerK: string
  trendMsg: string
  /** 그룹 비교 4카드의 메시지/콜아웃 (신규고객·장기건수·자동차·인당보험료 순) */
  vsMsgs: (string | null)[]
  vsCallouts: (string | undefined)[]
  ringDescs: { link: string; cancer: string }
  /** 코호트 페이지("내 연차의 기준") 메시지 — d.cohort 없으면 null(페이지 숨김) */
  coMsg: string | null
  /** 멘토 팁 (문장 줄바꿈 적용본) */
  heroes: { name: string; ref: string; body: string; apply: string }[]
  howto: string[]
  edits: CoachEdits
  onCommit: (id: string, html: string) => void
  showCoachGuide: boolean
  /** 켜면 앞의 플래너 페이지를 건너뛰고 강사용 가이드 3장만 그린다 (명단의 "가이드 인쇄") */
  guideOnly?: boolean
  /** C1 — .cfact 카드 4개 (C/A/M/S) 내부 HTML */
  camsFacts: string[]
  /** C2 진단 논리 본문 */
  coachLogic: string
  /** 강사용 안내 박스(.cguide) 문구 */
  cguides: { c1: string; c3: string; c4: string; c7: string }
  hypoBank: string[]
  coachQs: string[]
  dataNotes: string[]
  /** C5 목표 선택 코칭 불릿 */
  goalCoach: string[]
  heroRefs: string[]
  gName: string
  gEx: { reason: string; act: string; action: string; metric: string; from: string; to: string }
}
