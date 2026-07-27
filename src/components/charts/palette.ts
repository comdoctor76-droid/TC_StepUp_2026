/** 데이터 계열 색 — 5개 탭 전체에서 고정한다. */
export const SERIES = {
  self: '#F18D00', // 본인 (Hi Orange)
  peer: '#9AA5B1', // 동급
  next: '#F7C873', // 차상급
  tc: '#003070', // TC 표준그룹 (Hi Dark Blue)
} as const

/** 원형 차트용 6색 — 오렌지 주조 + 네이비 보조 */
export const PIE_COLORS = [
  '#F18D00', // 간편
  '#F7B24C', // 퍼펙트
  '#FFD9A0', // 스타
  '#7E9AC4', // 어린이
  '#2A5A9E', // 운전자
  '#003070', // 실손
]

/** 실손 세대별 4색 */
export const GEN_COLORS = ['#F18D00', '#F7B24C', '#7E9AC4', '#003070']

export const AXIS = '#78848F'
export const GRID = '#E7ECF1'
