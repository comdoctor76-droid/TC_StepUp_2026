/**
 * 파서 검증 스크립트 (개발용)
 *   tsx scripts/verifyParse.ts <원본.xlsx>
 *
 * 원본 워크북에 캐시된 사번 1b4503(염도경)의 값과 파싱 결과를 대조한다.
 */
import { readFileSync } from 'node:fs'
import { parseWorkbook } from '../src/data/parseWorkbook'
import { FIELDS, BENCH_FIELDS, TC_GROUP } from '../src/data/schema'
import { shardIdOf } from '../src/data/shard'

const file = process.argv[2]
if (!file) {
  console.error('사용법: tsx scripts/verifyParse.ts <원본.xlsx>')
  process.exit(1)
}

const t0 = Date.now()
const buf = readFileSync(file)
const parsed = parseWorkbook(buf)
console.log(`파싱 완료 ${Date.now() - t0}ms · 플래너 ${parsed.rowCount}명`)
if (parsed.warnings.length) {
  console.log('\n[경고]')
  parsed.warnings.slice(0, 10).forEach((w) => console.log(' -', w))
  if (parsed.warnings.length > 10) console.log(` … 외 ${parsed.warnings.length - 10}건`)
}

const p = parsed.planners['1b4503']
if (!p) {
  console.error('❌ 사번 1b4503 을 찾지 못했습니다.')
  process.exit(1)
}

console.log('\n[플래너 1b4503]')
const show: (keyof typeof FIELDS)[] = [
  'name',
  'hq',
  'visionCenter',
  'branch',
  'incomeRaw',
  'months',
  'hireDate',
  'longCustNet',
  'autoCustNet',
  'bothCustNet',
  'longCntNet',
  'monthlyPrem',
  'maxPrem',
  'longCust6m',
  'longCnt6m',
  'longPrem6m',
]
for (const k of show) console.log(`  ${k.padEnd(14)} = ${p.f[k]}`)
console.log('  series.retainLong =', p.s.retainLong)
console.log('  series.retainAuto =', p.s.retainAuto)
console.log('  series.retainBoth =', p.s.retainBoth)
console.log('  series.cntLong    =', p.s.cntLong)
console.log('  series.custLong   =', p.s.custLong)
console.log('  shardId           =', shardIdOf('1b4503'))

console.log('\n[벤치마크 TC 표준그룹]')
const tc = parsed.benchmarks[TC_GROUP]
const bshow: (keyof typeof BENCH_FIELDS)[] = [
  'months',
  'longCustNet',
  'autoCustNet',
  'bothCustNet',
  'longCnt',
  'longCntNet',
  'monthlyPrem',
  'maxPrem',
]
for (const k of bshow) console.log(`  ${k.padEnd(14)} = ${tc?.b[k]}`)

console.log('\n[incomeMap]')
console.log('  groupOf["400만원이상"]   =', parsed.incomeMap.groupOf['400만원이상'])
console.log('  groupOf["600만원이상"]   =', parsed.incomeMap.groupOf['600만원이상'])
console.log('  nextLevel["400만원이상"] =', parsed.incomeMap.nextLevel['400만원이상'])
console.log('  percentile["400만원이상"]=', parsed.incomeMap.percentile['400만원이상'])

// ── 샤드 분포 검증 ────────────────────────────────────────────────────
const buckets = new Map<string, number>()
let maxBytes = 0
for (const [code, row] of Object.entries(parsed.planners)) {
  const id = shardIdOf(code)
  buckets.set(id, (buckets.get(id) ?? 0) + 1)
  maxBytes = Math.max(maxBytes, JSON.stringify({ [code]: row }).length)
}
const counts = [...buckets.values()]
console.log('\n[샤드 분포]')
console.log(`  샤드 수 ${buckets.size} · 최소 ${Math.min(...counts)} · 최대 ${Math.max(...counts)}`)
console.log(`  행 최대 ${maxBytes}B → 최대 샤드 추정 ${(Math.max(...counts) * maxBytes / 1024).toFixed(0)}KB (한도 1024KB)`)
