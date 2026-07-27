/* ══════════════════════════════════════════════════════════════════════
   원본 워크북 열 스키마

   ⚠️ `input` 시트 헤더에는 중복 한글명이 있다.
      Z~AI 블록 = 상품별 "보험료", AJ~AS 블록 = 상품별 "건수" 인데
      둘 다 헤더가 간편/퍼펙트/어린이스타/… 로 똑같다.
      따라서 헤더 문자열이 아니라 **열 위치**로만 파싱해야 한다.

   워크북 수식은 전부 아래 형태다:
      VLOOKUP(code, input!$B$2:…, n, 0)
      VLOOKUP(라벨, 소득별Data!$C$33:…, n, 0)
   여기서 n은 1-based 오프셋이고, 두 시트가 **동일한 열 스키마**를 공유한다.
      input   : n=1 → B열(사원번호),  n=3 → D열(본부명),  n=46 → AU열(장기고객수)
      소득별Data: n=1 → C열(육성소득), n=3 → E열(지점코드), n=46 → AV열(…)

   → 즉 `input`의 n번째 = `소득별Data`의 n-1번째 로 한 칸 어긋나 있다.
     (input은 B=사원번호부터, 소득별Data는 C=육성소득부터 시작)
     아래 FIELDS 는 **input 기준 n**을 정본으로 삼고,
     소득별Data 조회 시에는 n-1 을 쓴다. (BENCH_OFFSET)
   ══════════════════════════════════════════════════════════════════════ */

/** input 기준 VLOOKUP 인덱스 → 필드 키 */
export const FIELDS = {
  code: 1, // B  사원번호
  incomeRaw: 2, // C  육성소득
  hq: 3, // D  본부명
  branchCode: 4, // E  지점코드
  officeCode: 5, // F  영업소코드
  visionCenter: 6, // G  비전센터명
  branch: 7, // H  지점명
  name: 8, // I  성명
  hireDate: 9, // J  입사일자
  months: 10, // K  경력위촉차월
  repName: 11, // L  대표자명

  avgIncome: 12, // M  월평균수정
  premProtect: 13, // N  보장성보험료
  cntProtect: 14, // O  보장성건수
  premSaving: 15, // P  저축성보험료
  cntSaving: 16, // Q  저축성건수
  premGeneral: 17, // R  일반보험료
  cntGeneral: 18, // S  일반건수
  premAuto: 19, // T  자동차보험료
  cntAuto: 20, // U  자동차건수
  premPension: 21, // V  연금보험료
  cntPension: 22, // W  연금건수
  premProperty: 23, // X  재물보험료
  cntProperty: 24, // Y  재물건수

  // 상품별 보험료 (Z~AI)
  premSimple: 25, // Z   간편
  premPerfect: 26, // AA  퍼펙트
  premKidStar: 27, // AB  어린이스타
  premKid: 28, // AC  어린이
  premDriver: 29, // AD  하이카운전자
  premDental: 30, // AE  퍼펙트치아
  premCare: 31, // AF  간병
  premPet: 32, // AG  펫보험
  premCancer: 33, // AH  암
  premSilson: 34, // AI  실손단독

  // 상품별 건수 (AJ~AS)
  cntSimple: 35, // AJ  간편
  cntPerfect: 36, // AK  퍼펙트
  cntKidStar: 37, // AL  어린이스타
  cntKid: 38, // AM  어린이
  cntDriver: 39, // AN  하이카운전자
  cntDental: 40, // AO  퍼펙트치아
  cntCare: 41, // AP  간병
  cntPet: 42, // AQ  펫보험
  cntCancer: 43, // AR  암
  cntSilson: 44, // AS  실손단독

  autoCust: 45, // AT  자동차고객수
  longCust: 46, // AU  장기고객수
  bothCust: 47, // AV  자장고객수
  longCnt: 48, // AW  장기건수
  monthlyPrem: 49, // AX  월납금액
  maxPrem: 50, // AY  최대납입보험료
  indivCust: 51, // AZ  개인고객수
  corpCust: 52, // BA  법인고객수
  longHeld: 53, // BB  장기보유고객수
  autoHeld: 54, // BC  자동차보유고객수
  retainCust: 55, // BD  유지고객수
  vipCust: 56, // BE  우수고객수
  transferLongCnt: 57, // BF  장기이관건수
  transferLongCust: 58, // BG  장기이관고객수
  transferAutoCnt: 59, // BH  자동차이관건수
  transferAutoCust: 60, // BI  자동차이관고객수
  transferBothCust: 61, // BJ  자장이관고객수
  bingo: 62, // BK  빙고수
  longCustNet: 63, // BL  장기이관제외고객
  autoCustNet: 64, // BM  자동차이관제외고객
  bothCustNet: 65, // BN  자장이관제외고객
  premPerson: 66, // BO  인보험료
  cntPerson: 67, // BP  인보험건수
  premCancerMain: 68, // BQ  암주치보험료
  premHeart: 69, // BR  심뇌보험료
  cnt6mAvg: 70, // BS  계약수_6개월평균
  cntCancer6m: 71, // BT  암주치_계약수(6개월평균)
  cntHeart6m: 72, // BU  심뇌_계약수(6개월평균)
  curCust: 73, // BV  당기고객수
  newCust: 74, // BW  신규고객수
  oldCust: 75, // BX  기존고객수
  curCnt: 76, // BY  당기계약건수
  newCnt: 77, // BZ  신규계약건수
  oldCnt: 78, // CA  기존계약건수
  silson1: 79, // CB  1세대
  silson2: 80, // CC  2세대
  silson3: 81, // CD  3세대
  silson4: 82, // CE  4세대
  silson5: 83, // CF  5세대
  longCnt6m: 84, // CG  6개월총장기건수
  longPrem6m: 85, // CH  6개월총장기보험료
  longCust6m: 86, // CI  6개월총장기고객수
  longMaxPrem6m: 87, // CJ  6개월장기최고보험료
  longCntNet: 88, // CK  장기이관제외건수
} as const

export type FieldKey = keyof typeof FIELDS

/**
 * 소득별Data 는 input 보다 한 열 앞에서 시작한다 (C=육성소득 ↔ input B=사원번호).
 * 워크북 수식에서 `소득별Data!$C$33:…, 54` 는 input 기준 55(BD)가 아니라
 * 54+1 = input 기준으로 BD(자동차고객수 이관제외)에 해당하는 위치다.
 *
 * 실제 대응 (소득별Data 1행 헤더로 검증):
 *   소득별Data n=45 → AZ열 '1인당 월납보험료'
 *   소득별Data n=53 → BC열 '자동차고객수(이관제외)'
 *   소득별Data n=54 → BD열 '장기고객수(이관제외)'
 *   소득별Data n=55 → BE열 '자장고객수(이관제외)'
 *   소득별Data n=56 → BF열 '장기이관고객'
 * → 소득별Data 는 input 에 없는 파생 열(1인당/1건당 월납, 이관제외 3종 등)을
 *   AZ~CU 구간에 따로 갖고 있으므로 별도 스키마가 필요하다.
 */
export const BENCH_FIELDS = {
  incomeLabel: 1, // C   육성소득 (조회 키)
  hq: 2, // D
  branchCode: 3, // E
  officeCode: 4, // F
  division: 5, // G   사업부명
  branch: 6, // H
  name: 7, // I
  hireDate: 8, // J
  months: 9, // K   입사차월  ← C분석!CL11 등에서 '평균차월'로 쓰임
  repName: 10, // L

  avgIncome: 11, // M  월평균수정
  premProtect: 12, // N  보장성보험료
  cntProtect: 13, // O  보장성건수
  premSaving: 14, // P
  cntSaving: 15, // Q
  premGeneral: 16, // R  일반보험료
  cntGeneral: 17, // S  일반건수
  premAuto: 18, // T  자동차보험료
  cntAuto: 19, // U  자동차건수
  premPension: 20, // V
  cntPension: 21, // W
  premProperty: 22, // X
  cntProperty: 23, // Y

  premSimple: 24, // Z   간편
  premPerfect: 25, // AA  퍼펙트
  premKidStar: 26, // AB  어린이스타
  premKid: 27, // AC  어린이
  premDriver: 28, // AD  하이카운전자
  premDental: 29, // AE
  premCare: 30, // AF
  premPet: 31, // AG
  premCancer: 32, // AH
  premSilson: 33, // AI  실손단독

  cntSimple: 34, // AJ
  cntPerfect: 35, // AK
  cntKidStar: 36, // AL
  cntKid: 37, // AM
  cntDriver: 38, // AN
  cntDental: 39, // AO
  cntCare: 40, // AP
  cntPet: 41, // AQ
  cntCancer: 42, // AR
  cntSilson: 43, // AS  실손단독

  autoCust: 44, // AT  자동차고객수
  longCust: 45, // AU  장기고객수
  bothCust: 46, // AV  자장고객수
  longCnt: 47, // AW  장기건수
  monthlyPrem: 48, // AX  월납금액
  maxPrem: 49, // AY  최대납입보험료
  premPerCust: 50, // AZ  1인당 월납보험료
  premPerCase: 51, // BA  1건당 월납보험료
  custCount: 52, // BB  고객수
  autoCustNet: 53, // BC  자동차고객수(이관제외)
  longCustNet: 54, // BD  장기고객수(이관제외)
  bothCustNet: 55, // BE  자장고객수(이관제외)
  transferLongCust: 56, // BF  장기이관고객
  premPerson: 57, // BG  인보험료
  cntPerson: 58, // BH  인보험건수
  premCancerMain: 59, // BI  암주치보험료
  premHeart: 60, // BJ  심뇌보험료
  cnt6mSum: 61, // BK  계약수_6개월합
  cntCancer6m: 62, // BL  암주치_계약수
  cntHeart6m: 63, // BM  심뇌_계약수
  curCust: 64, // BN  당기고객수
  newCust: 65, // BO  신규고객수
  oldCust: 66, // BP  기존고객수
  curCnt: 67, // BQ  당기계약건수
  newCnt: 68, // BR  신규계약건수
  oldCnt: 69, // BS  기존계약건수
  silson1: 70, // BT  1세대
  silson2: 71, // BU  2세대
  silson3: 72, // BV  3세대
  silson4: 73, // BW  4세대
  silson5: 74, // BX  5세대
  longCnt6m: 75, // BY  6개월총장기건수
  longPrem6m: 76, // BZ  6개월총장기보험료
  longCust6m: 77, // CA  6개월총장기고객수
  longMaxPrem6m: 78, // CB  6개월장기최고보험료
  retainM5: 79, // CC  유지고객M-5
  retainM4: 80, // CD
  retainM3: 81, // CE
  retainM2: 82, // CF
  retainM1: 83, // CG
  retainM: 84, // CH  유지고객M
  cntLongM5: 85, // CI  장기건수_M5
  cntLongM4: 86, // CJ
  cntLongM3: 87, // CK
  cntLongM2: 88, // CL
  cntLongM1: 89, // CM
  cntLongM: 90, // CN  장기건수_M
  custLongM5: 91, // CO  장기고객수_M5
  custLongM4: 92, // CP
  custLongM3: 93, // CQ
  custLongM2: 94, // CR
  custLongM1: 95, // CS
  custLongM: 96, // CT  장기고객수_M
  longCntNet: 97, // CU  장기이관제외건수
} as const

export type BenchFieldKey = keyof typeof BENCH_FIELDS

/** 고정 라벨 — 소득별Data 47행. 육성소득 500~700 그룹의 평균. */
export const TC_GROUP = 'TC 표준그룹'

/** 소득별Data 행 33~46 의 묶음 라벨 순서 (+ 47행 TC 표준그룹) */
export const BENCH_LABELS = [
  '100만원미만',
  '100만원이상',
  '200만원이상',
  '300만원이상',
  '400만원이상',
  '500만원이상',
  '600만원이상',
  '700만원이상',
  '800만원이상',
  '900만원이상',
  '1,000만원이상',
  '1,500만원이상',
  '2,000만원이상',
  '3,000만원이상',
  TC_GROUP,
] as const

/* ⚠️ C분석과 A분석의 소득군 목록은 **서로 다르다.** 재사용하면 표가 밀린다.
      C분석 : … 300↑ [400↑] 500↑ 700↑ 1,000↑ [2,000↑] 3,000↑
      A분석 : … 300↑        500↑ 700↑ 1,000↑ [1,500↑] 2,000↑ 3,000↑
      A분석에는 400↑ 이 없고 1,500↑ 이 있다.                                  */

/** C분석!CE53:CI62 참고 그래프 — 소득군별 평균 보유고객 (10개 구간) */
export const INCOME_BANDS = [
  { key: '100만원미만', short: '100↓' },
  { key: '100만원이상', short: '100↑' },
  { key: '200만원이상', short: '200↑' },
  { key: '300만원이상', short: '300↑' },
  { key: '400만원이상', short: '400↑' },
  { key: '500만원이상', short: '500↑' },
  { key: '700만원이상', short: '700↑' },
  { key: '1,000만원이상', short: '1,000↑' },
  { key: '2,000만원이상', short: '2,000↑' },
  { key: '3,000만원이상', short: '3,000↑' },
] as const

/** A분석!CY45:DC54 참고표 — 소득군별 인당 가입건수 (10개 구간, C분석과 다름) */
export const ACTION_BANDS = [
  { key: '100만원미만', short: '100↓' },
  { key: '100만원이상', short: '100↑' },
  { key: '200만원이상', short: '200↑' },
  { key: '300만원이상', short: '300↑' },
  { key: '500만원이상', short: '500↑' },
  { key: '700만원이상', short: '700↑' },
  { key: '1,000만원이상', short: '1,000↑' },
  { key: '1,500만원이상', short: '1,500↑' },
  { key: '2,000만원이상', short: '2,000↑' },
  { key: '3,000만원이상', short: '3,000↑' },
] as const

/**
 * 소득 라벨 → 짧은 표기.
 * 원본 C분석!CF53 등의 중첩 IF 를 그대로 옮긴 것.
 */
export function shortLabel(label: string): string {
  const m: Record<string, string> = {
    '100만원미만': '100↓',
    '100만원이상': '100↑',
    '200만원이상': '200↑',
    '300만원이상': '300↑',
    '400만원이상': '400↑',
    '500만원이상': '500↑',
    '600만원이상': '600↑',
    '700만원이상': '700↑',
    '800만원이상': '800↑',
    '900만원이상': '900↑',
    '1,000만원이상': '1,000↑',
    '1,500만원이상': '1,500↑',
    '2,000만원이상': '2,000↑',
    '3,000만원이상': '3,000↑',
  }
  return m[label] ?? label
}

/** 플래너 1인 레코드 (Firestore 저장 형태) */
export interface PlannerRow {
  /** FIELDS 키 → 값 */
  f: Partial<Record<FieldKey, string | number>>
  /** 최근 6개월 시계열 (Q6 유지고객 / Q7 장기건수 시트) */
  s: {
    /** 장기 이관제외 유지고객 M-5..M */
    retainLong: number[]
    /** 자동차 이관제외 유지고객 M-5..M */
    retainAuto: number[]
    /** 자장(연계) 이관제외 M-5..M */
    retainBoth: number[]
    /** 장기건수 M-5..M */
    cntLong: number[]
    /** 장기고객수 M-5..M */
    custLong: number[]
  }
}

/** 소득구간 벤치마크 1행 */
export interface BenchRow {
  b: Partial<Record<BenchFieldKey, string | number>>
}

/** meta/incomeMap */
export interface IncomeMap {
  /** 육성소득(원본) → 묶음 라벨.  소득별Data!C2:F28 (VLOOKUP …,4) */
  groupOf: Record<string, string>
  /** 묶음 라벨 → 차상급 라벨.  소득별Data!C33:E46 (VLOOKUP …,3) */
  nextLevel: Record<string, string>
  /** 육성소득 → 역누적 비율/문구.  소득별Data!C50:F63 */
  percentile: Record<string, { rate: number; band: string; cmp: string }>
  /** 육성소득 → 인원수. 소득별Data!C2:D28 */
  headcount: Record<string, number>
}

/** meta/dataset */
export interface DatasetMeta {
  /** [202601, …, 202606] — C분석!CU28:CZ28 에 상수로 박혀 있던 값 */
  months: number[]
  uploadedAt: string
  rowCount: number
  sourceFileName: string
  /** 레포트!B2 캡션. 예: '(2026.07.24. 영업교육운영파트)' */
  caption: string
}

/** 숫자 강제 변환 — 빈 셀/문자열은 0 */
export function n(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const x = Number(v.replace(/,/g, ''))
    return Number.isFinite(x) ? x : 0
  }
  return 0
}

/** 문자열 강제 변환 */
export function s(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}
