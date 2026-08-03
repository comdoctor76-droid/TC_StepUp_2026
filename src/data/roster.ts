/* ══════════════════════════════════════════════════════════════════════
   명단 조회 — 지역단 → 비전센터 → 지점 3단 트리로 묶는다.

   원본 데이터에 조직 코드가 아니라 이름 문자열만 있어(hq/visionCenter/branch),
   이름 그대로를 키로 쓴다. 빈 값은 '(미지정)' 으로 묶되, 비전센터만 예외로
   '드림영업실'(비전센터 없이 지역단 직속인 조직)로 묶는다.
   ══════════════════════════════════════════════════════════════════════ */

import type { RosterEntry } from './repository'
import { normalizeCode } from './shard'

export interface BranchNode {
  count: number
  planners: RosterEntry[]
}

export interface VisionCenterNode {
  count: number
  branches: Record<string, BranchNode>
}

export interface HqNode {
  count: number
  visionCenters: Record<string, VisionCenterNode>
}

export type OrgTree = Record<string, HqNode>

const UNSET = '(미지정)'
/** 비전센터가 비어 있는 인원 — 지역단 직속으로 배치된 별도 조직 */
const UNSET_VISION_CENTER = '드림영업실'
/** 비전센터 드롭다운에 끼워 넣는 가상 항목 — 실제 조직이 아니라 저장된 명단 */
export const STEPUP_VISION_CENTER = 'TC스텝업'

export function groupByOrg(planners: RosterEntry[]): OrgTree {
  const tree: OrgTree = {}
  for (const p of planners) {
    const hq = p.hq.trim() || UNSET
    const vc = p.visionCenter.trim() || UNSET_VISION_CENTER
    const br = p.branch.trim() || UNSET

    const hqNode = (tree[hq] ??= { count: 0, visionCenters: {} })
    hqNode.count++
    const vcNode = (hqNode.visionCenters[vc] ??= { count: 0, branches: {} })
    vcNode.count++
    const brNode = (vcNode.branches[br] ??= { count: 0, planners: [] })
    brNode.count++
    brNode.planners.push(p)
  }
  return tree
}

/** 한글 로케일 정렬 — 드롭다운에 쓰기 좋게 이름순으로 준다 */
export function sortedKeys(rec: Record<string, unknown>): string[] {
  return Object.keys(rec).sort((a, b) => a.localeCompare(b, 'ko'))
}

export function sortedPlanners(planners: RosterEntry[]): RosterEntry[] {
  return [...planners].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

/** 성명에 검색어가 포함된 사람을 이름순으로 — 사번 매칭은 호출부에서 loadPlanner 로 먼저 시도한다 */
export function searchByName(planners: RosterEntry[], query: string): RosterEntry[] {
  const q = query.trim()
  if (!q) return []
  return sortedPlanners(planners.filter((p) => p.name.includes(q)))
}

/* ── 사번 텍스트 붙여넣기로 선택 ──────────────────────────────────────
   드릴다운 대신 사번 목록을 통째로 붙여넣어 고르는 방법. 헤더 없이
   사번만(줄바꿈·쉼표·공백 구분) 있다고 가정한다. */

/** 사번 → RosterEntry, 대소문자·공백 무시 매칭용 */
export function buildCodeIndex(planners: RosterEntry[]): Map<string, RosterEntry> {
  const m = new Map<string, RosterEntry>()
  for (const p of planners) m.set(normalizeCode(p.code), p)
  return m
}

/** 줄바꿈/쉼표/공백으로 구분된 사번 목록 파싱 — 같은 사번 중복 붙여넣기는 한 번만 */
export function parsePastedCodes(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[\s,]+/)) {
    if (!raw) continue
    const key = normalizeCode(raw)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(raw)
  }
  return out
}

export interface PasteMatchResult {
  matched: RosterEntry[]
  /** 명단에서 찾지 못한 원문(붙여넣은 그대로) */
  missing: string[]
}

/** 붙여넣은 사번들을 명단과 대조 */
export function matchPastedCodes(
  codeIndex: Map<string, RosterEntry>,
  rawCodes: string[],
): PasteMatchResult {
  const matched: RosterEntry[] = []
  const missing: string[] = []
  for (const raw of rawCodes) {
    const p = codeIndex.get(normalizeCode(raw))
    if (p) matched.push(p)
    else missing.push(raw)
  }
  return { matched, missing }
}

/* ── TC스텝업 대상자 저장 ─────────────────────────────────────────── */

export interface HqGroup {
  hq: string
  entries: RosterEntry[]
}

/**
 * 선택된 사람들을 실제 소속 지역단(hq)별로 묶는다 — 일괄 인쇄/PDF 저장 뒤
 * "OO지역단 TC스텝업 대상자로 저장할까요?" 프롬프트에 쓴다. 선택 인원이
 * 여러 지역단에 걸쳐 있으면 그룹이 여러 개로 나온다(지역단마다 각자 저장).
 */
export function groupByHq(entries: RosterEntry[]): HqGroup[] {
  const map = new Map<string, RosterEntry[]>()
  for (const p of entries) {
    const hq = p.hq || UNSET
    const arr = map.get(hq)
    if (arr) arr.push(p)
    else map.set(hq, [p])
  }
  return [...map.keys()]
    .sort((a, b) => a.localeCompare(b, 'ko'))
    .map((hq) => ({ hq, entries: map.get(hq)! }))
}
