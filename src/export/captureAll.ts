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

// 폰트 정착은 실측상 1초 이내. 못 끝나도 무한정 기다리지 않고 그대로 진행한다.
const FONT_WAIT_TIMEOUT_MS = 5000
// 6장 전체가 실측 1~10초. 페이지 한 장이 이 시간을 넘기면 캡처를 포기하고 어느 페이지인지 알린다.
const PAGE_CAPTURE_TIMEOUT_MS = 8000

export interface CaptureProgress {
  (done: number, total: number): void
}

/** p 가 ms 안에 끝나지 않으면 onTimeout() 이 만든 에러로 대신 거부한다 (p 자체를 취소하진 않는다). */
function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

/** 폰트가 모두 로드될 때까지 대기 — 캡처/인쇄 전에 반드시 호출. 절대 멈추지 않는다. */
async function waitForFonts(timeoutMs = FONT_WAIT_TIMEOUT_MS) {
  const ready = (async () => {
    if ('fonts' in document) {
      try {
        await (document as Document & { fonts: FontFaceSet }).fonts.ready
      } catch {
        /* 무시 */
      }
    }
    // 레이아웃 확정을 위해 두 프레임 양보
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
  })()
  await Promise.race([ready, new Promise((r) => setTimeout(r, timeoutMs))])
}

/** #print-root 안의 .a4-page 들을 순서대로 캡처해 캔버스 배열로 반환 (스티칭 없음) */
export async function capturePageCanvases(onProgress?: CaptureProgress): Promise<HTMLCanvasElement[]> {
  const root = document.getElementById('print-root')
  if (!root) throw new Error('인쇄 영역을 찾을 수 없습니다.')

  const pages = Array.from(root.querySelectorAll<HTMLElement>('.a4-page'))
  if (pages.length === 0) throw new Error('출력할 페이지가 없습니다.')

  await waitForFonts()

  const canvases: HTMLCanvasElement[] = []
  for (let i = 0; i < pages.length; i++) {
    const el = pages[i]
    const c = await withTimeout(
      toCanvas(el, {
        pixelRatio: PIXEL_RATIO,
        backgroundColor: '#ffffff',
        cacheBust: false,
        // 화면 밖에 있는 요소이므로 실제 크기를 명시한다
        width: el.offsetWidth,
        height: el.offsetHeight,
        style: { transform: 'none', margin: '0' },
      }),
      PAGE_CAPTURE_TIMEOUT_MS,
      () => new Error(`이미지를 만들지 못했습니다. (${i + 1}번째 페이지)`),
    )
    canvases.push(c)
    onProgress?.(i + 1, pages.length)
  }
  return canvases
}

/** #print-root 안의 .a4-page 들을 순서대로 캡처해 하나의 PNG blob 으로 */
export async function captureAllPages(onProgress?: CaptureProgress): Promise<Blob> {
  const canvases = await capturePageCanvases(onProgress)

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

/**
 * 브라우저 인쇄 대화상자 (A4 6장).
 *
 * window.print() 는 Promise 가 아니라 undefined 를 반환하므로, 네이티브 인쇄창이
 * 떠 있는 동안 브라우저가 JS 를 멈추더라도 이 함수의 async 흐름과는 무관하다.
 * onReady 는 폰트 대기가 끝나고 print() 를 호출하기 직전에 불려, 호출부가 자체
 * 오버레이를 그 시점에 바로 닫을 수 있게 한다 (오버레이가 인쇄창과 겹쳐 떠 있지 않도록).
 *
 * fileStem 은 인쇄 대화상자에서 "PDF로 저장"을 고를 때 브라우저가 제안하는 파일명이
 * document.title 을 그대로 쓰기 때문에 필요하다 — 인쇄 직전에만 잠깐 바꿨다가 복원한다.
 * window.print() 가 대화상자가 떠 있는 동안 JS 를 멈추므로, 복원 코드는 항상 대화상자가
 * 닫힌 뒤에만 실행된다.
 */
export async function printAll(fileStem: string, onReady?: () => void) {
  await waitForFonts()
  const originalTitle = document.title
  document.title = fileStem
  onReady?.()
  window.print()
  document.title = originalTitle
}
