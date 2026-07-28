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
  if (!isNum(me) || !isNum(dg) || !isNum(tc)) return 'na'
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
  oneliner: string
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
    body: `자동차보험의 90%를 대면으로 체결하며, 방문 때마다 정액담보 조회자료에 형광펜으로 보장 공백을 표시해 보여주는 루틴으로 자동차를 장기보험의 뿌리로 만들었습니다. 개척 고객이 소개 고객보다 유지율과 추가 계약률이 높았다는 관찰도 남겼습니다.`,
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
      title: '신규고객 개척력',
      num: `월 ${f2(F.newCust.me)}명 · TC그룹 대비 ${relTxt(rr)}`,
      desc:
        `동일그룹(${f2(F.newCust.dg)}명)의 ${f1(divSafe(F.newCust.me, F.newCust.dg))}배, TC그룹(${f2(F.newCust.tc)}명)의 ${f1(divSafe(F.newCust.me, F.newCust.tc))}배입니다. ` +
        (F.transferLong.me === 0
          ? `이관고객 0명 — 장기고객 ${f1(F.custLong.me)}명 전원을 자력으로 만든 순수 개척 기반입니다. `
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
      desc: `활동량 자체는 이미 TC급입니다. 부족한 것은 '더 많이'가 아니라 활동이 성과로 이어지는 전환 과정입니다.`,
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
    const near = Object.entries(metrics).filter(([, mt]) => isNum(mt.me) && isNum(mt.dg) && mt.dg !== 0)
    near.sort((x, y) => Math.abs(relGap(x[1].me, x[1].dg) ?? 99) - Math.abs(relGap(y[1].me, y[1].dg) ?? 99))
    near.slice(0, 2).forEach(([k, mt]) =>
      S.push({
        id: 'near_' + k,
        score: 5,
        title: mt.label,
        num: `${fm(k, mt.me)} · 동일그룹과의 간격 ${relTxt(relGap(mt.me, mt.dg))}`,
        desc: `동일그룹과 가장 가까이 있는 지표예요. 모든 지표를 한 번에 올릴 필요는 없어요 — 첫 번째 승리를 만들 자리는 여기예요.`,
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
      q: `데이터가 말하는 건 개척 부족이 아니라 <b>후속상담·관계심화의 성장 공간</b>이에요. 정확한 이유는 코칭 대화에서 함께 확인해요.`,
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
    B.push({
      id: 'coverage',
      score: Math.abs(relGap(F.premPer.me, F.premPer.tc) || 0) * 0.9,
      title: '보장 깊이',
      num: `인당 월납 ${wonK(F.premPer.me)} vs TC ${wonK(F.premPer.tc)} (${relTxt(relGap(F.premPer.me, F.premPer.tc))})`,
      desc: `건당 ${wonK(F.premCase.me)}(TC ${wonK(F.premCase.tc)}), 최고보험료 ${wonK(F.premMax.me)}(TC ${wonK(F.premMax.tc)}). 최근 6개월 신계약 기준 암 주요치료비 부보율은 ${pctFmt(M.cancerRate.me)}로 동일그룹(${pctFmt(M.cancerRate.dg)})·TC(${pctFmt(M.cancerRate.tc)}) 모두에 미달합니다.`,
      q: `함께 확인해 볼 질문 — <b>상담을 진단비 중심으로 마무리하고, 치료과정 담보 제안을 생략하는 패턴이 있을까요?</b>`,
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
      num: `월 신규 ${f2(F.newCust.me)}명 vs 동일그룹 ${f2(F.newCust.dg)}명 · TC ${f2(F.newCust.tc)}명`,
      desc: `고객 기반(${f1(F.custTotal.me)}명)은 탄탄한데, 새 고객이 더해지는 속도가 느려졌어요. 지금의 깊은 고객관계는 소개가 나오기 가장 좋은 토양이에요.`,
      q: `함께 확인해 볼 질문 — <b>만족한 고객에게 소개를 요청하는 나만의 한 문장이 있을까요?</b>`,
    })
  }
  if (metrics.moLong.cls === 'bottleneck' && metrics.perCust.cls !== 'bottleneck') {
    B.push({
      id: 'activity',
      score: Math.abs(relGap(M.moLong.me, M.moLong.tc) || 0),
      title: '활동 리듬',
      num: `월 장기건수 ${f1(M.moLong.me)}건 vs 동일그룹 ${f1(M.moLong.dg)}건 · TC ${f1(M.moLong.tc)}건`,
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
        desc: `동일그룹은 이미 넘어섰어요. 이제 남은 것은 능력이 아니라 <b>습관의 문제</b>입니다.`,
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
      name: '고객개척 강점형',
      desc:
        `신규고객 유입(월 ${f2(F.newCust.me)}명)이 동일그룹·TC그룹을 압도합니다.` +
        (F.transferLong.me === 0 ? ` 이관 없이 자력으로 만든 개척 기반이라 접점이 마르지 않는 유형입니다.` : ''),
    })
  }
  if (isNum(M.simpleCntPct.me) && isNum(M.simpleCntPct.tc) && M.simpleCntPct.me - M.simpleCntPct.tc > 0.15) {
    types.push({
      name: '상품편중형(주력상품 중심)',
      desc: `신계약의 건수 ${pctFmt(M.simpleCntPct.me)}·보험료 ${pctFmt(M.simplePremPct.me)}가 간편에 집중되어 있습니다. 잘 팔리는 상품을 못 팔게 할 이유는 없습니다 — 간편을 입구상품으로 쓰고, 그 뒤의 보장확장과 자동차 연계로 이어가면 소득 구조가 달라지는 유형입니다.`,
    })
  }
  if (metrics.perCust.cls === 'bottleneck' && isNum(F.custLong.me) && isNum(F.custLong.dg) && F.custLong.me >= F.custLong.dg) {
    types.push({
      name: '관계심화 필요형',
      desc: `고객은 충분한데 고객당 계약 깊이(${f2(F.perCust.me)}건)가 얕습니다. 만난 고객과의 두 번째·세 번째 계약이 성장 열쇠입니다.`,
    })
  }
  if (metrics.linkRate.cls === 'bottleneck' && isNum(F.longSoloRate.me) && F.longSoloRate.me > 0.85) {
    types.push({
      name: '장기 집중형',
      desc: `장기영업이 강한 유형입니다(장기 단독 ${pctFmt(F.longSoloRate.me)}). 현재의 장기 접점을 자동차 만기정보와 가족계약으로 연결하면 소득 확장 가능성이 큽니다.`,
    })
  }
  if (metrics.moLong.cls !== 'bottleneck' && metrics.perCust.cls === 'bottleneck') {
    types.push({
      name: '활동대비 저전환형',
      desc: `활동량은 TC급인데 전환(고객당 건수·단가)이 약합니다. 활동을 늘리기보다 활동이 성과로 이어지는 과정을 손봐야 하는 유형입니다.`,
    })
  }
  if (metrics.premPer.cls === 'bottleneck' && metrics.perCust.cls !== 'bottleneck') {
    types.push({
      name: '보장심화형',
      desc: `계약 수는 따라가지만 보장의 깊이(인당·건당 보험료)가 약합니다. 보장분석과 설계 깊이가 성장 열쇠입니다.`,
    })
  }
  if (metrics.premPer.cls === 'strategic' && metrics.cancerRate.cls === 'strategic') {
    types.push({
      name: '고보장 설계형',
      desc: `계약 한 건의 보장 깊이(인당 ${wonK(F.premPer.me)}, 암 부보율 ${pctFmt(M.cancerRate.me)})가 상위권이에요. 이 설계력이 소개와 신규 유입으로 이어지도록 접점을 넓히는 것이 다음 단계예요.`,
    })
  }
  if (metrics.moLong.cls === 'bottleneck' && metrics.newCust.cls === 'bottleneck' && metrics.perCust.cls !== 'bottleneck') {
    types.push({
      name: '활동리듬 회복형',
      desc: `상담의 질과 전환력은 이미 검증되어 있어요. 활동의 양과 리듬을 회복하면 성과가 가장 빠르게 반응하는 유형이에요.`,
    })
  }
  if (types.length === 0) {
    types.push({ name: '균형성장형', desc: '뚜렷한 편중 없이 고르게 성장 중입니다. 가장 격차가 큰 한 지표에 집중하면 TC 진입이 앞당겨집니다.' })
  }
  const type = { main: types[0], sub: types[1] ?? null }

  // ── 90일 목표 ──────────────────────────────────────────────────────
  const G: CoachGoal[] = []
  if (bottlenecks.find((b) => b.id === 'depth')) {
    const addTarget = isNum(M.oldCnt6.me) ? Math.max(Math.round(M.oldCnt6.me) + 1, 4) : 4
    const cancerTarget = isNum(M.cancerRate.me) && isNum(M.cancerRate.tc) ? Math.round((M.cancerRate.me + (M.cancerRate.tc - M.cancerRate.me) * 0.6) * 20) / 20 : null
    G.push({
      id: 'depth',
      score: 100,
      title: "기존고객 '두 번째 계약' 만들기 — 보장점검 재상담",
      point: `신규 개척이 아닌, 이미 확보한 장기고객 ${f1(F.custLong.me)}명에서 고객당 계약 깊이를 높이는 전환`,
      now: `고객당 ${f2(F.perCust.me)}건 · 기존고객 추가계약 월 ${f2(M.oldCnt6.me)}건 · 암 주요치료비 부보율 ${pctFmt(M.cancerRate.me)}`,
      d30: `단독 1건·주력상품 가입고객 중 점검대상 <b>20명 리스트 확정</b>, 점검상담 <b>8명</b> 완료`,
      d90: `기존고객 추가계약 <b>${addTarget * 3}건(월 ${addTarget}건)</b>` + (cancerTarget ? `, 신계약 암 주요치료비 부보율 <b>${pctFmt(cancerTarget)} 수준</b>` : ''),
      week: `매주 <b>5명</b>에게 '보장 점검' 명분 연락(판매 아님을 먼저 선언) → 점검상담 <b>2건</b> 약속`,
      measure: `리스트 → 연락 → 점검상담 → 추가계약 4단계 인원을 주 단위 기록, 매주 금요일 점검`,
      ex: {
        reason: '새 고객을 만나는 건 자신 있는데, 이미 만난 고객을 다시 챙기는 일을 놓치고 있었다는 게 숫자로 보여서',
        act: '보장 점검 상담',
        action: '간편·단독 1건 고객 5명에게 보장 점검 연락, 점검상담 2건 약속',
        metric: '고객당 계약 건수',
        from: `${f2(F.perCust.me)}건`,
        to: `${f2(isNum(F.perCust.me) ? Math.round((F.perCust.me + 0.3) * 100) / 100 : null)}건`,
      },
      why: `500만원 진입에 필요한 것은 더 많은 고객이 아니라 <b>고객당 소득</b>입니다. 고객 기반과 활동량이 이미 상위권이므로, 고객당 건수 격차가 좁혀지는 만큼 소득이 가장 빠르게 반응하는 구조입니다. 주력상품 고객의 치료과정 보장 공백 점검은 고객가치 관점에서도 우선입니다.`,
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
      point: `장기 단독고객 ${soloLong ? f1(soloLong) + '명' : ''}을 자동차 만기 접점으로 연결해 매년 반복되는 만남 구조 확보`,
      now: `자동차고객 ${f1(F.custCar.me)}명 · 연계고객 ${f1(F.custLink.me)}명 · 연계율 ${pctFmt(F.linkRate.me)} · 월 자동차 ${f1(M.moCar.me)}건`,
      d30: `자동차 <b>만기월 정보 30명 확보</b> (계약 목표가 아니라 정보 목표)`,
      d90: `자동차 <b>월 ${carMo}~${carMo + 1}건</b>, 장기·자동차 연계고객 <b>${f1(F.custLink.me)}명 → ${f1(isNum(F.custLink.me) ? F.custLink.me + linkAdd : null)}명(+${linkAdd})</b>`,
      week: `장기고객 <b>5명</b>에게 본인·가족 차량 보유 여부, 현재 보험사, 만기월 확인 (고객정보 정비·가족 위험점검 명분)`,
      measure: `정보확보 → 견적 → 상담 → 계약 단계별 인원 기록`,
      ex: {
        reason: '장기 고객 접점은 강한데 자동차가 비어 있어, 매년 다시 만날 명분부터 만들고 싶어서',
        act: '자동차 만기 확인',
        action: '장기고객 5명에게 차량 보유·만기월 확인',
        metric: '장기·자동차 연계고객',
        from: `${f1(F.custLink.me)}명`,
        to: `${f1(isNum(F.custLink.me) ? F.custLink.me + linkAdd : null)}명`,
      },
      why: `TC그룹과의 최대 절대격차 영역이면서, 보장점검 상담 자리에서 <b>만기월 한 줄만 물어도 실행되는</b> 낮은 비용의 목표입니다. TC 연계율 즉시 도달이 아니라 연계고객 +${linkAdd}명이 현실적인 중간목표입니다.`,
      hero: 'car',
    })
  }
  if (bottlenecks.find((b) => b.id === 'coverage') && !G.find((g) => g.id === 'depth')) {
    G.push({
      id: 'coverage',
      score: 80,
      title: '보장 깊이 높이기 — 치료과정 담보 제안 습관화',
      point: `계약 수가 아니라 계약 1건의 보장가치를 높이는 전환`,
      now: `인당 월납 ${wonK(F.premPer.me)} · 건당 ${wonK(F.premCase.me)} · 암 부보율 ${pctFmt(M.cancerRate.me)}`,
      d30: `모든 신규 상담에 <b>암 주요치료비·심뇌 담보 점검 단계</b>를 넣고 제안 여부 기록 시작`,
      d90: `신계약 암 주요치료비 부보율 <b>동일그룹 수준(${pctFmt(M.cancerRate.dg)})</b> 접근, 신계약 건당 보험료 <b>${wonK(M.premCase6.tc)} 수준(TC)</b> 접근`,
      week: `주간 신계약 전건에 대해 '치료과정 보장 제안 여부' 셀프 체크`,
      measure: `신계약 건별 부보 담보 기록, 월 단위 부보율 산출`,
      ex: {
        reason: '계약 수보다 계약 한 건의 깊이가 소득을 좌우한다는 걸 확인해서',
        act: '치료과정 담보 점검',
        action: '신규 상담 전건에 암·심뇌 담보 점검 단계 포함',
        metric: '암 주요치료비 부보율',
        from: pctFmt(M.cancerRate.me),
        to: pctFmt(M.cancerRate.dg),
      },
      why: `활동량 대비 단가가 낮은 구조에서는 활동 추가보다 <b>설계 깊이</b>가 소득에 직결됩니다.`,
      hero: 'depth',
    })
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
      d90: `월 신규고객 <b>${f2(minSafe(F.newCust.dg, F.newCust.tc))}명 수준</b>(동일그룹) 회복`,
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
      why: `동일그룹은 이미 넘어섰어요. 남은 것은 능력이 아니라 <b>습관의 문제</b>입니다.`,
      hero: 'care',
      ex: { reason: '약점이 아니라 상위 그룹과의 마지막 간격만 남았다는 걸 확인해서', act: '주간 핵심 행동', action: '지표와 연결된 주간 행동 1개 고정', metric: lbl, from: '', to: '' },
    })
  }
  if (G.length === 1) {
    const lv = Object.entries(metrics).filter(([, mt]) => mt.cls === 'levelup' && isNum(mt.tc) && mt.tc !== 0)
    lv.sort((x, y) => Math.abs(relGap(y[1].me, y[1].tc) || 0) - Math.abs(relGap(x[1].me, x[1].tc) || 0))
    if (lv.length) {
      const [, mt] = lv[0]
      G.push({
        id: 'levelup2',
        score: 1,
        title: `TC 마지막 간격 좁히기 — ${mt.label}`,
        point: `약점 보완이 아닌, 상위 그룹 진입을 위한 마지막 간격 관리`,
        now: `${fm('', mt.me)} (동일그룹 ${fm('', mt.dg)} · TC ${fm('', mt.tc)})`,
        d30: `이 지표를 만드는 <b>주간 행동 1개</b>를 정해 4주 유지`,
        d90: `TC그룹과의 간격 <b>절반 좁히기</b>`,
        week: `선택한 주간 행동의 실행 여부 체크`,
        measure: `주 단위 실행 기록, 월 단위 지표 확인`,
        why: `동일그룹은 이미 넘어선 지표예요. 남은 것은 능력이 아니라 <b>습관의 문제</b>입니다.`,
        hero: 'care',
        ex: { reason: '약점이 아니라 상위 그룹과의 마지막 간격만 남았다는 걸 확인해서', act: '주간 핵심 행동', action: '지표와 연결된 주간 행동 1개 고정', metric: mt.label, from: '', to: '' },
      })
    }
  }
  const goals = [...G].sort((x, y) => y.score - x.score).slice(0, 2)

  // ── 한 줄 진단 ─────────────────────────────────────────────────────
  const s0 = strengths[0]
  const g0 = goals[0]
  const notThis = g0
    ? g0.id === 'depth'
      ? '새로운 고객을 더 많이 만나는 것'
      : g0.id === 'car'
        ? '장기 활동을 더 늘리는 것'
        : g0.id === 'coverage'
          ? '계약 건수를 더 쌓는 것'
          : '기존 방식을 반복하는 것'
    : '더 많이 활동하는 것'
  const useThis = s0 ? s0.title + (s0.id === 'prospect' && isNum(F.newCust.me) && isNum(F.newCust.tc) ? `(월 ${f2(F.newCust.me)}명, TC의 ${f1(divSafe(F.newCust.me, F.newCust.tc))}배)` : '') : '현재의 강점'
  const toThis = g0
    ? g0.id === 'depth'
      ? "'한 고객과의 두 번째 계약'과 '보장의 깊이'"
      : g0.id === 'car'
        ? "'매년 만나는 자동차 접점'과 '연계고객'"
        : g0.id === 'coverage'
          ? "'계약 1건의 보장가치'"
          : "'반복 가능한 고객 접점'"
    : '다음 단계 성과'
  const oneliner = `당신의 핵심 포인트는 ${notThis}이 아니라, 이미 잘하고 있는 <u>${useThis}</u>을 활용해 <u>${toThis}</u>로 전환하는 것입니다.`

  return { metrics, momentum, strengthIds, strengths, bottlenecks, noHardBottleneck, type, goals, oneliner }
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
