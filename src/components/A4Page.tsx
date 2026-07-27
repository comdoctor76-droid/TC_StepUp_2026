import type { ReactNode } from 'react'
import { PageTitle } from './PageTitle'
import type { Profile } from '../calc/resolve'
import { VERSION_LINE } from '../version'

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
        <span>
          하이플래너 자가진단 레포트 {caption ?? ''} · {VERSION_LINE}
        </span>
        <span>
          {profile.name}({profile.code}) · {page} / 5
        </span>
      </footer>
    </article>
  )
}
