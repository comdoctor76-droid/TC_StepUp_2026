import type { ReactNode } from 'react'

/* ══════════════════════════════════════════════════════════════════════
   원본 엑셀 비교표 양식 재현.

   원본(레포트!B11:O41)은 한 항목의 하위 구분을 **가로로** 펼친다.
     [구분] [항목] | 장기 자동차 연계고객 총고객 월신규 | ← 본인
                  | 장기 자동차 연계고객 총고객 월신규 | ← TC 표준그룹
   세로로 풀면 행 수가 3배가 되어 A4 한 장에 들어가지 않는다.

   데스크톱/인쇄 : 원본과 같은 가로 배치
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
      {blocks.map((b, bi) => (
        <section className="cmp__block" key={bi}>
          <h3 className="cmp__sec">{b.section}</h3>
          <div className="cmp__groups">
            {b.groups.map((g, gi) => (
              <div className="grp" key={gi}>
                <div className="grp__title">
                  {g.title}
                  {g.note && <span className="grp__note">{g.note}</span>}
                </div>
                {/* 모바일 — 항목별 목록 (좁은 화면에서 표는 뭉개진다) */}
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

                <div className="grp__scroll">
                  <table className="grp__t">
                    <thead>
                      <tr>
                        <th className="grp__who" />
                        {g.cells.map((c, i) => (
                          <th key={i}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="grp__me">
                        <th className="grp__who">{selfLabel}</th>
                        {g.cells.map((c, i) => (
                          <td
                            key={i}
                            className={`num ${c.sign ? (c.sign > 0 ? 'pos' : 'neg') : ''}`}
                            data-k={c.label}
                          >
                            {c.self}
                          </td>
                        ))}
                      </tr>
                      <tr className="grp__tc">
                        <th className="grp__who">{tcLabel}</th>
                        {g.cells.map((c, i) => (
                          <td key={i} className="num" data-k={c.label}>
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
}: {
  head: ReactNode[]
  rows: ReactNode[][]
  dense?: boolean
  caption?: ReactNode
}) {
  return (
    <div className={`simple-wrap ${dense ? 'simple-wrap--dense' : ''}`}>
      {caption && <div className="simple__cap">{caption}</div>}
      <table className={`simple ${dense ? 'simple--dense' : ''}`}>
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
