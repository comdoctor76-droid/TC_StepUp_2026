import type { BenchRow, IncomeMap, PlannerRow } from '../data/schema'
import { analyzeAction, type ActionAnalysis } from './action'
import { analyzeCustomer, type CustomerAnalysis } from './customer'
import { analyzeMarket, type MarketAnalysis } from './market'
import { buildReport, type ReportSummary } from './report'
import { buildCtx, profile, type Ctx, type Profile } from './resolve'
import { analyzeSkill, type SkillAnalysis } from './skill'

export interface FullAnalysis {
  ctx: Ctx
  profile: Profile
  report: ReportSummary
  customer: CustomerAnalysis
  action: ActionAnalysis
  market: MarketAnalysis
  skill: SkillAnalysis
}

/** 사번 1건에 대한 5개 탭 전체 계산 */
export function analyze(
  code: string,
  planner: PlannerRow,
  benchmarks: Record<string, BenchRow>,
  incomeMap: IncomeMap,
  months: number[],
): FullAnalysis {
  const ctx = buildCtx(code, planner, benchmarks, incomeMap, months)
  const p = profile(ctx)
  const name = p.name || code

  const customer = analyzeCustomer(ctx, name)
  const action = analyzeAction(ctx, name)
  const market = analyzeMarket(ctx, name)
  const skill = analyzeSkill(ctx, name)
  const report = buildReport(ctx, customer, action, market, skill)

  return { ctx, profile: p, report, customer, action, market, skill }
}

export * from './format'
export type { ActionAnalysis, CustomerAnalysis, MarketAnalysis, ReportSummary, SkillAnalysis, Profile, Ctx }
