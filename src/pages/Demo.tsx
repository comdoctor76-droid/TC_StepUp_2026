/**
 * 개발 전용 미리보기 (#/demo)
 *
 * Firestore 없이 tests/fixtures 의 골든 데이터로 5개 탭을 렌더한다.
 * `import.meta.env.DEV` 로 감싸고 동적 import 를 쓰므로 프로덕션 번들에
 * 픽스처(개인정보)가 포함되지 않는다.
 */
import { useEffect, useState } from 'react'
import { analyze, type FullAnalysis } from '../calc'
import type { BenchRow, IncomeMap, PlannerRow } from '../data/schema'
import { Report } from './Report'

export function Demo() {
  const [A, setA] = useState<FullAnalysis | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    import('../../tests/fixtures/demo02.json')
      .then((m) => {
        const f = (m.default ?? m) as unknown as {
          code: string
          months: number[]
          planner: PlannerRow
          benchmarks: Record<string, BenchRow>
          incomeMap: IncomeMap
        }
        setA(analyze(f.code, f.planner, f.benchmarks, f.incomeMap, f.months))
      })
      .catch((e) => setErr(String(e)))
  }, [])

  if (err) return <div className="gate"><div className="gate__card">{err}</div></div>
  if (!A) return <div className="gate"><div className="gate__card">미리보기 불러오는 중…</div></div>

  return (
    <Report
      A={A}
      caption="(개발 미리보기 · 실제 데이터 아님)"
      onBack={() => { location.hash = '#/' }}
      onRefresh={async () => {}}
    />
  )
}
