/* ══════════════════════════════════════════════════════════════════════
   버전 · 문의처

   수정할 때마다 APP_VERSION 을 0.01 씩 올린다 (1.00 → 1.01 → 1.02 …).
   CHANGELOG 에 한 줄씩 남긴다.
   ══════════════════════════════════════════════════════════════════════ */

export const APP_VERSION = '1.02'

export const CONTACT = {
  dept: '개인마케팅교육본부 / 영업교육운영파트',
  person: '이승학 전임강사',
} as const

/** '문의 개인마케팅교육본부 / 영업교육운영파트 이승학 전임강사' */
export const CONTACT_LINE = `문의 ${CONTACT.dept} ${CONTACT.person}`

/** 'v1.00 · 문의 …' — 푸터 한 줄 */
export const VERSION_LINE = `v${APP_VERSION} · ${CONTACT_LINE}`

/** 수정 이력 (최신이 위) */
export const CHANGELOG: { version: string; note: string }[] = [
  {
    version: '1.02',
    note: '업로드 실패(Transaction too big) 수정 — 배치 대신 문서 단위 쓰기 + 재시도',
  },
  { version: '1.01', note: '문의처 표기를 개인마케팅교육본부 / 영업교육운영파트로 수정' },
  { version: '1.00', note: '최초 배포 — 레포트/C/A/M/S 5개 탭, A4 5장 인쇄, PNG 공유' },
]
