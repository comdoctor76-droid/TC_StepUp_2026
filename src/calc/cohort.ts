/* ══════════════════════════════════════════════════════════════════════
   차월 코호트 벤치마크 — 원본 v18 의 computeCohort() 이식.

   원본은 브라우저에서 워크북 전체(input·Q6·Q7 시트)를 다시 읽어 같은
   차월대(밴드) 플래너들의 평균을 즉석 계산한다. 이 앱의 개별 조회 화면은
   전체 데이터를 갖고 있지 않으므로 **업로드(파싱) 시점에 밴드별 통계를
   사전계산**해 meta/cohort 문서 1건으로 저장하고(computeCohortStats),
   조회 시점에는 그 통계에서 본인 밴드를 찾아 원본과 같은 모양으로
   되돌린다(lookupCohort). 문서가 없으면(구버전 엑셀 데이터) undefined —
   원본의 `d.cohort ?` 와 동일하게 코호트 페이지가 조용히 숨는다.

   집계 정의(원본 그대로):
     - 밴드: 1~12 / 13~24 / 25~36 / 37~60 / 61~120 / 121차월 이상
     - TC 판정: 육성소득 문자열이 500/600/700 으로 시작
     - L = Q6 장기 이관제외 최근월(retainLong[5]), C = 자동차(retainAuto[5]),
       K = 연계(retainBoth[5]), T = L+C−K
     - 연계율 = ΣK/ΣL (밴드 합산 가중), 월 장기건수 = Q7 6개월 합/6,
       월평균 환산 = input 환산(누계)/6
     - 가드: 밴드 전체 n<30 → 밴드 제외, TC 하위그룹 n<10 → TC 없음
   ══════════════════════════════════════════════════════════════════════ */

import type { PlannerRow } from '../data/schema'

export interface CohortGroupAvg {
  n: number
  /** 평균 장기고객(이관 제외) */
  L: number
  /** 평균 총고객(L+C−K) */
  T: number
  /** 자동차 연계율 (ΣK/ΣL, null=산출 불가) */
  link: number | null
  /** 월 장기건수 (Q7 6개월 평균의 평균) */
  mo: number | null
  /** 월평균 환산실적 (환산 누계/6 의 평균) */
  conv: number | null
}

export interface CohortBandStats {
  lo: number
  hi: number
  label: string
  all: CohortGroupAvg
  /** TC 소득(500~700 시작) 도달자만 — n 가드는 조회 시점에 적용 */
  tc: CohortGroupAvg | null
  /** 밴드 내 장기고객(L) 분포 — 상위 % 산출용, 오름차순 정렬 */
  custLongSorted: number[]
}

/** meta/cohort 문서 형태 */
export interface CohortStats {
  bands: CohortBandStats[]
  /** TC 소득 도달자 전체의 평균 차월/12 */
  tcAvgYears: number | null
}

/** 조회 결과 — 원본 computeCohort() 반환값과 동일한 모양 */
export interface CoachCohort {
  band: string
  my: number
  all: CohortGroupAvg
  tc: CohortGroupAvg | null
  /** 같은 차월대 전체에서 장기고객 기준 상위 % */
  top: number | null
  tcAvgYears: number | null
}

const BANDS: [number, number, string][] = [
  [1, 12, '1~12차월'],
  [13, 24, '13~24차월'],
  [25, 36, '25~36차월'],
  [37, 60, '37~60차월'],
  [61, 120, '61~120차월'],
  [121, 100000, '121차월 이상'],
]

const isTcInc = (s: unknown): boolean => {
  const t = String(s ?? '')
  return t.startsWith('500') || t.startsWith('600') || t.startsWith('700')
}

interface Acc {
  n: number
  L: number
  T: number
  K: number
  mo: number
  moN: number
  cv: number
  cvN: number
}
const mk = (): Acc => ({ n: 0, L: 0, T: 0, K: 0, mo: 0, moN: 0, cv: 0, cvN: 0 })

const avg = (o: Acc): CohortGroupAvg | null =>
  o.n
    ? {
        n: o.n,
        L: o.L / o.n,
        T: o.T / o.n,
        link: o.L > 0 ? o.K / o.L : null,
        mo: o.moN ? o.mo / o.moN : null,
        conv: o.cvN ? o.cv / o.cvN : null,
      }
    : null

/**
 * 업로드 시점 사전계산 — 파싱된 전 플래너 레코드에서 밴드별 통계를 만든다.
 * 원본은 Q6 시트 행을 돌므로, 여기서는 Q6 시계열(retainLong)이 붙은
 * 플래너만 집계 대상으로 삼는다(동일 집합). Q6 데이터가 아예 없는
 * 워크북(구버전)이면 null — 문서를 쓰지 않는다.
 */
export function computeCohortStats(planners: Record<string, PlannerRow>): CohortStats | null {
  let tcMoSum = 0
  let tcMoN = 0
  let any = false

  const accs = BANDS.map(() => ({ all: mk(), tc: mk(), Ls: [] as number[] }))

  for (const p of Object.values(planners)) {
    const mo = Number(p.f.months)
    if (!Number.isFinite(mo)) continue
    const tc = isTcInc(p.f.incomeRaw)
    if (tc) {
      tcMoSum += mo
      tcMoN++
    }
    // Q6 에 없던 플래너는 원본에서도 집계되지 않는다
    if (p.s.retainLong.length < 6) continue
    const bi = BANDS.findIndex(([lo, hi]) => mo >= lo && mo <= hi)
    if (bi < 0) continue
    any = true

    const L = p.s.retainLong[5] || 0
    const C = p.s.retainAuto[5] || 0
    const K = p.s.retainBoth[5] || 0
    const T = L + C - K
    // Q7 6개월 합/6 — Q7 에 없으면 제외
    const moAvg = p.s.cntLong.length === 6 ? p.s.cntLong.reduce((a, b) => a + b, 0) / 6 : null
    // 환산(누계)/6 — 구버전 워크북엔 열이 없어 undefined 일 수 있다
    const convRaw = Number(p.f.perfConverted)
    const conv = Number.isFinite(convRaw) ? convRaw / 6 : null

    const put = (o: Acc) => {
      o.n++
      o.L += L
      o.T += T
      o.K += K
      if (moAvg !== null && Number.isFinite(moAvg)) {
        o.mo += moAvg
        o.moN++
      }
      if (conv !== null) {
        o.cv += conv
        o.cvN++
      }
    }
    const a = accs[bi]
    put(a.all)
    a.Ls.push(L)
    if (tc) put(a.tc)
  }

  if (!any) return null

  const bands: CohortBandStats[] = []
  for (let i = 0; i < BANDS.length; i++) {
    const A = avg(accs[i].all)
    if (!A) continue
    bands.push({
      lo: BANDS[i][0],
      hi: BANDS[i][1],
      label: BANDS[i][2],
      all: A,
      tc: avg(accs[i].tc),
      custLongSorted: [...accs[i].Ls].sort((a, b) => a - b),
    })
  }

  return { bands, tcAvgYears: tcMoN ? tcMoSum / tcMoN / 12 : null }
}

/**
 * 조회 — 본인 차월로 밴드를 찾아 원본 computeCohort() 와 같은 결과를 만든다.
 * 가드(전체 n≥30 · TC n≥10)도 원본 그대로 여기서 적용한다.
 */
export function lookupCohort(
  stats: CohortStats | null | undefined,
  months: number | string,
  meCustLong: number | null,
): CoachCohort | null {
  if (!stats || !Array.isArray(stats.bands)) return null
  const my = parseInt(String(months), 10)
  if (!Number.isFinite(my) || my < 1) return null
  const bd = stats.bands.find((b) => my >= b.lo && my <= b.hi)
  if (!bd || bd.all.n < 30) return null
  const tc = bd.tc && bd.tc.n >= 10 ? bd.tc : null

  let top: number | null = null
  if (typeof meCustLong === 'number' && Number.isFinite(meCustLong) && bd.custLongSorted.length) {
    const below = bd.custLongSorted.filter((v) => v < meCustLong).length
    top = Math.max(1, Math.round((1 - below / bd.custLongSorted.length) * 100))
  }

  return { band: bd.label, my, all: bd.all, tc, top, tcAvgYears: stats.tcAvgYears }
}

/* ── 세션 전역 통계 저장소 ────────────────────────────────────────────
   loadReference() 가 meta/cohort 를 읽은 뒤 여기에 담고, buildCoachData 가
   꺼내 쓴다. 데모(#/demo)나 문서 미존재 시에는 null 그대로 — 코호트
   페이지가 자동으로 숨는다. */

let active: CohortStats | null = null

export function setActiveCohortStats(stats: CohortStats | null | undefined): void {
  active = stats ?? null
}

export function getActiveCohortStats(): CohortStats | null {
  return active
}
