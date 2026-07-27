/** 표시 포맷 — 원본 엑셀의 셀 표시형식을 따른다. */

const nf = (min: number, max: number) =>
  new Intl.NumberFormat('ko-KR', { minimumFractionDigits: min, maximumFractionDigits: max })

const f0 = nf(0, 0)
const f1 = nf(1, 1)
const f2 = nf(2, 2)

/** 정수 (#,##0) */
export function int(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-'
  return f0.format(v)
}

/** 소수 1자리 (#,##0.0) */
export function dec1(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-'
  return f1.format(v)
}

/** 소수 2자리 (#,##0.00) */
export function dec2(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-'
  return f2.format(v)
}

/** 원 단위 금액 — 정수 반올림 */
export function won(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-'
  return f0.format(Math.round(v))
}

/** 백분율 (0.1234 → '12.3%') */
export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-'
  return `${nf(digits, digits).format(v * 100)}%`
}

/** 차이값 — 부호 포함 */
export function diff(v: number | null | undefined, fmt: (x: number) => string = int): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-'
  const s = fmt(Math.abs(v))
  if (v > 0) return `+${s}`
  if (v < 0) return `-${s}`
  return s
}

/** 입사일자 '20211110' → '2021.11.10' */
export function hireDate(v: string | number | undefined): string {
  const s = String(v ?? '')
  if (!/^\d{8}$/.test(s)) return s || '-'
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`
}

/** 기준월 202601 → '2026.01' */
export function ym(v: number): string {
  const s = String(v)
  if (s.length !== 6) return s
  return `${s.slice(0, 4)}.${s.slice(4, 6)}`
}

/** 기준월 202601 → '26.01' (차트 축용) */
export function ymShort(v: number): string {
  const s = String(v)
  if (s.length !== 6) return s
  return `${s.slice(2, 4)}.${s.slice(4, 6)}`
}

/** 0으로 나누기 방어 — 원본의 IFERROR(…,0) 와 동일 */
export function div(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0
  const r = a / b
  return Number.isFinite(r) ? r : 0
}

/** 엑셀 ROUND (반올림, 자릿수 지정) — 은행가 반올림이 아닌 half-away-from-zero */
export function xround(v: number, digits = 0): number {
  if (!Number.isFinite(v)) return 0
  const m = Math.pow(10, digits)
  return Math.sign(v) * Math.round(Math.abs(v) * m) / m
}
