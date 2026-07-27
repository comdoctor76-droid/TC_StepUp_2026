/**
 * 인쇄 / PNG 캡처용 A4 5장.
 *
 * 항상 DOM 에 마운트되어 있고 화면 밖(left:-20000px)에 놓인다.
 * display:none 으로 숨기면 Recharts 가 크기 0으로 렌더돼 캡처가 비므로 금지.
 */
import { createPortal } from 'react-dom'
import { A4Page } from './components/A4Page'
import { ReportTab } from './tabs/ReportTab'
import { CustomerTab } from './tabs/CustomerTab'
import { ActionTab } from './tabs/ActionTab'
import { MarketTab } from './tabs/MarketTab'
import { SkillTab } from './tabs/SkillTab'
import type { FullAnalysis } from './calc'

export function PrintRoot({ A, caption }: { A: FullAnalysis; caption?: string }) {
  const months = A.ctx.months
  const p = A.profile
  const common = { profile: p, months, caption }

  // body 직속으로 포털한다. #root 안에 있으면 인쇄 CSS
  // (body > *:not(#print-root){display:none}) 가 함께 숨겨 버려 5장이 나오지 않는다.
  return createPortal(
    <div id="print-root" aria-hidden="true">
      <A4Page {...common} id="report" title="하이플래너 자가진단 레포트" page={1}>
        <ReportTab A={A} dense />
      </A4Page>

      <A4Page {...common} id="c" title="Customer [고객] 분석" eyebrow="전체" page={2}>
        <CustomerTab A={A} dense />
      </A4Page>

      <A4Page {...common} id="a" title="Action [활동] 분석" eyebrow="최근 6개월" page={3}>
        <ActionTab A={A} dense />
      </A4Page>

      <A4Page {...common} id="m" title="Market [시장] 분석" eyebrow="최근 6개월" page={4}>
        <MarketTab A={A} dense />
      </A4Page>

      <A4Page {...common} id="s" title="Skill [기술] 분석" eyebrow="최근 6개월" page={5}>
        <SkillTab A={A} dense />
      </A4Page>
    </div>,
    document.body,
  )
}
