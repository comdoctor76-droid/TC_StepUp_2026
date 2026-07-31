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

/** rootId 안의 pageSelector 들을 순서대로 캡처해 캔버스 배열로 반환 (스티칭 없음) */
export async function capturePageCanvases(
  onProgress?: CaptureProgress,
  opts: CaptureOptions = {},
): Promise<HTMLCanvasElement[]> {
  const { rootId = 'print-root', pageSelector = '.a4-page', bodyClass } = opts
  const root = document.getElementById(rootId)
  if (!root) throw new Error('인쇄 영역을 찾을 수 없습니다.')

  const pages = Array.from(root.querySelectorAll<HTMLElement>(pageSelector))
  if (pages.length === 0) throw new Error('출력할 페이지가 없습니다.')

  // 조밀 스타일은 크기를 재기 전에 붙여야 한다 — 붙인 뒤 레이아웃이 정착하도록
  // waitForFonts() 의 프레임 양보를 그 다음에 둔다.
  if (bodyClass) document.body.classList.add(bodyClass)
  try {
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
  } finally {
    if (bodyClass) document.body.classList.remove(bodyClass)
  }
}

/** rootId 안의 pageSelector 들을 순서대로 캡처해 하나의 PNG blob 으로 */
export async function captureAllPages(onProgress?: CaptureProgress, opts: CaptureOptions = {}): Promise<Blob> {
  const canvases = await capturePageCanvases(onProgress, opts)

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
  onReady?.()

  await printAndWait()

  // 인쇄가 끝난 뒤에만 되돌린다 — 이유는 printAndWait() 주석 참고
  document.title = originalTitle
  if (bodyClass) document.body.classList.remove(bodyClass)
  await nextPaint()
}
