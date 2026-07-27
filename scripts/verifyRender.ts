/**
 * 렌더링 검증 (개발용)
 *   npx tsx scripts/verifyRender.ts
 *
 * 1) A4 인쇄 PDF 가 정확히 5페이지인지
 * 2) 각 A4 페이지가 297mm 안에 들어가는지 (내용 넘침 검사)
 * 3) 모바일 375px 에서 가로 스크롤이 없는지
 * 4) 5개 탭 스크린샷 + A4 미리보기 저장
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { PDFDocument } from 'pdf-lib'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173/TC_StepUp_2026/'
const OUT = 'tmp/verify'
mkdirSync(OUT, { recursive: true })

const TABS = [
  { id: 'report', label: '레포트' },
  { id: 'c', label: 'C분석' },
  { id: 'a', label: 'A분석' },
  { id: 'm', label: 'M분석' },
  { id: 's', label: 'S분석' },
  { id: 'plan', label: '액션플랜' },
]
const PAGES = TABS.length

let failures = 0
const fail = (msg: string) => {
  console.error(`  ❌ ${msg}`)
  failures++
}
const pass = (msg: string) => console.log(`  ✓ ${msg}`)

// 이 환경에는 Chromium 이 미리 설치돼 있다 (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers).
// playwright 패키지 버전과 브라우저 빌드 번호가 어긋날 수 있으므로 경로를 직접 지정한다.
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const browser = await chromium.launch({ executablePath: EXECUTABLE })

// ── 1. 데스크톱 + 인쇄 ────────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  let ignoreRequestFails = false
  page.on('requestfailed', (r) => {
    if (ignoreRequestFails) return
    if (/favicon/i.test(r.url())) return
    // 페이지 전환 중 취소(ERR_ABORTED)는 실패가 아니다
    if (/ERR_ABORTED/.test(r.failure()?.errorText ?? '')) return
    errors.push(`요청 실패: ${r.url()}`)
  })
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/favicon/i.test(t)) return
    errors.push(t)
  })

  await page.goto(`${BASE}#/demo`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#print-root .a4-page', { timeout: 20_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1200)

  console.log('\n[1] A4 인쇄')

  const pageCount = await page.locator('#print-root .a4-page').count()
  pageCount === PAGES ? pass(`A4 페이지 ${pageCount}장`) : fail(`A4 페이지가 ${pageCount}장 (${PAGES}장이어야 함)`)

  // 각 페이지의 내용 넘침 검사
  // flex 컨테이너는 scrollHeight 로 넘침을 못 잡는다.
  // 마지막 자식의 실제 bottom 좌표를 본문 영역 bottom 과 비교한다.
  const overflow = await page.evaluate(() => {
    const out: { id: string; over: number }[] = []
    document.querySelectorAll<HTMLElement>('#print-root .a4-page').forEach((el) => {
      const body = el.querySelector<HTMLElement>('.a4-body')!
      const limit = body.getBoundingClientRect().bottom
      let deepest = body.getBoundingClientRect().top
      body.querySelectorAll<HTMLElement>('*').forEach((c) => {
        const r = c.getBoundingClientRect()
        if (r.height > 0 && r.bottom > deepest) deepest = r.bottom
      })
      out.push({ id: el.dataset.page ?? '?', over: Math.round(deepest - limit) })
    })
    return out
  })
  for (const o of overflow) {
    if (o.over > 2) fail(`페이지 '${o.id}' 내용이 ${o.over}px 넘침`)
    else pass(`페이지 '${o.id}' 하단 여유 ${-o.over}px`)
  }

  // 실제 PDF 페이지 수
  const pdf = await page.pdf({ format: 'A4', printBackground: true, path: `${OUT}/report.pdf` })
  const pdfPages = (await PDFDocument.load(pdf)).getPageCount()
  pdfPages === PAGES ? pass(`PDF ${pdfPages}페이지`) : fail(`PDF 가 ${pdfPages}페이지 (${PAGES}페이지여야 함)`)

  // A4 미리보기 이미지 — #print-root 는 화면 밖(left:-20000px)이라 그대로는
  // 캡처가 안 되므로, 인쇄와 동일한 배치로 잠시 되돌린 뒤 찍는다.
  await page.addStyleTag({
    content: `body > *:not(#print-root){display:none!important}
              #print-root{position:static!important;left:0!important;z-index:auto!important}`,
  })
  await page.waitForTimeout(700)
  for (let i = 0; i < pageCount; i++) {
    await page
      .locator('#print-root .a4-page')
      .nth(i)
      .screenshot({ path: `${OUT}/a4-${i + 1}-${TABS[i].id}.png` })
  }
  pass(`A4 미리보기 ${pageCount}장 저장`)

  ignoreRequestFails = true
  await page.reload({ waitUntil: 'networkidle' })
  ignoreRequestFails = false
  await page.waitForSelector('.tabbar', { timeout: 20_000 })
  await page.waitForTimeout(700)

  console.log('\n[2] 데스크톱 화면')
  for (const t of TABS) {
    await page.getByRole('tab', { name: t.label }).click()
    await page.waitForTimeout(450)
    await page.locator('main.screen').screenshot({ path: `${OUT}/desktop-${t.id}.png` })
  }
  pass(`탭 ${TABS.length}개 스크린샷 저장`)

  if (errors.length) {
    errors.slice(0, 8).forEach((e) => fail(`콘솔 오류: ${e}`))
  } else pass('콘솔 오류 없음')

  // ── PNG 캡처 + 공유(다운로드 폴백) ────────────────────────────────
  console.log('\n[2-1] 이미지 저장')
  // 앱이 실제로 지정하는 다운로드 파일명을 가로챈다.
  // (Playwright 의 suggestedFilename 은 blob: 다운로드에서 'download' 로 나오기도 한다)
  await page.evaluate(() => {
    const orig = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (this.download) (window as unknown as { __dlName?: string }).__dlName = this.download
      return orig.call(this)
    }
  })

  const dl = page.waitForEvent('download', { timeout: 120_000 })
  await page.getByRole('button', { name: '이미지로 저장' }).click()
  const download = await dl
  const appName = await page.evaluate(() => (window as unknown as { __dlName?: string }).__dlName)
  const path = `${OUT}/merged.png`
  await download.saveAs(path)

  const NAME_RE = /^홍길동\(DEMO02\)_\d{8}_\d{4}\.png$/ // 성명(사번)_YYYYMMDD_HHmm.png
  appName && NAME_RE.test(appName)
    ? pass(`파일명 ${appName}`)
    : fail(`파일명 형식이 다름: ${appName ?? '(없음)'}`)

  const png = readFileSync(path)
  // PNG IHDR: 8바이트 시그니처 + 4(길이) + 4('IHDR') → width, height
  const w = png.readUInt32BE(16)
  const h = png.readUInt32BE(20)
  const expW = Math.round(794 * 1.5)
  const expH = Math.round(1123 * 1.5) * PAGES + 10 * (PAGES - 1)
  Math.abs(w - expW) <= 4 ? pass(`이미지 폭 ${w}px`) : fail(`이미지 폭 ${w}px (기대 ${expW}±4)`)
  Math.abs(h - expH) <= 14 ? pass(`이미지 높이 ${h}px (${PAGES}장 병합)`) : fail(`이미지 높이 ${h}px (기대 ${expH}±12)`)
  w * h < 16_777_216
    ? pass(`총 ${(w * h / 1e6).toFixed(1)}M px — iOS 캔버스 한도(16.7M) 이내`)
    : fail(`총 ${(w * h / 1e6).toFixed(1)}M px — iOS 캔버스 한도 초과`)

  await page.close()
}

// ── 3. 모바일 ─────────────────────────────────────────────────────────
{
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  await page.goto(`${BASE}#/demo`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.tabbar', { timeout: 20_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(900)

  console.log('\n[3] 모바일 375px')

  for (const t of TABS) {
    await page.getByRole('tab', { name: t.label }).click()
    await page.waitForTimeout(450)

    const h = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
    }))
    if (h.doc > h.win + 1) fail(`${t.label}: 가로 스크롤 발생 (${h.doc} > ${h.win})`)
    else pass(`${t.label}: 가로 스크롤 없음`)

    await page.screenshot({ path: `${OUT}/mobile-${t.id}.png`, fullPage: true })
  }

  // 본문 글자 크기
  await page.getByRole('tab', { name: '레포트' }).click()
  await page.waitForTimeout(400)
  const fontSize = await page.evaluate(() => {
    // 모바일에서는 표 대신 목록이 보인다
    const el =
      document.querySelector('main.screen .grp__m li > b') ??
      document.querySelector('main.screen')
    return el ? parseFloat(getComputedStyle(el).fontSize) : 0
  })
  fontSize >= 17
    ? pass(`본문 글자 ${fontSize}px`)
    : fail(`본문 글자가 ${fontSize}px (17px 이상이어야 함)`)

  await page.close()
}

await browser.close()

console.log(`\n${failures === 0 ? '✅ 전부 통과' : `❌ 실패 ${failures}건`} — 결과: ${OUT}/`)
process.exit(failures === 0 ? 0 : 1)
