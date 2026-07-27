import type { Profile } from '../calc/resolve'
import { hireDate as fmtHire, ym } from '../calc/format'
import { APP_VERSION, CONTACT_LINE } from '../version'

/**
 * 각 탭/페이지 최상단의 오렌지 타이틀 바.
 * 화면·인쇄·PNG 어디서나 동일하게 크게 보이도록 한다.
 */
export function PageTitle({
  eyebrow,
  title,
  profile,
  months,
  dense,
  page,
}: {
  /** 소제목 (예: '최근 6개월') */
  eyebrow?: string
  title: string
  profile: Profile
  months: number[]
  dense?: boolean
  /** 인쇄 시 페이지 번호 (n/5) */
  page?: number
}) {
  const range =
    months.length >= 2 ? `${ym(months[0])} ~ ${ym(months[months.length - 1])}` : ''
  return (
    <header className={`ptitle ${dense ? 'ptitle--dense' : ''}`}>
      <div className="ptitle__main">
        <h1 className="ptitle__h1">
          {title}
          {eyebrow && <span className="ptitle__eyebrow">{eyebrow}</span>}
          <span className="ptitle__ver">v{APP_VERSION}</span>
        </h1>
        {page ? (
          <span className="ptitle__page">{page} / 5</span>
        ) : (
          <span className="ptitle__contact">{CONTACT_LINE}</span>
        )}
      </div>
      <div className="ptitle__sub">
        <b>
          {profile.name} ({profile.code})
        </b>
        <span>{profile.hq}</span>
        <span>{profile.visionCenter}</span>
        <span>{profile.branch}</span>
        <span>{profile.months}차월</span>
        <span>육성소득 {profile.incomeRaw}</span>
        <span>입사 {fmtHire(profile.hireDate)}</span>
        {range && <span className="ptitle__range">기준 {range}</span>}
        {page && <span className="ptitle__contact">{CONTACT_LINE}</span>}
      </div>
    </header>
  )
}
