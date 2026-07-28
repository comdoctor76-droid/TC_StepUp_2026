/* ══════════════════════════════════════════════════════════════════════
   PDF 저장 위치 선택

   File System Access API(showSaveFilePicker)가 있으면(Chrome/Edge 데스크톱)
   저장 위치를 물어 직접 쓴다. 없으면(Safari/Firefox 등) 기존 download() 로
   폴백 — shareOrDownload() 와 동일한 취소/실패 처리 패턴을 따른다.
   ══════════════════════════════════════════════════════════════════════ */

import { download } from './share'

export type SaveOutcome = 'saved' | 'downloaded' | 'cancelled'

interface FileSystemWritableStream {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}
interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableStream>
}
type ShowSaveFilePicker = (opts: {
  suggestedName: string
  types: { description: string; accept: Record<string, string[]> }[]
}) => Promise<FileSystemFileHandleLike>

export async function savePdf(blob: Blob, fileName: string): Promise<SaveOutcome> {
  const w = window as Window & { showSaveFilePicker?: ShowSaveFilePicker }

  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'saved'
    } catch (err) {
      // 사용자가 저장 대화상자를 닫은 경우는 실패가 아니다
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // 그 외 오류(권한 거부 등)는 다운로드로 폴백
    }
  }

  download(blob, fileName)
  return 'downloaded'
}
