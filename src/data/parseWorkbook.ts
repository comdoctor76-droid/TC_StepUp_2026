/* ══════════════════════════════════════════════════════════════════════
   원본 xlsx → Firestore 적재용 구조로 변환.
   브라우저(관리자 화면)와 Node(CLI 임포터)에서 동일하게 쓴다.

   읽는 시트: input · 소득별Data · Q6 유지고객 · Q7 장기건수
   ══════════════════════════════════════════════════════════════════════ */

import * as XLSX from 'xlsx'
import {
  BENCH_FIELDS,
  BENCH_LABELS,
  FIELDS,
  TC_GROUP,
  type BenchFieldKey,
  type BenchRow,
  type FieldKey,
  type IncomeMap,
  type PlannerRow,
  n,
} from './schema'
import { normalizeCode } from './shard'

export interface ParsedWorkbook {
  planners: Record<string, PlannerRow> // key = 정규화된 사번
  benchmarks: Record<string, BenchRow> // key = 소득 라벨 (BENCH_LABELS)
  incomeMap: IncomeMap
  rowCount: number
  warnings: string[]
}

type Cell = string | number | boolean | null | undefined
type Grid = Cell[][]

/** 시트를 0-based 2차원 배열로. `defval:null` 로 빈 셀도 자리를 지킨다. */
function grid(wb: XLSX.WorkBook, name: string): Grid {
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`시트를 찾을 수 없습니다: "${name}"`)
  return XLSX.utils.sheet_to_json<Cell[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: true,
  }) as Grid
}

/** 엑셀 열 문자(A,B,…,AA) → 0-based 인덱스 */
export function colIndex(col: string): number {
  let x = 0
  for (const ch of col.toUpperCase()) x = x * 26 + (ch.charCodeAt(0) - 64)
  return x - 1
}

const cell = (g: Grid, row0: number, col0: number): Cell => g[row0]?.[col0] ?? null

/** 실제로 읽는 시트만 파싱한다. 원본에는 16,250행짜리 숨김 시트가 여럿 있어
 *  전체를 읽으면 브라우저에서 30초 가까이 걸린다.
 *  Q6/Q7 두 시트는 워크북 버전에 따라 탭 이름이 바뀐 적이 있어 후보를 여럿 둔다. */
const Q6_SHEET_CANDIDATES = ['Q6 유지고객', '6개월 유지고객']
const Q7_SHEET_CANDIDATES = ['Q7 장기건수', '장기건수']
const NEEDED_SHEETS = ['input', '소득별Data', ...Q6_SHEET_CANDIDATES, ...Q7_SHEET_CANDIDATES]

export function parseWorkbook(data: ArrayBuffer | Uint8Array): ParsedWorkbook {
  const wb = XLSX.read(data, {
    type: 'array',
    cellDates: false,
    cellStyles: false,
    cellHTML: false,
    cellFormula: false,
    sheets: NEEDED_SHEETS,
  })
  const warnings: string[] = []

  // ── input ───────────────────────────────────────────────────────────
  // 1행 = 헤더, B열(0-based 1)부터 CK열(0-based 88)까지.
  // FIELDS 의 n(1-based, B기준) → 0-based 열 = n
  const gi = grid(wb, 'input')
  const planners: Record<string, PlannerRow> = {}
  const fieldEntries = Object.entries(FIELDS) as [FieldKey, number][]

  for (let r = 1; r < gi.length; r++) {
    const raw = cell(gi, r, FIELDS.code)
    if (raw === null || raw === undefined || raw === '') continue
    const code = normalizeCode(String(raw))

    const f: PlannerRow['f'] = {}
    for (const [key, idx] of fieldEntries) {
      const v = cell(gi, r, idx)
      if (v === null || v === undefined || v === '') continue
      f[key] = typeof v === 'number' ? v : String(v)
    }

    if (planners[code]) warnings.push(`사번 중복: ${code} (뒤 행으로 덮어씀)`)
    planners[code] = {
      f,
      s: { retainLong: [], retainAuto: [], retainBoth: [], cntLong: [], custLong: [] },
    }
  }

  // ── Q6 유지고객 ─────────────────────────────────────────────────────
  // A=사원번호, D~I=장기이관제외 M-5..M, J~O=자동차이관제외, P~U=자장이관제외
  attachSeries(wb, Q6_SHEET_CANDIDATES, planners, warnings, [
    ['retainLong', 3],
    ['retainAuto', 9],
    ['retainBoth', 15],
  ])

  // ── Q7 장기건수 ─────────────────────────────────────────────────────
  // A=사원번호, D~I=장기건수 M-5..M, J~O=장기고객수 M-5..M
  attachSeries(wb, Q7_SHEET_CANDIDATES, planners, warnings, [
    ['cntLong', 3],
    ['custLong', 9],
  ])

  // ── 소득별Data ──────────────────────────────────────────────────────
  const gd = grid(wb, '소득별Data')
  const COL_C = colIndex('C')

  // 행 33~47 (1-based) = 0-based 32~46. C열이 소득 라벨.
  const benchmarks: Record<string, BenchRow> = {}
  const benchEntries = Object.entries(BENCH_FIELDS) as [BenchFieldKey, number][]
  for (let r = 32; r <= 46; r++) {
    const label = cell(gd, r, COL_C)
    if (label === null || label === '') continue
    const key = String(label).trim()
    const b: BenchRow['b'] = {}
    for (const [k, idx] of benchEntries) {
      const v = cell(gd, r, COL_C + idx - 1)
      if (v === null || v === undefined || v === '') continue
      b[k] = typeof v === 'number' ? v : String(v)
    }
    benchmarks[key] = { b }
  }
  for (const label of BENCH_LABELS) {
    if (!benchmarks[label]) warnings.push(`소득별Data 벤치마크 행 누락: ${label}`)
  }

  // ── incomeMap ───────────────────────────────────────────────────────
  // 행 2~28 (0-based 1~27): C=육성소득 원본, D=인원수, F=묶음 라벨
  const groupOf: Record<string, string> = {}
  const headcount: Record<string, number> = {}
  for (let r = 1; r <= 27; r++) {
    const src = cell(gd, r, COL_C)
    const grp = cell(gd, r, COL_C + 3) // F열
    if (!src || src === '육성소득' || src === '합계') continue
    if (grp) groupOf[String(src).trim()] = String(grp).trim()
    headcount[String(src).trim()] = n(cell(gd, r, COL_C + 1))
  }

  // 행 33~46 (0-based 32~45): C=묶음 라벨, E=차상급 라벨
  const nextLevel: Record<string, string> = {}
  for (let r = 32; r <= 45; r++) {
    const cur = cell(gd, r, COL_C)
    const nxt = cell(gd, r, COL_C + 2) // E열
    if (cur && nxt) nextLevel[String(cur).trim()] = String(nxt).trim()
  }

  // 행 50~63 (0-based 49~62): C=육성소득, D=역누적비율, E=상위/하위, F=이상/이하
  const percentile: IncomeMap['percentile'] = {}
  for (let r = 49; r <= 62; r++) {
    const lab = cell(gd, r, COL_C)
    if (!lab) continue
    percentile[String(lab).trim()] = {
      rate: n(cell(gd, r, COL_C + 1)),
      band: String(cell(gd, r, COL_C + 2) ?? ''),
      cmp: String(cell(gd, r, COL_C + 3) ?? ''),
    }
  }

  if (!benchmarks[TC_GROUP]) {
    warnings.push(`'${TC_GROUP}' 행(소득별Data 47행)이 없습니다. 비교군 표시가 비게 됩니다.`)
  }

  return {
    planners,
    benchmarks,
    incomeMap: { groupOf, nextLevel, percentile, headcount },
    rowCount: Object.keys(planners).length,
    warnings,
  }
}

/** Q6/Q7 시트의 6개월 시계열을 planner 레코드에 붙인다.
 *  `sheetNames` 는 후보 목록 — 첫 번째로 존재하는 시트를 쓴다. */
function attachSeries(
  wb: XLSX.WorkBook,
  sheetNames: string[],
  planners: Record<string, PlannerRow>,
  warnings: string[],
  specs: [keyof PlannerRow['s'], number][],
) {
  let g: Grid | undefined
  let matched = ''
  for (const sheet of sheetNames) {
    try {
      g = grid(wb, sheet)
      matched = sheet
      break
    } catch {
      // 다음 후보 시도
    }
  }
  if (!g) {
    warnings.push(`선택 시트 "${sheetNames.join('/')}" 가 없어 추이 그래프가 비게 됩니다.`)
    return
  }
  let missing = 0
  for (let r = 1; r < g.length; r++) {
    const raw = cell(g, r, 0)
    if (raw === null || raw === '') continue
    const code = normalizeCode(String(raw))
    const p = planners[code]
    if (!p) {
      missing++
      continue
    }
    for (const [key, start] of specs) {
      p.s[key] = Array.from({ length: 6 }, (_, i) => n(cell(g, r, start + i)))
    }
  }
  if (missing > 0) {
    warnings.push(`"${matched}" 에 input 에 없는 사번 ${missing}건 — 무시했습니다.`)
  }
}
