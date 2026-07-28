/* ══════════════════════════════════════════════════════════════════════
   골든 테스트 — 엑셀 원본과의 전면 대조

   기대값은 **LibreOffice Calc 로 원본 워크북을 실제 재계산한 결과**다.
   (사번 1B9137 기준, 373개 셀. 절차는 scripts/recalcWithLibreOffice.md 참고)

   픽스처는 저장소에 커밋되므로 신원 필드(사번·성명·입사일자·소속)만 익명화했다.
   모든 수치는 원본 그대로여서 검증력은 동일하고, 신원 필드도 서로 다른 값이라
   VLOOKUP 열 매핑 검증은 그대로 유지된다.
   ══════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest'
import fixture from './fixtures/demo02.json'
import expected from './fixtures/expected-demo02.json'
import { analyze } from '../src/calc'
import type { BenchRow, IncomeMap, PlannerRow } from '../src/data/schema'
import { allShardIds, normalizeCode, shardIdOf } from '../src/data/shard'
import { flowSum, stockAt, windowOf } from '../src/calc/period'

const A = analyze(
  fixture.code,
  fixture.planner as unknown as PlannerRow,
  fixture.benchmarks as unknown as Record<string, BenchRow>,
  fixture.incomeMap as unknown as IncomeMap,
  fixture.months,
)

const exp = expected as Record<string, unknown>

/** 엑셀 셀 1개 대조. 라벨·셀주소별로 it() 을 만들지 않고 모아서 검증한다. */
const results: { label: string; cell: string; expected: unknown; actual: unknown; ok: boolean }[] =
  []

const TOL = 1e-6
function chk(label: string, cell: string, actual: unknown) {
  const e = exp[cell]
  let ok: boolean
  if (typeof e === 'number' && typeof actual === 'number') {
    ok = Math.abs(e - actual) / Math.max(1, Math.abs(e)) < TOL
  } else if (e === null || e === undefined || e === '') {
    ok = actual === 0 || actual === '' || actual === null || actual === undefined
  } else {
    ok = String(e).trim() === String(actual).trim()
  }
  results.push({ label, cell, expected: e, actual, ok })
}

const r = A.report
const p = A.profile

// ── 인적사항 ─────────────────────────────────────────────────────────
chk('인적사항 지역단', '레포트!B6', p.hq)
chk('인적사항 비전센터', '레포트!C6', p.visionCenter)
chk('인적사항 지점', '레포트!D6', p.branch)
chk('인적사항 성명', '레포트!F6', p.name)
chk('인적사항 입사일자', '레포트!I6', p.hireDate)
chk('인적사항 육성소득', '레포트!K6', p.incomeRaw)
chk('인적사항 차월', '레포트!M6', p.months)

// ── 현황Ⅰ (전체) ────────────────────────────────────────────────────
const o = r.overall
chk('유지고객 장기', '레포트!D13', o.customers.long.self)
chk('유지고객 자동차', '레포트!E13', o.customers.auto.self)
chk('유지고객 연계', '레포트!F13', o.customers.link.self)
chk('유지고객 총', '레포트!G13', o.customers.total.self)
chk('월신규고객', '레포트!H13', o.customers.monthlyNew.self)
chk('TC 장기', '레포트!J13', o.customers.long.tc)
chk('TC 자동차', '레포트!K13', o.customers.auto.tc)
chk('TC 연계', '레포트!L13', o.customers.link.tc)
chk('TC 총', '레포트!M13', o.customers.total.tc)
chk('TC 월신규', '레포트!N13', o.customers.monthlyNew.tc)
chk('고객당건수', '레포트!D14', o.casesPerCustomer.self)
chk('고객당건수 TC', '레포트!J14', o.casesPerCustomer.tc)
chk('장기단독비율', '레포트!D16', o.mixRate.longOnly.self)
chk('자동차단독비율', '레포트!F16', o.mixRate.autoOnly.self)
chk('연계율', '레포트!H16', o.mixRate.linkRate.self)
chk('장기단독비율 TC', '레포트!J16', o.mixRate.longOnly.tc)
chk('자동차단독비율 TC', '레포트!L16', o.mixRate.autoOnly.tc)
chk('연계율 TC', '레포트!N16', o.mixRate.linkRate.tc)
;['D18', 'E18', 'F18', 'G18', 'H18'].forEach((c, i) =>
  chk(`실손 ${i + 1}세대`, `레포트!${c}`, o.silson.self[i]),
)
chk('실손 총건수', '레포트!I18', o.silson.selfTotal)
;['J18', 'K18', 'L18', 'M18', 'N18'].forEach((c, i) =>
  chk(`실손 ${i + 1}세대 TC`, `레포트!${c}`, o.silson.tc[i]),
)
chk('실손 총건수 TC', '레포트!O18', o.silson.tcTotal)
chk('인당보험료', '레포트!D20', o.premium.perCust.self)
chk('건당보험료', '레포트!F20', o.premium.perCase.self)
chk('최고보험료', '레포트!H20', o.premium.max.self)
chk('인당보험료 TC', '레포트!J20', o.premium.perCust.tc)
chk('건당보험료 TC', '레포트!L20', o.premium.perCase.tc)
chk('최고보험료 TC', '레포트!N20', o.premium.max.tc)

// ── 현황Ⅱ (6개월) ───────────────────────────────────────────────────
const q = r.recent
chk('6M 고객당건수', '레포트!D25', q.casesPerCustomer.self)
chk('6M 고객당건수 TC', '레포트!J25', q.casesPerCustomer.tc)
chk('6M 고객 신규', '레포트!D28', q.newOld.cust.self.nw)
chk('6M 고객 기존', '레포트!E28', q.newOld.cust.self.old)
chk('6M 고객 합계', '레포트!F28', q.newOld.cust.self.sum)
chk('6M 가입 신규', '레포트!G28', q.newOld.cases.self.nw)
chk('6M 가입 기존', '레포트!H28', q.newOld.cases.self.old)
chk('6M 가입 합계', '레포트!I28', q.newOld.cases.self.sum)
chk('6M 고객 신규 TC', '레포트!J28', q.newOld.cust.tc.nw)
chk('6M 고객 기존 TC', '레포트!K28', q.newOld.cust.tc.old)
chk('6M 고객 합계 TC', '레포트!L28', q.newOld.cust.tc.sum)
chk('6M 가입 신규 TC', '레포트!M28', q.newOld.cases.tc.nw)
chk('6M 가입 기존 TC', '레포트!N28', q.newOld.cases.tc.old)
chk('6M 가입 합계 TC', '레포트!O28', q.newOld.cases.tc.sum)
chk('월평균 일반', '레포트!D30', q.monthlyCases.general.self)
chk('월평균 장기', '레포트!F30', q.monthlyCases.protect.self)
chk('월평균 자동차', '레포트!H30', q.monthlyCases.auto.self)
chk('월평균 일반 TC', '레포트!J30', q.monthlyCases.general.tc)
chk('월평균 장기 TC', '레포트!L30', q.monthlyCases.protect.tc)
chk('월평균 자동차 TC', '레포트!N30', q.monthlyCases.auto.tc)

const PROD = ['간편', '퍼펙트', '어린이', '스타', '운전자', '실손']
const premCellsSelf = ['D32', 'E32', 'F32', 'G32', 'H32', 'I32']
const premCellsTc = ['J32', 'K32', 'L32', 'M32', 'N32', 'O32']
PROD.forEach((l, i) => {
  chk(`보험료비중 ${l}`, `레포트!${premCellsSelf[i]}`, q.premiumShare.find((x) => x.label === l)!.self)
  chk(`보험료비중 ${l} TC`, `레포트!${premCellsTc[i]}`, q.premiumShare.find((x) => x.label === l)!.tc)
})
const cntCellsSelf = ['D34', 'E34', 'F34', 'G34', 'H34', 'I34']
const cntCellsTc = ['J34', 'K34', 'L34', 'M34', 'N34', 'O34']
PROD.forEach((l, i) => {
  chk(`건수비중 ${l}`, `레포트!${cntCellsSelf[i]}`, q.countShare.find((x) => x.label === l)!.self)
  chk(`건수비중 ${l} TC`, `레포트!${cntCellsTc[i]}`, q.countShare.find((x) => x.label === l)!.tc)
})
chk('6M 인당보험료', '레포트!D36', q.premium.perCust.self)
chk('6M 건당보험료', '레포트!F36', q.premium.perCase.self)
chk('6M 최고보험료', '레포트!H36', q.premium.max.self)
chk('6M 인당보험료 TC', '레포트!J36', q.premium.perCust.tc)
chk('6M 건당보험료 TC', '레포트!L36', q.premium.perCase.tc)
chk('6M 최고보험료 TC', '레포트!N36', q.premium.max.tc)
const avgSelf = ['D38', 'E38', 'F38', 'G38', 'H38', 'I38']
const avgTc = ['J38', 'K38', 'L38', 'M38', 'N38', 'O38']
PROD.forEach((l, i) => {
  chk(`상품평균 ${l}`, `레포트!${avgSelf[i]}`, q.productAvg.find((x) => x.label === l)!.self)
  chk(`상품평균 ${l} TC`, `레포트!${avgTc[i]}`, q.productAvg.find((x) => x.label === l)!.tc)
})
chk('암 보험료', '레포트!D41', q.critical.cancer.prem.self)
chk('암 부보율', '레포트!E41', q.critical.cancer.rate.self)
chk('암 건수', '레포트!F41', q.critical.cancer.cases.self)
chk('심뇌 보험료', '레포트!G41', q.critical.heart.prem.self)
chk('심뇌 부보율', '레포트!H41', q.critical.heart.rate.self)
chk('심뇌 건수', '레포트!I41', q.critical.heart.cases.self)
chk('암 보험료 TC', '레포트!J41', q.critical.cancer.prem.tc)
chk('암 부보율 TC', '레포트!K41', q.critical.cancer.rate.tc)
chk('암 건수 TC', '레포트!L41', q.critical.cancer.cases.tc)
chk('심뇌 보험료 TC', '레포트!M41', q.critical.heart.prem.tc)
chk('심뇌 부보율 TC', '레포트!N41', q.critical.heart.rate.tc)
chk('심뇌 건수 TC', '레포트!O41', q.critical.heart.cases.tc)

// ── C분석 ────────────────────────────────────────────────────────────
const c = A.customer
const B = c.blocks
chk('C 본인 장기', 'C분석!CG29', B.self.long)
chk('C 본인 자동차', 'C분석!CH29', B.self.auto)
chk('C 본인 총', 'C분석!CI29', B.self.total)
chk('C TC 장기', 'C분석!CG30', B.tc.long)
chk('C TC 자동차', 'C분석!CH30', B.tc.auto)
chk('C TC 총', 'C분석!CI30', B.tc.total)
chk('C 동급 장기', 'C분석!CG31', B.peer.long)
chk('C 동급 자동차', 'C분석!CH31', B.peer.auto)
chk('C 동급 총', 'C분석!CI31', B.peer.total)
chk('C 차상급 장기', 'C분석!CG32', B.next.long)
chk('C 차상급 자동차', 'C분석!CH32', B.next.auto)
chk('C 차상급 총', 'C분석!CI32', B.next.total)
chk('C 월평균 본인', 'C분석!CL29', B.self.monthlyNew)
chk('C 월평균 TC', 'C분석!CL30', B.tc.monthlyNew)
chk('C 월평균 동급', 'C분석!CL31', B.peer.monthlyNew)
chk('C 월평균 차상급', 'C분석!CL32', B.next.monthlyNew)
chk('C 연계 본인', 'C분석!CP29', B.self.both)
chk('C 연계 TC', 'C분석!CP30', B.tc.both)
chk('C 연계 동급', 'C분석!CP31', B.peer.both)
;['CU29', 'CV29', 'CW29', 'CX29', 'CY29', 'CZ29'].forEach((cell, i) =>
  chk(`C 추이 ${i + 1}`, `C분석!${cell}`, c.trend[i].총유지),
)
const bandCells = ['53', '54', '55', '56', '57', '58', '59', '60', '61', '62']
c.bandChart.forEach((b, i) => {
  chk(`C 소득군 ${b.name} 장기`, `C분석!CG${bandCells[i]}`, b.장기)
  chk(`C 소득군 ${b.name} 자동차`, `C분석!CH${bandCells[i]}`, b.자동차)
  chk(`C 소득군 ${b.name} 총`, `C분석!CI${bandCells[i]}`, b.총고객)
})
chk('C 점수', 'C분석!CS50', c.score)

// ── A분석 ────────────────────────────────────────────────────────────
const a = A.action
chk('A 전체 본인 고객', 'A분석!DA25', a.perCustomerAll[0].cust)
chk('A 전체 본인 건수', 'A분석!DB25', a.perCustomerAll[0].cases)
chk('A 전체 본인 인당', 'A분석!DC25', a.perCustomerAll[0].perCust)
chk('A 전체 동급 인당', 'A분석!DC26', a.perCustomerAll[1].perCust)
chk('A 전체 TC 인당', 'A분석!DC27', a.perCustomerAll[3].perCust)
chk('A 전체 차상급 인당', 'A분석!DC28', a.perCustomerAll[2].perCust)
chk('A 6M 본인 인당', 'A분석!DC30', a.perCustomer6m[0].perCust)
chk('A 6M 동급 인당', 'A분석!DC31', a.perCustomer6m[1].perCust)
chk('A 6M TC 인당', 'A분석!DC32', a.perCustomer6m[2].perCust)
const byT = (k: string) => a.byType.find((x) => x.key === k)!
chk('A 일반 본인', 'A분석!DF25', byT('general').본인)
chk('A 자동차 본인', 'A분석!DG25', byT('auto').본인)
chk('A 보장성 본인', 'A분석!DH25', byT('protect').본인)
chk('A 인보험 본인', 'A분석!DI25', byT('person').본인)
chk('A 계 본인', 'A분석!DJ25', byT('total').본인)
chk('A 일반 동급', 'A분석!DF26', byT('general').동급)
chk('A 자동차 동급', 'A분석!DG26', byT('auto').동급)
chk('A 보장성 동급', 'A분석!DH26', byT('protect').동급)
chk('A 계 동급', 'A분석!DJ26', byT('total').동급)
chk('A 일반 TC', 'A분석!DF27', byT('general').TC표준그룹)
chk('A 자동차 TC', 'A분석!DG27', byT('auto').TC표준그룹)
chk('A 보장성 TC', 'A분석!DH27', byT('protect').TC표준그룹)
chk('A 계 TC', 'A분석!DJ27', byT('total').TC표준그룹)
chk('A 신규고객 본인', 'A분석!DL25', a.newOldCust[0].신규)
chk('A 기존고객 본인', 'A분석!DM25', a.newOldCust[0].기존)
chk('A 총고객 본인', 'A분석!DN25', a.newOldCust[0].합계)
chk('A 신규건수 본인', 'A분석!DO25', a.newOldCases[0].신규)
chk('A 기존건수 본인', 'A분석!DP25', a.newOldCases[0].기존)
chk('A 총건수 본인', 'A분석!DQ25', a.newOldCases[0].합계)
chk('A 신규고객 TC', 'A분석!DL27', a.newOldCust[2].신규)
chk('A 기존고객 TC', 'A분석!DM27', a.newOldCust[2].기존)
chk('A 총고객 TC', 'A분석!DN27', a.newOldCust[2].합계)
chk('A 신규건수 TC', 'A분석!DO27', a.newOldCases[2].신규)
chk('A 기존건수 TC', 'A분석!DP27', a.newOldCases[2].기존)
chk('A 총건수 TC', 'A분석!DQ27', a.newOldCases[2].합계)
;['DL30', 'DM30', 'DN30', 'DO30', 'DP30', 'DQ30'].forEach((cell, i) =>
  chk(`A 건수추이 ${i + 1}`, `A분석!${cell}`, a.trend[i].건수본인),
)
;['DU30', 'DV30', 'DW30', 'DX30', 'DY30', 'DZ30'].forEach((cell, i) =>
  chk(`A 고객추이 ${i + 1}`, `A분석!${cell}`, a.trend[i].고객본인),
)
const aBand = ['45', '46', '47', '48', '49', '50', '51', '52', '53', '54']
a.bandTable.forEach((b, i) => {
  chk(`A 소득군 ${b.name} 고객`, `A분석!DA${aBand[i]}`, b.cust)
  chk(`A 소득군 ${b.name} 건수`, `A분석!DB${aBand[i]}`, b.cases)
  chk(`A 소득군 ${b.name} 인당`, `A분석!DC${aBand[i]}`, b.perCust)
})
chk('A 점수', 'A분석!DT43', a.score)

// ── M분석 ────────────────────────────────────────────────────────────
const m = A.market
chk('M 본인 장기', 'M분석!CX27', m.mix[0].long)
chk('M 본인 자동차', 'M분석!CY27', m.mix[0].auto)
chk('M 본인 연계', 'M분석!CZ27', m.mix[0].link)
chk('M 본인 장기비중', 'M분석!DC27', m.mix[0].longRate)
chk('M 본인 자동차비중', 'M분석!DD27', m.mix[0].autoRate)
chk('M 본인 연계율', 'M분석!DE27', m.mix[0].linkRate)
chk('M 동급 장기비중', 'M분석!DC29', m.mix[1].longRate)
chk('M 동급 자동차비중', 'M분석!DD29', m.mix[1].autoRate)
chk('M TC 장기비중', 'M분석!DC32', m.mix[3].longRate)
chk('M TC 자동차비중', 'M분석!DD32', m.mix[3].autoRate)
chk('M TC 연계율', 'M분석!DE32', m.mix[3].linkRate)
const MPROD = ['간편', '퍼펙트', '스타', '어린이', '운전자', '실손']
const cntSelfCells = ['DZ27', 'EA27', 'EB27', 'EC27', 'ED27', 'EE27']
const cntPeerCells = ['DZ29', 'EA29', 'EB29', 'EC29', 'ED29', 'EE29']
const cntTcCells = ['DZ32', 'EA32', 'EB32', 'EC32', 'ED32', 'EE32']
MPROD.forEach((l, i) => {
  chk(`M 건수비중 ${l}`, `M분석!${cntSelfCells[i]}`, m.countShare.self.find((x) => x.label === l)!.share)
  chk(`M 건수비중 ${l} 동급`, `M분석!${cntPeerCells[i]}`, m.countShare.peer.find((x) => x.label === l)!.share)
  chk(`M 건수비중 ${l} TC`, `M분석!${cntTcCells[i]}`, m.countShare.tc.find((x) => x.label === l)!.share)
})
const premSelfCells = ['EN27', 'EO27', 'EP27', 'EQ27', 'ER27', 'ES27']
const premPeerCells = ['EN29', 'EO29', 'EP29', 'EQ29', 'ER29', 'ES29']
const premTcCells = ['EN32', 'EO32', 'EP32', 'EQ32', 'ER32', 'ES32']
MPROD.forEach((l, i) => {
  chk(`M 보험료비중 ${l}`, `M분석!${premSelfCells[i]}`, m.premiumShare.self.find((x) => x.label === l)!.share)
  chk(`M 보험료비중 ${l} 동급`, `M분석!${premPeerCells[i]}`, m.premiumShare.peer.find((x) => x.label === l)!.share)
  chk(`M 보험료비중 ${l} TC`, `M분석!${premTcCells[i]}`, m.premiumShare.tc.find((x) => x.label === l)!.share)
})
;['CZ36', 'DA36', 'DB36', 'DC36', 'DD36'].forEach((cell, i) =>
  chk(`M 실손 ${i + 1}세대`, `M분석!${cell}`, m.silsonAll.self[i].share),
)
chk('M 실손 총', 'M분석!DJ36', m.silsonAll.selfTotal)
;['CZ37', 'DA37', 'DB37', 'DC37', 'DD37'].forEach((cell, i) =>
  chk(`M 실손 ${i + 1}세대 TC`, `M분석!${cell}`, m.silsonAll.tc[i].share),
)
chk('M 실손 총 TC', 'M분석!DJ37', m.silsonAll.tcTotal)
chk('M 점수', 'M분석!EF31', m.score)

// ── S분석 ────────────────────────────────────────────────────────────
const s = A.skill
const rowsAll: [number, string][] = [
  [0, '24'],
  [1, '25'],
  [2, '27'],
  [3, '28'],
]
rowsAll.forEach(([idx, row]) => {
  const nm = ['본인', '동급', '차상급', 'TC'][idx]
  chk(`S 전체 ${nm} 고객`, `S분석!BV${row}`, s.amountAll[idx].cust)
  chk(`S 전체 ${nm} 월납`, `S분석!BW${row}`, s.amountAll[idx].total)
  chk(`S 전체 ${nm} 인당`, `S분석!BX${row}`, s.amountAll[idx].perCust)
  chk(`S 전체 ${nm} 건수`, `S분석!BZ${row}`, s.amountAll[idx].cases)
  chk(`S 전체 ${nm} 건당`, `S분석!CA${row}`, s.amountAll[idx].perCase)
  chk(`S 전체 ${nm} 최고`, `S분석!CC${row}`, s.amountAll[idx].max)
})
const rows6m: [number, string][] = [
  [0, '29'],
  [2, '30'],
  [1, '31'],
]
rows6m.forEach(([idx, row]) => {
  const nm = ['본인', '동급', 'TC'][idx]
  chk(`S 6M ${nm} 인당`, `S분석!BX${row}`, s.amount6m[idx].perCust)
  chk(`S 6M ${nm} 건당`, `S분석!CA${row}`, s.amount6m[idx].perCase)
  chk(`S 6M ${nm} 최고`, `S분석!CC${row}`, s.amount6m[idx].max)
})
const sProdSelf = ['CV24', 'CW24', 'CX24', 'CY24', 'CZ24', 'DA24']
const sProdPeer = ['CV25', 'CW25', 'CX25', 'CY25', 'CZ25', 'DA25']
const sProdTc = ['CV28', 'CW28', 'CX28', 'CY28', 'CZ28', 'DA28']
MPROD.forEach((l, i) => {
  const row = s.productAvg.find((x) => x.label === l)!
  chk(`S 상품평균 ${l}`, `S분석!${sProdSelf[i]}`, row.본인)
  chk(`S 상품평균 ${l} 동급`, `S분석!${sProdPeer[i]}`, row.동급)
  chk(`S 상품평균 ${l} TC`, `S분석!${sProdTc[i]}`, row.TC표준그룹)
})
const critRows: [number, string][] = [
  [0, '24'],
  [1, '25'],
  [2, '28'],
]
critRows.forEach(([idx, row]) => {
  const nm = ['본인', '동급', 'TC'][idx]
  chk(`S 암 부보율 ${nm}`, `S분석!DG${row}`, s.critical[idx].cancerRate)
  chk(`S 심뇌 부보율 ${nm}`, `S분석!DH${row}`, s.critical[idx].heartRate)
  chk(`S 암 건당 ${nm}`, `S분석!DI${row}`, s.critical[idx].cancerPerCase)
  chk(`S 심뇌 건당 ${nm}`, `S분석!DJ${row}`, s.critical[idx].heartPerCase)
})


// ── 검증 ───────────────────────────────────────────────────────────────
const fmt = (v: unknown) =>
  typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(6)) : JSON.stringify(v)

describe('엑셀 원본 대조 (LibreOffice 재계산값)', () => {
  it(`기대값 ${Object.keys(exp).length}개 셀을 모두 읽었다`, () => {
    console.log(`  대조 항목 ${results.length}건 / 기대값 셀 ${Object.keys(exp).length}개`)
    expect(results.length).toBeGreaterThan(350)
    const missing = results.filter((r) => exp[r.cell] === undefined)
    expect(missing.map((m) => m.cell)).toEqual([])
  })

  it('모든 항목이 엑셀과 일치한다', () => {
    const fails = results.filter((r) => !r.ok)
    const report = fails
      .map((f) => `  ${f.label.padEnd(30)} ${f.cell.padEnd(14)} 엑셀=${fmt(f.expected)} 앱=${fmt(f.actual)}`)
      .join('\n')
    expect(fails.length, `\n불일치 ${fails.length}/${results.length}건\n${report}\n`).toBe(0)
  })
})

describe('비교군 라벨 체인 (C분석!CH22 → CH24 → CH26)', () => {
  it('차상급 체인이 14개 구간 전부에서 끊기지 않는다', () => {
    const nx = fixture.incomeMap.nextLevel as Record<string, string>
    const labels = [
      '100만원미만', '100만원이상', '200만원이상', '300만원이상', '400만원이상',
      '500만원이상', '600만원이상', '700만원이상', '800만원이상', '900만원이상',
      '1,000만원이상', '1,500만원이상', '2,000만원이상', '3,000만원이상',
    ]
    for (const l of labels) {
      expect(nx[l], `nextLevel["${l}"]`).toBeTruthy()
      expect(fixture.benchmarks, `benchmarks["${nx[l]}"]`).toHaveProperty(nx[l])
    }
  })

  it('묶음 라벨로 접히는 구간 (소득별Data!C2:F28)', () => {
    const g = fixture.incomeMap.groupOf as Record<string, string>
    expect(g['600만원이상']).toBe('500만원이상')
    expect(g['800만원이상']).toBe('700만원이상')
    expect(g['900만원이상']).toBe('700만원이상')
  })
})

describe('소득군 밴드 목록', () => {
  it('C분석과 A분석의 구간이 다르다 (400↑ vs 1,500↑)', () => {
    expect(A.customer.bandChart.map((b) => b.name)).toContain('400↑')
    expect(A.customer.bandChart.map((b) => b.name)).not.toContain('1,500↑')
    expect(A.action.bandTable.map((b) => b.name)).toContain('1,500↑')
    expect(A.action.bandTable.map((b) => b.name)).not.toContain('400↑')
  })
})

describe('S 점수', () => {
  it('원본 산식 유실(개요!BU25 = S분석!#REF!)로 null 이다', () => {
    expect(A.skill.score).toBeNull()
    expect(A.report.cams.S).toBeNull()
  })
})

describe('샤딩', () => {
  it('사번 정규화는 대소문자를 무시한다', () => {
    expect(normalizeCode('1B4503')).toBe('1b4503')
    expect(shardIdOf('1B4503')).toBe(shardIdOf('1b4503'))
  })
  it('샤드 ID 는 000~255 범위의 3자리', () => {
    const ids = allShardIds()
    expect(ids).toHaveLength(256)
    for (const c of ['demo02', '000008', '014210', 'zz9999', '']) {
      expect(ids).toContain(shardIdOf(c))
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════
   조회기간 적용 규칙 — 재고/흐름 구분의 근거를 고정한다.

   이 동등성이 깨지면 기간 선택이 잘못된 수치를 내놓게 되므로,
   엑셀 원본이 바뀌었는지부터 확인해야 한다. (calc/period.ts 주석 참조)
   ══════════════════════════════════════════════════════════════════════ */
describe('조회기간 — 재고/흐름', () => {
  const months = fixture.months as number[]
  const full = windowOf(undefined, months)
  const s = (fixture.planner as PlannerRow).s
  const f = (fixture.planner as PlannerRow).f

  it('재고: 마지막 달 유지고객 = 전체기간 스칼라', () => {
    expect(stockAt(s.retainLong, full)).toBe(f.longCustNet)
    expect(stockAt(s.retainAuto, full)).toBe(f.autoCustNet)
    expect(stockAt(s.retainBoth, full)).toBe(f.bothCustNet)
  })

  it('재고: 기본(전체 구간)일 때 화면 값과 blocks.self 가 같다', () => {
    const long = stockAt(A.customer.series.long, full)
    const auto = stockAt(A.customer.series.auto, full)
    const both = stockAt(A.customer.series.both, full)
    expect(long).toBe(A.customer.blocks.self.long)
    expect(auto).toBe(A.customer.blocks.self.auto)
    expect(both).toBe(A.customer.blocks.self.both)
    expect(long + auto - both).toBe(A.customer.blocks.self.total)
  })

  it('흐름: 6개월 장기건수 합계 = 6개월 스칼라', () => {
    expect(flowSum(s.cntLong, full)).toBe(f.longCnt6m)
  })

  it('흐름: custLong 합계는 6개월 총계와 다르다 (중복 제거) — 구간 인당건수 계산 불가', () => {
    expect(flowSum(s.custLong, full)).not.toBe(f.longCust6m)
  })

  it('구간을 좁히면 종료월 시점 값이 나온다', () => {
    const w = windowOf({ mode: 'custom', from: months[0], to: months[2] }, months)
    expect(w.isFull).toBe(false)
    expect(w.endIdx).toBe(2)
    expect(stockAt(s.retainLong, w)).toBe(s.retainLong[2])
    expect(flowSum(s.cntLong, w)).toBe(s.cntLong[0] + s.cntLong[1] + s.cntLong[2])
  })
})
