/* ══════════════════════════════════════════════════════════════════════
   성장코칭 탭 — 원본 "TC스텝업 하이플래너 성장 코칭" 독립 도구의 render()를
   그대로 이식했다(파일 업로드 없이 이미 계산된 FullAnalysis 에서 값을 뽑음 —
   src/calc/coach.ts 참조). 9페이지(P1~P9) + 강사용 2페이지(토글)로 구성된다.
   ══════════════════════════════════════════════════════════════════════ */

import { useCallback, useMemo, useRef, useState } from 'react'
import type { FullAnalysis } from '../../calc'
import { buildCoachData, type CoachMetric } from '../../calc/coach'
import { analyzeCoach, f1, f2, isNum, pctFmt, wonK, HEROES } from '../../calc/coachAnalyze'
import { Editable, Html, type CoachEdits } from './Editable'
import { KpiCard, VsCard, RingCard, TrendCard, ButterflyCard, HeroCard, StrengthCard, BottleneckCard, TcChip, Capsule } from './cards'
import { CamsMap } from './CamsMap'
import { GoalCard } from './GoalCard'
import { CoachPrintRoot } from './CoachPrintRoot'
import { printAll, captureAllPages } from '../../export/captureAll'
import { exportPdf } from '../../export/pdf'
import { savePdf } from '../../export/pdfSave'
import { canShareFiles, isMobile, outputFileName, outputFileStem, shareOrDownload } from '../../export/share'

const COACH_CAPTURE_OPTS = { rootId: 'coach-print-root', pageSelector: '.sheet' }

function maskId(id: string): string {
  const s = String(id ?? '')
  return s.length > 2 ? s.slice(0, 2) + '****' : '****'
}
function joinYm(v: string | number): string {
  const s = String(v ?? '')
  return s.length >= 6 ? `${s.slice(0, 4)}.${s.slice(4, 6)}` : s
}
function incomeBand(v: string): string {
  return String(v ?? '').replace('이상', ' 구간')
}

function Insight({ id, h, p, edits, onCommit }: { id: string; h: string; p?: string; edits: CoachEdits; onCommit: (id: string, html: string) => void }) {
  return (
    <div className="insight">
      <Editable id={`${id}-h`} html={h} edits={edits} onCommit={onCommit} className="insight-h" />
      {p && <Editable id={`${id}-p`} html={p} edits={edits} onCommit={onCommit} className="insight-p" />}
    </div>
  )
}

function SecHead({ n, title, note }: { n: string; title: string; note?: string }) {
  return (
    <div className="sec-h">
      <span className="sec-n">{n}</span>
      <span className="sec-t">{title}</span>
      {note && <span className="sec-note">{note}</span>}
    </div>
  )
}

function PageHead({ title, sub, tag }: { title: React.ReactNode; sub: React.ReactNode; tag: string }) {
  return (
    <div className="rp-head">
      <div>
        <div className="rp-title">{title}</div>
        <div className="rp-sub num">{sub}</div>
      </div>
      <span className="rp-tag">{tag}</span>
    </div>
  )
}

function PageFoot({ n, t, name }: { n: string; t: string; name: string }) {
  return (
    <div className="sheet-foot">
      <span>현대해상 영업교육운영파트 · TC스텝업</span>
      <span>
        {n} — {t}
      </span>
    </div>
  )
}

const fmtMyeong = (v: number | null) => f2(v) + '명'
const fmtGun1 = (v: number | null) => f1(v) + '건'

export function GrowthCoachTab({ A, caption }: { A: FullAnalysis; caption: string }) {
  const d = useMemo(() => buildCoachData(A, caption), [A, caption])
  const r = useMemo(() => analyzeCoach(d), [d])
  const [edits, setEdits] = useState<CoachEdits>({})
  const [showCoachGuide, setShowCoachGuide] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [busyMode, setBusyMode] = useState<'print' | 'pdf' | 'image' | null>(null)
  const [showPrintChoice, setShowPrintChoice] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const opIdRef = useRef(0)
  const isCurrentOp = (id: number) => opIdRef.current === id
  const startOp = () => ++opIdRef.current

  const onCommit = (id: string, html: string) => setEdits((prev) => ({ ...prev, [id]: html }))

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

  const pageProps = {
    b, d, r, F, M, name, sub1, BASE_ALL, BASE_6, dgBand,
    insKpi, insVs, insFlow, insBottle, premDrop, premPerK, trendMsg,
    bflyPattern, carWorst, heroIds, howto, edits, onCommit, showCoachGuide,
    camsFacts, hypoBank, coachQs, dataNotes, heroRefs, gName, gEx,
  }

  const mobile = isMobile()

  const doPrintCoach = useCallback(async () => {
    const id = startOp()
    setBusyMode('print')
    setBusy('준비 중')
    try {
      const fileStem = `${outputFileStem(A.profile.name, A.profile.code)}_성장코칭`
      await printAll(
        fileStem,
        () => {
          if (isCurrentOp(id)) {
            setBusy(null)
            setBusyMode(null)
          }
        },
        'printing-coach',
      )
    } catch (e) {
      if (isCurrentOp(id)) {
        setToast(e instanceof Error ? e.message : '인쇄를 시작하지 못했습니다.')
        setTimeout(() => setToast(null), 5000)
      }
    } finally {
      if (isCurrentOp(id)) {
        setBusy(null)
        setBusyMode(null)
      }
    }
  }, [A])

  const doImageCoach = useCallback(async () => {
    const id = startOp()
    setBusyMode('image')
    setBusy('0')
    try {
      const blob = await captureAllPages((done, total) => {
        if (isCurrentOp(id)) setBusy(`${done} / ${total}`)
      }, COACH_CAPTURE_OPTS)
      const fileName = outputFileName(A.profile.name, A.profile.code)
      const result = await shareOrDownload(blob, fileName, `${A.profile.name} 플래너 성장코칭`)
      if (!isCurrentOp(id)) return
      setToast(
        result === 'shared'
          ? '공유했습니다.'
          : result === 'downloaded'
            ? `이미지를 저장했습니다 — ${fileName}`
            : '공유를 취소했습니다.',
      )
      setTimeout(() => setToast(null), 5000)
    } catch (e) {
      if (!isCurrentOp(id)) return
      setToast(e instanceof Error ? e.message : '이미지를 만들지 못했습니다.')
      setTimeout(() => setToast(null), 5000)
    } finally {
      if (isCurrentOp(id)) {
        setBusy(null)
        setBusyMode(null)
      }
    }
  }, [A])

  const doExportPdfCoach = useCallback(async () => {
    const id = startOp()
    setBusyMode('pdf')
    setBusy('0')
    try {
      const blob = await exportPdf((done, total) => {
        if (isCurrentOp(id)) setBusy(`${done} / ${total}`)
      }, COACH_CAPTURE_OPTS)
      const fileName = outputFileName(A.profile.name, A.profile.code, 'pdf')
      const result = await savePdf(blob, `${fileName.replace(/\.pdf$/, '')}_성장코칭.pdf`)
      if (!isCurrentOp(id)) return
      setToast(result === 'cancelled' ? 'PDF 저장을 취소했습니다.' : `PDF를 저장했습니다.`)
      setTimeout(() => setToast(null), 5000)
    } catch (e) {
      if (!isCurrentOp(id)) return
      setToast(e instanceof Error ? e.message : 'PDF를 만들지 못했습니다.')
      setTimeout(() => setToast(null), 5000)
    } finally {
      if (isCurrentOp(id)) {
        setBusy(null)
        setBusyMode(null)
      }
    }
  }, [A])

  const openPrintChoice = useCallback(() => {
    if (mobile) {
      void doImageCoach()
      return
    }
    setShowPrintChoice(true)
  }, [mobile, doImageCoach])

  const choosePrint = useCallback(() => {
    setShowPrintChoice(false)
    void doPrintCoach()
  }, [doPrintCoach])

  const choosePdf = useCallback(() => {
    setShowPrintChoice(false)
    void doExportPdfCoach()
  }, [doExportPdfCoach])

  return (
    <div className="coach-report">
      <div className="coach-toolbar">
        <label className="toggle">
          <input type="checkbox" checked={showCoachGuide} onChange={(e) => setShowCoachGuide(e.target.checked)} />
          강사용 가이드 포함
        </label>
        <div className="grow" />
        <button className="btn btn--primary" onClick={openPrintChoice} disabled={!!busy}>
          {busy
            ? busyMode === 'print'
              ? '인쇄 준비 중'
              : busyMode === 'pdf'
                ? `PDF 저장 중 ${busy}`
                : `출력 중 ${busy}`
            : mobile
              ? '인쇄·PDF 저장 (이미지 저장·공유)'
              : '인쇄·PDF 저장'}
        </button>
      </div>
      <p className="edit-hint">
        진단 문구는 <b>클릭해서 바로 수정</b>할 수 있습니다 · 수정 내용은 이 화면에서만 유지됩니다(새로고침하면 원래대로 돌아갑니다)
      </p>

      <CoachPages {...pageProps} />
      <CoachPrintRoot {...pageProps} />

      {showPrintChoice && (
        <div
          className="choice-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowPrintChoice(false)}
        >
          <div className="choice-overlay__box" onClick={(e) => e.stopPropagation()}>
            <p className="choice-overlay__title">어떻게 출력할까요?</p>
            <div className="choice-overlay__actions">
              <button className="btn btn--primary" onClick={choosePrint}>
                인쇄
              </button>
              <button className="btn btn--primary" onClick={choosePdf}>
                PDF로 저장
              </button>
            </div>
            <button
              className="btn choice-overlay__cancel"
              onClick={() => setShowPrintChoice(false)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {busy && (
        <div className="overlay" role="status" aria-live="polite">
          <div className="overlay__box">
            <div className="overlay__spin" />
            {busyMode === 'print' ? (
              <p>인쇄 준비 중입니다</p>
            ) : busyMode === 'pdf' ? (
              <p>
                PDF를 만드는 중입니다
                <br />
                <b>{busy}</b>
              </p>
            ) : (
              <p>
                이미지를 만드는 중입니다
                <br />
                <b>{busy}</b>
              </p>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {mobile && !canShareFiles() && (
        <p className="hint">
          이 브라우저는 파일 공유를 지원하지 않아 이미지가 <b>다운로드</b>됩니다.
        </p>
      )}
    </div>
  )
}

/* 화면과 인쇄(CoachPrintRoot)가 정확히 같은 마크업을 그리도록 페이지 전체를
   별도 컴포넌트로 뺐다 — 두 곳에서 동일한 props 로 그대로 재사용한다. */
export function CoachPages(props: {
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
}) {
  const { b, d, r, F, M, name, sub1, BASE_ALL, BASE_6, dgBand, insKpi, insVs, insFlow, insBottle, premDrop, premPerK, trendMsg, bflyPattern, carWorst, heroIds, howto, edits, onCommit, showCoachGuide, camsFacts, hypoBank, coachQs, dataNotes, heroRefs, gName, gEx } = props

  return (
    <div className="sheets">
      {/* P1 진단 개요 + CAMS */}
      <article className="sheet">
        <PageHead title={<>하이플래너 <span className="accent">성장 코칭</span></>} sub={sub1} tag="TC STEP-UP" />
        <div className="person num">
          <div className="pchip"><b>성명</b><span>{name} 플래너</span></div>
          <div className="pchip"><b>소속</b><span>{b.hq} · {b.branch}</span></div>
          <div className="pchip"><b>입사</b><span>{joinYm(b.hireDate)} ({b.months}차월)</span></div>
          <div className="pchip"><b>육성소득</b><span>{incomeBand(b.incomeRaw)}</span></div>
          <div className="pchip"><b>사번</b><span>{maskId(b.code)}</span></div>
        </div>
        <div className="sec">
          <SecHead n="1" title="나의 한 줄 진단" />
          <div className="oneliner">
            <div className="ol-k">ONE-LINE DIAGNOSIS</div>
            <Editable id="oneliner" html={r.oneliner} edits={edits} onCommit={onCommit} className="ol-t" />
          </div>
        </div>
        <div className="sec">
          <SecHead n="2" title="나의 영업유형" />
          <div className="type-row">
            <div className="type-card main">
              <span className="type-badge">메인유형</span>
              <Editable id="type-main-name" html={r.type.main.name} edits={edits} onCommit={onCommit} className="type-name" />
              <Editable id="type-main-desc" html={r.type.main.desc} edits={edits} onCommit={onCommit} className="type-desc" />
            </div>
            {r.type.sub && (
              <div className="type-card sub">
                <span className="type-badge">서브유형</span>
                <Editable id="type-sub-name" html={r.type.sub.name} edits={edits} onCommit={onCommit} className="type-name" />
                <Editable id="type-sub-desc" html={r.type.sub.desc} edits={edits} onCommit={onCommit} className="type-desc" />
              </div>
            )}
          </div>
        </div>
        <div className="sec">
          <SecHead n="3" title="C·A·M·S 성장 신호등" note="한눈에 보는 나의 현재" />
          <CamsMap analysis={r} m6={M} dgBand={dgBand} />
        </div>
        <PageFoot n="1" t="진단 개요" name={name} />
      </article>

      {/* P2 핵심지표 + 활동구조 */}
      <article className="sheet">
        <PageHead title={<>핵심 지표와 <span className="accent">활동 구조</span></>} sub={<>{name} 플래너 · 각 카드의 아래 칸은 전체 누적 대비 최근 6개월의 변화예요</>} tag="DATA" />
        <Insight id="ins-kpi" h={insKpi.h} p={insKpi.p} edits={edits} onCommit={onCommit} />
        <div className="sec">
          <SecHead n="4" title="핵심 지표" />
          <div className="kpi-grid">
            <KpiCard ico="🧲" label="월평균 신규고객" sub="전체 기간" value={f2(F.newCust.me)} unit="명"
              chips={<><TcChip me={F.newCust.me} tc={F.newCust.tc} /><span className="chip neutral num">동일그룹 {f2(F.newCust.dg)}명</span></>}
              cap={<Capsule label="최근 6개월 월" fullV={F.newCust.me} m6V={M.newCust6.me} fmt={f2} unit="명" />} />
            <KpiCard ico="👥" label="장기고객" sub="이관 제외 · 전체" value={f1(F.custLong.me)} unit="명"
              chips={<><TcChip me={F.custLong.me} tc={F.custLong.tc} /><span className="chip neutral num">TC {f1(F.custLong.tc)}명</span></>}
              cap={F.transferLong.me === 0 ? <>이관고객 <b>0명</b>, 전원 자력 개척이에요 <span className="delta up">참고: TC그룹 평균 이관 {f1(F.transferLong.tc)}건</span></> : undefined} />
            <KpiCard ico="📑" label="고객당 계약 건수" sub="장기 · 전체" value={f2(F.perCust.me)} unit="건"
              chips={<><TcChip me={F.perCust.me} tc={F.perCust.tc} /><span className="chip neutral num">TC {f2(F.perCust.tc)}건</span></>}
              cap={<Capsule label="최근 6개월" fullV={F.perCust.me} m6V={M.perCust6.me} fmt={f2} unit="건" />} />
            <KpiCard ico="💰" label="인당 월납보험료" sub="장기 · 전체" value={premPerK} unit="천원"
              chips={<><TcChip me={F.premPer.me} tc={F.premPer.tc} />{premDrop && <span className="chip warn">최근 계약일수록 얕아지는 신호</span>}</>}
              cap={<Capsule label="최근 6개월" fullV={isNum(F.premPer.me) ? F.premPer.me / 1000 : null} m6V={isNum(M.premPer6.me) ? M.premPer6.me / 1000 : null} fmt={f1} unit="천원" />} />
          </div>
          <div className="basecap num">[{BASE_ALL}]</div>
        </div>
        <div className="sec">
          <SecHead n="5" title="활동 구조 비교" />
          {bflyPattern && (
            <Insight id="ins-bfly" h="앞은 이기고, 뒤에서 지고 있습니다" p="신규고객을 만나는 활동은 TC그룹보다 강해요. 반면 이미 만난 고객과의 재상담·추가계약에 성장 공간이 있어요. '기회' 표시가 붙은 줄이 90일 목표가 겨냥하는 지점이에요." edits={edits} onCommit={onCommit} />
          )}
          <ButterflyCard M={M} base={BASE_6} />
        </div>
        <PageFoot n="2" t="핵심 지표 · 활동 구조" name={name} />
      </article>

      {/* P3 그룹 비교 */}
      <article className="sheet">
        <PageHead title={<>그룹 <span className="accent">비교</span></>} sub={<>{name} 플래너 · <span style={{ color: 'var(--cr-hi-dk)', fontWeight: 700 }}>주황=나</span> · 회색=동일그룹 · <span style={{ color: 'var(--cr-blue)', fontWeight: 700 }}>파랑=TC그룹</span></>} tag="DATA" />
        <Insight id="ins-vs" h={insVs.h} p={insVs.p} edits={edits} onCommit={onCommit} />
        <div className="sec">
          <SecHead n="6" title="그룹 비교" />
          <VsCard name="월평균 신규고객" sub="명 · 전체" o={F.newCust} fmt={fmtMyeong}
            msg={isNum(F.newCust.me) && isNum(F.newCust.tc) && F.newCust.me > F.newCust.tc ? `새 고객을 만나는 힘은 이미 <b>TC그룹을 앞서 있어요.</b> 이 힘은 그대로 지켜가면 돼요.` : null}
            msgId="vs-newCust" edits={edits} onCommit={onCommit} base={BASE_ALL} />
          <VsCard name="장기계약 건수" sub="이관 제외 · 전체" o={F.cntLong} fmt={fmtGun1}
            msg={`장기고객은 ${f1(F.custLong.me)}명으로 TC(${f1(F.custLong.tc)}명)의 ${isNum(F.custLong.me) && isNum(F.custLong.tc) ? Math.round((F.custLong.me / F.custLong.tc) * 100) : '-'}%인데, 계약 건수는 ${f1(F.cntLong.me)}건으로 TC(${f1(F.cntLong.tc)}건)의 ${isNum(F.cntLong.me) && isNum(F.cntLong.tc) ? Math.round((F.cntLong.me / F.cntLong.tc) * 100) : '-'}%입니다. <b>고객이 부족한 게 아니라, 고객 한 분과의 계약이 아직 얕은 것뿐이에요.</b>`}
            msgId="vs-cntLong" edits={edits} onCommit={onCommit} base={BASE_ALL} callout={r.bottlenecks.some((x) => x.id === 'depth') ? '성장 기회' : undefined} />
          <VsCard name="월평균 자동차 건수" sub="최근 6개월" o={M.moCar} fmt={fmtGun1}
            msg={carWorst ? `TC그룹과 간격이 가장 큰 영역이에요. 자동차는 <b>매년 다시 만나는 명분</b>이 되어 주는 접점이에요.` : null}
            msgId="vs-moCar" edits={edits} onCommit={onCommit} base={BASE_6} callout={carWorst ? '가장 큰 성장 기회' : undefined} />
          <VsCard name="인당 월납보험료" sub="장기 · 전체" o={F.premPer} fmt={wonK}
            msg={isNum(F.premPer.me) && isNum(F.premPer.dg) && F.premPer.me < F.premPer.dg ? `보험료 규모는 동일그룹에도 아직 미치지 못해요. 계약을 늘리는 것과 함께 <b>계약 1건의 보장 깊이</b>를 같이 보면 좋아요.` : null}
            msgId="vs-premPer" edits={edits} onCommit={onCommit} base={BASE_ALL} callout={isNum(F.premPer.me) && isNum(F.premPer.dg) && F.premPer.me < F.premPer.dg ? '함께 볼 지점' : undefined} />
        </div>
        <PageFoot n="3" t="그룹 비교" name={name} />
      </article>

      {/* P4 비율 + 흐름 */}
      <article className="sheet">
        <PageHead title={<>비율과 <span className="accent">흐름</span></>} sub={<>{name} 플래너 · 링의 채워진 만큼이 나의 현재예요</>} tag="DATA" />
        <Insight id="ins-flow" h={insFlow.h} p={insFlow.p} edits={edits} onCommit={onCommit} />
        <div className="sec">
          <SecHead n="7" title="두 개의 비율" />
          <div className="ring-duo">
            <RingCard name="자동차·장기 연계율" o={F.linkRate}
              desc={`장기고객 100명 중 자동차까지 함께하는 고객이 <b>${isNum(F.linkRate.me) ? Math.round(F.linkRate.me * 100) : '-'}명</b>이라는 뜻이에요. TC그룹은 ${isNum(F.linkRate.tc) ? Math.round(F.linkRate.tc * 100) : '-'}명이에요.`}
              descId="ring-linkRate" edits={edits} onCommit={onCommit} base="기준: 전체 누적 · 장기고객 대비" />
            <RingCard name="암 주요치료비 부보율" o={M.cancerRate}
              desc={`최근 6개월 새 계약 10건 중 암 치료과정 보장이 담긴 계약이 <b>약 ${isNum(M.cancerRate.me) ? Math.round(M.cancerRate.me * 10) : '-'}건</b>이라는 뜻이에요.`}
              descId="ring-cancerRate" edits={edits} onCommit={onCommit} base="기준: 최근 6개월 신계약 건 기준" />
          </div>
        </div>
        <div className="sec">
          <SecHead n="8" title="월별 흐름" />
          <TrendCard monthly={d.monthly} msg={trendMsg} msgId="trend-msg" edits={edits} onCommit={onCommit} base={BASE_6} />
        </div>
        <PageFoot n="4" t="비율 · 흐름" name={name} />
      </article>

      {/* P5 무기 */}
      <article className="sheet">
        <PageHead title={<>나의 <span className="accent">무기</span></>} sub={<>{name} 플래너 · 코칭의 순서는 약점이 아니라 무기에서 시작해요</>} tag="STRENGTH" />
        {r.strengths.length > 0 && (
          <Insight id="ins-strength" h="이것은 TC그룹도 부러워할 무기입니다" p="약점을 고치기 전에, 이 무기를 어디에 쓸지 먼저 정하는 것이 이 코칭의 순서예요." edits={edits} onCommit={onCommit} />
        )}
        <div className="sec">
          <SecHead n="9" title="나의 무기" />
          {r.strengths.map((s, i) => (
            <StrengthCard key={s.id} s={s} index={i} edits={edits} onCommit={onCommit} />
          ))}
        </div>
        <PageFoot n="5" t="나의 무기" name={name} />
      </article>

      {/* P6 성장 포인트 */}
      <article className="sheet">
        <PageHead title={<>성장 <span className="accent">포인트</span></>} sub={<>{name} 플래너 · 성장 포인트는 다음 성장이 숨어 있는 자리예요</>} tag="FOCUS" />
        {insBottle && <Insight id="ins-bottle" h={insBottle.h} p={insBottle.p} edits={edits} onCommit={onCommit} />}
        <div className="sec">
          <SecHead n="10" title="성장 포인트" />
          {r.bottlenecks.map((bn, i) => (
            <BottleneckCard key={bn.id} b={bn} index={i} edits={edits} onCommit={onCommit} />
          ))}
        </div>
        <PageFoot n="6" t="성장 포인트" name={name} />
      </article>

      {/* P7 90일 실행 플랜 */}
      <article className="sheet">
        <PageHead title={<>90일 <span className="accent">실행 플랜</span></>} sub={r.goals.length > 1 ? 'AI 코치의 두 가지 제안 중 나의 90일 목표는 내가 선택해요 — 선택은 언제나 플래너의 몫이에요' : 'AI 코치의 제안을 나의 말로 다듬어 90일 목표로 삼아요 — 선택은 언제나 플래너의 몫이에요'} tag="ACTION PLAN" />
        <div className="sec">
          <SecHead n="11" title="AI 코치의 제안" />
          {r.goals.map((g, i) => (
            <GoalCard key={g.id} g={g} index={i} edits={edits} onCommit={onCommit} />
          ))}
        </div>
        <PageFoot n="7" t="90일 실행 플랜" name={name} />
      </article>

      {/* P8 멘토 팁 + HOW TO */}
      <article className="sheet">
        <PageHead title={<>이번 주 <span className="accent">실행</span></>} sub={<>{name} 플래너 · 현장에서 성과를 낸 선배 멘토들의 경험에서 가져온 팁이에요</>} tag="START" />
        <div className="sec">
          <SecHead n="12" title="멘토의 실전 팁" />
          {heroIds.map((id) => (
            <HeroCard key={id} hero={HEROES[id]} />
          ))}
        </div>
        <div className="sec">
          <SecHead n="13" title="이번 주 HOW TO" />
          <div className="howto">
            {howto.slice(0, 5).map((h, i) => (
              <div className="chk" key={i}>
                <div className="box" />
                <Editable id={`howto-${i}`} html={h} edits={edits} onCommit={onCommit} as="span" />
              </div>
            ))}
          </div>
        </div>
        <PageFoot n="8" t="이번 주 실행" name={name} />
      </article>

      {/* P9 나의 선택 */}
      <article className="sheet">
        <PageHead title={<>나의 선택과 <span className="accent">다짐</span></>} sub="목표는 AI가 아니라 내가 정해요 · 손으로 적어도 좋아요" tag="MY CHOICE" />
        <div className="sec">
          <SecHead n="14" title="나의 선택" />
          <div className="ex-card">
            <span className="ex-tag">✎ 작성 예시</span>
            <div className="ex-row"><b>내가 선택한 목표</b> {gName}</div>
            <div className="ex-row"><b>선택한 이유</b> {gEx.reason}</div>
            <div className="ex-row"><b>첫 실행일</b> 다음 주 월요일 &nbsp;·&nbsp; <b>점검일</b> 매주 금요일 오후</div>
            <div className="ex-row"><b>매주 실행할 행동</b> {gEx.action}</div>
            <div className="ex-note">예시는 참고만 하고, 나의 상황과 나의 말로 바꿔 적어요.</div>
          </div>
          <div className="choice">
            <div className="fld full"><label>내가 선택한 목표</label><input type="text" /></div>
            <div className="fld"><label>첫 실행일</label><input type="text" /></div>
            <div className="fld"><label>점검일</label><input type="text" /></div>
            <div className="fld full" style={{ display: 'block' }}>
              <label style={{ display: 'block', marginBottom: 6 }}>선택한 이유</label>
              <div className="write" contentEditable suppressContentEditableWarning />
            </div>
            <div className="fld full" style={{ display: 'block' }}>
              <label style={{ display: 'block', marginBottom: 6 }}>매주 실행할 행동</label>
              <div className="write" contentEditable suppressContentEditableWarning />
            </div>
          </div>
          <div className="declare">
            <span className="dk">실행선언</span>
            나는 앞으로 <input type="text" placeholder="90" />일 동안, 매주 <input type="text" placeholder="5" />명을 대상으로
            <input type="text" className="w" placeholder={gEx.act} />을 실행하여,
            <input type="text" className="w" placeholder={gEx.metric} />을 현재 <input type="text" placeholder={gEx.from} />에서 <input type="text" placeholder={gEx.to} />까지 높이겠다.
          </div>
        </div>
        <PageFoot n="9" t="나의 선택" name={name} />
      </article>

      {/* 강사용 (토글) */}
      {showCoachGuide && (
        <>
          <article className="sheet coach">
            <div className="coach-band">
              <div>
                <div className="cb-t">강사용 코칭 가이드</div>
                <div className="cb-s">플래너 배포용에 포함하지 마십시오 · {name} 플래너 ({maskId(b.code)})</div>
              </div>
            </div>
            <div className="sec">
              <SecHead n="C1" title="데이터 종합판단 (C·A·M·S)" />
              <ul className="tight">
                {camsFacts.map((t, i) => (
                  <Html key={i} html={t} as="div" />
                ))}
              </ul>
            </div>
            <div className="sec">
              <SecHead n="C2" title="진단 논리" />
              <Editable
                id="coach-logic"
                html={`강점(${r.strengths.map((s) => s.title).join(' · ')})과 병목(${r.bottlenecks.map((x) => x.title.split(' ·')[0]).join(' · ')})이 하나의 구조로 연결됩니다. ${r.goals[0] ? `<b>${r.goals[0].title.split(' —')[0]}</b>을 최우선한 이유: ① 소득 직결도 ② 30일 내 실행 가능성 ③ 개선 시 연관 지표(인당보험료·부보율·유지·소개)가 함께 움직이는 파급효과.` : ''} ${r.goals[1] ? `2순위(${r.goals[1].title.split(' —')[0]})는 절대격차는 크지만 1순위 상담 자리에 얹어 실행하는 편이 효율적입니다.` : ''}`}
                edits={edits}
                onCommit={onCommit}
                className="plain"
              />
            </div>
            <div className="sec">
              <SecHead n="C3" title="원인가설 (데이터와 가설 구분)" />
              {hypoBank.slice(0, 3).map((h, i) => (
                <Html key={i} html={h} as="div" className="hypo" />
              ))}
              <p className="plain" style={{ marginTop: 8, fontSize: 13, color: 'var(--cr-text3)' }}>
                ※ 가설은 데이터만으로 단정할 수 없습니다 — 아래 코칭 질문으로 확인해 보세요.
              </p>
            </div>
            <PageFoot n="C-1" t="강사용 · 대외비" name={name} />
          </article>
          <article className="sheet coach">
            <div className="coach-band">
              <div>
                <div className="cb-t">강사용 코칭 가이드 (계속)</div>
                <div className="cb-s">{name} 플래너 ({maskId(b.code)})</div>
              </div>
            </div>
            <div className="sec">
              <SecHead n="C4" title="코칭 질문" />
              <ol className="qs">
                {coachQs.map((q, i) => (
                  <Html key={i} html={q} as="li" />
                ))}
              </ol>
            </div>
            <div className="sec">
              <SecHead n="C5" title="목표 선택 코칭" />
              <ul className="tight">
                <li><b>목표를 바꾸려 할 때 확인</b> — "그 목표는 이번 주에 몇 명에게, 무엇을 하는 것으로 시작됩니까?" 행동 단위로 번역되지 않으면 재선택을 유도.</li>
                <li><b>과다 목표 방지</b> — 두 목표를 모두 선언하려 하면, 2순위는 1순위 상담 자리에 얹는 한 가지 행동으로만 축소해 지도.</li>
                <li><b>2순위 선택을 존중할 조건</b> — 본인이 해당 영역의 심리적 저항을 스스로 언급하고 먼저 깨고 싶어할 때.</li>
              </ul>
            </div>
            <div className="sec">
              <SecHead n="C6" title="멘토 팁 활용 주의사항" />
              <ul className="tight">
                {heroRefs.map((h, i) => (
                  <Html key={i} html={h} as="li" />
                ))}
              </ul>
            </div>
            <div className="sec">
              <SecHead n="C7" title="데이터 확인 필요" />
              {dataNotes.map((n, i) => (
                <Html key={i} html={n} as="div" className="note-card" />
              ))}
            </div>
            <PageFoot n="C-2" t="강사용 · 대외비" name={name} />
          </article>
        </>
      )}
    </div>
  )
}
