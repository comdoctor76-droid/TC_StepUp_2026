import type { ReactNode } from 'react'
import { PageTitle } from './PageTitle'
import type { Profile } from '../calc/resolve'
import { DISCLAIMER, REPORT_TITLE_SHORT, TOTAL_PAGES, VERSION_LINE } from '../version'

/** A4 세로 1장. 원본 엑셀 pageSetup(A4·portrait·fitToPage) 과 동일. */
export function A4Page({
  id,
  title,
  eyebrow,
  profile,
  months,
  page,
  caption,
  children,
}: {
  id: string
  title: string
  eyebrow?: string
  profile: Profile
  months: number[]
  page: number
  caption?: string
  children: ReactNode
}) {
  return (
    <article className="a4-page" data-page={id}>
      <PageTitle title={title} eyebrow={eyebrow} profile={profile} months={months} dense page={page} />
      <div className="a4-body dense">{children}</div>
      <footer className="a4-foot">
        <div className="a4-foot__meta">
          <span>
            {REPORT_TITLE_SHORT} {caption ?? ''} · {VERSION_LINE}
          </span>
          <span>
            {profile.name}({profile.code}) · {page} / {TOTAL_PAGES}
          </span>
        </div>
        <div className="a4-foot__notice">{DISCLAIMER}</div>
      </footer>
    </article>
  )
}
