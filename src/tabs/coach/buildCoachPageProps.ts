/* ══════════════════════════════════════════════════════════════════════
   성장코칭 리포트의 강점/병목/영업유형/90일 목표 등 서술 문구 조립부.
   GrowthCoachTab(화면)과 CoachPrintRootForPerson(일괄 인쇄) 양쪽이
   완전히 같은 문구를 만들도록 공용 순수 함수로 뺐다.
   ══════════════════════════════════════════════════════════════════════ */

import type { FullAnalysis } from '../../calc'
import { buildCoachData } from '../../calc/coach'
import { analyzeCoach, f1, f2, isNum, pctFmt, wonK, HEROES } from '../../calc/coachAnalyze'
import type { CoachEdits } from './Editable'
import type { CoachPageProps } from './types'

export function incomeBand(v: string): string {
  return String(v ?? '').replace('이상', ' 구간')
}

export function buildCoachPageProps(
  A: FullAnalysis,
  caption: string,
  edits: CoachEdits,
  onCommit: (id: string, html: string) => void,
  showCoachGuide: boolean,
): CoachPageProps {
  const d = buildCoachData(A, caption)
  const r = analyzeCoach(d)

  const F = d.full
  const M = d.m6
  const b = d.basic
  const name = b.name

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

  const insKpi =
    hasDepth && pctCust && pctCnt
      ? { h: `고객은 TC그룹의 ${pctCust}%인데, 계약은 ${pctCnt}%입니다`, p: `고객 기반과 신규 유입은 이미 상위권이에요. 지금 소득 차이를 만드는 건 한 고객과의 계약 깊이예요. 아래 활동 구조 비교에서 어느 활동이 앞서고 있는지 함께 확인해 보세요.` }
      : hasProspecting
        ? { h: `지금 필요한 것은 전환이 아니라, 고객 접점 그 자체입니다`, p: `고객 기반이 동일그룹에 아직 미치지 못해요. 아래 지표에서 접점 규모부터 함께 확인해 보세요.` }
        : r.noHardBottleneck
          ? { h: `동일그룹은 모두 넘어섰습니다 — 이제 TC와의 마지막 간격이에요`, p: `각 카드의 아래 칸은 전체 누적과 최근 6개월의 차이예요.` }
          : { h: `핵심 지표로 본 나의 현재 위치입니다`, p: `각 카드의 아래 칸은 전체 누적과 최근 6개월의 차이예요.` }

  const insVs = r.strengths.some((s) => s.id === 'prospect')
    ? { h: `신규 개척은 이미 TC그룹을 앞서 있습니다 — 격차는 전환 지표에 있습니다`, p: `막대의 길이보다 '고객 대비 계약'의 간격을 봐 주세요. 주황 표시는 성장 기회가 가장 큰 곳이에요.` }
    : { h: `동일그룹·TC그룹과 나의 위치를 막대 길이로 비교했습니다`, p: `주황 표시는 성장 기회가 가장 큰 곳이에요.` }

  const insFlow =
    r.momentum !== null && r.momentum > 0.5
      ? { h: `흐름은 좋습니다 — 최근 두 달, 월 활동량이 TC그룹을 넘어섰습니다`, p: `이 상승 흐름을 새 고객이 아니라, 이미 만난 고객에게 돌려보는 것이 다음 단계예요.` }
      : { h: `두 개의 비율과 월별 흐름이 다음 성장의 공간을 보여줍니다`, p: `링의 채워진 만큼이 나의 현재이고, 파란 칩이 TC그룹의 위치예요.` }

  const insBottle = hasDepth
    ? { h: `부족한 것은 고객이 아니라, 한 고객과의 '두 번째 계약'입니다`, p: `성장 포인트는 약점이 아니라, 다음 성장이 숨어 있는 자리예요. 점선 상자는 코칭에서 함께 이야기할 질문이에요.` }
    : hasProspecting
      ? { h: `영업의 시작인 고객 접점부터 넓혀야 합니다`, p: `성장 포인트는 약점이 아니라, 다음 성장이 숨어 있는 자리예요.` }
      : hasCar
        ? { h: `매년 다시 만날 명분, 자동차 접점이 비어 있습니다`, p: `성장 포인트는 약점이 아니라, 다음 성장이 숨어 있는 자리예요.` }
        : hasCoverage
          ? { h: `계약의 개수보다 계약 한 건의 깊이를 볼 차례입니다`, p: `성장 포인트는 약점이 아니라, 다음 성장이 숨어 있는 자리예요.` }
          : r.bottlenecks.some((x) => x.id === 'inflow')
            ? { h: `기반은 탄탄합니다 — 새 고객이 더해지는 리듬만 살리면 됩니다`, p: `깊은 고객관계는 소개가 나오기 가장 좋은 토양이에요.` }
            : r.bottlenecks.some((x) => x.id === 'activity')
              ? { h: `전환력은 검증됐습니다 — 이제 횟수를 곱할 차례예요`, p: `상담 슬롯을 고정하면 지금의 전환력이 그대로 소득으로 이어져요.` }
              : r.noHardBottleneck
                ? { h: `약점이 아니라, 상위 그룹과의 마지막 간격만 남았어요`, p: `동일그룹은 모두 넘어섰어요. 지금부터는 보완이 아니라 진입의 문제예요.` }
                : null

  const premDrop = isNum(F.premPer.me) && isNum(M.premPer6.me) && M.premPer6.me < F.premPer.me * 0.85
  const premPerK = isNum(F.premPer.me) ? Math.round(F.premPer.me / 1000).toLocaleString('ko-KR') : '확인 필요'

  const trendMsg =
    r.momentum !== null && r.momentum > 0.5
      ? `최근으로 올수록 계약이 늘고 있어요 — <b>성장의 흐름이 살아 있어요.</b> 이 흐름을 기존 고객 재상담으로 연결하는 것이 다음 단계예요.`
      : `월별 흐름을 TC그룹과 비교해 보세요. 흐름이 꺾인 달의 활동을 함께 되짚어 보는 것이 출발점이에요.`

  const heroIds = [...new Set(r.goals.map((g) => g.hero))].slice(0, 2)

  const howto: string[] = []
  if (r.goals.find((g) => g.id === 'depth')) {
    howto.push(`단독 1건·주력상품 고객 중 최근 1년 접점 있는 고객 <b>20명 리스트</b> 작성`)
    howto.push(`그중 <b>5명에게 점검 문자</b> 발송 — "상품 권유가 아니라 보장 점검입니다" 문구 포함`)
    howto.push(`<b>점검상담 약속 2건</b> 확정`)
  }
  if (r.goals.find((g) => g.id === 'car')) howto.push(`장기고객 <b>5명</b>에게 본인·가족 차량 보유 여부와 <b>만기월 확인</b>`)
  if (r.goals.find((g) => g.id === 'prospecting')) howto.push(`고정 거점 2곳 정하고 첫 방문 <b>2회</b>`)
  if (r.goals.find((g) => g.id === 'coverage')) howto.push(`이번 주 신규 상담 전건에 <b>치료과정 담보 점검 단계</b> 포함`)
  if (r.goals.find((g) => g.id === 'inflow')) {
    howto.push(`만족도 높은 고객 <b>10명 리스트</b> 작성`)
    howto.push(`상담 마무리에 <b>소개 한 문장</b> 2회 시도`)
  }
  if (r.goals.find((g) => g.id === 'activity')) howto.push(`주간 <b>상담 슬롯 3개</b>(요일·시간)를 캘린더에 먼저 고정`)
  if (r.goals.find((g) => g.id === 'levelup')) howto.push(`간격 지표와 연결된 <b>주간 행동 1개</b> 정하기`)
  howto.push(`금요일: 리스트–연락–상담–계약 <b>단계별 숫자 기록</b> 점검`)

  const camsFacts = [
    `<b>C(고객)</b> — 총고객 ${f1(F.custTotal.me)}명(동일그룹 ${f1(F.custTotal.dg)} / TC ${f1(F.custTotal.tc)}), 월 신규 ${f2(F.newCust.me)}명. 장기이관 ${f1(F.transferLong.me)}건(TC그룹 평균 ${f1(F.transferLong.tc)}건) — 이관 규모 차이를 고객기반 해석에 반영할 것.`,
    `<b>A(활동)</b> — 고객당 건수 ${f2(F.perCust.me)}건(동일 ${f2(F.perCust.dg)} / TC ${f2(F.perCust.tc)}). 6개월: 신규고객 월 ${f2(M.newCust6.me)}명(TC ${f2(M.newCust6.tc)}) vs 기존고객 추가계약 월 ${f2(M.oldCnt6.me)}건(TC ${f2(M.oldCnt6.tc)}). 월 장기 ${f1(M.moLong.me)}건 / 자동차 ${f1(M.moCar.me)}건(TC ${f1(M.moCar.tc)}건). 최근 6개월 장기건수 추이: ${d.monthly.map((m) => f1(m.me)).join(' → ')}건.`,
    `<b>M(시장)</b> — 장기 단독 ${pctFmt(F.longSoloRate.me)}(TC ${pctFmt(F.longSoloRate.tc)}), 연계율 ${pctFmt(F.linkRate.me)}. 간편 건수비중 ${pctFmt(M.simpleCntPct.me)}·보험료비중 ${pctFmt(M.simplePremPct.me)}. 실손 보유 ${f1(F.silsonCnt.me)}건(TC그룹 평균 ${f1(F.silsonCnt.tc)}건) — 자사 기준으로 타사 실손 미반영.`,
    `<b>S(기술)</b> — 인당 ${wonK(F.premPer.me)} / 건당 ${wonK(F.premCase.me)} / 최고 ${wonK(F.premMax.me)} (TC ${wonK(F.premPer.tc)} / ${wonK(F.premCase.tc)} / ${wonK(F.premMax.tc)}). 암 부보율 ${pctFmt(M.cancerRate.me)}(동일 ${pctFmt(M.cancerRate.dg)} / TC ${pctFmt(M.cancerRate.tc)}), 심뇌 ${pctFmt(M.brainRate.me)}.`,
  ]

  const hypoBank: string[] = []
  if (r.goals.find((g) => g.id === 'depth'))
    hypoBank.push(
      `<b>가설 1 · 후속상담 프로세스 부재</b> — 체결 후 재상담 트리거(청구·만기·정기점검)가 루틴화되지 않았을 가능성.<span class="ev">근거: 기존고객 추가계약 월 ${f2(M.oldCnt6.me)}건 vs TC ${f2(M.oldCnt6.tc)}건</span>`,
    )
  if (hasCoverage)
    hypoBank.push(
      `<b>가설 2 · 제안 범위 축소 습관</b> — 가입 가능한 담보 위주로 설계를 좁혀 치료과정 담보 제안을 생략할 가능성.<span class="ev">근거: 암 부보율 ${pctFmt(M.cancerRate.me)}, 건당 ${wonK(F.premCase.me)}</span>`,
    )
  if (r.goals.find((g) => g.id === 'car'))
    hypoBank.push(
      `<b>가설 3 · 자동차 취급 회피</b> — 견적·사고처리 부담 또는 경험 부재로 자동차 상담을 피했을 가능성.<span class="ev">근거: 월 자동차 ${f1(M.moCar.me)}건, 자동차고객 ${f1(F.custCar.me)}명</span>`,
    )
  if (r.goals.find((g) => g.id === 'inflow'))
    hypoBank.push(
      `<b>가설 · 소개 요청 루틴 부재</b> — 만족 고객은 많으나 소개를 요청하는 정형화된 한 문장·타이밍이 없을 가능성.<span class="ev">근거: 월 신규 ${f2(F.newCust.me)}명, 총고객 ${f1(F.custTotal.me)}명</span>`,
    )
  if (r.goals.find((g) => g.id === 'activity'))
    hypoBank.push(
      `<b>가설 · 상담 슬롯 미고정</b> — 상담이 요청 기반으로만 이루어져 주간 활동량이 유동적일 가능성.<span class="ev">근거: 월 장기건수 ${f1(M.moLong.me)}건 vs TC ${f1(M.moLong.tc)}건</span>`,
    )
  if (r.goals.find((g) => g.id === 'prospecting'))
    hypoBank.push(`<b>가설 · 접점 루틴 부재</b> — 접점 활동이 일회성에 그쳐 반복 구조가 없을 가능성.<span class="ev">근거: 월 신규 ${f2(F.newCust.me)}명</span>`)

  const coachQs = [
    `이 데이터에서 예상보다 잘하고 있었던 것은 무엇입니까? <span style="color:var(--cr-text3)">(본인이 강점을 강점으로 인식하는지 확인)</span>`,
    r.goals.find((g) => g.id === 'depth')
      ? `계약이 체결된 다음, 그 고객과의 <b>두 번째 만남</b>은 보통 언제, 어떤 계기로 이루어집니까?`
      : `활동이 부족한 것입니까, 활동이 성과로 연결되는 과정이 부족한 것입니까?`,
    hasCoverage ? `상담에서 암 주요치료비나 심뇌 담보를 제안하지 <b>않게 되는 순간</b>은 어떤 상황입니까?` : `현재 가장 자신 있는 고객 접점을 활용하면 어떤 약점을 개선할 수 있습니까?`,
    r.goals.find((g) => g.id === 'car') ? `자동차보험을 권하지 않는 이유가 있다면 — 시간, 견적 경쟁, 사고처리 부담 중 무엇에 가깝습니까?` : `두 목표 중 지금 더 실행 가능한 것은 어느 쪽입니까?`,
    `두 목표 중 <b>다음 7일 안에 숫자로 확인할 수 있는 첫 행동</b>이 나오는 쪽은 어느 것입니까?`,
  ]

  const dataNotes = [
    `<b>TC 표준그룹 정의</b> — 화면 표기는 '500~700'이나 원본 템플릿 수식(소득별Data)은 700만원대까지 포함(실측 500~800, 단순평균 산출)입니다. 벤치마크가 표기보다 소폭 높게 잡힐 수 있으나 진단 방향은 불변 — 'TC 도달 개선량'의 절대값 해석에 여유를 둘 것.`,
    `<b>동일그룹 정의</b> — 플래너 본인의 육성소득 구간(현재: ${dgBand})으로 자동 설정됩니다.`,
    `<b>부보율 정의</b> — 암·심뇌 부보율은 최근 6개월 신계약 건 기준입니다. '보유고객 부보율'로 읽지 않도록 안내.`,
    `<b>실손 데이터 한계</b> — 자사 계약 기준으로 타사 실손 보유가 미반영. "실손이 없다"가 아니라 "실손 정보를 내가 모른다"로 코칭할 것.`,
  ]

  const heroRefs = heroIds.map((id) => {
    const h = HEROES[id]
    const extra = id === 'depth' ? ` 리모델링 뉘앙스가 생기지 않도록 '추가 보완' 중심으로 지도하고, 기존계약 해지·대체 언급 시 불이익 설명 의무 준수.` : ''
    return `<b>${h.name}</b> (출처: 영업수기 케이스 ${h.ref} · 플래너 화면에는 출처 미표기) — 사례와 본 플래너의 규모·연차 차이를 확인하고, 실적 수치가 아니라 <b>루틴의 원리</b>만 가져오게 할 것.${extra}`
  })

  const g0 = r.goals[0]
  const gEx = g0?.ex ?? { reason: '', act: '실행 행동', action: '', metric: '핵심 지표', from: '', to: '' }
  const gName = g0 ? g0.title.split(' —')[0] + ' (제안 1)' : ''

  return {
    b, d, r, F, M, name, sub1, BASE_ALL, BASE_6, dgBand,
    insKpi, insVs, insFlow, insBottle, premDrop, premPerK, trendMsg,
    bflyPattern, carWorst, heroIds, howto, edits, onCommit, showCoachGuide,
    camsFacts, hypoBank, coachQs, dataNotes, heroRefs, gName, gEx,
  }
}
