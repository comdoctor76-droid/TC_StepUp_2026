/* ══════════════════════════════════════════════════════════════════════
   버전 · 문의처 · 문서 제목

   수정할 때마다 APP_VERSION 을 0.01 씩 올린다 (0.01 → 0.02 → 0.03 …).
   CHANGELOG 에 한 줄씩 남긴다.
   ══════════════════════════════════════════════════════════════════════ */

export const APP_VERSION = '0.05'

export const CONTACT = {
  dept: '개인마케팅교육본부 / 영업교육운영파트',
} as const

/** '문의 개인마케팅교육본부 / 영업교육운영파트' */
export const CONTACT_LINE = `문의 ${CONTACT.dept}`

/** 'v0.05 · 문의 …' — 푸터 한 줄 */
export const VERSION_LINE = `v${APP_VERSION} · ${CONTACT_LINE}`

/** 레포트 제목 — 신버전 워크북 레포트!B1 */
export const REPORT_TITLE = '스텝업 레포트 [ Step - Up Report ]'

/** 짧은 제목 (앱바·탭 등 좁은 자리) */
export const REPORT_TITLE_SHORT = '스텝업 레포트'

/** 관리자 화면의 캡션 기본값 — 신버전 워크북 레포트!B2 */
export const DEFAULT_CAPTION = '(영업교육운영파트 / updated by 2026.6.30.)'

/** 인쇄·캡처 페이지 수 (레포트/C/A/M/S/액션플랜) */
export const TOTAL_PAGES = 6

/** 수정 이력 (최신이 위) */
export const CHANGELOG: { version: string; note: string }[] = [
  {
    version: '0.05',
    note: '문의처에서 담당자명 제외, 버전 체계를 0.xx 로 변경',
  },
  {
    version: '0.04',
    note: '신규 엑셀(스텝업 레포트) 기준으로 재정렬 — 암·심뇌 건수 월평균 표기, M분석 반올림 제거, A분석 소득군 표 정정, 액션플랜 탭 추가',
  },
  {
    version: '0.03',
    note: '업로드 실패(Transaction too big) 수정 — 배치 대신 문서 단위 쓰기 + 재시도',
  },
  { version: '0.02', note: '문의처 표기를 개인마케팅교육본부 / 영업교육운영파트로 수정' },
  { version: '0.01', note: '최초 배포 — 레포트/C/A/M/S 5개 탭, A4 5장 인쇄, PNG 공유' },
]
