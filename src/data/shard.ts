/* ══════════════════════════════════════════════════════════════════════
   Firestore 샤딩

   input 16,249행을 문서 1개씩 쓰면 매월 16,249 writes → Spark 무료 한도(일 2만)
   에 근접한다. 사번 앞 2자리로 나누면 '1d' 접두사에만 6,242행이 몰려
   문서 1MB 한도를 넘긴다. 따라서 **해시 기반 균등 샤딩**을 쓴다.

   샤드당 평균 16,249 / 256 ≒ 64명, 약 130KB (1MB 한도의 13%).
   매월 쓰기: 256(샤드) + 1(benchmarks) + 2(meta) ≒ 259 writes.

   ⚠️ 이 함수는 업로더(관리자 화면·CLI)와 조회 클라이언트가 **반드시 공유**한다.
      한쪽만 바꾸면 조회가 전부 실패한다.
   ══════════════════════════════════════════════════════════════════════ */

export const SHARD_COUNT = 256

/** 사번 정규화 — 대소문자 무시, 공백 제거. 원본에 '1B4503'/'1b4503' 혼용. */
export function normalizeCode(code: string): string {
  return String(code).trim().toLowerCase()
}

/** FNV-1a 32bit */
function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** 사번 → 샤드 ID ('000' ~ '255') */
export function shardIdOf(code: string): string {
  return String(fnv1a(normalizeCode(code)) % SHARD_COUNT).padStart(3, '0')
}

/** 전체 샤드 ID 목록 */
export function allShardIds(): string[] {
  return Array.from({ length: SHARD_COUNT }, (_, i) => String(i).padStart(3, '0'))
}
