/* ══════════════════════════════════════════════════════════════════════
   파싱 결과 → Firestore 적재

   문서 수: 256(샤드) + 1(benchmarks) + 2(meta) ≒ 259
   Spark 무료 한도(일 20,000 writes) 대비 충분히 여유가 있다.

   중간에 끊겨도 meta/uploadProgress 에 완료 샤드를 기록해 이어서 올릴 수 있다.
   ══════════════════════════════════════════════════════════════════════ */

import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { COL, DOC } from './repository'
import type { ParsedWorkbook } from './parseWorkbook'
import { allShardIds, shardIdOf } from './shard'
import type { PlannerRow } from './schema'

export interface UploadOptions {
  months: number[]
  caption: string
  sourceFileName: string
  /** 지정하면 meta/auth.viewerHash 를 갱신한다 */
  viewerPasswordHash?: string
  /** 이미 올린 샤드를 건너뛴다 (중단 후 재개) */
  resume?: boolean
}

export interface UploadProgress {
  (done: number, total: number, label: string): void
}

/** 사번 → 샤드별로 묶는다 */
export function groupIntoShards(
  planners: Record<string, PlannerRow>,
): Map<string, Record<string, PlannerRow>> {
  const map = new Map<string, Record<string, PlannerRow>>()
  for (const id of allShardIds()) map.set(id, {})
  for (const [code, row] of Object.entries(planners)) {
    map.get(shardIdOf(code))![code] = row
  }
  return map
}

export async function uploadParsed(
  parsed: ParsedWorkbook,
  opts: UploadOptions,
  onProgress?: UploadProgress,
): Promise<{ shardsWritten: number; skipped: number }> {
  const shards = groupIntoShards(parsed.planners)
  const ids = [...shards.keys()]

  let doneIds = new Set<string>()
  if (opts.resume) {
    const snap = await getDoc(doc(db, COL.meta, DOC.uploadProgress))
    if (snap.exists()) {
      const d = snap.data() as { sourceFileName?: string; done?: string[] }
      if (d.sourceFileName === opts.sourceFileName) doneIds = new Set(d.done ?? [])
    }
  }

  const total = ids.length + 3
  let done = 0
  let skipped = 0

  // ── 1. 플래너 샤드 ─────────────────────────────────────────────────
  //   Firestore 배치는 최대 500개 쓰기. 샤드 문서가 크므로 20개씩 끊는다.
  const CHUNK = 20
  const written: string[] = [...doneIds]

  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK).filter((id) => !doneIds.has(id))
    if (slice.length === 0) {
      skipped += Math.min(CHUNK, ids.length - i)
      done += Math.min(CHUNK, ids.length - i)
      onProgress?.(done, total, '건너뜀')
      continue
    }

    const batch = writeBatch(db)
    for (const id of slice) batch.set(doc(db, COL.shards, id), shards.get(id)!)
    await batch.commit()

    written.push(...slice)
    done += slice.length
    onProgress?.(done, total, `플래너 샤드 ${done}/${ids.length}`)

    await setDoc(doc(db, COL.meta, DOC.uploadProgress), {
      sourceFileName: opts.sourceFileName,
      done: written,
      updatedAt: new Date().toISOString(),
    })
  }

  // ── 2. 벤치마크 ────────────────────────────────────────────────────
  await setDoc(doc(db, COL.benchmarks, DOC.benchmarksAll), parsed.benchmarks)
  onProgress?.(++done, total, '소득구간 벤치마크')

  // ── 3. incomeMap ───────────────────────────────────────────────────
  await setDoc(doc(db, COL.meta, DOC.incomeMap), parsed.incomeMap)
  onProgress?.(++done, total, '소득구간 매핑')

  // ── 4. dataset (+ 비밀번호 해시) ───────────────────────────────────
  await setDoc(doc(db, COL.meta, DOC.dataset), {
    months: opts.months,
    uploadedAt: new Date().toISOString(),
    rowCount: parsed.rowCount,
    sourceFileName: opts.sourceFileName,
    caption: opts.caption,
  })
  if (opts.viewerPasswordHash) {
    await setDoc(doc(db, COL.meta, DOC.auth), { viewerHash: opts.viewerPasswordHash }, { merge: true })
  }
  onProgress?.(++done, total, '메타데이터')

  return { shardsWritten: ids.length - skipped, skipped }
}
