/* ══════════════════════════════════════════════════════════════════════
   명단 조회 — 지역단 → 비전센터 → 지점 3단 트리로 묶는다.

   원본 데이터에 조직 코드가 아니라 이름 문자열만 있어(hq/visionCenter/branch),
   이름 그대로를 키로 쓴다. 빈 값은 '(미지정)' 으로 묶는다.
   ══════════════════════════════════════════════════════════════════════ */

import type { RosterEntry } from './repository'

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

export function groupByOrg(planners: RosterEntry[]): OrgTree {
  const tree: OrgTree = {}
  for (const p of planners) {
    const hq = p.hq || UNSET
    const vc = p.visionCenter || UNSET
    const br = p.branch || UNSET

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
