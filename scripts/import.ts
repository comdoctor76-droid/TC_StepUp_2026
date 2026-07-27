/**
 * CLI 임포터 — 원본 엑셀을 Firestore 에 적재한다.
 *
 *   npm run import -- <원본.xlsx> [옵션]
 *
 * 옵션
 *   --months 202601-202606      기준월 6개월 (기본 202601-202606)
 *   --caption "(영업교육운영파트)"  레포트 캡션
 *   --viewer-password "…"        접속 비밀번호 설정 (SHA-256 해시로 저장)
 *   --key ./serviceAccount.json  서비스 계정 키 (기본: GOOGLE_APPLICATION_CREDENTIALS)
 *   --dry-run                    Firestore 에 쓰지 않고 검증만
 *
 * 서비스 계정 키는 절대 커밋하지 않는다 (.gitignore 에 등록되어 있음).
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { cert, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { parseWorkbook } from '../src/data/parseWorkbook'
import { TC_GROUP, type PlannerRow } from '../src/data/schema'
import { allShardIds, shardIdOf } from '../src/data/shard'

// ── 인자 파싱 ────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const file = argv.find((a) => !a.startsWith('--'))
const opt = (name: string, def?: string) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? (argv[i + 1] ?? def) : def
}
const flag = (name: string) => argv.includes(`--${name}`)

if (!file) {
  console.error('사용법: npm run import -- <원본.xlsx> [--months 202601-202606] [--caption "…"]')
  process.exit(1)
}

const monthSpec = opt('months', '202601-202606')!
const caption = opt('caption', '(영업교육운영파트)')!
const viewerPassword = opt('viewer-password')
const keyPath = opt('key')
const dryRun = flag('dry-run')

function parseMonths(spec: string): number[] {
  const m = spec.match(/^(\d{6})\s*-\s*(\d{6})$/)
  if (!m) throw new Error(`기준월 형식 오류: '${spec}' (예: 202601-202606)`)
  const out: number[] = []
  let y = Number(m[1].slice(0, 4))
  let mo = Number(m[1].slice(4))
  const end = Number(m[2])
  for (let i = 0; i < 24; i++) {
    const cur = y * 100 + mo
    out.push(cur)
    if (cur === end) break
    if (++mo > 12) {
      mo = 1
      y++
    }
  }
  if (out.length !== 6) throw new Error(`기준월은 6개월이어야 합니다 (현재 ${out.length}개월)`)
  return out
}

// ── 파싱 ────────────────────────────────────────────────────────────
const months = parseMonths(monthSpec)
console.log(`▶ 엑셀 읽는 중: ${file}`)
const t0 = Date.now()
const parsed = parseWorkbook(readFileSync(file))
console.log(`  파싱 완료 ${Date.now() - t0}ms · 플래너 ${parsed.rowCount.toLocaleString('ko-KR')}명`)
console.log(`  벤치마크 ${Object.keys(parsed.benchmarks).length}개 구간 (TC 표준그룹 ${parsed.benchmarks[TC_GROUP] ? '있음' : '없음'})`)
console.log(`  기준월 ${months.join(' · ')}`)

if (parsed.warnings.length) {
  console.log(`\n[경고 ${parsed.warnings.length}건]`)
  parsed.warnings.slice(0, 10).forEach((w) => console.log('  -', w))
  if (parsed.warnings.length > 10) console.log(`  … 외 ${parsed.warnings.length - 10}건`)
}

// ── 샤드 구성 ───────────────────────────────────────────────────────
const shards = new Map<string, Record<string, PlannerRow>>()
for (const id of allShardIds()) shards.set(id, {})
for (const [code, row] of Object.entries(parsed.planners)) shards.get(shardIdOf(code))![code] = row

const sizes = [...shards.values()].map((s) => JSON.stringify(s).length)
const maxKB = Math.max(...sizes) / 1024
console.log(
  `\n샤드 ${shards.size}개 · 최대 ${maxKB.toFixed(0)}KB (Firestore 문서 한도 1024KB)`,
)
if (maxKB > 900) {
  console.error('❌ 샤드가 문서 한도에 근접합니다. SHARD_COUNT 를 늘려주세요.')
  process.exit(1)
}

if (dryRun) {
  console.log('\n--dry-run : Firestore 에 쓰지 않고 종료합니다.')
  process.exit(0)
}

// ── Firestore 적재 ──────────────────────────────────────────────────
initializeApp({
  credential: keyPath
    ? cert(JSON.parse(readFileSync(keyPath, 'utf8')))
    : applicationDefault(),
  projectId: 'tc-stepup',
})
const db = getFirestore()

const CHUNK = 20
let done = 0
for (let i = 0; i < allShardIds().length; i += CHUNK) {
  const slice = allShardIds().slice(i, i + CHUNK)
  const batch = db.batch()
  for (const id of slice) batch.set(db.collection('plannerShards').doc(id), shards.get(id)!)
  await batch.commit()
  done += slice.length
  process.stdout.write(`\r  플래너 샤드 ${done}/256`)
}
console.log()

await db.collection('benchmarks').doc('all').set(parsed.benchmarks)
console.log('  ✓ benchmarks/all')

await db.collection('meta').doc('incomeMap').set(parsed.incomeMap)
console.log('  ✓ meta/incomeMap')

await db.collection('meta').doc('dataset').set({
  months,
  uploadedAt: new Date().toISOString(),
  rowCount: parsed.rowCount,
  sourceFileName: file.split('/').pop() ?? file,
  caption,
})
console.log('  ✓ meta/dataset')

if (viewerPassword) {
  const hash = createHash('sha256').update(viewerPassword).digest('hex')
  await db.collection('meta').doc('auth').set({ viewerHash: hash }, { merge: true })
  console.log('  ✓ meta/auth (접속 비밀번호 해시)')
}

console.log(`\n✅ 완료 — 플래너 ${parsed.rowCount.toLocaleString('ko-KR')}명, 쓰기 ${256 + 3}건`)
process.exit(0)
