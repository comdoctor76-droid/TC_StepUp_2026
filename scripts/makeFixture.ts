/**
 * 골든 테스트 픽스처 생성
 *   tsx scripts/makeFixture.ts <원본.xlsx> [사번]
 *
 * 원본 워크북에서 해당 사번 1명분 + 벤치마크 + incomeMap 만 잘라내
 * tests/fixtures/<사번>.json 으로 저장한다.
 * (개인정보 최소화를 위해 플래너는 지정한 1명만 담는다)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parseWorkbook } from '../src/data/parseWorkbook'
import { normalizeCode } from '../src/data/shard'

const file = process.argv[2]
const code = normalizeCode(process.argv[3] ?? '1b4503')
if (!file) {
  console.error('사용법: tsx scripts/makeFixture.ts <원본.xlsx> [사번]')
  process.exit(1)
}

const parsed = parseWorkbook(readFileSync(file))
const planner = parsed.planners[code]
if (!planner) {
  console.error(`사번 ${code} 을(를) 찾지 못했습니다.`)
  process.exit(1)
}

const out = {
  code,
  months: [202601, 202602, 202603, 202604, 202605, 202606],
  planner,
  benchmarks: parsed.benchmarks,
  incomeMap: parsed.incomeMap,
}

const path = `tests/fixtures/${code}.json`
writeFileSync(path, JSON.stringify(out, null, 2))
console.log(`✅ ${path} (${(JSON.stringify(out).length / 1024).toFixed(0)}KB)`)
