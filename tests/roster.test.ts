/* ══════════════════════════════════════════════════════════════════════
   명단 조회 — 조직 트리 묶기 + 사번 붙여넣기 매칭 로직 단위 테스트

   Firestore 접근 없이 순수 함수만 검증한다(loadAllPlanners 는 실제 데이터가
   필요해 이 테스트로는 다루지 않는다).
   ══════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest'
import {
  buildCodeIndex,
  groupByHq,
  groupByOrg,
  matchPastedCodes,
  parsePastedCodes,
} from '../src/data/roster'
import type { RosterEntry } from '../src/data/repository'

function entry(over: Partial<RosterEntry>): RosterEntry {
  return { code: 'AAAA', name: '홍길동', hq: '호남', visionCenter: '광주비전센터', branch: '광주지점', ...over }
}

describe('groupByOrg — 비전센터 빈 값은 드림영업실로 묶는다', () => {
  const planners = [
    entry({ code: 'A001', visionCenter: '광주비전센터' }),
    entry({ code: 'A002', visionCenter: '' }),
    entry({ code: 'A003', visionCenter: '' }),
    entry({ code: 'A004', hq: '서울', visionCenter: '' }),
  ]
  const tree = groupByOrg(planners)

  it('빈 비전센터는 "드림영업실" 키로 묶인다', () => {
    expect(tree['호남'].visionCenters['드림영업실']).toBeTruthy()
    expect(tree['호남'].visionCenters['드림영업실'].count).toBe(2)
  })

  it('일반 비전센터는 이름 그대로 유지된다', () => {
    expect(tree['호남'].visionCenters['광주비전센터'].count).toBe(1)
  })

  it('드림영업실은 지역단별로 따로 구분된다 (병합되지 않음)', () => {
    expect(tree['서울'].visionCenters['드림영업실'].count).toBe(1)
    expect(tree['호남'].visionCenters['드림영업실'].count).toBe(2)
  })

  it('지점이 빈 값이면 여전히 (미지정)으로 묶인다', () => {
    const t2 = groupByOrg([entry({ code: 'B001', branch: '' })])
    expect(t2['호남'].visionCenters['광주비전센터'].branches['(미지정)']).toBeTruthy()
  })

  it('공백만 있는 비전센터도 빈 값과 똑같이 "드림영업실"로 묶인다', () => {
    const t2 = groupByOrg([
      entry({ code: 'C001', visionCenter: ' ' }),
      entry({ code: 'C002', visionCenter: '   ' }),
      entry({ code: 'C003', visionCenter: '' }),
    ])
    expect(t2['호남'].visionCenters['드림영업실'].count).toBe(3)
    expect(Object.keys(t2['호남'].visionCenters)).toEqual(['드림영업실'])
  })
})

describe('parsePastedCodes — 헤더 없는 사번 목록 파싱', () => {
  it('줄바꿈으로 구분된 사번을 그대로 파싱한다', () => {
    expect(parsePastedCodes('1B4503\n1C1234\n1D9999')).toEqual(['1B4503', '1C1234', '1D9999'])
  })

  it('쉼표·공백·빈 줄을 무시한다', () => {
    expect(parsePastedCodes('1B4503, 1C1234\n\n  1D9999  ')).toEqual(['1B4503', '1C1234', '1D9999'])
  })

  it('대소문자만 다른 중복은 한 번만 남긴다', () => {
    expect(parsePastedCodes('1b4503\n1B4503\n1B4503')).toEqual(['1b4503'])
  })
})

describe('matchPastedCodes — 명단과 대조', () => {
  const planners = [entry({ code: '1B4503' }), entry({ code: '1C1234', name: '김철수' })]
  const idx = buildCodeIndex(planners)

  it('대소문자·공백 무시하고 매칭된다', () => {
    const { matched, missing } = matchPastedCodes(idx, ['1b4503', ' 1C1234 '])
    expect(matched.map((p) => p.code)).toEqual(['1B4503', '1C1234'])
    expect(missing).toEqual([])
  })

  it('명단에 없는 사번은 missing 원문 그대로 반환된다', () => {
    const { matched, missing } = matchPastedCodes(idx, ['1B4503', 'ZZZZZZ'])
    expect(matched.map((p) => p.code)).toEqual(['1B4503'])
    expect(missing).toEqual(['ZZZZZZ'])
  })
})

describe('groupByHq — TC스텝업 저장 프롬프트용 지역단별 묶기', () => {
  it('같은 지역단 인원은 하나의 그룹으로 묶인다', () => {
    const groups = groupByHq([
      entry({ code: 'A001', hq: '호남' }),
      entry({ code: 'A002', hq: '호남' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].hq).toBe('호남')
    expect(groups[0].entries.map((p) => p.code)).toEqual(['A001', 'A002'])
  })

  it('여러 지역단에 걸쳐 있으면 그룹이 여러 개로 나뉘고 이름순 정렬된다', () => {
    const groups = groupByHq([
      entry({ code: 'A001', hq: '호남' }),
      entry({ code: 'B001', hq: '서울' }),
    ])
    expect(groups.map((g) => g.hq)).toEqual(['서울', '호남'])
  })
})
