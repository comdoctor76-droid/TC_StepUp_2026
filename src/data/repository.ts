/* ══════════════════════════════════════════════════════════════════════
   Firestore 조회 계층

   리포트 1건당 읽기: 샤드 1 + benchmarks 1 + meta 2 = 4 reads
   벤치마크/메타는 세션 캐시에 담아 두 번째 조회부터는 샤드 1건만 읽는다.
   ══════════════════════════════════════════════════════════════════════ */

import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { BenchRow, DatasetMeta, IncomeMap, PlannerRow } from './schema'
import { normalizeCode, shardIdOf } from './shard'

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

/** 뷰어 비밀번호 해시 (로그인 전에 읽는다) */
export async function loadAuthMeta(): Promise<{ viewerHash?: string } | null> {
  const snap = await getDoc(doc(db, COL.meta, DOC.auth))
  return snap.exists() ? (snap.data() as { viewerHash?: string }) : null
}

/** 업로드 직후 캐시 무효화 */
export function clearCache() {
  refCache = null
  shardCache.clear()
}

/** 비밀번호 → SHA-256 hex */
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
