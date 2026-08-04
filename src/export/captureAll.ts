/* ══════════════════════════════════════════════════════════════════════
   A4 페이지들을 캡처해 PNG(들)로 — 모바일 "이미지로 저장"과 PDF 저장이 공유한다.

   장당 해상도(pixelRatio)와 "한 캔버스에 몇 장을 이어붙일지"는 서로 다른 문제다.
   이어붙인 캔버스의 총 픽셀이 iOS Safari 의 캔버스 픽셀 한도(4096×4096 =
   16,777,216)를 넘으면 브라우저가 조용히 축소·클리핑해 흐리거나 깨진 이미지가
   나온다 — 예전에는 이 한도를 "레포트 6장을 전부 한 장으로 이어붙인다"는
   전제로 pixelRatio 1.5 하나로 맞춰 뒀는데, 성장코칭은 최대 16장까지 나와
   그 전제가 이미 깨져 있었다(16장 × 1.5배 ≈ 32M px, 한도의 거의 2배).

   그래서 이제 장수와 무관하게 항상 안전하도록, 합쳤을 때 총 픽셀이 한도 아래
   여유(MAX_MERGE_PIXELS)를 넘지 않는 만큼씩만 묶어 여러 장의 PNG로 나눈다 —
   장수가 늘어나면 이미지 장수가 늘 뿐 장당 해상도(IMAGE_PIXEL_RATIO)는 항상
   그대로 유지된다. PDF 는 페이지를 하나로 합치지 않고 각각 독립된 이미지로
   끼워 넣으므로 이 한도와 무관해 훨씬 높은 배율(PDF_PIXEL_RATIO)을 쓸 수 있다.
   ══════════════════════════════════════════════════════════════════════ */

import { toCanvas } from 'html-to-image'

/** 이미지로 저장할 때 장당 캡처 배율 (예전 1.5 → 2.0, 실면적 78% 증가) */
export const IMAGE_PIXEL_RATIO = 2
/** PDF 는 페이지를 합치지 않으니 훨씬 높여도 안전하다 */
export const PDF_PIXEL_RATIO = 3
/** 캔버스 하나에 합쳐도 되는 총 픽셀 상한 — iOS 한도(16,777,216)보다 여유를 둔다 */
const MAX_MERGE_PIXELS = 15_000_000
const GAP = 10 // 페이지 사이 구분선 두께(px, 스케일 적용 후)

// 폰트 정착은 실측상 1초 이내. 못 끝나도 무한정 기다리지 않고 그대로 진행한다.
const FONT_WAIT_TIMEOUT_MS = 5000
// 6장 전체가 실측 1~10초. 페이지 한 장이 이 시간을 넘기면 캡처를 포기하고 어느 페이지인지 알린다.
const PAGE_CAPTURE_TIMEOUT_MS = 8000

export interface CaptureProgress {
  (done: number, total: number): void
}

/** 캡처/인쇄 대상을 바꾸고 싶을 때만 넘긴다 — 기본값은 기존 6페이지 흐름과 동일하다. */
export interface CaptureOptions {
  /** 페이지들을 담은 컨테이너의 id. 기본 'print-root' */
  rootId?: string
  /** 컨테이너 안에서 페이지 하나하나를 고르는 선택자. 기본 '.a4-page' */
  pageSelector?: string
  /**
   * 캡처하는 동안만 <body> 에 붙일 클래스 (예: 'capturing-coach').
   *
   * html-to-image 는 지금 화면에 있는 DOM 을 그대로 찍기 때문에, @media print 안에만
   * 있는 조밀 스타일은 캡처에 반영되지 않는다. 성장코칭은 화면용 큰 글자 그대로 찍히면
   * 페이지가 A4(297mm)를 넘겨 pdf.ts 가 눌러 담아 상하가 찌그러졌다 — 이 클래스로
   * 인쇄와 같은 조밀 스타일 + A4 고정 높이를 적용한다.
   *
   * 기존 6페이지 리포트(.a4-page)는 이미 height 가 297mm 로 못박혀 있어 필요 없다.
   */
  bodyClass?: string
  /** 장당 캡처 배율. 기본 IMAGE_PIXEL_RATIO — PDF 저장은 더 높은 PDF_PIXEL_RATIO 를 넘긴다. */
  pixelRatio?: number
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

/**
 * root 안의 <img> 가 전부 로드(또는 실패)될 때까지 대기 — 절대 멈추지 않는다.
 *
 * 표지처럼 cover prop 이 세팅되는 순간에야 <img> 가 DOM 에 처음 붙는 경우, 호출부의
 * nextPaint()(두 프레임 양보)는 React 가 그 <img> 를 실제로 그렸다는 것만 보장할 뿐
 * 이미지 바이트 다운로드가 끝났다는 보장은 아니다 — 세션 첫 인쇄/PDF/이미지 저장에서만
 * 표지가 빈 채로 나오고, 그다음부터는 브라우저가 이미 캐시해 둬서 정상으로 보이던
 * 문제의 원인이었다.
 */
async function waitForImages(root: ParentNode, timeoutMs = FONT_WAIT_TIMEOUT_MS) {
  const pending = Array.from(root.querySelectorAll('img')).filter(
    (img) => !(img.complete && img.naturalWidth > 0),
  )
  if (pending.length === 0) return
  await Promise.race([
    Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          }),
      ),
    ),
    new Promise((r) => setTimeout(r, timeoutMs)),
  ])
}

/** rootId 안의 pageSelector 들을 순서대로 캡처해 캔버스 배열로 반환 (스티칭 없음) */
export async function capturePageCanvases(
  onProgress?: CaptureProgress,
  opts: CaptureOptions = {},
): Promise<HTMLCanvasElement[]> {
  const { rootId = 'print-root', pageSelector = '.a4-page', bodyClass, pixelRatio = IMAGE_PIXEL_RATIO } = opts
  const root = document.getElementById(rootId)
  if (!root) throw new Error('인쇄 영역을 찾을 수 없습니다.')

  const pages = Array.from(root.querySelectorAll<HTMLElement>(pageSelector))
  if (pages.length === 0) throw new Error('출력할 페이지가 없습니다.')

  // 조밀 스타일은 크기를 재기 전에 붙여야 한다 — 붙인 뒤 레이아웃이 정착하도록
  // waitForFonts() 의 프레임 양보를 그 다음에 둔다.
  if (bodyClass) document.body.classList.add(bodyClass)
  try {
    await waitForFonts()
    await waitForImages(root)

    const canvases: HTMLCanvasElement[] = []
    for (let i = 0; i < pages.length; i++) {
      const el = pages[i]
      const c = await withTimeout(
        toCanvas(el, {
          pixelRatio,
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
  } finally {
    if (bodyClass) document.body.classList.remove(bodyClass)
  }
}

/** 캔버스 여러 장을 세로로 이어붙여 PNG blob 하나로 */
function stitchCanvases(canvases: HTMLCanvasElement[]): Promise<Blob> {
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

  return new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했습니다.'))), 'image/png'),
  )
}

/** 이어붙였을 때 MAX_MERGE_PIXELS 를 넘지 않도록 캔버스들을 순서대로 묶는다 */
function groupByPixelBudget(canvases: HTMLCanvasElement[]): HTMLCanvasElement[][] {
  const groups: HTMLCanvasElement[][] = []
  let current: HTMLCanvasElement[] = []
  let currentPixels = 0
  for (const c of canvases) {
    const px = c.width * c.height
    if (current.length > 0 && currentPixels + px > MAX_MERGE_PIXELS) {
      groups.push(current)
      current = []
      currentPixels = 0
    }
    current.push(c)
    currentPixels += px
  }
  if (current.length > 0) groups.push(current)
  return groups
}

/**
 * rootId 안의 pageSelector 들을 순서대로 캡처해 PNG blob(들)로 이어붙인다.
 *
 * 장수가 많아 한 캔버스로 합치면 캔버스 픽셀 한도를 넘길 상황이면 여러 장의
 * PNG 로 자동으로 나눈다(위 MAX_MERGE_PIXELS 참고) — 장당 해상도는 항상
 * IMAGE_PIXEL_RATIO 그대로 유지되고, 대신 결과 이미지 장수가 늘어난다.
 */
export async function captureAllPagesChunked(
  onProgress?: CaptureProgress,
  opts: CaptureOptions = {},
): Promise<Blob[]> {
  const canvases = await capturePageCanvases(onProgress, opts)
  const groups = groupByPixelBudget(canvases)
  return Promise.all(groups.map(stitchCanvases))
}

/** 두 프레임 양보 — 바뀐 DOM/스타일이 실제로 페인트될 시간을 준다 */
export function nextPaint(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
}

/* afterprint 를 못 쏘는 환경 대비 안전판 — 이 시간이 지나면 그냥 끝난 것으로 본다. */
const PRINT_END_FALLBACK_MS = 8000

/**
 * window.print() 를 부르고 **인쇄가 실제로 끝날 때까지** 기다린다.
 *
 * 예전에는 print() 바로 다음 줄에서 body 클래스와 document.title 을 되돌렸다.
 * "print() 가 대화상자가 떠 있는 동안 JS 를 멈춘다"는 전제였는데, 최신 크롬은
 * 미리보기를 넘긴 시점에 곧바로 반환하고 실제 래스터화는 그 뒤에 계속된다.
 * 그래서 래스터화 도중 body.printing-coach 가 떨어져 나가면
 *   - #coach-print-root 가 display:none 이 되고 (#print-root 가 대신 나타남)
 *   - .sheet 가 height:297mm · page-break-after 를 잃어 페이지가 다시 나뉘고
 *   - 화면용 툴바가 인쇄 흐름에 끼어든다
 * 크롬은 이미 뽑아 둔 몇 장을 내보낸 뒤 바뀐 문서로 페이지네이션을 다시 시작해,
 * "1~3장 + 1~9장" 처럼 앞부분이 중복된 출력물이 나왔다(미리보기는 정상, PDF 는
 * print() 를 안 쓰므로 무관 — 실제 신고 증상과 정확히 일치).
 */
function printAndWait(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const done = () => {
      if (settled) return
      settled = true
      window.removeEventListener('afterprint', done)
      if (timer) clearTimeout(timer)
      resolve()
    }
    // print() 보다 먼저 걸어 둔다 — 동기적으로 막는 브라우저는 print() 안에서 발화한다
    window.addEventListener('afterprint', done)
    try {
      window.print()
    } catch {
      done()
      return
    }
    if (!settled) timer = setTimeout(done, PRINT_END_FALLBACK_MS)
  })
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
 * 복원은 반드시 **인쇄가 끝난 뒤**(printAndWait) 여야 한다 — 래스터화 도중 문서를
 * 건드리면 앞부분이 중복 출력된다(printAndWait 주석 참고).
 *
 * bodyClass 를 주면(예: 'printing-coach') 인쇄 직전에 <body> 에 붙였다가 끝나면 뗀다 —
 * #print-root 가 아닌 다른 인쇄 대상(#coach-print-root 등)으로 print.css 가 분기하게
 * 하는 스위치. 기본(6페이지 리포트) 흐름은 아무 클래스도 필요 없다.
 */
export async function printAll(fileStem: string, onReady?: () => void, bodyClass?: string) {
  await waitForFonts()
  const originalTitle = document.title
  document.title = fileStem
  if (bodyClass) document.body.classList.add(bodyClass)
  // 인쇄용 스타일이 실제로 적용된 뒤에 인쇄를 시작한다
  await nextPaint()
  // bodyClass 로 어느 쪽이 인쇄 대상인지 알 수 있다 — 그 안의 표지 등 <img> 가
  // 실제로 로드될 때까지 기다린다(세션 첫 인쇄에서만 표지가 비어 보이던 문제).
  const activeRoot = document.getElementById(bodyClass ? 'coach-print-root' : 'print-root')
  if (activeRoot) await waitForImages(activeRoot)
  onReady?.()

  await printAndWait()

  // 인쇄가 끝난 뒤에만 되돌린다 — 이유는 printAndWait() 주석 참고
  document.title = originalTitle
  if (bodyClass) document.body.classList.remove(bodyClass)
  await nextPaint()
}
