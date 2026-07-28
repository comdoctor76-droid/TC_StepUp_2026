import type { ReactNode } from 'react'

/* ══════════════════════════════════════════════════════════════════════
   원본 엑셀 비교표 양식 재현.

   원본(레포트!B11:O41)은 [구분][항목] 뒤에 본인·TC 를 **같은 행 안에서
   좌우 열 그룹**으로 나란히 둔다 — 각 열 그룹 아래 하위 지표(장기/자동차/…)가
   그룹마다 다른 개수로 반복된다. [구분] 은 같은 구분을 공유하는 항목들
   왼쪽에 세로로 걸치는 레일로 표시한다(Excel 의 셀 병합에 대응).

   데스크톱/인쇄 : 원본과 같은 좌우 열 그룹 배치
   모바일        : 항목별 카드 (CSS 에서 전환)
   ══════════════════════════════════════════════════════════════════════ */

export interface Cell {
  label: string
  self: ReactNode
  tc: ReactNode
  /** 본인 − TC 부호. 지정하면 본인 값에 색을 입힌다. */
  sign?: number
}

export interface Group {
  /** 좌측 '구분' (고객분석 / 활동분석 / 시장분석 / 기술분석) */
  section?: string
  /** '항목' */
  title: ReactNode
  cells: Cell[]
  /** 항목 아래 보조 설명 */
  note?: ReactNode
}

export function CompareTable({
  groups,
  selfLabel,
  tcLabel = 'TC 표준그룹',
  dense,
}: {
  groups: Group[]
  selfLabel: string
  tcLabel?: string
  dense?: boolean
}) {
  // 연속된 같은 '구분'을 묶는다
  const blocks: { section: string; groups: Group[] }[] = []
  for (const g of groups) {
    const sec = g.section ?? ''
    const last = blocks[blocks.length - 1]
    if (last && last.section === sec) last.groups.push(g)
    else blocks.push({ section: sec, groups: [g] })
  }

  return (
    <div className={`cmp ${dense ? 'cmp--dense' : ''}`}>
      {/* 그룹마다 반복하던 "본인/TC" 색상 밴드를 표 전체 상단에 한 번만 그린다 */}
      <div className="cmp__ghead">
        <span className="cmp__ghead--self">{selfLabel}</span>
        <span className="cmp__ghead--tc">{tcLabel}</span>
      </div>
      {blocks.map((b, bi) => (
        <section className="cmp__block" key={bi}>
          <div className="cmp__sec">{b.section}</div>
          <div className="cmp__groups">
            {b.groups.map((g, gi) => (
              <div className="grp" key={gi}>
                <div className="grp__title">
                  {g.title}
                  {g.note && <span className="grp__note">{g.note}</span>}
                </div>

                {/* 모바일 — 항목별 목록 (좁은 화면에서 좌우 열 그룹 표는 뭉개진다) */}
                <ul className="grp__m">
                  <li className="grp__m-head">
                    <span />
                    <b>{selfLabel}</b>
                    <span>{tcLabel}</span>
                  </li>
                  {g.cells.map((c, i) => (
                    <li key={i}>
                      <span className="grp__m-k">{c.label}</span>
                      <b className={`num ${c.sign ? (c.sign > 0 ? 'pos' : 'neg') : ''}`}>{c.self}</b>
                      <span className="num grp__m-tc">{c.tc}</span>
                    </li>
                  ))}
                </ul>

                {/* 데스크톱/인쇄 — 원본처럼 본인·TC 가 같은 행에 좌우 열 그룹으로 */}
                <div className="grp__scroll">
                  {/* data-cols — 열이 많은 그룹(6자리 보험료 6열 등)은 CSS 가
                      값 글자를 한 단계 줄여 숫자끼리 붙지 않게 한다 */}
                  <table className="grp__t2" data-cols={g.cells.length}>
                    <thead>
                      <tr>
                        {g.cells.map((c, i) => (
                          <th key={`s${i}`} className="grp__sub grp__sub--self">
                            {c.label}
                          </th>
                        ))}
                        {g.cells.map((c, i) => (
                          <th
                            key={`t${i}`}
                            className={`grp__sub grp__sub--tc ${i === 0 ? 'grp__sub--first' : ''}`}
                          >
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {g.cells.map((c, i) => (
                          <td
                            key={`s${i}`}
                            className={`num grp__val grp__val--self ${c.sign ? (c.sign > 0 ? 'pos' : 'neg') : ''}`}
                          >
                            {c.self}
                          </td>
                        ))}
                        {g.cells.map((c, i) => (
                          <td
                            key={`t${i}`}
                            className={`num grp__val grp__val--tc ${i === 0 ? 'grp__val--first' : ''}`}
                          >
                            {c.tc}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/** 단순 표 (헤더 1줄 + 데이터) — 참고표용 */
export function SimpleTable({
  head,
  rows,
  dense,
  caption,
  wrap,
}: {
  head: ReactNode[]
  rows: ReactNode[][]
  dense?: boolean
  caption?: ReactNode
  /** 좁은 박스에 억지로 맞춰야 할 때 — 줄바꿈 허용 + 글자 한 단계 축소 (화면 모드 전용, 인쇄는 이미 줄바꿈) */
  wrap?: boolean
}) {
  return (
    <div className={`simple-wrap ${dense ? 'simple-wrap--dense' : ''}`}>
      {caption && <div className="simple__cap">{caption}</div>}
      <table className={`simple ${dense ? 'simple--dense' : ''} ${wrap ? 'simple--wrap' : ''}`}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? 'simple__h' : 'num'}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
