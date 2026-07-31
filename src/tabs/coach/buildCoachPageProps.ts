/* ══════════════════════════════════════════════════════════════════════
   성장코칭 리포트의 강점/병목/영업유형/90일 목표 등 서술 문구 조립부.
   GrowthCoachTab(화면)과 CoachPrintRootForPerson(일괄 인쇄) 양쪽이
   완전히 같은 문구를 만들도록 공용 순수 함수로 뺐다.

   원본 v18 은 렌더 후 DOM 을 훑어 문장 끝마다 <br> 을 넣는다
   (applySentenceBreaks). React 가 관리하는 DOM 의 innerHTML 을 건드릴 수
   없으므로, 같은 정규식을 **문자열 생성 시점**에 같은 대상 필드에만
   적용한다(sb) — 결과 HTML 은 동일하다.
   ══════════════════════════════════════════════════════════════════════ */

import type { FullAnalysis } from '../../calc'
import { buildCoachData } from '../../calc/coach'
import { analyzeCoach, f0, f1, f2, isNum, pctFmt, wonK, HEROES } from '../../calc/coachAnalyze'
import type { CoachEdits } from './Editable'
import type { CoachPageProps, CoachInsight } from './types'

export function incomeBand(v: string): string {
  return String(v ?? '').replace('이상', ' 구간')
}

/* 원본 applySentenceBreaks() 의 정규식 — 문장이 끝나면 줄바꿈 */
const SB_RX = /([.!?])\s+(?=[가-힣'"“‘<(A-Z0-9])/g
const sb = (h: string) => h.replace(SB_RX, '$1<br>')

export function buildCoachPageProps(
  A: FullAnalysis,
  caption: string,
  edits: CoachEdits,
  onCommit: (id: string, html: string) => void,
  showCoachGuide: boolean,
  /** 강사용 가이드 3장만 뽑을 때 (앞 페이지 생략) */
  guideOnly = false,
): CoachPageProps {
  const d = buildCoachData(A, caption)
  const r = analyzeCoach(d)

  const F = d.full
  const M = d.m6
  const b = d.basic
  const name = b.name

  /* 문장 줄바꿈 — 원본 SEL 에 해당하는 필드에만 적용 (r 은 이 호출에서 만든
     새 객체라 제자리 수정해도 안전하다) */
  r.strengths.forEach((s) => (s.desc = sb(s.desc)))
  r.bottlenecks.forEach((bn) => {
    bn.desc = sb(bn.desc)
    if (bn.q) bn.q = sb(bn.q)
  })
  r.type.main.desc = sb(r.type.main.desc)
  if (r.type.sub) r.type.sub.desc = sb(r.type.sub.desc)
  r.goals.forEach((g) => {
    g.point = sb(g.point)
    g.now = sb(g.now)
    g.d30 = sb(g.d30)
    g.d90 = sb(g.d90)
    g.week = sb(g.week)
    g.measure = sb(g.measure)
    g.why = sb(g.why)
  })
  r.truth.shadow = sb(r.truth.shadow)
  r.truth.opp.html = sb(r.truth.opp.html)
  r.lesson.now = sb(r.lesson.now)
  r.lesson.str = sb(r.lesson.str)
  r.lesson.next = sb(r.lesson.next)

  const dgBand = incomeBand(b.incomeRaw) || '동일소득 구간'
  const BASE_ALL = `기준: 전체 누적 · 단위: 명/건/원 · 비교: 동일그룹(${dgBand})·TC 표준그룹`
  const BASE_6 = `기준: ${b.periodLabel} 월평균 · 비교: 동일그룹(${dgBand})·TC 표준그룹`
  const sub1 = `기준 ${b.caption.replace(/[()]/g, '')} · 전체 누적 + ${b.periodLabel} · 비교: 동일그룹(${dgBand}) · TC 표준그룹`

  const hasDepth = r.bottlenecks.some((x) => x.id === 'depth')
  const hasCar = r.bottlenecks.some((x) => x.id === 'car')
  const hasCoverage = r.bottlenecks.some((x) => x.id === 'coverage')
  const hasProspecting = r.bottlenecks.some((x) => x.id === 'prospecting')
  const pctCust = isNum(F.custLong.me) && isNum(F.custLong.tc) ? Math.round((F.custLong.me / F.custLong.tc) * 100) : null
  const pctCnt = isNum(F.cntLong.me) && isNum(F.cntLong.tc) ? Math.round((F.cntLong.me / F.cntLong.tc) * 100) : null
  const bflyPattern = isNum(M.newCust6.me) && isNum(M.newCust6.tc) && M.newCust6.me > M.newCust6.tc && isNum(M.oldCnt6.me) && isNum(M.oldCnt6.tc) && M.oldCnt6.me < M.oldCnt6.tc
  const carWorst = hasCar && isNum(M.moCar.me) && isNum(M.moCar.tc) && M.moCar.tc - M.moCar.me >= 4

  const ins = (h: string, p: string): CoachInsight => ({ h, p: sb(p) })

  const insKpi =
    hasDepth && pctCust && pctCnt
      ? ins(`고객은 TC그룹의 ${pctCust}%인데, 계약은 ${pctCnt}%입니다`, `고객 기반과 신규 유입은 이미 상위권이에요. 지금 소득 차이를 만드는 건 한 고객과의 계약 깊이예요. 아래 활동 구조 비교에서 어느 활동이 앞서고 있는지 함께 확인해 보세요.`)
      : hasProspecting
        ? ins(`지금 필요한 것은 전환이 아니라, 고객 접점 그 자체입니다`, `고객 기반이 동일그룹에 아직 미치지 못해요. 아래 지표에서 접점 규모부터 함께 확인해 보세요.`)
        : r.noHardBottleneck
          ? ins(`동일그룹은 모두 넘어섰습니다 — 이제 TC와의 마지막 간격이에요`, `각 카드의 아래 칸은 전체 누적과 최근 6개월의 차이예요.`)
          : ins(`핵심 지표로 본 나의 현재 위치입니다`, `각 카드의 아래 칸은 전체 누적과 최근 6개월의 차이예요.`)

  const insBfly = bflyPattern
    ? ins(`앞은 강하고, 뒤에 성장 공간이 있어요`, `신규고객을 만나는 활동은 TC그룹보다 강해요. 반면 이미 만난 고객과의 재상담·추가계약에 성장 공간이 있어요. '기회' 표시가 붙은 줄이 90일 목표가 겨냥하는 지점이에요.`)
    : null

  const insVs = r.strengths.some((s) => s.id === 'prospect')
    ? ins(`신규 고객발굴은 이미 TC그룹을 앞서 있습니다 — 간격은 전환 지표에 있습니다`, `막대의 길이보다 '고객 대비 계약'의 간격을 봐 주세요. 주황 표시는 성장 기회가 가장 큰 곳이에요.`)
    : ins(`동일그룹·TC그룹과 나의 위치를 막대 길이로 비교했습니다`, `주황 표시는 성장 기회가 가장 큰 곳이에요.`)

  const insFlow =
    r.momentum !== null && r.momentum > 0.5
      ? ins(`흐름은 좋습니다 — 최근 두 달, 월 활동량이 TC그룹을 넘어섰습니다`, `이 상승 흐름을 새 고객이 아니라, 이미 만난 고객에게 돌려보는 것이 다음 단계예요.`)
      : ins(`두 개의 비율과 월별 흐름이 다음 성장의 공간을 보여줍니다`, `링의 채워진 만큼이 나의 현재이고, 파란 칩이 TC그룹의 위치예요.`)

  const insStrength = r.strengths.length
    ? ins(`이것은 TC그룹도 부러워할 무기입니다`, `약점을 고치기 전에, 이 무기를 어디에 쓸지 먼저 정하는 것이 이 코칭의 순서예요.`)
    : null

  const insBottle = hasDepth
    ? ins(`더 필요한 건 고객이 아니라, 한 고객과의 '두 번째 계약'이에요`, `성장 포인트는 약점이 아니라, 다음 성장이 숨어 있는 자리예요. 점선 상자는 코칭에서 함께 이야기할 질문이에요.`)
    : hasProspecting
      ? ins(`영업의 시작인 고객 접점부터 넓혀야 합니다`, `성장 포인트는 약점이 아니라, 다음 성장이 숨어 있는 자리예요.`)
      : hasCar
        ? ins(`매년 다시 만날 명분, 자동차 접점이 비어 있습니다`, `성장 포인트는 약점이 아니라, 다음 성장이 숨어 있는 자리예요.`)
        : hasCoverage
          ? ins(`계약의 개수보다 계약 한 건의 깊이를 볼 차례입니다`, `성장 포인트는 약점이 아니라, 다음 성장이 숨어 있는 자리예요.`)
          : r.bottlenecks.some((x) => x.id === 'inflow')
            ? ins(`기반은 탄탄합니다 — 새 고객이 더해지는 리듬만 살리면 됩니다`, `깊은 고객관계는 소개가 나오기 가장 좋은 토양이에요.`)
            : r.bottlenecks.some((x) => x.id === 'activity')
              ? ins(`전환력은 검증됐습니다 — 이제 횟수를 곱할 차례예요`, `상담 슬롯을 고정하면 지금의 전환력이 그대로 소득으로 이어져요.`)
              : r.noHardBottleneck
                ? ins(`약점이 아니라, 상위 그룹과의 마지막 간격만 남았어요`, `동일그룹은 모두 넘어섰어요. 지금부터는 보완이 아니라 진입의 문제예요.`)
                : null

  const premDrop = isNum(F.premPer.me) && isNum(M.premPer6.me) && M.premPer6.me < F.premPer.me * 0.85
  const premPerK = isNum(F.premPer.me) ? Math.round(F.premPer.me / 1000).toLocaleString('ko-KR') : '확인 필요'

  const trendMsg = sb(
    r.momentum !== null && r.momentum > 0.5
      ? `최근으로 올수록 계약이 늘고 있어요 — <b>성장의 흐름이 살아 있어요.</b> 이 흐름을 기존 고객 재상담으로 연결하는 것이 다음 단계예요.`
      : `월별 흐름을 TC그룹과 비교해 보세요. 흐름이 꺾인 달의 활동을 함께 되짚어 보는 것이 출발점이에요.`,
  )

  /* 그룹 비교 4카드 메시지/콜아웃 (신규고객 · 장기건수 · 자동차 · 인당보험료) */
  const premBehindDg = isNum(F.premPer.me) && isNum(F.premPer.dg) && F.premPer.me < F.premPer.dg
  const vsMsgs: (string | null)[] = [
    isNum(F.newCust.me) && isNum(F.newCust.tc) && F.newCust.me > F.newCust.tc
      ? sb(`새 고객을 만나는 힘은 이미 <b>TC그룹을 앞서 있어요.</b> 이 힘은 그대로 지켜가면 돼요.`)
      : null,
    sb(
      `장기고객은 ${f1(F.custLong.me)}명으로 TC(${f1(F.custLong.tc)}명)의 ${pctCust ?? '-'}%인데, 계약 건수는 ${f1(F.cntLong.me)}건으로 TC(${f1(F.cntLong.tc)}건)의 ${pctCnt ?? '-'}%입니다. <b>고객이 더 필요한 게 아니라, 고객 한 분과의 계약이 아직 얕은 것뿐이에요.</b>`,
    ),
    carWorst ? sb(`TC그룹과 간격이 가장 큰 영역이에요. 자동차는 <b>매년 다시 만나는 명분</b>이 되어 주는 접점이에요.`) : null,
    premBehindDg
      ? sb(`보험료 규모는 동일그룹에도 아직 미치지 못해요. 계약을 늘리는 것과 함께 <b>계약 1건의 보장 깊이</b>를 같이 보면 좋아요.`)
      : null,
  ]
  const vsCallouts: (string | undefined)[] = [
    undefined,
    hasDepth ? '성장 기회' : undefined,
    carWorst ? '가장 큰 성장 기회' : undefined,
    premBehindDg ? '함께 볼 지점' : undefined,
  ]

  const ringDescs = {
    link: sb(
      `장기고객 100명 중 자동차까지 함께하는 고객이 <b>${isNum(F.linkRate.me) ? Math.round(F.linkRate.me * 100) : '-'}명</b>이라는 뜻이에요. TC그룹은 ${isNum(F.linkRate.tc) ? Math.round(F.linkRate.tc * 100) : '-'}명이에요.`,
    ),
    cancer: sb(
      `최근 6개월 새 계약 10건 중 암 치료과정 보장이 담긴 계약이 <b>약 ${isNum(M.cancerRate.me) ? Math.round(M.cancerRate.me * 10) : '-'}건</b>이라는 뜻이에요.`,
    ),
  }

  /* 코호트 페이지 메시지 — d.cohort 없으면 null(페이지 숨김) */
  let coMsg: string | null = null
  if (d.cohort) {
    const ct = d.cohort
    const ref = ct.tc || ct.all
    const refName = ct.tc
      ? `같은 차월대(${ct.band})에서 TC 소득을 만든 ${ct.tc.n}명`
      : `같은 차월대 전체 ${ct.all.n.toLocaleString()}명`
    const aheadL = isNum(F.custLong.me) && F.custLong.me >= ref.L
    coMsg = sb(
      `TC 표준그룹은 평균 <b>${f1(ct.tcAvgYears)}년차</b> 그룹이에요 — 그 숫자를 지금의 기준으로 삼을 필요는 없어요. ${refName}의 평균 장기고객은 <b>${f1(ref.L)}명</b>. ${aheadL ? `하이플래너님은 이미 이 기준을 넘어, <b>연차 대비 TC 트랙 위</b>에 있어요.` : `지금 따라잡을 기준은 ${f1(F.custLong.tc)}명이 아니라 <b>이 숫자</b>예요.`}${isNum(ct.top) ? ` 같은 차월대 전체에서 장기고객 기준 <b>상위 ${ct.top}%</b>예요.` : ''}`,
    )
  }

  const heroIds = [...new Set(r.goals.map((g) => g.hero))].slice(0, 2)
  const heroes = heroIds.map((id) => ({ ...HEROES[id], body: sb(HEROES[id].body), apply: sb(HEROES[id].apply) }))

  const howto: string[] = []
  if (r.goals.find((g) => g.id === 'depth')) {
    howto.push(`단독 1건·주력상품 고객 중 최근 1년 접점 있는 고객 <b>20명 리스트</b> 작성`)
    howto.push(`그중 <b>5분께 점검 문자</b> 발송 — "상품 권유가 아니라 보장 점검입니다" 문구 포함`)
    howto.push(`<b>점검상담 약속 2건</b> 확정`)
  }
  if (r.goals.find((g) => g.id === 'car')) howto.push(`장기고객 <b>5분</b>께 본인·가족 차량 보유 여부와 <b>만기월 확인</b>`)
  if (r.goals.find((g) => g.id === 'prospecting')) howto.push(`고정 거점 2곳 정하고 첫 방문 <b>2회</b>`)
  if (r.goals.find((g) => g.id === 'coverage'))
    howto.push(
      r.metrics.cancerRate.cls === 'bottleneck'
        ? `이번 주 신규 상담 전건에 <b>치료과정 담보 점검 단계</b> 포함`
        : `이번 주 신규 상담 전건에 <b>납입 여력 확인·증액 제안 단계</b> 포함`,
    )
  if (r.goals.find((g) => g.id === 'inflow')) {
    howto.push(`만족도 높은 고객 <b>10명 리스트</b> 작성`)
    howto.push(`상담 마무리에 <b>소개 한 문장</b> 2회 시도`)
  }
  if (r.goals.find((g) => g.id === 'activity')) howto.push(`주간 <b>상담 슬롯 3개</b>(요일·시간)를 캘린더에 먼저 고정`)
  if (r.goals.find((g) => g.id === 'levelup')) howto.push(`간격 지표와 연결된 <b>주간 행동 1개</b> 정하기`)
  howto.push(`금요일: 리스트–연락–상담–계약 <b>단계별 숫자 기록</b> 점검`)

  /* ── 강사용 (C1~C7, 원본 v18 문구) ──────────────────────────────── */
  const camsFacts = [
    `<span class="ck">C</span><b>고객 — 고객 기반이 얼마나 넓고, 새 고객이 얼마나 더해지는가</b><br>총 유지고객은 <b>${f1(F.custTotal.me)}명</b>(동일그룹 ${f1(F.custTotal.dg)}명 · TC그룹 ${f1(F.custTotal.tc)}명)이고, 매달 새로 만나는 고객은 <b>${f2(F.newCust.me)}명</b>입니다. 장기 이관고객은 ${f1(F.transferLong.me)}건인데 TC그룹 평균은 ${f1(F.transferLong.tc)}건입니다.<span class="cread">→ TC그룹의 고객 수에는 이관분이 섞여 있습니다. 이 플래너의 기반이 자력이라면 그 점을 먼저 인정해 주세요.</span>`,
    `<span class="ck">A</span><b>활동 — 얼마나 자주 만나고, 만남이 계약으로 이어지는가</b><br>고객 한 분당 계약은 <b>${f2(F.perCust.me)}건</b>(동일그룹 ${f2(F.perCust.dg)}건 · TC그룹 ${f2(F.perCust.tc)}건)입니다. 최근 6개월 기준, 신규고객 상담은 월 ${f2(M.newCust6.me)}명(TC ${f2(M.newCust6.tc)}명)인데 기존고객 추가계약은 월 ${f2(M.oldCnt6.me)}건(TC ${f2(M.oldCnt6.tc)}건)입니다. 월 장기건수는 ${f1(M.moLong.me)}건, 자동차는 ${f1(M.moCar.me)}건(TC ${f1(M.moCar.tc)}건)이고, 장기건수 흐름은 ${d.monthly.map((m) => f1(m.me)).join(' → ')}건입니다.<span class="cread">→ 앞단(새 고객)과 뒷단(기존 고객)의 균형을 보세요. 어느 쪽이 약한지가 코칭의 방향입니다.</span>`,
    `<span class="ck">M</span><b>시장 — 어떤 상품과 접점으로 영업하고 있는가</b><br>장기 단독 비중 ${pctFmt(F.longSoloRate.me)}(TC ${pctFmt(F.longSoloRate.tc)}), 자동차 연계율 ${pctFmt(F.linkRate.me)}입니다. 간편(주력) 상품은 건수의 ${pctFmt(M.simpleCntPct.me)}, 보험료의 ${pctFmt(M.simplePremPct.me)}를 차지합니다. 실손은 ${f1(F.silsonCnt.me)}건으로 보이지만(TC 평균 ${f1(F.silsonCnt.tc)}건) 자사 계약만 집계된 숫자입니다.<span class="cread">→ 실손은 "없다"가 아니라 "타사 보유 여부를 우리가 모른다"입니다. 상담에서 확인 질문으로 풀어 주세요.</span>`,
    `<span class="ck">S</span><b>기술 — 계약 한 건을 얼마나 깊게 설계하는가</b><br>인당 월납 ${wonK(F.premPer.me)}, 건당 ${wonK(F.premCase.me)}, 최고 ${wonK(F.premMax.me)}입니다(TC그룹은 각각 ${wonK(F.premPer.tc)} · ${wonK(F.premCase.tc)} · ${wonK(F.premMax.tc)}). 최근 6개월 신계약의 암 주요치료비 부보율은 ${pctFmt(M.cancerRate.me)}(동일그룹 ${pctFmt(M.cancerRate.dg)} · TC ${pctFmt(M.cancerRate.tc)}), 심뇌는 ${pctFmt(M.brainRate.me)}입니다.<span class="cread">→ 보험료 숫자보다 '한 건의 보장 범위'를 대화 소재로 삼는 편이 저항이 적습니다.</span>`,
  ].map(sb)

  const coachLogic = sb(
    `이 플래너의 강점과 성장 포인트는 별개가 아니라 <b>하나의 구조로 연결</b>되어 있어요. 잘하는 것은 <b>${r.strengths.map((s) => s.title).join(', ')}</b>이고, 성장 공간은 <b>${r.bottlenecks.map((x) => x.title.split(' ·')[0]).join(', ')}</b>입니다.${r.goals[0] ? ` AI가 <b>'${r.goals[0].title.split(' —')[0]}'</b>을 첫 번째 제안으로 고른 이유는 세 가지예요 — ① 소득과 가장 바로 연결되고, ② 30일 안에 행동으로 옮길 수 있으며, ③ 이 지표가 좋아지면 다른 지표(인당보험료·부보율·유지·소개)도 함께 움직이기 때문이에요.` : ''}${r.goals[1] ? ` 두 번째 제안(${r.goals[1].title.split(' —')[0]})은 간격 자체는 크지만, 새 활동을 따로 만들기보다 <b>첫 번째 제안의 상담 자리에 얹어서</b> 실행하는 편이 플래너에게 부담이 적어요.` : ''}`,
  )

  const cguides = {
    c1: sb(
      `이 가이드는 <b>코칭 대화를 준비하는 강사용</b>이에요. 플래너를 판정하는 자료가 아니라, <b>어떤 질문을 고를지 정하는 재료</b>로 사용해 주세요. 각 영역의 <b style="color:var(--cr-hi-dk)">→ 표시</b>가 코칭에서 짚어줄 포인트입니다.`,
    ),
    c3: sb(
      `숫자는 <b>무엇이</b> 낮은지만 알려주고, <b>왜</b> 낮은지는 알려주지 않아요. 아래는 데이터에서 떠올릴 수 있는 원인 후보들입니다 — 맞는지 틀리는지는 C4의 질문으로 플래너 본인에게 확인해 주세요.`,
    ),
    c4: sb(
      `다섯 질문은 <b>강점 인정 → 사실 확인 → 원인 탐색 → 선택 → 첫 행동</b>의 순서로 설계되어 있어요. 그대로 읽어도 되고, 플래너의 말에 따라 자연스럽게 바꿔도 됩니다.`,
    ),
    c7: sb(
      `레포트를 보다가 플래너가 <b>"이 숫자 좀 이상한데요?"</b>라고 물을 수 있는 지점들이에요. 미리 읽어 두시면 당황하지 않고 답할 수 있어요.`,
    ),
  }

  const hypoBank: string[] = []
  if (r.goals.find((g) => g.id === 'depth'))
    hypoBank.push(
      `<b>가설 1 · 후속상담의 계기가 없다</b> — 계약이 끝난 뒤 그 고객을 다시 만날 계기(보험금 청구, 만기 도래, 정기 보장점검)가 습관으로 잡혀 있지 않을 가능성이에요.<span class="ev">근거: 기존고객 추가계약 월 ${f2(M.oldCnt6.me)}건 vs TC ${f2(M.oldCnt6.tc)}건</span>`,
    )
  if (hasCoverage) {
    if (r.metrics.cancerRate.cls === 'bottleneck')
      hypoBank.push(
        `<b>가설 2 · 제안 범위를 스스로 좁힌다</b> — 가입이 쉬운 담보 위주로 설계를 좁히다 보니, 치료과정 담보(암 주요치료비·심뇌) 제안을 자기도 모르게 건너뛸 가능성이에요.<span class="ev">근거: 암 부보율 ${pctFmt(M.cancerRate.me)}, 건당 ${wonK(F.premCase.me)}</span>`,
      )
    else
      hypoBank.push(
        `<b>가설 2 · 증액 이야기를 꺼내지 못한다</b> — 담보 구성은 잘 갖추는데, 고객의 납입 여력을 확인하고 규모를 키우자는 제안은 부담스러워 생략할 가능성이에요.<span class="ev">근거: 건당 ${wonK(F.premCase.me)}(TC ${wonK(F.premCase.tc)}), 인당 ${wonK(F.premPer.me)}(TC ${wonK(F.premPer.tc)})</span>`,
      )
  }
  if (r.goals.find((g) => g.id === 'car'))
    hypoBank.push(
      `<b>가설 3 · 자동차를 피하고 있다</b> — 견적 경쟁이나 사고처리 부담, 혹은 취급 경험이 없어서 자동차 상담 자체를 피해 왔을 가능성이에요.<span class="ev">근거: 월 자동차 ${f1(M.moCar.me)}건, 자동차고객 ${f1(F.custCar.me)}명</span>`,
    )
  if (r.goals.find((g) => g.id === 'inflow'))
    hypoBank.push(
      `<b>가설 · 소개를 요청하는 말이 없다</b> — 만족하는 고객은 많은데, 소개를 부탁하는 자기만의 한 문장과 타이밍이 정해져 있지 않을 가능성이에요.<span class="ev">근거: 월 신규 ${f2(F.newCust.me)}명, 총고객 ${f1(F.custTotal.me)}명</span>`,
    )
  if (r.goals.find((g) => g.id === 'activity'))
    hypoBank.push(
      `<b>가설 · 상담 시간이 고정되어 있지 않다</b> — 고객 요청이 올 때만 상담이 잡혀서, 주간 활동량이 그때그때 달라질 가능성이에요.<span class="ev">근거: 월 장기건수 ${f1(M.moLong.me)}건 vs TC ${f1(M.moLong.tc)}건</span>`,
    )
  if (r.goals.find((g) => g.id === 'prospecting'))
    hypoBank.push(
      `<b>가설 · 접점 활동이 일회성이다</b> — 새 고객을 만나는 활동이 한 번씩 시도로 끝나고, 매주 반복되는 구조가 없을 가능성이에요.<span class="ev">근거: 월 신규 ${f2(F.newCust.me)}명</span>`,
    )

  /* C4 — 진짜 이야기 질문을 앞에 붙이고, 기본 5문항은 인용체 + .qwhy */
  const truthQs = (r.truth.qa ?? []).filter((q): q is string => Boolean(q))
  const coachQs = [
    ...truthQs,
    `"이 레포트에서 '생각보다 내가 잘하고 있었네' 싶은 부분이 있으세요?"<span class="qwhy">왜 묻나요 — 강점을 플래너 본인의 언어로 말하게 하면, 뒤에 나올 제안의 수용성이 크게 올라가요. 첫 질문은 반드시 강점에서 시작해 주세요.</span>`,
    r.goals.find((g) => g.id === 'depth')
      ? `"계약이 끝난 다음, 그 고객님을 두 번째로 만나게 되는 건 보통 언제, 어떤 계기인가요?"<span class="qwhy">왜 묻나요 — 후속상담 루틴이 있는지 없는지를 판단이 아니라 사실로 확인하는 질문이에요. '없다'는 답이 나오면 그게 곧 제안 1의 출발점이 돼요.</span>`
      : `"활동의 양이 적은 걸까요, 아니면 활동이 성과로 이어지는 과정에 빈틈이 있는 걸까요?"<span class="qwhy">왜 묻나요 — 문제를 '양'과 '전환' 중 어디로 보는지 본인의 진단을 먼저 듣기 위한 질문이에요.</span>`,
    hasCoverage && r.metrics.cancerRate.cls === 'bottleneck'
      ? `"상담하다 보면 암 주요치료비나 심뇌 담보 이야기를 안 하고 넘어가게 되는 순간이 있으실 텐데, 주로 어떤 상황인가요?"<span class="qwhy">왜 묻나요 — '제안을 생략하는 순간'을 구체적 장면으로 떠올리게 하면, 행동 교정 지점이 스스로 보여요.</span>`
      : hasCoverage
        ? `"설계할 때 증액이나 추가 담보 이야기를 꺼내는 나만의 순서나 타이밍이 있으세요?"<span class="qwhy">왜 묻나요 — 규모 제안이 습관인지 우연인지 확인하는 질문이에요.</span>`
        : `"지금 가장 자신 있는 고객 접점을 다른 데 활용한다면, 어디에 써보고 싶으세요?"<span class="qwhy">왜 묻나요 — 강점을 지렛대로 약점을 잇는 사고를 본인이 먼저 하게 만드는 질문이에요.</span>`,
    r.goals.find((g) => g.id === 'car')
      ? `"자동차보험을 잘 권하지 않으신다면 — 시간 부담, 견적 경쟁, 사고처리 걱정 중 어디에 가장 가까우세요?"<span class="qwhy">왜 묻나요 — 회피의 원인을 세 가지 보기로 좁혀 주면 답하기 쉬워지고, 원인별로 처방이 달라져요.</span>`
      : `"두 가지 제안 중에, 지금의 나에게 더 현실적인 건 어느 쪽 같으세요?"<span class="qwhy">왜 묻나요 — 선택권을 플래너에게 돌려주는 질문이에요. 강사가 골라주면 실행 책임도 강사에게 남아요.</span>`,
    `"두 제안 중, 앞으로 7일 안에 숫자로 확인할 수 있는 첫 행동이 나오는 쪽은 어느 것일까요?"<span class="qwhy">왜 묻나요 — 대화를 '느낌'이 아니라 '이번 주의 행동 하나'로 마무리하는 마지막 질문이에요. 이 답이 그대로 '나의 선택' 페이지에 적히면 됩니다.</span>`,
  ]

  const goalCoach = [
    `<b>플래너가 제안에 없는 다른 목표를 말할 때</b> — 반가운 신호예요. 다만 "그 목표는 이번 주에, 몇 분께, 무엇을 하는 것으로 시작되나요?"라고 물어봐 주세요. 행동으로 번역되면 그대로 진행하고, 번역이 안 되면 두 제안으로 부드럽게 돌아오면 됩니다.`,
    `<b>두 가지를 다 하겠다고 할 때</b> — 의욕은 인정하되, 두 번째 제안은 "첫 번째 제안의 상담 자리에 얹는 한 가지 행동"으로만 줄여 주세요. 목표가 둘이면 90일 뒤 남는 것은 대개 하나도 없어요.`,
    `<b>두 번째 제안을 고르겠다고 할 때</b> — 존중해도 좋은 경우가 있어요. 본인이 그 영역의 심리적 부담("사실 자동차가 겁나요" 같은)을 스스로 꺼내면서 먼저 깨보고 싶다고 말할 때예요. 그 동기가 실행률을 만듭니다.`,
  ].map(sb)

  const dataNotes = [
    `<b>TC 표준그룹 정의</b> — 화면 표기는 '500~700'이나 원본 템플릿 수식(소득별Data)은 700만원대까지 포함(실측 500~800, 단순평균 산출)입니다. 벤치마크가 표기보다 소폭 높게 잡힐 수 있으나 진단 방향은 불변 — 'TC 도달 개선량'의 절대값 해석에 여유를 둘 것.`,
    `<b>동일그룹 정의</b> — 플래너 본인의 육성소득 구간(현재: ${dgBand})으로 자동 설정됩니다.`,
    `<b>부보율 정의</b> — 암·심뇌 부보율은 최근 6개월 신계약 건 기준입니다. '보유고객 부보율'로 읽지 않도록 안내.`,
    `<b>실손 데이터 한계</b> — 자사 계약 기준으로 타사 실손 보유가 미반영. "실손이 없다"가 아니라 "실손 정보를 내가 모른다"로 코칭할 것.`,
  ]
  if (d.cohort)
    dataNotes.push(
      `<b>내 연차의 기준(코호트) 산출 방법</b> — 업로드된 전 플래너 원자료로 미리 계산해 둔 통계입니다. 본인 차월이 속한 고정 구간(1~12/13~24/25~36/37~60/61~120/121+)에서, '같은 차월대 전체'는 구간 내 모든 플래너(${d.cohort.all.n.toLocaleString()}명), '같은 차월대 TC'는 그중 육성소득 500~700 도달자(${d.cohort.tc ? d.cohort.tc.n : '표본 부족'}명)의 평균이에요. 유지고객은 이관 제외, 연계율은 구간 합산 가중 평균, 월 장기건수는 최근 6개월 평균, 환산실적은 원자료(6개월 합계)를 6으로 나눈 월평균입니다. 신규고객·보험료 지표는 원자료 정의가 확정되지 않아 넣지 않았어요.`,
    )
  else
    dataNotes.push(
      `<b>내 연차의 기준(코호트) 미표시</b> — 업로드된 데이터에 원자료 통계가 없거나 구간 표본이 부족해 코호트 비교를 생략했어요.`,
    )
  const dataNotesSb = dataNotes.map(sb)

  const heroRefs = heroIds.map((id) => {
    const h = HEROES[id]
    return sb(
      `<b>${h.name}</b> <span style="color:var(--cr-text3)">(출처: 영업수기 케이스 ${h.ref} — 플래너 화면에는 출처가 표기되지 않아요)</span><br>사례 속 주인공과 이 플래너는 규모·연차가 다를 수 있어요. 실적 숫자를 따라 하게 하지 말고, <b>반복했던 루틴의 원리</b>만 가져오게 해주세요.` +
        (id === 'depth'
          ? ` 그리고 이 팁은 재상담 사례라서 자칫 리모델링처럼 들릴 수 있어요 — <b>'기존 계약은 지키고, 빈 곳을 추가로 채우는 방향'</b>으로 지도해 주시고, 기존계약 해지·대체가 언급되면 불이익 설명 의무를 꼭 지켜 주세요.`
          : ''),
    )
  })

  const g0 = r.goals[0]
  const gEx = g0?.ex ?? { reason: '', act: '실행 행동', action: '', metric: '핵심 지표', from: '', to: '' }
  const gExSb = { ...gEx, reason: sb(gEx.reason), action: sb(gEx.action) }
  const gName = g0 ? g0.title.split(' —')[0] + ' (제안 1)' : ''

  return {
    b, d, r, F, M, name, sub1, BASE_ALL, BASE_6, dgBand,
    insKpi, insBfly, insVs, insFlow, insStrength, insBottle,
    premDrop, premPerK, trendMsg, vsMsgs, vsCallouts, ringDescs, coMsg,
    heroes, howto, edits, onCommit, showCoachGuide, guideOnly,
    camsFacts, coachLogic, cguides, hypoBank, coachQs, dataNotes: dataNotesSb, goalCoach, heroRefs,
    gName, gEx: gExSb,
  }
}
