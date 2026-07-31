/* ══════════════════════════════════════════════════════════════════════
   TC스텝업 하이라이트 PDF — 저장·조회

   성장코칭 화면 뒤에 붙는 강의용 하이라이트 자료다. 두 곳에서 온다:

     1) 기본본  — 저장소에 함께 배포된 public/highlight/…pdf
     2) 교체본  — 관리자가 화면에서 새로 올린 파일 (Firestore)

   교체본이 있으면 그걸 쓰고, 없으면 기본본을 쓴다.

   **왜 Firestore 인가** — Storage 를 쓰려면 storage.rules 를 따로 게시해야
   하는데, meta/{docId} 는 이미 "로그인하면 읽기 · 관리자만 쓰기" 규칙이 있어
   규칙을 건드리지 않고 바로 쓸 수 있다. 다만 문서 1건은 1MiB 를 넘을 수 없어
   base64 를 여러 조각으로 나눠 담는다(meta/highlightChunk0, 1, …).
   ══════════════════════════════════════════════════════════════════════ */

import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { COL } from './repository'

/** meta/highlight — 조각들의 목차 */
export const DOC_HIGHLIGHT = 'highlight'
const chunkDocId = (i: number) => `highlightChunk${i}`

/** Firestore 문서 1건 한도(1MiB)보다 넉넉히 작게 — base64 는 1글자 = 1바이트다 */
const CHUNK_CHARS = 600_000

/** 저장소에 함께 배포되는 기본 하이라이트 (관리자가 교체하기 전까지 쓰인다) */
const BUNDLED_PATH = 'highlight/tc-stepup-highlight.pdf'
/**
 * 기본본을 내려받을 때 쓸 파일명.
 * 관리자가 새 파일을 올리면 그때부터는 **올린 파일의 이름 그대로** 내려간다.
 */
export const BUNDLED_FILE_NAME = '260728TC스텝업과정_하이라이트.pdf'

export interface HighlightMeta {
  fileName: string
  size: number
  chunkCount: number
  updatedAt: string
}

export interface HighlightFile {
  bytes: Uint8Array
  fileName: string
  size: number
  /** 'uploaded' = 관리자가 올린 교체본, 'bundled' = 배포에 포함된 기본본 */
  source: 'uploaded' | 'bundled'
  updatedAt?: string
}

/* ── base64 ↔ 바이트 ──────────────────────────────────────────────────
   한 번에 String.fromCharCode(...전체) 를 부르면 인자가 수십만 개라 스택이
   터진다 — 작은 덩어리로 끊어서 처리한다. */
const B64_STEP = 0x8000

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += B64_STEP) {
    bin += String.fromCharCode(...bytes.subarray(i, i + B64_STEP))
  }
  return btoa(bin)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

let cache: HighlightFile | null = null

/** 하이라이트 PDF 를 가져온다 — 교체본이 있으면 교체본, 없으면 기본본 */
export async function loadHighlight(force = false): Promise<HighlightFile> {
  if (cache && !force) return cache

  // 1) 관리자가 올린 교체본
  try {
    const metaSnap = await getDoc(doc(db, COL.meta, DOC_HIGHLIGHT))
    if (metaSnap.exists()) {
      const meta = metaSnap.data() as HighlightMeta
      if (meta.chunkCount > 0) {
        const snaps = await Promise.all(
          Array.from({ length: meta.chunkCount }, (_, i) =>
            getDoc(doc(db, COL.meta, chunkDocId(i))),
          ),
        )
        const b64 = snaps.map((s) => (s.exists() ? ((s.data() as { b64?: string }).b64 ?? '') : '')).join('')
        if (b64) {
          const bytes = base64ToBytes(b64)
          cache = {
            bytes,
            fileName: meta.fileName || BUNDLED_FILE_NAME,
            size: bytes.length,
            source: 'uploaded',
            updatedAt: meta.updatedAt,
          }
          return cache
        }
      }
    }
  } catch {
    // 권한/네트워크 문제면 기본본으로 넘어간다 — 화면이 비지 않게 하는 게 우선
  }

  // 2) 배포에 포함된 기본본
  const res = await fetch(`${import.meta.env.BASE_URL}${BUNDLED_PATH}`)
  if (!res.ok) throw new Error('하이라이트 자료를 불러오지 못했습니다.')
  const bytes = new Uint8Array(await res.arrayBuffer())
  cache = { bytes, fileName: BUNDLED_FILE_NAME, size: bytes.length, source: 'bundled' }
  return cache
}

export interface SaveProgress {
  (done: number, total: number): void
}

/**
 * 새 PDF 로 교체한다 (관리자만 — firestore.rules 의 meta 쓰기 규칙).
 * 조각 수가 줄어드는 경우 남아 있는 옛 조각을 지워 찌꺼기를 남기지 않는다.
 */
export async function saveHighlight(file: File, onProgress?: SaveProgress): Promise<HighlightMeta> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length === 0) throw new Error('빈 파일입니다.')

  const b64 = bytesToBase64(bytes)
  const chunks: string[] = []
  for (let i = 0; i < b64.length; i += CHUNK_CHARS) chunks.push(b64.slice(i, i + CHUNK_CHARS))

  const prev = await getDoc(doc(db, COL.meta, DOC_HIGHLIGHT))
  const prevCount = prev.exists() ? ((prev.data() as HighlightMeta).chunkCount ?? 0) : 0

  const total = chunks.length + 1
  for (let i = 0; i < chunks.length; i++) {
    await setDoc(doc(db, COL.meta, chunkDocId(i)), { b64: chunks[i] })
    onProgress?.(i + 1, total)
  }

  const meta: HighlightMeta = {
    fileName: file.name,
    size: bytes.length,
    chunkCount: chunks.length,
    updatedAt: new Date().toISOString(),
  }
  await setDoc(doc(db, COL.meta, DOC_HIGHLIGHT), meta)
  onProgress?.(total, total)

  // 예전 파일이 더 길었다면 남는 조각 정리
  for (let i = chunks.length; i < prevCount; i++) {
    await deleteDoc(doc(db, COL.meta, chunkDocId(i))).catch(() => {})
  }

  cache = { bytes, fileName: meta.fileName, size: bytes.length, source: 'uploaded', updatedAt: meta.updatedAt }
  return meta
}

/** 업로드 직후 등 캐시 무효화 */
export function clearHighlightCache() {
  cache = null
}
