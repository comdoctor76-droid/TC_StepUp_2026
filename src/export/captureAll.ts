/* ══════════════════════════════════════════════════════════════════════
   A4 5장 → 세로로 이어붙인 PNG 1장

   pixelRatio 1.5 고정:
     장당 794×1123 CSS px → 1191×1685 px, 5장 = 1191×8425 = 10.0M px
     iOS Safari 의 캔버스 총 픽셀 한도(16,777,216)보다 작아야 하므로
     2.0(17.8M)은 쓸 수 없다.
   ══════════════════════════════════════════════════════════════════════ */

import { toCanvas } from 'html-to-image'

export const PIXEL_RATIO = 1.5
const GAP = 10 // 페이지 사이 구분선 두께(px, 스케일 적용 후)

export interface CaptureProgress {
  (done: number, total: number): void
}

/** 폰트가 모두 로드될 때까지 대기 — 캡처 전에 반드시 호출 */
async function waitForFonts() {
  if ('fonts' in document) {
    try {
      await (document as Document & { fonts: FontFaceSet }).fonts.ready
    } catch {
      /* 무시 */
    }
  }
  // 레이아웃 확정을 위해 두 프레임 양보
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
}

/** #print-root 안의 .a4-page 들을 순서대로 캡처해 하나의 PNG blob 으로 */
export async function captureAllPages(onProgress?: CaptureProgress): Promise<Blob> {
  const root = document.getElementById('print-root')
  if (!root) throw new Error('인쇄 영역을 찾을 수 없습니다.')

  const pages = Array.from(root.querySelectorAll<HTMLElement>('.a4-page'))
  if (pages.length === 0) throw new Error('출력할 페이지가 없습니다.')

  await waitForFonts()

  const canvases: HTMLCanvasElement[] = []
  for (let i = 0; i < pages.length; i++) {
    const el = pages[i]
    const c = await toCanvas(el, {
      pixelRatio: PIXEL_RATIO,
      backgroundColor: '#ffffff',
      cacheBust: false,
      // 화면 밖에 있는 요소이므로 실제 크기를 명시한다
      width: el.offsetWidth,
      height: el.offsetHeight,
      style: { transform: 'none', margin: '0' },
    })
    canvases.push(c)
    onProgress?.(i + 1, pages.length)
  }

  const width = Math.max(...canvases.map((c) => c.width))
  const height =
    canvases.reduce((a, c) => a + c.height, 0) + GAP * Math.max(0, canvases.length - 1)

  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('캔버스를 만들 수 없습니다.')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  let y = 0
  canvases.forEach((c, i) => {
    ctx.drawImage(c, Math.floor((width - c.width) / 2), y)
    y += c.height
    if (i < canvases.length - 1) {
      ctx.fillStyle = '#F18D00'
      ctx.fillRect(0, y, width, GAP)
      y += GAP
    }
  })

  const blob = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/png'))
  if (!blob) throw new Error('이미지를 만들지 못했습니다.')
  return blob
}

/** 브라우저 인쇄 대화상자 (A4 5장) */
export async function printAll() {
  await waitForFonts()
  window.print()
}
