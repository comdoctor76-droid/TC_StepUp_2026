/* ══════════════════════════════════════════════════════════════════════
   파싱 결과 → Firestore 적재

   쓰기 횟수: 256(샤드) + 8(진행률) + 4(benchmarks·incomeMap·dataset·auth) ≒ 268
   Spark 무료 한도(일 20,000 writes) 대비 충분히 여유가 있다.

   ⚠️ 샤드는 반드시 **문서 1건씩** 쓴다.
      writeBatch 로 20개를 묶으면 요청이 약 2.85MB 가 되는데, 브라우저 JS SDK 의
      WebChannel(long-polling) 전송은 문서상 커밋 한도(10 MiB)보다 훨씬 낮은
      실질 한계를 가져 'Transaction too big. Decrease transaction size.' 로 실패한다.
      1건씩 쓰면 요청이 최대 166KB 라 어떤 전송 한계에도 걸리지 않는다.

   중간에 끊겨도 meta/uploadProgress 에 완료 샤드를 기록해 이어서 올릴 수 있다.
   ══════════════════════════════════════════════════════════════════════ */

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { COL, DOC } from './repository'
import type { ParsedWorkbook } from './parseWorkbook'
import { allShardIds, shardIdOf } from './shard'
import type { PlannerRow } from './schema'

/** 동시에 보낼 쓰기 요청 수 */
const CONCURRENCY = 4
/** 진행률 문서를 갱신하는 주기 (매 건마다 쓰면 쓰기가 256건 늘어난다) */
const PROGRESS_EVERY = 32
/** 문서 1건 쓰기 재시도 횟수 */
const RETRIES = 3

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 문서 1건 쓰기 + 지수 백오프 재시도 (2s → 4s → 8s) */
async function setDocWithRetry(path: [string, string], data: object, label: string) {
  let lastErr: unknown
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      await setDoc(doc(db, path[0], path[1]), data)
      return
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)

      // 크기 문제는 재시도해도 소용없다 — 원인을 바로 알려준다
      if (/too big|too large|exceeds the maximum/i.test(msg)) {
        throw new Error(
          `${label} 문서가 너무 큽니다. src/data/shard.ts 의 SHARD_COUNT 를 늘린 뒤 ` +
            `업로더와 앱을 함께 다시 배포해야 합니다. (원본 오류: ${msg})`,
        )
      }
      // 권한 문제도 재시도 대상이 아니다
      if (/permission|insufficient|unauthenticated/i.test(msg)) {
        throw new Error(
          `쓰기 권한이 없습니다. Firestore 규칙의 isAdmin() 에 현재 로그인 계정의 UID 가 ` +
            `들어 있는지, 규칙을 게시했는지 확인해 주세요. (원본 오류: ${msg})`,
        )
      }
      if (attempt === RETRIES) break
      await sleep(2000 * Math.pow(2, attempt))
    }
  }
  throw lastErr
}

export async function uploadParsed(
  parsed: ParsedWorkbook,
  opts: UploadOptions,
  onProgress?: UploadProgress,
): Promise<{ shardsWritten: number; skipped: number }> {
  const shards = groupIntoShards(parsed.planners)
  const ids = [...shards.keys()]

  // ── 재개 지점 확인 ───────────────────────────────────────────────────
  let doneIds = new Set<string>()
  if (opts.resume) {
    const snap = await getDoc(doc(db, COL.meta, DOC.uploadProgress))
    if (snap.exists()) {
      const d = snap.data() as { sourceFileName?: string; done?: string[] }
      if (d.sourceFileName === opts.sourceFileName) doneIds = new Set(d.done ?? [])
    }
  }

  const pending = ids.filter((id) => !doneIds.has(id))
  const skipped = ids.length - pending.length
  const total = ids.length + 5 // 샤드 + benchmarks + incomeMap + dataset + cohort + auth
  let done = skipped

  const writeProgressDoc = () =>
    setDoc(doc(db, COL.meta, DOC.uploadProgress), {
      sourceFileName: opts.sourceFileName,
      done: [...doneIds],
      updatedAt: new Date().toISOString(),
    })

  // ── 1. 플래너 샤드 — 문서 1건씩, 동시 4개 ────────────────────────────
  let cursor = 0
  let sinceProgressDoc = 0

  const worker = async () => {
    for (;;) {
      const i = cursor++
      if (i >= pending.length) return
      const id = pending[i]

      await setDocWithRetry([COL.shards, id], shards.get(id)!, `샤드 ${id}`)

      doneIds.add(id)
      done++
      sinceProgressDoc++
      onProgress?.(done, total, `플래너 샤드 ${done - skipped}/${pending.length}`)

      if (sinceProgressDoc >= PROGRESS_EVERY) {
        sinceProgressDoc = 0
        await writeProgressDoc()
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  if (pending.length > 0) await writeProgressDoc()

  // ── 2. 벤치마크 ──────────────────────────────────────────────────────
  await setDocWithRetry([COL.benchmarks, DOC.benchmarksAll], parsed.benchmarks, '벤치마크')
  onProgress?.(++done, total, '소득구간 벤치마크')

  // ── 3. incomeMap ─────────────────────────────────────────────────────
  await setDocWithRetry([COL.meta, DOC.incomeMap], parsed.incomeMap, '소득구간 매핑')
  onProgress?.(++done, total, '소득구간 매핑')

  // ── 4. dataset ───────────────────────────────────────────────────────
  await setDocWithRetry(
    [COL.meta, DOC.dataset],
    {
      months: opts.months,
      uploadedAt: new Date().toISOString(),
      rowCount: parsed.rowCount,
      sourceFileName: opts.sourceFileName,
      caption: opts.caption,
    },
    '메타데이터',
  )
  onProgress?.(++done, total, '메타데이터')

  // ── 5. 차월 코호트 통계 (성장코칭 "내 연차의 기준") ──────────────────
  if (parsed.cohortStats) {
    await setDocWithRetry([COL.meta, DOC.cohort], parsed.cohortStats, '코호트 통계')
  }
  onProgress?.(++done, total, '코호트 통계')

  // ── 6. 접속 비밀번호 (지정한 경우에만) ───────────────────────────────
  if (opts.viewerPasswordHash) {
    await setDoc(
      doc(db, COL.meta, DOC.auth),
      { viewerHash: opts.viewerPasswordHash },
      { merge: true },
    )
  }
  onProgress?.(++done, total, '접속 비밀번호')

  return { shardsWritten: pending.length, skipped }
}
