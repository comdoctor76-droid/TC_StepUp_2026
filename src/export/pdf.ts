/* ══════════════════════════════════════════════════════════════════════
   A4 6장 → 실제 다중 페이지 PDF

   pdf-lib 은 메인 번들에 넣지 않는다 — "PDF로 저장"을 실제로 눌렀을 때만
   동적 import 로 불러온다 (Admin/Demo 와 같은 코드 분할 관례).
   ══════════════════════════════════════════════════════════════════════ */

import { capturePageCanvases, type CaptureOptions, type CaptureProgress } from './captureAll'

/** rootId 안의 pageSelector 들을 A4 페이지 각각으로 담은 PDF Blob 을 만든다 */
export async function exportPdf(onProgress?: CaptureProgress, opts: CaptureOptions = {}): Promise<Blob> {
  const canvases = await capturePageCanvases(onProgress, opts)

  const { PDFDocument, PageSizes } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const [pw, ph] = PageSizes.A4

  for (const c of canvases) {
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
    if (!blob) throw new Error('PDF를 만들지 못했습니다.')
    const img = await doc.embedPng(await blob.arrayBuffer())
    const page = doc.addPage([pw, ph])

    // A4 비율을 유지한 채 페이지에 맞춰 넣고 가운데 정렬한다.
    // 예전에는 width/height 를 A4 로 그냥 못박아 그렸는데, 캡처된 페이지가 A4 보다
    // 길면(성장코칭에서 실측 최대 38% 초과) 그만큼 상하가 눌려 글자가 찌그러졌다.
    // 비율을 지키면 최악의 경우 위아래 여백이 생길 뿐 왜곡은 나오지 않는다.
    const scale = Math.min(pw / img.width, ph / img.height)
    const w = img.width * scale
    const h = img.height * scale
    page.drawImage(img, { x: (pw - w) / 2, y: ph - h, width: w, height: h })
  }

  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}
