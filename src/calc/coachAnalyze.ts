/* ══════════════════════════════════════════════════════════════════════
   성장코칭 탭 — 진단 엔진 (원본 "TC스텝업 하이플래너 성장 코칭" 의 analyze()
   를 그대로 이식).

   AI API 호출은 없다 — 지표를 본인/동급/TC 3자 비교로 분류(cls)한 뒤,
   조건-문구 규칙으로 강점 2개·병목(성장 포인트) 최대 3개·영업유형·90일
   목표 2개·한 줄 진단을 조립하는 결정론적 로직이다. 이 도구의 가치는
   문구 그 자체이므로 아이디·임계값·템플릿을 원본 그대로 유지했다 — 로직을
   "개선"하지 않는다.
   ══════════════════════════════════════════════════════════════════════ */

import type { CoachData, CoachMetric } from './coach'

export const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v)

export const f1 = (v: number | null | undefined) =>
  isNum(v)
    ? (Math.round(v * 10) / 10).toLocaleString('ko-KR', {
        minimumFractionDigits: v % 1 ? 1 : 0,
        maximumFractionDigits: 1,
      })
    : '확인 필요'
export const f2 = (v: number | null | undefined) =>
  isNum(v) ? v.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : '확인 필요'
export const f0 = (v: number | null | undefined) =>
  isNum(v) ? Math.round(v).toLocaleString('ko-KR') : '확인 필요'
export const pctFmt = (v: number | null | undefined) =>
  isNum(v) ? (Math.round(v * 1000) / 10).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '%' : '확인 필요'
export const won = (v: number | null | undefined) =>
  isNum(v) ? Math.round(v).toLocaleString('ko-KR') + '원' : '확인 필요'
export const wonK = (v: number | null | undefined) =>
  isNum(v) ? Math.round(v / 1000).toLocaleString('ko-KR') + '천원' : '확인 필요'
export const relGap = (me: number | null | undefined, ref: number | null | undefined) =>
  isNum(me) && isNum(ref) && ref !== 0 ? ((me - ref) / ref) * 100 : null
export const ppGap = (me: number | null | undefined, ref: number | null | undefined) =>
  isNum(me) && isNum(ref) ? (me - ref) * 100 : null
const sgn = (v: number) => (v >= 0 ? '+' : '−')
export const relTxt = (v: number | null) => (v === null ? '—' : `${sgn(v)}${Math.abs(Math.round(v))}%`)
export const ppTxt = (v: number | null) => (v === null ? '—' : `${sgn(v)}${Math.abs(Math.round(v * 10) / 10)}%p`)

export type MetricCls = 'strategic' | 'levelup' | 'bottleneck' | 'mixed' | 'na'

function cls(me: number | null, dg: number | null, tc: number | null): MetricCls {
  if (!isNum(me) || !isNum(tc)) return 'na'
  // 동일그룹 값이 없으면 본인 vs TC 2단계로만 판정한다 (원본 v18)
  if (!isNum(dg)) return me >= tc ? 'strategic' : 'bottleneck'
  if (me >= dg && me >= tc) return 'strategic'
  if (me >= dg && me < tc) return 'levelup'
  if (me < dg && me < tc) return 'bottleneck'
  return 'mixed'
}

export interface CoachMetricInfo extends CoachMetric {
  label: string
  cls: MetricCls
}

export interface CoachStrength {
  id: string
  score: number
  title: string
  num: string
  desc: string
}

export interface CoachBottleneck {
  id: string
  score: number
  title: string
  num: string
  desc: string
  q: string | null
}

export interface CoachGoalExample {
  reason: string
  act: string
  action: string
  metric: string
  from: string
  to: string
}

export interface CoachGoal {
  id: string
  score: number
  title: string
  point: string
  now: string
  d30: string
  d90: string
  week: string
  measure: string
  why: string
  hero: string
  ex: CoachGoalExample
}

export interface CoachTypeInfo {
  name: string
  desc: string
  /** 유형이 놓인 축 (예: '성과중심활동 · 신규고객') — 유형 배지 옆에 작게 붙는다 */
  axis?: string
}

/** 진짜 이야기 페이지의 대비 수치 한 칸 (값/이름/부연) */
export interface TruthStat {
  v: string
  k: string
  s: string
}

/** "데이터가 본 진짜 이야기" — 반전 서사 (원본 v18 a.truth) */
export interface CoachTruth {
  id: string
  head: string
  sL: TruthStat | null
  sR: TruthStat | null
  shadow: string
  opp: { badge: string; html: string }
  one: string
  /** 코칭 질문(각각 .qwhy 근거 포함) — 2번째는 없을 수 있다 */
  qa: (string | null)[]
}

/** "One Point Lesson" — 유형별 3줄 (지금 → 잘하는 것 → 다음 한 걸음) */
export interface CoachLesson {
  now: string
  str: string
  next: string
}

export interface CoachAnalysis {
  metrics: Record<string, CoachMetricInfo>
  momentum: number | null
  strengthIds: string[]
  strengths: CoachStrength[]
  bottlenecks: CoachBottleneck[]
  noHardBottleneck: boolean
  type: { main: CoachTypeInfo; sub: CoachTypeInfo | null }
  goals: CoachGoal[]
  truth: CoachTruth
  lesson: CoachLesson
}

/** 멘토 실전 사례 라이브러리 (익명 · 원본 그대로) */
export const HEROES: Record<string, { name: string; ref: string; body: string; apply: string }> = {
  depth: {
    name: '보장 점검 멘토의 팁',
    ref: 'HP18-08',
    body: `증권 7개를 가진 고객이 "결국 가입시키려는 것 아니냐"며 거절하자 "잘 되어 있으면 한눈에 정리해드리는 것만으로 이득"이라고 응대해 전 증권을 회수 — 분석 결과 질병사망 2천만원뿐인 실태를 고객 스스로 발견하게 해 리모델링과 소개 2명으로 연결했습니다. 잘 가입된 고객은 안심만 시켰더니 오히려 신뢰로 다음 계약이 왔습니다.`,
    apply: `재상담을 '판매'가 아닌 <b>'점검'으로 선언하고 시작</b>하기. 문제없으면 "잘 준비되셨습니다"로 끝내기 — 그 정직이 다음 계약과 소개를 만듭니다.`,
  },
  car: {
    name: '자동차 연계 멘토의 팁',
    ref: 'HP24-04',
    body: `자동차보험의 90%를 대면으로 체결하며, 방문 때마다 정액담보 조회자료에 형광펜으로 보장 공백을 표시해 보여주는 루틴으로 자동차를 장기보험의 뿌리로 만들었습니다. 직접 발굴한 고객이 소개 고객보다 유지율과 추가 계약률이 높았다는 관찰도 남겼습니다.`,
    apply: `자동차를 '싼 견적 경쟁'이 아니라 <b>'매년 만나는 명분'</b>으로 정의하고, 만기 상담 자리를 장기 보장점검의 입구로 사용하기.`,
  },
  prospect: {
    name: '고정 방문 루틴 멘토의 팁',
    ref: 'HP24-04',
    body: `요일·장소를 고정해 매주 같은 날 같은 곳을 방문하는 루틴(월~금 각각 다른 5곳)을 3개월 이상 유지 — 계약 제로에 그만두려던 그때, 꾸준히 다닌 곳들에서 상담 요청이 한꺼번에 밀려들었습니다.`,
    apply: `핵심은 장소가 아니라 <b>'같은 날, 같은 장소, 빠지지 않기'</b>예요. 30일은 반응이 아니라 루틴 유지 자체를 목표로.`,
  },
  care: {
    name: '사후관리 멘토의 팁',
    ref: 'HP24-01',
    body: `체결을 끝이 아니라 시작으로 정의하고 사고현장과 청구까지 책임지는 올케어로 자동차 갱신율 95%를 유지 — 타사 미지급 보험금 2천만원을 찾아준 뒤 소개가 이어졌습니다.`,
    apply: `청구·보상 경험이 있는 고객을 재상담 1차 타깃으로 — <b>이미 신뢰가 확인된 접점</b>입니다.`,
  },
}

export function analyzeCoach(d: CoachData): CoachAnalysis {
  const F = d.full
  const M = d.m6

  const defs: Record<string, [CoachMetric, string]> = {
    newCust: [F.newCust, '월평균 신규고객'],
    custLong: [F.custLong, '장기고객'],
    perCust: [F.perCust, '고객당 건수'],
    linkRate: [F.linkRate, '연계율'],
    custCar: [F.custCar, '자동차고객'],
    premPer: [F.premPer, '인당 보험료'],
    premCase: [F.premCase, '건당 보험료'],
    cancerRate: [M.cancerRate, '암 부보율'],
    brainRate: [M.brainRate, '심뇌 부보율'],
    moLong: [M.moLong, '월 장기건수'],
    moCar: [M.moCar, '월 자동차건수'],
    newCust6: [M.newCust6, '6개월 신규고객'],
    oldCnt6: [M.oldCnt6, '기존고객 추가계약'],
  }
  const metrics: Record<string, CoachMetricInfo> = {}
  for (const [k, [o, label]] of Object.entries(defs)) {
    metrics[k] = { ...o, label, cls: cls(o.me, o.dg, o.tc) }
  }

  const mv = d.monthly.map((x) => x.me).filter(isNum)
  const momentum = mv.length === 6 ? (mv[3] + mv[4] + mv[5]) / 3 - (mv[0] + mv[1] + mv[2]) / 3 : null

  // ── 강점 후보 ──────────────────────────────────────────────────────
  const S: CoachStrength[] = []
  if (metrics.newCust.cls === 'strategic') {
    const rr = relGap(F.newCust.me, F.newCust.tc)
    S.push({
      id: 'prospect',
      score: (rr || 0) + 60,
      title: '신규고객 발굴력',
      num: `월 ${f2(F.newCust.me)}명 · TC그룹 대비 ${relTxt(rr)}`,
      desc:
        `${isNum(F.newCust.dg) ? `동일그룹(${f2(F.newCust.dg)}명)의 ${f1(divSafe(F.newCust.me, F.newCust.dg))}배, ` : ''}TC그룹(${f2(F.newCust.tc)}명)의 ${f1(divSafe(F.newCust.me, F.newCust.tc))}배입니다. ` +
        (F.transferLong.me === 0
          ? `이관고객 0명 — 장기고객 ${f1(F.custLong.me)}분 모두와 직접 인연을 맺어 온, 순수한 발굴의 힘이에요. `
          : '') +
        (momentum !== null && momentum > 0.5
          ? `최근 6개월 장기건수도 상승 흐름(월 ${f1(mv[0])}건 → ${f1(mv[5])}건)입니다.`
          : ''),
    })
  }
  if (metrics.custLong.cls !== 'bottleneck' && isNum(F.custLong.me) && isNum(F.custLong.dg) && F.custLong.me >= F.custLong.dg) {
    S.push({
      id: 'base',
      score: (relGap(F.custLong.me, F.custLong.dg) || 0) + 20,
      title: '고객 기반',
      num: `장기고객 ${f1(F.custLong.me)}명 · 동일그룹 대비 ${relTxt(relGap(F.custLong.me, F.custLong.dg))}`,
      desc: `동일그룹(${f1(F.custLong.dg)}명)을 넘어 TC그룹(${f1(F.custLong.tc)}명)의 ${Math.round((divSafe(F.custLong.me, F.custLong.tc) ?? 0) * 100)}% 수준까지 확보했습니다. 새 시장을 찾기 전에, 이 기반에서 꺼낼 수 있는 성과가 먼저입니다.`,
    })
  }
  if (isNum(M.simpleCntPct.me) && isNum(M.simpleCntPct.tc) && M.simpleCntPct.me - M.simpleCntPct.tc > 0.15) {
    S.push({
      id: 'simple',
      score: 35,
      title: '주력상품 체결력',
      num: `신계약 건수의 ${pctFmt(M.simpleCntPct.me)}가 주력상품(간편)`,
      desc: `간편 시장에서의 상담 접근력이 검증되어 있습니다. 이 고객군은 건강 이슈가 있는 만큼 치료과정 보장의 필요가 오히려 큰 고객군 — 확장 여지가 가장 큰 무기입니다.`,
    })
  }
  if (metrics.moLong.cls !== 'bottleneck' && isNum(M.moLong.me) && isNum(M.moLong.tc) && M.moLong.me >= M.moLong.tc * 0.95) {
    S.push({
      id: 'longAct',
      score: 30,
      title: '장기 신계약 활동량',
      num: `월 ${f1(M.moLong.me)}건 · TC그룹(${f1(M.moLong.tc)}건)과 동일 수준`,
      desc: `활동량 자체는 이미 TC급이에요. 이제 필요한 것은 '더 많이'가 아니라, 활동이 성과로 이어지는 전환이에요.`,
    })
  }
  const fmtM: Record<string, (v: number | null) => string> = {
    premPer: wonK,
    premCase: wonK,
    premMax: wonK,
    linkRate: pctFmt,
    cancerRate: pctFmt,
    brainRate: pctFmt,
  }
  const fm = (k: string, v: number | null) => (fmtM[k] ?? f2)(v)
  if (S.length === 0) {
    const lv = Object.entries(metrics).filter(([, mt]) => mt.cls === 'levelup' && isNum(mt.dg) && mt.dg !== 0)
    lv.sort((x, y) => (relGap(y[1].me, y[1].dg) || 0) - (relGap(x[1].me, x[1].dg) || 0))
    lv.slice(0, 2).forEach(([k, mt]) =>
      S.push({
        id: 'lv_' + k,
        score: 10,
        title: mt.label,
        num: `${fm(k, mt.me)} · 동일그룹 대비 ${relTxt(relGap(mt.me, mt.dg))}`,
        desc: `동일그룹(${fm(k, mt.dg)})을 넘어선 자산이에요. TC그룹(${fm(k, mt.tc)})까지 남은 간격이 다음 목표예요.`,
      }),
    )
  }
  if (S.length === 0) {
    // 동일그룹 값이 없는 지표는 TC그룹 기준으로 폴백한다 (원본 v18)
    const ref = (mt: CoachMetricInfo) => (isNum(mt.dg) ? mt.dg : mt.tc)
    const refName = (mt: CoachMetricInfo) => (isNum(mt.dg) ? '동일그룹' : 'TC그룹')
    const near = Object.entries(metrics).filter(([, mt]) => isNum(mt.me) && isNum(ref(mt)) && ref(mt) !== 0)
    near.sort((x, y) => Math.abs(relGap(x[1].me, ref(x[1])) ?? 99) - Math.abs(relGap(y[1].me, ref(y[1])) ?? 99))
    near.slice(0, 2).forEach(([k, mt]) =>
      S.push({
        id: 'near_' + k,
        score: 5,
        title: mt.label,
        num: `${fm(k, mt.me)} · ${refName(mt)}과의 간격 ${relTxt(relGap(mt.me, ref(mt)))}`,
        desc: `${refName(mt)}과 가장 가까이 있는 지표예요. 모든 지표를 한 번에 올릴 필요는 없어요 — 첫 번째 승리를 만들 자리는 여기예요.`,
      }),
    )
  }
  if (S.length < 2 && momentum !== null && momentum > 0.5) {
    S.push({
      id: 'momentum',
      score: 8,
      title: '상승 흐름',
      num: `최근 6개월 장기건수 월 ${f1(mv[0])}건 → ${f1(mv[5])}건`,
      desc: `숫자보다 중요한 건 방향이에요. 최근으로 올수록 계약이 늘고 있어요 — 이 흐름이 살아 있는 지금이 변화의 적기예요.`,
    })
  }
  const strengthIds = S.map((s) => s.id)
  const strengths = [...S].sort((x, y) => y.score - x.score).slice(0, 2)

  // ── 병목(성장 포인트) 후보 ─────────────────────────────────────────
  const B: CoachBottleneck[] = []
  if (metrics.perCust.cls === 'bottleneck') {
    const potential =
      isNum(F.custLong.me) && isNum(F.perCust.tc) && isNum(F.cntLong.me)
        ? Math.round(F.custLong.me * F.perCust.tc - F.cntLong.me)
        : null
    B.push({
      id: 'depth',
      score: Math.abs(relGap(F.perCust.me, F.perCust.tc) || 0) * 1.3 + (isNum(F.custLong.me) && isNum(F.custLong.dg) && F.custLong.me >= F.custLong.dg ? 20 : 0),
      title: "'1고객 1건' 구조",
      num: `고객당 ${f2(F.perCust.me)}건 vs TC ${f2(F.perCust.tc)}건 (${relTxt(relGap(F.perCust.me, F.perCust.tc))})`,
      desc:
        `고객 수(${f1(F.custLong.me)}명, TC의 ${Math.round((divSafe(F.custLong.me, F.custLong.tc) ?? 0) * 100)}%)에 비해 계약 깊이가 얕습니다.` +
        (potential && potential > 0 ? ` 이 격차를 TC 수준으로 좁히면 지금 고객만으로 <b>약 ${potential.toLocaleString()}건의 잠재 계약 기반</b>이 있는 셈입니다.` : '') +
        (isNum(M.newCust6.me) && isNum(M.newCust6.tc) && M.newCust6.me > M.newCust6.tc && isNum(M.oldCnt6.me) && isNum(M.oldCnt6.tc) && M.oldCnt6.me < M.oldCnt6.tc
          ? ` 6개월 데이터도 같은 신호입니다 — 신규고객 확보(월 ${f2(M.newCust6.me)}명)는 TC(${f2(M.newCust6.tc)}명)보다 많은데, 기존고객 추가계약(월 ${f2(M.oldCnt6.me)}건)은 TC(${f2(M.oldCnt6.tc)}건)에 못 미칩니다.`
          : ''),
      q: `데이터가 말하는 건 고객발굴 부족이 아니라 <b>후속상담·관계심화의 성장 공간</b>이에요. 정확한 이유는 코칭 대화에서 함께 확인해요.`,
    })
  }
  if (metrics.linkRate.cls === 'bottleneck' || metrics.moCar.cls === 'bottleneck') {
    B.push({
      id: 'car',
      score: Math.abs(ppGap(F.linkRate.me, F.linkRate.tc) || 0) * 3.2,
      title: '자동차 · 연계 공백',
      num: `연계율 ${pctFmt(F.linkRate.me)} vs TC ${pctFmt(F.linkRate.tc)} (${ppTxt(relDiff(F.linkRate.me, F.linkRate.tc))})`,
      desc: `자동차고객 ${f1(F.custCar.me)}명(동일그룹 ${f1(F.custCar.dg)}, TC ${f1(F.custCar.tc)}), 월평균 자동차 ${f1(M.moCar.me)}건(TC ${f1(M.moCar.tc)}건). 자동차는 매년 반복되는 만남 명분이자 장기 추가계약의 뿌리인데, 이 접점이 거의 비어 있습니다.`,
      q: null,
    })
  }
  if (metrics.premPer.cls === 'bottleneck' || metrics.cancerRate.cls === 'bottleneck') {
    // 암 부보율이 병목인지 / TC에만 뒤처지는지 / 이미 앞서는지에 따라 서술을 가른다 (원본 v18)
    const cB = metrics.cancerRate.cls === 'bottleneck'
    const cBehindTC = isNum(M.cancerRate.me) && isNum(M.cancerRate.tc) && M.cancerRate.me < M.cancerRate.tc
    const cancerTxt = cB
      ? `최근 6개월 신계약 기준 암 주요치료비 부보율도 ${pctFmt(M.cancerRate.me)}로, ${isNum(M.cancerRate.dg) ? '동일그룹(' + pctFmt(M.cancerRate.dg) + ')·' : ''}TC(${pctFmt(M.cancerRate.tc)})까지 아직 간격이 있어요.`
      : cBehindTC
        ? `암 주요치료비 부보율은 ${pctFmt(M.cancerRate.me)}로${isNum(M.cancerRate.dg) ? ' 동일그룹(' + pctFmt(M.cancerRate.dg) + ')은 넘어섰고,' : ''} TC(${pctFmt(M.cancerRate.tc)})까지 조금 남았어요.`
        : `암 주요치료비 부보율은 ${pctFmt(M.cancerRate.me)}로 ${isNum(M.cancerRate.dg) ? '두 그룹을 모두' : 'TC그룹을'} 앞서 있어요 — 남은 과제는 담보 구성이 아니라 계약 규모 쪽이에요.`
    const pB = metrics.premPer.cls === 'bottleneck'
    B.push({
      id: 'coverage',
      score: Math.abs(relGap(F.premPer.me, F.premPer.tc) || 0) * 0.9,
      title: '보장 깊이',
      num: pB
        ? `인당 월납 ${wonK(F.premPer.me)} vs TC ${wonK(F.premPer.tc)} (${relTxt(relGap(F.premPer.me, F.premPer.tc))})`
        : `암 주요치료비 부보율 ${pctFmt(M.cancerRate.me)} vs TC ${pctFmt(M.cancerRate.tc)} (${ppTxt(relDiff(M.cancerRate.me, M.cancerRate.tc))})`,
      desc: `건당 ${wonK(F.premCase.me)}(TC ${wonK(F.premCase.tc)}), 최고보험료 ${wonK(F.premMax.me)}(TC ${wonK(F.premMax.tc)}). ${cancerTxt}`,
      q: cB
        ? `함께 확인해 볼 질문 — <b>상담을 진단비 중심으로 마무리하고, 치료과정 담보 제안을 생략하는 패턴이 있을까요?</b>`
        : `함께 확인해 볼 질문 — <b>설계 단계에서 납입 여력 확인과 증액·추가 담보 제안을 다루는 순서가 있을까요?</b>`,
    })
  }
  if (metrics.newCust.cls === 'bottleneck' && isNum(F.custTotal.me) && isNum(F.custTotal.dg) && F.custTotal.me < F.custTotal.dg) {
    B.push({
      id: 'prospecting',
      score: Math.abs(relGap(F.newCust.me, F.newCust.dg) || 0),
      title: '고객 접점',
      num: `월 신규 ${f2(F.newCust.me)}명 vs 동일그룹 ${f2(F.newCust.dg)}명`,
      desc: `총 유지고객(${f1(F.custTotal.me)}명)이 동일그룹(${f1(F.custTotal.dg)}명)에 아직 미치지 못해요. 새 시장 '개척'이라기보다, 매주 갈 수 있는 자리에서 아는 얼굴이 되는 일부터 시작해요.`,
      q: null,
    })
  }
  if (metrics.newCust.cls === 'bottleneck' && !B.find((x) => x.id === 'prospecting')) {
    B.push({
      id: 'inflow',
      score: Math.abs(relGap(F.newCust.me, F.newCust.dg) || 0) + 15,
      title: '신규 유입 리듬',
      num: isNum(F.newCust.dg)
        ? `월 신규 ${f2(F.newCust.me)}명 vs 동일그룹 ${f2(F.newCust.dg)}명 · TC ${f2(F.newCust.tc)}명`
        : `월 신규 ${f2(F.newCust.me)}명 vs TC ${f2(F.newCust.tc)}명`,
      desc: `고객 기반(${f1(F.custTotal.me)}명)은 탄탄한데, 새 고객이 더해지는 속도가 느려졌어요. 지금의 깊은 고객관계는 소개가 나오기 가장 좋은 토양이에요.`,
      q: `함께 확인해 볼 질문 — <b>만족한 고객에게 소개를 요청하는 나만의 한 문장이 있을까요?</b>`,
    })
  }
  if (metrics.moLong.cls === 'bottleneck' && metrics.perCust.cls !== 'bottleneck') {
    B.push({
      id: 'activity',
      score: Math.abs(relGap(M.moLong.me, M.moLong.tc) || 0),
      title: '활동 리듬',
      num: isNum(M.moLong.dg)
        ? `월 장기건수 ${f1(M.moLong.me)}건 vs 동일그룹 ${f1(M.moLong.dg)}건 · TC ${f1(M.moLong.tc)}건`
        : `월 장기건수 ${f1(M.moLong.me)}건 vs TC ${f1(M.moLong.tc)}건`,
      desc: `계약의 깊이와 전환력은 이미 상위권이에요. 상담 횟수 자체가 늘면 지금의 전환력이 그대로 소득으로 곱해지는 구조예요.`,
      q: null,
    })
  }
  let noHardBottleneck = false
  if (B.length === 0) {
    const lv = Object.entries(metrics).filter(([, mt]) => mt.cls === 'levelup' && isNum(mt.me) && isNum(mt.tc) && mt.tc !== 0)
    lv.sort((x, y) => Math.abs(relGap(y[1].me, y[1].tc) || 0) - Math.abs(relGap(x[1].me, x[1].tc) || 0))
    lv.slice(0, 2).forEach(([k, mt]) => {
      B.push({
        id: 'lvl_' + k,
        score: 1,
        title: `TC까지 남은 간격 — ${mt.label}`,
        num: `${f2(mt.me)} vs TC ${f2(mt.tc)} (${relTxt(relGap(mt.me, mt.tc))})`,
        desc: `동일그룹은 이미 넘어선 지표예요. 이제 남은 것은 TC그룹과의 마지막 간격 — 약점 보완이 아니라 상위 그룹 진입의 문제예요.`,
        q: null,
      })
    })
    noHardBottleneck = true
  }
  const bottlenecks = [...B].sort((x, y) => y.score - x.score).slice(0, 3)

  // ── 영업유형 ───────────────────────────────────────────────────────
  const types: CoachTypeInfo[] = []
  if (metrics.newCust.cls === 'strategic' && isNum(F.newCust.me) && isNum(F.newCust.tc) && F.newCust.me >= F.newCust.tc * 1.4) {
    types.push({
      name: '신규고객 확장형',
      axis: '성과중심활동 · 신규고객',
      desc:
        `신규고객 유입(월 ${f2(F.newCust.me)}명)이 동일그룹·TC그룹을 압도합니다.` +
        (F.transferLong.me === 0 ? ` 이관 없이 자력으로 만든 발굴 기반이라 접점이 마르지 않는 유형입니다.` : ''),
    })
  }
  if (isNum(M.simpleCntPct.me) && isNum(M.simpleCntPct.tc) && M.simpleCntPct.me - M.simpleCntPct.tc > 0.15) {
    types.push({
      name: '첫 계약 개척형',
      axis: '성과중심활동 · 신규고객',
      desc: `간편으로 첫 계약을 만드는 힘이 뛰어난 유형입니다(건수 ${pctFmt(M.simpleCntPct.me)}·보험료 ${pctFmt(M.simplePremPct.me)}). 이미 잘 열고 있는 문 안쪽에서 보장확장과 자동차 연계로 이어가면, 같은 활동으로 소득 구조가 달라집니다.`,
    })
  }
  if (metrics.perCust.cls === 'bottleneck' && isNum(F.custLong.me) && isNum(F.custLong.dg) && F.custLong.me >= F.custLong.dg) {
    types.push({
      name: '기존고객 성장형',
      axis: '성장중심활동 · 기존고객',
      desc: `고객 기반은 이미 충분히 쌓여 있습니다. 이제 만난 고객과의 두 번째·세 번째 계약(현재 고객당 ${f2(F.perCust.me)}건)을 더해 가는 것이 성장 열쇠입니다.`,
    })
  }
  if (metrics.linkRate.cls === 'bottleneck' && isNum(F.longSoloRate.me) && F.longSoloRate.me > 0.85) {
    types.push({
      name: '장기고객 전문형',
      axis: '성장중심활동 · 기존고객',
      desc: `장기영업이 강한 유형입니다(장기 단독 ${pctFmt(F.longSoloRate.me)}). 현재의 장기 접점을 자동차 만기정보와 가족계약으로 연결하면 소득 확장 가능성이 큽니다.`,
    })
  }
  if (metrics.moLong.cls !== 'bottleneck' && metrics.perCust.cls === 'bottleneck') {
    types.push({
      name: '활동 에너지형',
      axis: '성장중심활동 · 전환 만들기',
      desc: `활동의 힘은 이미 TC급으로 살아 있습니다. 그 에너지가 성과로 이어지는 전환 과정(고객당 건수·단가)을 다듬으면 가장 빠르게 반응하는 유형입니다.`,
    })
  }
  if (metrics.premPer.cls === 'bottleneck' && metrics.perCust.cls !== 'bottleneck') {
    types.push({
      name: '고객가치 심화형',
      axis: '성장중심활동 · 기존고객',
      desc: `계약을 만드는 힘은 이미 궤도에 올라 있습니다. 여기에 보장분석과 설계의 깊이(인당·건당 보험료)를 더하면 고객가치와 소득이 함께 커지는 유형입니다.`,
    })
  }
  if (metrics.premPer.cls === 'strategic' && metrics.cancerRate.cls === 'strategic') {
    types.push({
      name: '고객신뢰 설계형',
      axis: '성장중심활동 · 소개 확장',
      desc: `계약 한 건의 보장 깊이(인당 ${wonK(F.premPer.me)}, 암 부보율 ${pctFmt(M.cancerRate.me)})가 상위권이에요. 이 설계력이 소개와 신규 유입으로 이어지도록 접점을 넓히는 것이 다음 단계예요.`,
    })
  }
  if (metrics.moLong.cls === 'bottleneck' && metrics.newCust.cls === 'bottleneck' && metrics.perCust.cls !== 'bottleneck') {
    types.push({
      name: '활동리듬 만들기형',
      axis: '성장중심활동 · 리듬 회복',
      desc: `상담의 질과 전환력은 이미 검증되어 있어요. 활동의 양과 리듬을 회복하면 성과가 가장 빠르게 반응하는 유형이에요.`,
    })
  }
  if (types.length === 0) {
    types.push({
      name: '균형성장형',
      axis: '성과·성장 균형',
      desc: '어느 한쪽에 치우침 없이 고르게 균형 잡힌 성장 중입니다. 가장 간격이 큰 한 지표에 집중하면 TC 진입이 앞당겨집니다.',
    })
  }
  const type = { main: types[0], sub: types[1] ?? null }

  // ── 90일 목표 ──────────────────────────────────────────────────────
  const G: CoachGoal[] = []
  if (bottlenecks.find((b) => b.id === 'depth')) {
    const addTarget = isNum(M.oldCnt6.me) ? Math.max(Math.round(M.oldCnt6.me) + 1, 4) : 4
    // 이미 TC를 앞선 부보율에는 목표를 걸지 않는다 (원본 v18: tc>me 조건 추가)
    const cancerTarget =
      isNum(M.cancerRate.me) && isNum(M.cancerRate.tc) && M.cancerRate.tc > M.cancerRate.me
        ? Math.round((M.cancerRate.me + (M.cancerRate.tc - M.cancerRate.me) * 0.6) * 20) / 20
        : null
    G.push({
      id: 'depth',
      score: 100,
      title: "기존고객 '두 번째 계약' 만들기 — 보장점검 재상담",
      point: `신규 고객발굴이 아닌, 이미 확보한 장기고객 ${f1(F.custLong.me)}명에서 고객당 계약 깊이를 높이는 전환`,
      now: `고객당 ${f2(F.perCust.me)}건 · 기존고객 추가계약 월 ${f2(M.oldCnt6.me)}건 · 암 주요치료비 부보율 ${pctFmt(M.cancerRate.me)}`,
      d30: `단독 1건·주력상품 가입고객 중 점검대상 <b>20명 리스트 확정</b>, 점검상담 <b>8명</b> 완료`,
      d90: `기존고객 추가계약 <b>${addTarget * 3}건(월 ${addTarget}건)</b>` + (cancerTarget ? `, 신계약 암 주요치료비 부보율 <b>${pctFmt(cancerTarget)} 수준</b>` : ''),
      week: `매주 <b>5분</b>께 '보장 점검' 명분 연락(판매 아님을 먼저 선언) → 점검상담 <b>2건</b> 약속`,
      measure: `리스트 → 연락 → 점검상담 → 추가계약 4단계 인원을 주 단위 기록, 매주 금요일 점검`,
      ex: {
        reason: '새 고객을 만나는 건 자신 있는데, 이미 만난 고객을 다시 챙기는 일을 놓치고 있었다는 게 숫자로 보여서',
        act: '보장 점검 상담',
        action: '간편·단독 1건 고객 5분께 보장 점검 연락, 점검상담 2건 약속',
        metric: '고객당 계약 건수',
        from: `${f2(F.perCust.me)}건`,
        to: `${f2(isNum(F.perCust.me) ? Math.round((F.perCust.me + 0.3) * 100) / 100 : null)}건`,
      },
      why: `500만원 진입에 필요한 것은 더 많은 고객이 아니라, <b>고객 한 분과 만드는 소득의 깊이</b>입니다. 고객 기반과 활동량이 이미 상위권이므로, 고객당 건수의 간격이 좁혀지는 만큼 소득이 가장 빠르게 반응하는 구조입니다. 주력상품 고객의 치료과정 보장 공백 점검은 고객가치 관점에서도 우선입니다.`,
      hero: 'depth',
    })
  }
  if (bottlenecks.find((b) => b.id === 'car')) {
    const soloLong = isNum(F.custLong.me) && isNum(F.custLink.me) ? F.custLong.me - F.custLink.me : null
    const linkAdd = isNum(F.custLink.me) && isNum(F.custLink.tc) ? Math.min(Math.max(Math.round((F.custLink.tc - F.custLink.me) * 0.25), 3), 8) : 6
    const carMo = isNum(M.moCar.me) ? Math.max(Math.round(M.moCar.me + 1.5), 2) : 2
    G.push({
      id: 'car',
      score: 70,
      title: '자동차 연계 시동 — 만기정보부터',
      point: `장기 단독고객 ${soloLong ? f1(soloLong) + '분' : ''}과 자동차 만기를 계기로 다시 만나, 매년 반복되는 만남을 만들어요`,
      now: `자동차고객 ${f1(F.custCar.me)}명 · 연계고객 ${f1(F.custLink.me)}명 · 연계율 ${pctFmt(F.linkRate.me)} · 월 자동차 ${f1(M.moCar.me)}건`,
      d30: `자동차 <b>만기월 정보 30명 확보</b> (계약 목표가 아니라 정보 목표)`,
      d90: `자동차 <b>월 ${carMo}~${carMo + 1}건</b>, 장기·자동차 연계고객 <b>${f1(F.custLink.me)}명 → ${f1(isNum(F.custLink.me) ? F.custLink.me + linkAdd : null)}명(+${linkAdd})</b>`,
      week: `장기고객 <b>5분</b>께 본인·가족 차량 보유 여부, 현재 보험사, 만기월 확인 (고객정보 정비·가족 위험점검 명분)`,
      measure: `정보확보 → 견적 → 상담 → 계약 단계별 인원 기록`,
      ex: {
        reason: '장기 고객 접점은 강한데 자동차가 비어 있어, 매년 다시 만날 명분부터 만들고 싶어서',
        act: '자동차 만기 확인',
        action: '장기고객 5분께 차량 보유·만기월 확인',
        metric: '장기·자동차 연계고객',
        from: `${f1(F.custLink.me)}명`,
        to: `${f1(isNum(F.custLink.me) ? F.custLink.me + linkAdd : null)}명`,
      },
      why: `TC그룹과의 최대 절대격차 영역이면서, 보장점검 상담 자리에서 <b>만기월 한 줄만 물어도 실행되는</b> 낮은 비용의 목표입니다. TC 연계율 즉시 도달이 아니라 연계고객 +${linkAdd}명이 현실적인 중간목표입니다.`,
      hero: 'car',
    })
  }
  if (bottlenecks.find((b) => b.id === 'coverage') && !G.find((g) => g.id === 'depth')) {
    // 암 부보율이 병목이면 담보 점검 카드, 이미 좋으면 "계약 규모" 카드 (원본 v18 분기)
    if (metrics.cancerRate.cls === 'bottleneck') {
      G.push({
        id: 'coverage',
        score: 80,
        title: '보장 깊이 높이기 — 치료과정 담보 제안 습관화',
        point: `계약 수가 아니라 계약 1건의 보장가치를 높이는 전환`,
        now: `인당 월납 ${wonK(F.premPer.me)} · 건당 ${wonK(F.premCase.me)} · 암 부보율 ${pctFmt(M.cancerRate.me)}`,
        d30: `모든 신규 상담에 <b>암 주요치료비·심뇌 담보 점검 단계</b>를 넣고 제안 여부 기록 시작`,
        d90: `신계약 암 주요치료비 부보율 <b>${isNum(M.cancerRate.dg) ? '동일그룹 수준(' + pctFmt(M.cancerRate.dg) + ')' : 'TC 수준(' + pctFmt(M.cancerRate.tc) + ')'}</b> 접근, 신계약 건당 보험료 <b>${wonK(M.premCase6.tc)} 수준(TC)</b> 접근`,
        week: `주간 신계약 전건에 대해 '치료과정 보장 제안 여부' 셀프 체크`,
        measure: `신계약 건별 부보 담보 기록, 월 단위 부보율 산출`,
        ex: {
          reason: '계약 수보다 계약 한 건의 깊이가 소득을 좌우한다는 걸 확인해서',
          act: '치료과정 담보 점검',
          action: '신규 상담 전건에 암·심뇌 담보 점검 단계 포함',
          metric: '암 주요치료비 부보율',
          from: pctFmt(M.cancerRate.me),
          to: isNum(M.cancerRate.dg) ? pctFmt(M.cancerRate.dg) : pctFmt(M.cancerRate.tc),
        },
        why: `활동량 대비 단가가 낮은 구조에서는 활동 추가보다 <b>설계 깊이</b>가 소득에 직결됩니다.`,
        hero: 'depth',
      })
    } else {
      G.push({
        id: 'coverage',
        score: 80,
        title: '계약 규모 키우기 — 납입 여력 확인 습관화',
        point: `담보 구성은 이미 좋아요. 계약 1건의 규모를 키우는 전환`,
        now: `인당 월납 ${wonK(F.premPer.me)} · 건당 ${wonK(F.premCase.me)} (TC ${wonK(F.premPer.tc)} · ${wonK(F.premCase.tc)})`,
        d30: `모든 신규 상담에 <b>납입 여력 확인 + 증액·추가 담보 제안 단계</b>를 넣고 제안 여부 기록 시작`,
        d90: `신계약 건당 보험료 <b>${wonK(M.premCase6.tc)} 수준(TC)</b> 접근`,
        week: `주간 신계약 전건에 대해 '증액 제안 여부' 셀프 체크`,
        measure: `신계약 건별 보험료 기록, 월 단위 건당 보험료 산출`,
        ex: {
          reason: '담보 구성은 자신 있는데 계약 규모에서 간격이 있다는 걸 확인해서',
          act: '납입 여력 확인·증액 제안',
          action: '신규 상담 전건에 증액 제안 단계 포함',
          metric: '신계약 건당 보험료',
          from: wonK(M.premCase6.me),
          to: wonK(M.premCase6.tc),
        },
        why: `부보율이 이미 앞서 있는 구조에서는 <b>계약 규모</b>가 소득 격차를 좁히는 지렛대예요.`,
        hero: 'depth',
      })
    }
  }
  if (bottlenecks.find((b) => b.id === 'prospecting')) {
    G.push({
      id: 'prospecting',
      score: 60,
      title: '아는 얼굴 만들기 — 매주 같은 자리 루틴',
      point: `거창한 개척이 아니라, 나의 생활 동선에서 반복 가능한 접점을 만드는 일`,
      now: `월 신규 ${f2(F.newCust.me)}명 · 총고객 ${f1(F.custTotal.me)}명`,
      d30: `매주 갈 수 있는 <b>고정 거점 2곳</b>(단골 상권·모임·사업장) 정하고 첫 방문 <b>4회</b>`,
      d90: `월 신규고객 <b>${f2(F.newCust.dg)}명 수준</b>(동일그룹) 도달`,
      week: `같은 요일, 같은 자리 방문 — 권유 대신 <b>도움 되는 정보 한 가지</b> 전하기`,
      measure: `방문 → 대화 → 연락처 → 상담 단계별 기록`,
      ex: {
        reason: '새 고객 접점이 줄어든 걸 확인하고, 부담 없는 반복 루틴부터 만들고 싶어서',
        act: '고정 거점 방문',
        action: '고정 거점 2곳을 같은 요일에 방문',
        metric: '월 신규고객',
        from: `${f2(F.newCust.me)}명`,
        to: `${f2(F.newCust.dg)}명`,
      },
      why: `'개척'이라는 말이 무겁게 들리지만, 실제 성과를 낸 멘토들의 공통점은 장소가 아니라 <b>빠지지 않는 반복</b>이었어요. 아는 얼굴이 되면 상담은 따라와요.`,
      hero: 'prospect',
    })
  }
  if (metrics.newCust.cls === 'bottleneck') {
    const baseOK = isNum(F.custTotal.me) && isNum(F.custTotal.dg) && F.custTotal.me >= F.custTotal.dg
    G.push({
      id: 'inflow',
      score: 85,
      title: '소개로 여는 신규 유입 — 만족고객 소개 대화',
      point: `${baseOK ? '탄탄한 기존 고객관계' : '지금 있는 고객관계'}를 새 고객 유입의 입구로 바꾸는 전환`,
      now: `월 신규 ${f2(F.newCust.me)}명 · 총고객 ${f1(F.custTotal.me)}명`,
      d30: `만족도 높은 고객 <b>10명 리스트</b> 작성, 소개 대화 <b>6회</b> 시도`,
      d90: `월 신규고객 <b>${f2(minSafe(F.newCust.dg, F.newCust.tc))}명 수준</b>${isNum(F.newCust.dg) ? '(동일그룹)' : '(TC그룹)'} 회복`,
      week: `보장점검·계약관리 상담 마무리에 <b>소개 한 문장</b> 얹기 (주 2~3회)`,
      measure: `소개 대화 → 소개 접수 → 연락 → 상담 단계별 기록`,
      why: `깊은 고객관계는 소개가 나오기 가장 좋은 토양이에요. 새 시장을 찾기보다 <b>이미 신뢰가 확인된 고객</b>에서 시작하는 것이 가장 빠릅니다.`,
      hero: 'care',
      ex: {
        reason: '고객 관리는 자신 있는데 새 고객이 더해지는 속도가 느려진 게 숫자로 보여서',
        act: '소개 대화',
        action: '만족고객 상담 마무리에 소개 한 문장, 주 2~3회',
        metric: '월 신규고객',
        from: `${f2(F.newCust.me)}명`,
        to: `${f2(minSafe(F.newCust.dg, F.newCust.tc))}명`,
      },
    })
  }
  if (bottlenecks.find((b) => b.id === 'activity')) {
    G.push({
      id: 'activity',
      score: 75,
      title: '상담 슬롯 고정 — 활동 리듬 만들기',
      point: `검증된 전환력에 상담 횟수를 곱하는 전환`,
      now: `월 장기건수 ${f1(M.moLong.me)}건 (동일그룹 ${f1(M.moLong.dg)} · TC ${f1(M.moLong.tc)}건)`,
      d30: `주간 <b>상담 슬롯 3개(요일·시간 고정)</b> 확보, 4주 유지`,
      d90: `월 장기건수 <b>${f1(minSafe(M.moLong.dg, M.moLong.tc))}건 수준</b> 도달`,
      week: `고정 슬롯에 기존·소개 고객 상담을 먼저 배치`,
      measure: `주간 슬롯 소화율(계획 대비 실행) 기록`,
      why: `계약의 깊이는 이미 상위권 — 횟수가 늘면 <b>지금의 전환력이 그대로 소득으로 곱해집니다.</b>`,
      hero: 'prospect',
      ex: {
        reason: '상담의 질은 자신 있는데 횟수의 리듬이 느슨해진 걸 확인해서',
        act: '고정 슬롯 상담',
        action: '주 3개 고정 슬롯에 상담 우선 배치',
        metric: '월 장기건수',
        from: `${f1(M.moLong.me)}건`,
        to: `${f1(minSafe(M.moLong.dg, M.moLong.tc))}건`,
      },
    })
  }
  if (G.length === 0 && bottlenecks.length) {
    const bn = bottlenecks[0]
    const lbl = bn.title.replace('TC까지 남은 간격 — ', '')
    G.push({
      id: 'levelup',
      score: 50,
      title: `TC 마지막 간격 좁히기 — ${lbl}`,
      point: `약점 보완이 아닌, 상위 그룹 진입을 위한 마지막 간격 관리`,
      now: bn.num,
      d30: `이 지표를 만드는 <b>주간 행동 1개</b>를 정해 4주 유지`,
      d90: `TC그룹과의 간격 <b>절반 좁히기</b>`,
      week: `선택한 주간 행동의 실행 여부 체크`,
      measure: `주 단위 실행 기록, 월 단위 지표 확인`,
      why: `동일그룹은 이미 넘어섰어요. 남은 것은 능력이 아니라 <b>습관의 영역</b>이에요.`,
      hero: 'care',
      ex: { reason: '약점이 아니라 상위 그룹과의 마지막 간격만 남았다는 걸 확인해서', act: '주간 핵심 행동', action: '지표와 연결된 주간 행동 1개 고정', metric: lbl, from: '', to: '' },
    })
  }
  if (G.length === 1) {
    const lv = Object.entries(metrics).filter(([, mt]) => mt.cls === 'levelup' && isNum(mt.tc) && mt.tc !== 0)
    lv.sort((x, y) => Math.abs(relGap(y[1].me, y[1].tc) || 0) - Math.abs(relGap(x[1].me, x[1].tc) || 0))
    if (lv.length) {
      const [k, mt] = lv[0]
      G.push({
        id: 'levelup2',
        score: 1,
        title: `TC 마지막 간격 좁히기 — ${mt.label}`,
        point: `약점 보완이 아닌, 상위 그룹 진입을 위한 마지막 간격 관리`,
        now: `${fm(k, mt.me)} (동일그룹 ${fm(k, mt.dg)} · TC ${fm(k, mt.tc)})`,
        d30: `이 지표를 만드는 <b>주간 행동 1개</b>를 정해 4주 유지`,
        d90: `TC그룹과의 간격 <b>절반 좁히기</b>`,
        week: `선택한 주간 행동의 실행 여부 체크`,
        measure: `주 단위 실행 기록, 월 단위 지표 확인`,
        why: `동일그룹은 이미 넘어선 지표예요. 남은 것은 능력이 아니라 <b>습관의 영역</b>이에요.`,
        hero: 'care',
        ex: { reason: '약점이 아니라 상위 그룹과의 마지막 간격만 남았다는 걸 확인해서', act: '주간 핵심 행동', action: '지표와 연결된 주간 행동 1개 고정', metric: mt.label, from: '', to: '' },
      })
    }
  }
  const goals = [...G].sort((x, y) => y.score - x.score).slice(0, 2)

  // 1순위 목표의 근거에 환산실적 간격을 덧붙인다 (원본 v18)
  if (goals[0] && isNum(M.perfConv.me) && isNum(M.perfConv.tc) && M.perfConv.me < M.perfConv.tc) {
    const pctLv = Math.round((M.perfConv.me / M.perfConv.tc) * 100)
    goals[0].why =
      (goals[0].why || '') +
      ` 지금 월평균 환산실적은 TC의 <b>${pctLv}%</b> 수준이에요 — 위 루틴이 이 간격을 좁히는 가장 빠른 길이에요.`
  }

  // ── 데이터가 본 진짜 이야기 (반전 서사 R1~R6, 원본 v18 그대로) ─────
  const truth: CoachTruth = (() => {
    const dgOr = (o: CoachMetric) => (isNum(o.dg) ? o.dg : o.tc) // 동일그룹 없으면 TC 기준
    const conv = M.perfConv
    const hasConv = isNum(conv.me) && isNum(conv.tc)
    const convPct = hasConv ? Math.round((conv.me! / conv.tc!) * 100) : null
    const convGapM = hasConv ? Math.max(0, Math.round((conv.tc! - conv.me!) / 10000)) : null // 만원
    const gapPer = isNum(F.perCust.me) && isNum(F.perCust.tc) ? Math.max(0, F.perCust.tc - F.perCust.me) : null
    const pot = gapPer && isNum(F.custTotal.me) ? Math.round(gapPer * F.custTotal.me) : null // 잠재 계약
    const potHalf = pot ? Math.round(pot / 4) : null
    const custT = isNum(F.custTotal.me) ? f1(F.custTotal.me) : null
    const oppDepth = (lead: string) => ({
      badge: pot ? `+${pot.toLocaleString()}건` : `성장 공간`,
      html: pot
        ? `${lead} 고객당 계약이 <b>${f2(F.perCust.me)}건</b>, TC그룹은 ${f2(F.perCust.tc)}건이에요. 이 <b>${f2(gapPer)}건</b>의 간격을 이미 인연을 맺은 ${custT}분에 곱하면 — <b>새 고객 없이도 만들 수 있는 계약 ${pot.toLocaleString()}건</b>이 나와요. 약점이 아니라, 미리 확보해 둔 예약석이에요.${convGapM && potHalf ? ` 이 중 4분의 1(약 ${potHalf.toLocaleString()}건)만 채워져도, TC까지 남은 환산 간격(월 약 ${convGapM.toLocaleString()}만원)이 크게 좁혀지는 걸로 가늠돼요.` : ''}`
        : `${lead} 이미 인연을 맺은 고객과의 두 번째 계약에 가장 큰 성장 공간이 있어요.`,
    })
    // R1 발굴 의존
    if (
      isNum(F.newCust.me) && isNum(F.newCust.tc) && F.newCust.me >= F.newCust.tc * 1.4 &&
      ((hasConv && conv.me! < conv.tc! * 0.9) || (!hasConv && isNum(F.perCust.me) && isNum(F.perCust.tc) && F.perCust.me < F.perCust.tc * 0.9))
    ) {
      const mult = f1(divSafe(F.newCust.me, F.newCust.tc))
      return {
        id: 'R1',
        head: '들어오는 문은 넓은데, 머무는 방이 아직 좁아요',
        sL: { v: mult + '배', k: '새 고객을 만나는 힘', s: 'TC그룹 대비' },
        sR: hasConv
          ? { v: convPct + '%', k: '월평균 환산실적', s: 'TC그룹 대비' }
          : { v: f2(F.perCust.me) + '건', k: '고객당 계약', s: 'TC ' + f2(F.perCust.tc) + '건' },
        shadow: `새 고객을 만나는 힘은 TC그룹의 <b>${mult}배</b>예요. 그런데 ${hasConv ? `월평균 환산실적은 TC의 <b>${convPct}%</b>에 머물러 있어요` : `고객 한 분과의 계약은 <b>${f2(F.perCust.me)}건</b>으로 TC(${f2(F.perCust.tc)}건)에 못 미쳐요`}. 두 숫자가 함께 말하는 건 하나예요 — <b>들어오는 문은 넓은데, 머무는 방이 아직 좁아요.</b> 발굴을 더 늘리는 게 답이 아니라는 걸, 하이플래너님의 숫자가 이미 증명하고 있어요.`,
        opp: oppDepth(''),
        one: '이미 만난 고객과의 <b>두 번째 계약</b>',
        qa: [
          `"발굴이 TC의 ${mult}배인데 ${hasConv ? `소득은 ${convPct}%` : '계약 깊이는 더 얕다'}면 — 새 고객을 더 만나는 게 답일까요?"<span class="qwhy">왜 묻나요 — 본인이 가장 자신 있는 행동이 정답이 아닐 수 있음을, 지적이 아니라 질문으로 스스로 발견하게 하는 반전 확인 질문이에요.</span>`,
          pot
            ? `"이미 만난 ${custT}분 안에 계약 ${pot.toLocaleString()}건이 잠들어 있다면, 어디서부터 깨우고 싶으세요?"<span class="qwhy">왜 묻나요 — 잠재량을 본인의 선택으로 전환시키는 질문이에요. '어디서부터'가 곧 첫 행동이 돼요.</span>`
            : null,
        ],
      }
    }
    // R2 1회성 가입
    if (
      isNum(F.custLong.me) && isNum(dgOr(F.custLong)) && F.custLong.me >= dgOr(F.custLong)! &&
      isNum(F.premPer.me) && isNum(F.premPer.tc) && F.premPer.me < F.premPer.tc * 0.85
    ) {
      const pm = f1(F.premPer.me / 10000)
      const pt = f1(F.premPer.tc / 10000)
      return {
        id: 'R2',
        head: '고객은 충분한데, 한 분과의 계약이 아직 얕아요',
        sL: { v: f1(F.custLong.me) + '명', k: '장기고객', s: '동일그룹 이상' },
        sR: { v: pm + '만원', k: '인당 월납보험료', s: 'TC ' + pt + '만원' },
        shadow: `장기고객은 <b>${f1(F.custLong.me)}명</b>으로 이미 기준을 넘었어요. 그런데 한 분이 맡겨주신 월 보험료는 <b>${pm}만원</b>, TC그룹은 ${pt}만원이에요. 고객을 더 만나는 문제가 아니라 — <b>한 번의 가입으로 끝난 인연이 많다</b>는 뜻이에요.`,
        opp: oppDepth(''),
        one: '가입 후 <b>보장 점검으로 다시 만나는 두 번째 상담</b>',
        qa: [
          `"고객 수는 이미 충분한데 인당 보험료가 ${pm}만원이라면 — 더 만나야 할까요, 더 깊어져야 할까요?"<span class="qwhy">왜 묻나요 — 병목이 '수'가 아니라 '깊이'임을 본인 입으로 결론 내리게 하는 질문이에요.</span>`,
          null,
        ],
      }
    }
    // R3 전환 누수
    if (
      isNum(M.moLong.me) && isNum(dgOr(M.moLong)) && M.moLong.me >= dgOr(M.moLong)! &&
      isNum(F.perCust.me) && isNum(F.perCust.tc) && F.perCust.me < F.perCust.tc * 0.85
    ) {
      return {
        id: 'R3',
        head: '활동은 도는데, 성과가 새어 나가고 있어요',
        sL: { v: f1(M.moLong.me) + '건', k: '월 장기건수', s: '동일그룹 이상' },
        sR: { v: f2(F.perCust.me) + '건', k: '고객당 계약', s: 'TC ' + f2(F.perCust.tc) + '건' },
        shadow: `계약은 월 <b>${f1(M.moLong.me)}건</b>으로 활발해요. 그런데 고객 한 분 기준으로는 <b>${f2(F.perCust.me)}건</b> — 넓게 만나고 얕게 맺고 있어요. 활동의 양이 아니라, <b>한 번의 만남이 두 번째로 이어지는 길목</b>에 성장 공간이 있어요.`,
        opp: oppDepth(''),
        one: '계약한 고객과의 <b>2주 안 한 번 더 연락</b> 규칙',
        qa: [
          `"활동은 이미 충분히 돌고 있는데 고객당 계약이 ${f2(F.perCust.me)}건이라면 — 어디서 새고 있는 걸까요?"<span class="qwhy">왜 묻나요 — '더 많이'가 아니라 '어디서 새는가'로 시선을 옮기는 질문이에요.</span>`,
          null,
        ],
      }
    }
    // R4 마무리 부재
    if (
      isNum(M.simpleCntPct.me) && isNum(M.simpleCntPct.tc) && M.simpleCntPct.me - M.simpleCntPct.tc > 0.15 &&
      isNum(F.premPer.me) && isNum(F.premPer.tc) && F.premPer.me < F.premPer.tc
    ) {
      const sp = f0(M.simpleCntPct.me * 100)
      return {
        id: 'R4',
        head: '문은 잘 여는데, 마무리가 아직이에요',
        sL: { v: sp + '%', k: '간편 계약 비중', s: 'TC보다 +' + f0((M.simpleCntPct.me - M.simpleCntPct.tc) * 100) + '%p' },
        sR: { v: f1(F.premPer.me / 10000) + '만원', k: '인당 월납보험료', s: 'TC ' + f1(F.premPer.tc / 10000) + '만원' },
        shadow: `계약의 <b>${sp}%</b>가 간편이에요. 문을 여는 속도는 TC보다 빨라요. 그런데 인당 보험료는 <b>${f1(F.premPer.me / 10000)}만원</b>에 머물러요. 잘 파는 상품을 줄일 이유는 없어요 — 다만 <b>입구에서 멈추지 않고 보장 이야기로 마무리를 짓는 것</b>, 거기에 다음 소득이 있어요.`,
        opp: oppDepth(''),
        one: '간편 가입 고객과의 <b>보장 확장 두 번째 상담</b>',
        qa: [
          `"간편으로 문을 연 고객 중, 보장 이야기까지 이어진 분은 몇 분쯤 될까요?"<span class="qwhy">왜 묻나요 — '입구 상품' 전략의 다음 단계를 본인이 세도록 하는 질문이에요.</span>`,
          null,
        ],
      }
    }
    // R5 연계 공백
    if (
      isNum(F.custLong.me) && isNum(F.custLong.tc) && F.custLong.me >= F.custLong.tc * 0.8 &&
      isNum(F.linkRate.me) && isNum(F.linkRate.tc) && F.linkRate.me < F.linkRate.tc * 0.5
    ) {
      const unlinked = Math.round(F.custLong.me * (1 - F.linkRate.me))
      return {
        id: 'R5',
        head: '매년 다시 만날 약속을, 아직 쓰지 않고 있어요',
        sL: { v: f1(F.custLong.me) + '명', k: '장기고객', s: 'TC의 ' + Math.round((F.custLong.me / F.custLong.tc) * 100) + '%' },
        sR: { v: f0(F.linkRate.me * 100) + '%', k: '자동차 연계율', s: 'TC ' + f0(F.linkRate.tc * 100) + '%' },
        shadow: `장기고객 기반은 TC그룹의 <b>${Math.round((F.custLong.me / F.custLong.tc) * 100)}%</b>까지 왔어요. 그런데 자동차로 연결된 분은 <b>${f0(F.linkRate.me * 100)}%</b>뿐이에요. 자동차는 싼 견적 경쟁이 아니라 — <b>1년에 한 번, 자연스럽게 다시 만날 약속</b>이에요.`,
        opp: {
          badge: `${unlinked.toLocaleString()}번의 약속`,
          html: `아직 자동차로 연결되지 않은 장기고객이 <b>${unlinked.toLocaleString()}분</b>이에요. 이분들과 만기월만 확인해 두면 — <b>해마다 ${unlinked.toLocaleString()}번의 다시 만날 약속</b>이 생겨요. 새 고객 없이 만드는, 반복되는 만남이에요.`,
        },
        one: '장기고객과의 <b>자동차 만기 확인 한마디</b>',
        qa: [
          `"장기 고객 ${f1(F.custLong.me)}분 중 자동차 만기를 알고 있는 분은 몇 분인가요?"<span class="qwhy">왜 묻나요 — 연계를 '판매'가 아니라 '재회 명분'으로 재정의하게 하는 질문이에요.</span>`,
          null,
        ],
      }
    }
    // R6 상위권 (기본)
    const convLine = hasConv && conv.me! < conv.tc! ? ` 남은 건 TC까지의 마지막 간격(환산 기준 <b>${convPct}%</b>)뿐이에요.` : ''
    // 상위권 기회 카드: 깊이 여지가 없으면 TC 간격 최대 지표로 전환
    let r6opp: { badge: string; html: string }
    if (pot && pot > 0) {
      r6opp = oppDepth('그중 가장 여지가 큰 곳을 짚자면 —')
    } else {
      let best: { ratio: number; label: string } | null = null
      for (const [k, mt] of Object.entries(metrics)) {
        if (!mt || !isNum(mt.me) || !isNum(mt.tc) || mt.me >= mt.tc) continue
        const ratio = mt.me / mt.tc
        if (!best || ratio < best.ratio) best = { ratio, label: mt.label || k }
      }
      r6opp = best
        ? {
            badge: `${Math.round(best.ratio * 100)}%`,
            html: `TC그룹과의 간격이 가장 크게 남은 곳은 <b>${best.label}</b>이에요 — 지금 TC의 <b>${Math.round(best.ratio * 100)}%</b>까지 왔어요. 모든 지표를 같이 올릴 필요는 없어요. <b>이 하나가 TC 수준에 닿는 것</b>, 그게 다음 90일의 가장 빠른 길로 가늠돼요.`,
          }
        : {
            badge: '유지의 힘',
            html: `지금의 구조를 90일 더 <b>같은 리듬으로 반복하는 것</b> 자체가 성장 전략이에요. 흔들리지 않는 반복이 상위권의 무기예요.`,
          }
    }
    // 여러 지표가 고르게 뒤처져 있으면 "모순 없음"보다 "기본기의 크기"로 말한다 (v20)
    const weakN = Object.values(metrics).filter((mt) => mt && mt.cls === 'bottleneck').length
    if (weakN >= 4) {
      return {
        id: 'R6',
        head: '모순을 찾기 전에, 기본기의 크기를 키울 때예요',
        sL: null,
        sR: null,
        shadow: `서로 어긋나서 발목을 잡는 지표는 없어요. 다만 여러 지표가 TC까지 고르게 간격을 두고 있어요 — 방향이 틀린 게 아니라, <b>지금 하고 있는 것의 양과 반복</b>이 커질 차례라는 뜻이에요.${convLine}`,
        opp: r6opp,
        one: '가장 간격이 큰 <b>지표 하나</b>에 90일 집중',
        qa: [
          `"여러 지표 중 딱 하나만 90일 안에 TC 수준으로 만든다면, 어떤 걸 고르시겠어요?"<span class="qwhy">왜 묻나요 — 넓은 간격 앞에서 막막함 대신 선택과 집중으로 시선을 옮기는 질문이에요.</span>`,
          null,
        ],
      }
    }
    return {
      id: 'R6',
      head: '찌를 모순이 없다는 것 — 그게 이 데이터의 결론이에요',
      sL: null,
      sR: null,
      shadow: `유입과 깊이, 활동과 전환, 상품과 마무리 — 서로 어긋나는 지표가 없어요. 구조를 고치는 단계는 지났다는 뜻이에요.${convLine} 이제 필요한 건 방향 전환이 아니라, <b>지금 구조의 크기를 키우는 것</b>이에요.`,
      opp: r6opp,
      one: '가장 간격이 큰 <b>지표 하나</b>에 90일 집중',
      qa: [
        `"지금 구조에서 어느 하나가 1.2배가 되면, 소득이 가장 크게 움직일까요?"<span class="qwhy">왜 묻나요 — 상위권 플래너에게는 문제 찾기가 아니라 '레버리지 고르기'가 코칭이에요.</span>`,
        null,
      ],
    }
  })()

  // ── One Point Lesson: 유형별 3줄 (지금 → 잘하는 것 → 다음 한 걸음) ──
  const lesson: CoachLesson = (() => {
    const tn = type.main.name
    const nn = (v: number | null, f: (v: number) => string) => (isNum(v) ? f(v) : null)
    const cust = nn(F.custLong.me, f1)
    const custT = nn(F.custTotal.me, f1)
    const per = nn(F.perCust.me, f2)
    const nc = nn(F.newCust.me, f2)
    const ncTc = nn(F.newCust.tc, f2)
    const prem = nn(F.premPer.me, (v) => f1(v / 10000))
    const premTc = nn(F.premPer.tc, (v) => f1(v / 10000))
    const link = nn(F.linkRate.me, (v) => f0(v * 100))
    const solo = nn(F.longSoloRate?.me ?? null, (v) => f0(v * 100))
    const simple = nn(M.simpleCntPct.me, (v) => f0(v * 100))
    const simpleGap =
      isNum(M.simpleCntPct.me) && isNum(M.simpleCntPct.tc) ? f0((M.simpleCntPct.me - M.simpleCntPct.tc) * 100) : null
    const mo = nn(M.moLong.me, f1)
    const nc6 = nn(M.newCust6.me, f2)
    const cancer = nn(M.cancerRate.me, (v) => f0(v * 100))
    const convPctL =
      isNum(M.perfConv.me) && isNum(M.perfConv.tc) && M.perfConv.me < M.perfConv.tc
        ? Math.round((M.perfConv.me / M.perfConv.tc) * 100)
        : null
    const L = (now: string, str: string, next: string): CoachLesson => ({ now, str, next })
    if (tn === '신규고객 확장형')
      return L(
        nc && ncTc
          ? `매달 새 고객 <b>${nc}명</b>을 만나요. TC그룹(${ncTc}명)을 크게 앞서는, 흔치 않은 발굴력이에요.`
          : `새 고객을 만나는 힘이 TC그룹을 앞서요. 흔치 않은 발굴력이에요.`,
        custT
          ? `새로운 고객과 인연을 맺는 힘은 이미 증명됐어요 — 지금까지 함께해 온 고객 <b>${custT}분</b>이 그 증거예요.`
          : `새로운 고객과 인연을 맺는 힘은 이미 충분히 증명됐어요.`,
        custT
          ? `이번 90일은 그 발굴력 위에, <b>이미 인연을 맺은 ${custT}분과의 두 번째 계약을 더해 갑니다.</b>`
          : `이번 90일은 그 발굴력 위에, <b>이미 만난 고객과의 두 번째 계약을 더해 갑니다.</b>`,
      )
    if (tn.startsWith('첫 계약 개척형'))
      return L(
        isNum(M.simpleCntPct.me)
          ? `계약 10건 중 <b>${f0(M.simpleCntPct.me * 10)}건</b>이 간편보험이에요. 문을 여는 상품으로는 최고의 무기예요.`
          : `계약 대부분이 간편보험이에요. 문을 여는 상품으로는 최고의 무기예요.`,
        simpleGap
          ? `간편으로 첫 계약을 만드는 속도는 TC그룹보다 빨라요(<b>+${simpleGap}%p</b>).`
          : `간편으로 첫 계약을 만드는 속도는 TC그룹보다 빨라요.`,
        `간편으로 연 문 안쪽에서, <b>다음 상담엔 보장 이야기를 한 가지만 더 얹어봅니다.</b>`,
      )
    if (tn === '기존고객 성장형')
      return L(
        per
          ? `고객 한 분당 계약이 <b>${per}건</b>이에요. 만난 분들과의 '두 번째 계약'이 아직 적다는 뜻이에요.`
          : `만난 분들과의 '두 번째 계약'이 아직 적어요.`,
        prem
          ? `대신 한 분 한 분이 맡겨주신 보험료는 탄탄해요(월 <b>${prem}만원</b>).`
          : `대신 한 분 한 분과의 계약의 깊이는 탄탄해요.`,
        custT
          ? `새 고객 찾기보다, <b>이미 알고 지내는 ${custT}분을 다시 만나는 90일을 시작합니다.</b>`
          : `새 고객 찾기보다, <b>이미 알고 지내는 고객을 다시 만나는 90일을 시작합니다.</b>`,
      )
    if (tn === '장기고객 전문형')
      return L(
        solo && link
          ? `계약의 <b>${solo}%</b>가 장기 단독이에요. 자동차와 연결된 고객은 ${link}%뿐이고요.`
          : `계약 대부분이 장기 단독이에요. 자동차와 연결된 고객은 아직 적어요.`,
        `장기 하나로 여기까지 온 건, 보장 상담력이 진짜라는 뜻이에요.`,
        cust
          ? `장기 고객 <b>${cust}분</b>께 <b>"자동차 만기 언제세요?" 한마디를 건네봅니다</b> — 1년에 한 번씩 다시 만날 약속이 생겨요.`
          : `장기 고객분들께 <b>"자동차 만기 언제세요?" 한마디를 건네봅니다</b> — 1년에 한 번씩 다시 만날 약속이 생겨요.`,
      )
    if (tn === '활동 에너지형')
      return L(
        mo && per
          ? `계약은 월 <b>${mo}건</b>으로 활발한데, 고객당으로는 ${per}건 — 넓게 만나고 얕게 맺고 있어요.`
          : `활동은 활발한데, 한 분과의 계약은 얕게 맺고 있어요.`,
        `움직이는 힘은 이미 충분해요. 지금 필요한 건 '더 많이'가 아니라 '한 번 더'예요.`,
        `활동을 늘리지 말고, <b>계약한 고객에게 2주 안에 한 번 더 연락하는 규칙을 만듭니다.</b>`,
      )
    if (tn === '고객가치 심화형')
      return L(
        prem && premTc
          ? `고객이 맡겨주신 월 보험료가 <b>${prem}만원</b>이에요. TC그룹(${premTc}만원)과의 차이는 '단가'에 있어요.`
          : `고객이 맡겨주신 월 보험료에서 TC그룹과의 차이가 커요 — 차이는 '단가'에 있어요.`,
        per
          ? `계약 건수와 고객 관리는 이미 궤도에 올라 있어요(고객당 <b>${per}건</b>).`
          : `계약 건수와 고객 관리는 이미 궤도에 올라 있어요.`,
        `다음 상담부터 <b>암·심뇌 보장 한 가지를 반드시 견적에 담아 보여드립니다.</b>`,
      )
    if (tn === '고객신뢰 설계형')
      return L(
        prem && cancer
          ? `인당 보험료 <b>${prem}만원</b>, 암 부보율 <b>${cancer}%</b> — 두 지표 모두 TC그룹을 넘었어요.`
          : `인당 보험료와 암 부보율, 두 지표 모두 TC그룹을 넘었어요.`,
        `'제대로 된 보장'을 설계하는 힘이 최상급이라는 뜻이에요.`,
        `이 설계력을 <b>소개로 연결합니다</b> — 만족 고객 3분께 "저 같은 설계가 필요한 분"을 여쭤봅니다.`,
      )
    if (tn === '활동리듬 만들기형')
      return L(
        nc6 && mo
          ? `최근 6개월, 새 고객(월 <b>${nc6}명</b>)과 계약(월 ${mo}건)의 리듬이 함께 느려졌어요.`
          : `최근 6개월, 새 고객과 계약의 리듬이 함께 느려졌어요.`,
        cust
          ? `고객 자산은 그대로예요 — <b>${cust}분</b>이 하이플래너님을 기억하고 있어요.`
          : `고객 자산은 그대로예요 — 지금까지 만난 고객들이 하이플래너님을 기억하고 있어요.`,
        `큰 목표 대신, <b>매주 정한 요일에 기존 고객 3분께 안부 연락</b> — 이 한 가지로 리듬을 되찾습니다.`,
      )
    // 균형성장형(기본)
    const bg = goals[0]
    return L(
      `어느 지표도 치우침 없이 동일그룹을 고르게 앞서고 있어요.`,
      convPctL
        ? `약점을 메우는 단계는 지났다는 뜻이에요 — 남은 건 TC까지의 마지막 간격(환산 기준 <b>${convPctL}%</b>)이에요.`
        : `약점을 메우는 단계는 지났다는 뜻이에요 — 남은 건 TC까지의 마지막 간격이에요.`,
      bg
        ? `가장 간격이 큰 <b>${bg.ex?.metric || '핵심 지표'} 하나만 골라 90일 동안 집중합니다.</b>`
        : `가장 간격이 큰 <b>지표 하나만 골라 90일 동안 집중합니다.</b>`,
    )
  })()

  return { metrics, momentum, strengthIds, strengths, bottlenecks, noHardBottleneck, type, goals, truth, lesson }
}

function divSafe(a: number | null, b: number | null): number | null {
  return isNum(a) && isNum(b) && b !== 0 ? a / b : null
}
function minSafe(a: number | null, b: number | null): number | null {
  if (!isNum(a)) return b
  if (!isNum(b)) return a
  return Math.min(a, b)
}
/** relGap 은 %(백분율)로 반환하지만, 이 자리(원본 CQ31/N16 연계율 %p 표기)는
 *  ppGap 과 같은 %p 차이가 필요하다 — 원본 원문대로 (me-tc) 를 그대로 넘긴다. */
function relDiff(me: number | null, tc: number | null): number | null {
  return isNum(me) && isNum(tc) ? me - tc : null
}
