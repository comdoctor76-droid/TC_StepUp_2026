/* ══════════════════════════════════════════════════════════════════════
   인쇄물 표지 — 남/여 포스터 위에 교육생 데이터를 얹는다.

   포스터 원본에는 샘플 데이터(염도경 등)가 래스터로 박혀 있어 글자만 바꿀 수
   없다 — 해당 텍스트 블록을 포스터와 같은 배경색 패치로 덮고, 같은 문구
   형식(라벨 그대로, 숫자만 교육생 값)으로 다시 그린다.

   좌표는 포스터 이미지 좌상단 기준 % — 이미지 교체 시 여기만 손보면 된다.
   A4Page 를 쓰지 않는다(제목바·푸터·페이지번호 없는 풀블리드 1장).
   ══════════════════════════════════════════════════════════════════════ */

import type { FullAnalysis } from '../calc'
import { dec2, int, pct, won, ym } from '../calc/format'
import coverM from '../assets/cover-m.jpg'
import coverF from '../assets/cover-f.jpg'

export type CoverGender = 'M' | 'F'

export function CoverPage({ A, gender }: { A: FullAnalysis; gender: CoverGender }) {
  const p = A.profile
  const o = A.report.overall
  const months = A.ctx.months

  const nameLine = `${p.name} (${p.code}) | ${p.hq} ${p.visionCenter} ${p.branch} | ${p.months}차월`
  const periodLine = `데이터 기간 : ${ym(months[0])} - ${ym(months[5])}`

  return (
    <article className="a4-page a4-cover" data-page="cover" data-cover={gender}>
      <img className="a4-cover__bg" src={gender === 'M' ? coverM : coverF} alt="" />

      {gender === 'F' ? (
        <>
          {/* 상단 흰 배경 — 이름줄 + 데이터 기간 */}
          <div className="a4-cover__patch cvf-name">
            <b>{nameLine}</b>
            <span>{periodLine}</span>
          </div>
          {/* 말풍선 3개 — 원본 말풍선을 덮는 흰 박스 */}
          <div className="a4-cover__bubble cvf-total">
            총 고객
            <b>
              <em>{int(p.totalCustomers)}명</em> 돌파!
            </b>
          </div>
          <div className="a4-cover__bubble cvf-new">
            월 신규고객
            <b>
              <em>{dec2(o.customers.monthlyNew.self)}명</em>!
            </b>
          </div>
          <div className="a4-cover__bubble cvf-cases">
            인당 건수
            <b>
              <em>{dec2(o.casesPerCustomer.self)}건</em>
            </b>
          </div>
        </>
      ) : (
        <>
          {/* 상단 큰 이름 블록 — 포스터에 박힌 샘플 이름을 덮는다 */}
          <div className="a4-cover__patch cvm-top">
            <b>
              {p.name} <i>({p.code})</i> | {p.hq} {p.visionCenter}
            </b>
            <span>
              {p.branch} | {p.months}차월
            </span>
          </div>
          {/* 하단 연청색 밴드 — 이름줄 */}
          <div className="a4-cover__patch cvm-name">
            <b>{nameLine}</b>
          </div>
          {/* 원 1 — 육성소득 */}
          <div className="a4-cover__circle cvm-c1">
            육성소득
            <b>{p.levelLabel}</b>
            달성
          </div>
          {/* 원 2 — 총 고객 / 월 신규 */}
          <div className="a4-cover__circle cvm-c2">
            <span>
              총 고객 <b>{int(p.totalCustomers)}</b>명
            </span>
            <span>
              월 신규 <b>{dec2(o.customers.monthlyNew.self)}</b>명
            </span>
          </div>
          {/* 원 3 — 인당 보험료 / 연계율 */}
          <div className="a4-cover__circle cvm-c3">
            인당 보험료
            <b>{won(p.premPerCustomer)}원</b>
            <span>
              연계율 <b>{pct(o.mixRate.linkRate.self)}</b>
            </span>
          </div>
        </>
      )}
    </article>
  )
}
