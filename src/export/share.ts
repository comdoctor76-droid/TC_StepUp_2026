/* ══════════════════════════════════════════════════════════════════════
   파일명 생성 · 카카오톡 공유 · 다운로드 폴백

   공유는 Web Share API Level 2 (`navigator.share({files})`) 를 쓴다.
   안드로이드 Chrome / iOS Safari 에서 OS 공유 시트가 뜨고, 그 안에
   **카카오톡**을 고르면 이미지가 바로 전송된다.

   Kakao JS SDK 로 이미지를 직접 보내려면 카카오 서버에 먼저 업로드해야 하고
   앱키 발급·도메인 등록이 필요하므로 쓰지 않는다.
   ══════════════════════════════════════════════════════════════════════ */

/** 'YYYYMMDD_HHmm' */
export function stamp(d = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

/** 파일명에 쓸 수 없는 문자 제거 */
function safe(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').trim() || '무명'
}

/**
 * 출력 파일명 몸통(확장자 없음) — `성명(사번)_출력일시`
 * 예: 염도경(1B4503)_20260727_1530
 * 문서 제목(인쇄 대화상자의 PDF 저장 제안 파일명)처럼 확장자가 필요 없는 곳에 재사용한다.
 */
export function outputFileStem(name: string, code: string, d = new Date()): string {
  return `${safe(name)}(${safe(code).toUpperCase()})_${stamp(d)}`
}

/**
 * 출력 파일명 — `성명(사번)_출력일시.png`
 * 예: 염도경(1B4503)_20260727_1530.png
 */
export function outputFileName(name: string, code: string, ext = 'png', d = new Date()): string {
  return `${outputFileStem(name, code, d)}.${ext}`
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/** 파일 공유 → 실패/미지원 시 다운로드 폴백 */
export async function shareOrDownload(
  blob: Blob,
  fileName: string,
  title: string,
): Promise<ShareOutcome> {
  const file = new File([blob], fileName, { type: blob.type || 'image/png' })

  const nav = navigator as Navigator & {
    canShare?: (d: ShareData) => boolean
    share?: (d: ShareData) => Promise<void>
  }

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text: title })
      return 'shared'
    } catch (err) {
      // 사용자가 공유 시트를 닫은 경우는 실패가 아니다
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // 그 외 오류는 다운로드로 폴백
    }
  }

  download(blob, fileName)
  return 'downloaded'
}

export function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Safari 가 다운로드를 시작할 시간을 준다
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** 이 기기가 파일 공유(카카오톡 등)를 지원하는가 */
export function canShareFiles(): boolean {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (!nav.canShare) return false
  try {
    return nav.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] })
  } catch {
    return false
  }
}

/** 모바일 환경 판별 — 전체 인쇄 버튼의 동작을 가른다 */
export function isMobile(): boolean {
  return (
    window.matchMedia('(max-width: 820px)').matches ||
    window.matchMedia('(pointer: coarse)').matches
  )
}
