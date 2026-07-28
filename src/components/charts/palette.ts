/** 데이터 계열 색 — 5개 탭 전체에서 고정한다. */
export const SERIES = {
  self: '#F18D00', // 본인 (Hi Orange)
  peer: '#9AA5B1', // 동급
  next: '#F7C873', // 차상급
  tc: '#003070', // TC 표준그룹 (Hi Dark Blue)
} as const

/** 원형 차트용 6색 — 오렌지 주조 + 네이비 보조.
    퍼펙트·스타는 원래 저채도(#F7B24C/#FFD9A0)라 간편과 헷갈리고 범례 글자도 잘 안 보여
    (recharts 범례 글자색이 슬라이스 색을 그대로 씀) 더 진하고 서로 구분되는 톤으로 바꿨다. */
export const PIE_COLORS = [
  '#F18D00', // 간편
  '#C9502C', // 퍼펙트
  '#8C6D1F', // 스타
  '#7E9AC4', // 어린이
  '#2A5A9E', // 운전자
  '#003070', // 실손
]

/** 실손 세대별 4색 */
export const GEN_COLORS = ['#F18D00', '#F7B24C', '#7E9AC4', '#003070']

export const AXIS = '#78848F'
export const GRID = '#E7ECF1'
