/* ══════════════════════════════════════════════════════════════════════
   Firestore 조회 계층

   리포트 1건당 읽기: 샤드 1 + benchmarks 1 + meta 2 = 4 reads
   벤치마크/메타는 세션 캐시에 담아 두 번째 조회부터는 샤드 1건만 읽는다.
   ══════════════════════════════════════════════════════════════════════ */

import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { BenchRow, DatasetMeta, IncomeMap, PlannerRow } from './schema'
import { s } from './schema'
import { allShardIds, normalizeCode, shardIdOf } from './shard'

export const COL = {
  shards: 'plannerShards',
  benchmarks: 'benchmarks',
  meta: 'meta',
} as const

export const DOC = {
  benchmarksAll: 'all',
  incomeMap: 'incomeMap',
  dataset: 'dataset',
  auth: 'auth',
  uploadProgress: 'uploadProgress',
} as const

export interface ReferenceData {
  benchmarks: Record<string, BenchRow>
  incomeMap: IncomeMap
  dataset: DatasetMeta
}

let refCache: ReferenceData | null = null
const shardCache = new Map<string, Record<string, PlannerRow>>()

/** 벤치마크 + incomeMap + dataset (세션 1회) */
export async function loadReference(force = false): Promise<ReferenceData> {
  if (refCache && !force) return refCache

  const [bSnap, iSnap, dSnap] = await Promise.all([
    getDoc(doc(db, COL.benchmarks, DOC.benchmarksAll)),
    getDoc(doc(db, COL.meta, DOC.incomeMap)),
    getDoc(doc(db, COL.meta, DOC.dataset)),
  ])

  if (!bSnap.exists() || !iSnap.exists()) {
    throw new Error(
      '기준 데이터가 아직 업로드되지 않았습니다. 관리자 화면에서 엑셀을 먼저 올려주세요.',
    )
  }

  refCache = {
    benchmarks: bSnap.data() as Record<string, BenchRow>,
    incomeMap: iSnap.data() as IncomeMap,
    dataset: (dSnap.exists()
      ? dSnap.data()
      : {
          months: [202601, 202602, 202603, 202604, 202605, 202606],
          uploadedAt: '',
          rowCount: 0,
          sourceFileName: '',
          caption: '',
        }) as DatasetMeta,
  }
  return refCache
}

/** 사번 1명 조회 — 해당 샤드 문서 1건만 읽는다 */
export async function loadPlanner(codeInput: string): Promise<PlannerRow | null> {
  const code = normalizeCode(codeInput)
  if (!code) return null

  const shardId = shardIdOf(code)
  let shard = shardCache.get(shardId)

  if (!shard) {
    const snap = await getDoc(doc(db, COL.shards, shardId))
    if (!snap.exists()) return null
    shard = snap.data() as Record<string, PlannerRow>
    shardCache.set(shardId, shard)
  }

  return shard[code] ?? null
}

export interface RosterEntry {
  code: string
  name: string
  hq: string
  visionCenter: string
  branch: string
}

let rosterCache: RosterEntry[] | null = null
/** 한 번에 동시 요청할 샤드 수 — 진행률 콜백을 중간중간 부르기 위한 묶음 크기 */
const ROSTER_CHUNK = 32

/**
 * 전체 플래너 명단 — 지역단/비전센터/지점별로 훑어보는 화면용.
 * 샤드가 사번 해시로 나뉘어 있어(조직 단위 쿼리 불가) 256개 샤드를 전부 읽어
 * 클라이언트에서 훑는 방법뿐이다. 세션 1회만 하도록 캐시하고, 이미 읽은
 * 샤드는 shardCache 에도 채워 넣어 이후 단건(사번) 조회가 재조회 없이 되게 한다.
 */
export async function loadAllPlanners(
  onProgress?: (done: number, total: number) => void,
): Promise<RosterEntry[]> {
  if (rosterCache) return rosterCache

  const ids = allShardIds()
  const entries: RosterEntry[] = []
  for (let i = 0; i < ids.length; i += ROSTER_CHUNK) {
    const chunk = ids.slice(i, i + ROSTER_CHUNK)
    await Promise.all(
      chunk.map(async (id) => {
        let shard = shardCache.get(id)
        if (!shard) {
          const snap = await getDoc(doc(db, COL.shards, id))
          shard = snap.exists() ? (snap.data() as Record<string, PlannerRow>) : {}
          shardCache.set(id, shard)
        }
        for (const code of Object.keys(shard)) {
          const row = shard[code]
          entries.push({
            code: code.toUpperCase(),
            name: s(row.f.repName) || s(row.f.name),
            hq: s(row.f.hq),
            visionCenter: s(row.f.visionCenter),
            branch: s(row.f.branch),
          })
        }
      }),
    )
    onProgress?.(Math.min(i + ROSTER_CHUNK, ids.length), ids.length)
  }

  rosterCache = entries
  return entries
}

/** 뷰어 비밀번호 해시 (로그인 전에 읽는다) */
export async function loadAuthMeta(): Promise<{ viewerHash?: string } | null> {
  const snap = await getDoc(doc(db, COL.meta, DOC.auth))
  return snap.exists() ? (snap.data() as { viewerHash?: string }) : null
}

/** 업로드 직후 캐시 무효화 */
export function clearCache() {
  refCache = null
  shardCache.clear()
  rosterCache = null
}

/** 비밀번호 → SHA-256 hex */
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
