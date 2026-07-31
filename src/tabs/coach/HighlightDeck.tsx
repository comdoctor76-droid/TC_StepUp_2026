/* ══════════════════════════════════════════════════════════════════════
   TC스텝업 하이라이트 — 성장코칭 뒤에 붙는 강의용 자료

   원본 PDF 를 pdf.js 로 **매번 다시 그린다**. 이미지로 한 번 만들어 두고
   CSS 로 늘리면 확대할수록 뭉개지지만, 확대 배율이 바뀔 때마다 그 배율로
   래스터화하면 몇 배로 키워도 글자가 깨지지 않는다 — 강의용 화면 확대에
   필요한 조건이다. 화면 밀도(devicePixelRatio)도 곱해 레티나에서도 선명하다.

   1페이지(표지)는 성장코칭 뒤에 이어 붙일 때 중복이라 건너뛴다 —
   내려받는 파일은 자르지 않은 **원본 그대로**다.
   ══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { auth } from '../../firebase'
import { isAdminUser } from '../../session'
import { loadHighlight, saveHighlight, type HighlightFile } from '../../data/highlight'

/** 표지(1페이지)는 화면에 싣지 않는다 */
const SKIP_PAGES = 1
/** 100% 의 기준 폭 — A4 한 장(210mm)의 CSS 픽셀. 즉 100% = 실물 크기 */
const A4_WIDTH = 794
/** 확대 배율 — A4 실물 크기 대비 비율 */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]
const DEFAULT_ZOOM_INDEX = 2
/**
 * 캔버스에 실제로 담을 픽셀의 상한 — A4 폭의 몇 배까지 그릴지.
 *
 * 확대 배율만큼 무한정 키우면 메모리가 폭발한다: 400% × 레티나(2배) 면
 * 한 장이 6352×8984 = 228MB, 15장이면 3GB 라 브라우저가 죽는다.
 * 화면에 보이는 크기는 배율대로 커지되, 담는 픽셀은 A4 폭의 4배에서 멈춘다
 * (그 이상은 눈으로 구분되지 않는다).
 */
const MAX_RENDER_MULT = 4
/** 캔버스 한 변이 이보다 크면 브라우저가 그리지 못한다(대부분 16384) */
const MAX_CANVAS_PX = 12000
/** 화면에서 이만큼 떨어진 페이지는 그리지 않고 비워 둔다 (뷰포트 높이 배수) */
const RENDER_MARGIN = '150% 0px'

type PdfDoc = {
  numPages: number
  getPage: (n: number) => Promise<PdfPage>
  destroy: () => Promise<void>
}
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number }
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }) => {
    promise: Promise<void>
    cancel: () => void
  }
}

/**
 * pdf.js 는 무거워서 하이라이트를 실제로 열 때만 불러온다.
 *
 * 버전은 4.x 로 고정한다 — 6.x 는 아주 최신 브라우저에만 있는 JS 기능
 * (Map.prototype.getOrInsertComputed)을 써서 사내 PC 의 구버전 크롬에서
 * 페이지가 새까맣게 렌더된다. 4.x 는 같은 화질을 내면서 호환 범위가 넓다.
 */
async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  return pdfjs
}

function fmtSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.round(bytes / 1024).toLocaleString('ko-KR')}KB`
}

/** 한 페이지 — 확대 배율이 바뀌면 그 배율로 다시 그린다 */
function HighlightPage({
  doc,
  pageNumber,
  index,
  zoom,
  baseWidth,
}: {
  doc: PdfDoc
  pageNumber: number
  index: number
  zoom: number
  baseWidth: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const figRef = useRef<HTMLElement | null>(null)
  /** 아직 안 그린 페이지도 자리(높이)를 차지해야 스크롤과 지연 렌더가 맞는다 —
   *  그래서 A4 세로비를 기본값으로 두고, 실제 크기를 알면 그때 바꾼다. */
  const [ratio, setRatio] = useState(841.89 / 595.276)
  /** 화면 근처에 있는 동안만 그린다 — 15장을 한꺼번에 그리면 메모리가 감당이 안 된다 */
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = figRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => setNear(entries.some((e) => e.isIntersecting)), {
      rootMargin: RENDER_MARGIN,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!near) {
      // 멀어지면 캔버스를 비워 메모리를 돌려준다 (0×0 이면 백업 저장소가 사라진다)
      if (canvas && canvas.width > 0) {
        canvas.width = 0
        canvas.height = 0
      }
      return
    }

    let cancelled = false
    let task: { promise: Promise<void>; cancel: () => void } | null = null

    void (async () => {
      const page = await doc.getPage(pageNumber)
      if (cancelled) return

      const unit = page.getViewport({ scale: 1 })
      setRatio(unit.height / unit.width)

      // 화면 밀도까지 곱해 그리면 레티나에서도 선명하다. 다만 배율이 올라갈수록
      // 담는 픽셀은 A4 폭의 MAX_RENDER_MULT 배에서 멈춘다(메모리 폭발 방지).
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const mult = Math.min(zoom * dpr, MAX_RENDER_MULT)
      let scale = ((baseWidth * mult) / unit.width)
      const longest = Math.max(unit.width, unit.height) * scale
      if (longest > MAX_CANVAS_PX) scale *= MAX_CANVAS_PX / longest

      const viewport = page.getViewport({ scale })
      if (!canvas) return
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return

      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      canvas.style.width = '100%'
      canvas.style.height = 'auto'
      // alpha:false 캔버스의 기본색은 검정이다 — 렌더가 늦거나 실패해도
      // 새까만 사각형이 보이지 않도록 흰 종이를 먼저 깔아 둔다.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      task = page.render({ canvasContext: ctx, viewport, canvas })
      try {
        await task.promise
      } catch {
        /* 배율이 다시 바뀌어 취소된 것 — 무시 */
      }
    })()

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageNumber, zoom, baseWidth, near])

  return (
    <figure className="hl-page" ref={figRef}>
      <canvas
        ref={canvasRef}
        className="hl-canvas"
        style={ratio ? { aspectRatio: `1 / ${ratio}` } : undefined}
        aria-label={`하이라이트 ${index + 1}쪽`}
      />
      <figcaption className="hl-num num">{index + 1}</figcaption>
    </figure>
  )
}

export function HighlightDeck() {
  const [file, setFile] = useState<HighlightFile | null>(null)
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  /** 지금 화면에서 페이지를 놓을 수 있는 폭 — "화면맞춤" 계산에만 쓴다 */
  const [availWidth, setAvailWidth] = useState(A4_WIDTH)

  const zoom = ZOOM_STEPS[zoomIndex]

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setAvailWidth(Math.max(280, el.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [doc])

  /** 화면 폭에 들어가는 가장 큰 배율로 맞춘다 */
  const fitToWidth = useCallback(() => {
    let idx = 0
    for (let i = 0; i < ZOOM_STEPS.length; i++) {
      if (A4_WIDTH * ZOOM_STEPS[i] <= availWidth) idx = i
    }
    setZoomIndex(idx)
  }, [availWidth])

  const open = useCallback(async (f: HighlightFile) => {
    const pdfjs = await loadPdfJs()
    // pdf.js 가 원본 배열을 가져가 버리므로(transfer) 복사본을 넘긴다 —
    // 내려받기 버튼이 같은 바이트를 계속 쓸 수 있어야 한다.
    const task = pdfjs.getDocument({ data: f.bytes.slice() })
    return (await task.promise) as unknown as PdfDoc
  }, [])

  useEffect(() => {
    let alive = true
    let opened: PdfDoc | null = null
    void (async () => {
      try {
        const f = await loadHighlight()
        if (!alive) return
        setFile(f)
        opened = await open(f)
        if (!alive) {
          void opened.destroy()
          return
        }
        setDoc(opened)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : '하이라이트를 불러오지 못했습니다.')
      }
    })()
    return () => {
      alive = false
      if (opened) void opened.destroy()
    }
  }, [open])

  const say = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 5000)
  }

  const doDownload = useCallback(() => {
    if (!file) return
    // Uint8Array 를 그대로 넘기면 타입 정의상 ArrayBufferLike 라 거부될 수 있어
    // 명시적으로 ArrayBuffer 를 잘라 쓴다.
    const buf = file.bytes.slice().buffer as ArrayBuffer
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = file.fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [file])

  const doUpload = useCallback(
    async (picked: File) => {
      if (!/\.pdf$/i.test(picked.name)) {
        say('PDF 파일만 올릴 수 있습니다.')
        return
      }
      if (!isAdminUser(auth.currentUser)) {
        say('자료 교체는 관리자만 할 수 있습니다 — 관리자 화면(/#/admin)에서 로그인한 뒤 다시 시도해 주세요.')
        return
      }
      setBusy('0%')
      try {
        await saveHighlight(picked, (d, t) => setBusy(`${Math.round((d / t) * 100)}%`))
        const f = await loadHighlight(true)
        setFile(f)
        const next = await open(f)
        setDoc((prev) => {
          if (prev) void prev.destroy()
          return next
        })
        say(`새 자료로 교체했습니다 — ${f.fileName}`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        say(
          /permission|insufficient/i.test(msg)
            ? '쓰기 권한이 없습니다. 관리자로 로그인했는지 확인해 주세요.'
            : `교체하지 못했습니다: ${msg}`,
        )
      } finally {
        setBusy(null)
      }
    },
    [open],
  )

  const pageNumbers = doc
    ? Array.from({ length: Math.max(0, doc.numPages - SKIP_PAGES) }, (_, i) => i + 1 + SKIP_PAGES)
    : []

  return (
    <section className="hl" ref={wrapRef}>
      <div className="hl-bar">
        <div className="hl-title">
          <b>TC스텝업 하이라이트</b>
          <span className="hl-sub">
            강의용 자료
            {file ? ` · ${file.fileName} · ${fmtSize(file.size)}` : ''}
            {doc ? ` · ${pageNumbers.length}쪽` : ''}
          </span>
        </div>
        <div className="hl-zoom" role="group" aria-label="확대·축소">
          <button
            className="btn btn--ghost"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            aria-label="축소"
          >
            −
          </button>
          <span className="hl-pct num">{Math.round(zoom * 100)}%</span>
          <button
            className="btn btn--ghost"
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            aria-label="확대"
          >
            +
          </button>
          <button className="btn btn--ghost" onClick={fitToWidth}>
            화면맞춤
          </button>
        </div>
        <div className="hl-acts">
          <button className="btn btn--primary" onClick={doDownload} disabled={!file}>
            다운로드
          </button>
          <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={!!busy}>
            {busy ? `업로드 ${busy}` : '자료 교체'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void doUpload(f)
            }}
          />
        </div>
      </div>

      {error && <p className="hl-msg">{error}</p>}
      {!error && !doc && <p className="hl-msg">하이라이트 자료를 불러오는 중입니다…</p>}

      {/* 확대하면 페이지가 화면보다 넓어진다 — 이 안에서만 가로 스크롤이 생기게 감싼다.
          (예전에는 .hl 이 210mm 로 묶여 있어 100% 를 넘겨도 넓어지지 못했다) */}
      <div className="hl-scroll" ref={scrollRef}>
        {doc && (
          <div className="hl-pages" style={{ width: A4_WIDTH * zoom }}>
            {pageNumbers.map((n, i) => (
              <HighlightPage key={n} doc={doc} pageNumber={n} index={i} zoom={zoom} baseWidth={A4_WIDTH} />
            ))}
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </section>
  )
}
