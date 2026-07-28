/* 성장코칭 리포트의 진단 문구는 원본 도구처럼 클릭해서 바로 고칠 수 있다.
   수정 내용은 Firestore 에 저장하지 않고 이 화면(세션) 안에서만 유지된다 —
   새로고침하거나 탭을 나가면 다시 엔진이 만든 원래 문구로 돌아간다. */

export type CoachEdits = Record<string, string>

export function Editable({
  id,
  html,
  edits,
  onCommit,
  as: Tag = 'div',
  className,
}: {
  /** edits 맵의 키 */
  id: string
  /** 엔진이 만든 기본 문구 (HTML 일부 포함 가능 — <b>, <br> 등) */
  html: string
  edits: CoachEdits
  onCommit: (id: string, html: string) => void
  as?: 'div' | 'span'
  className?: string
}) {
  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      className={className}
      dangerouslySetInnerHTML={{ __html: edits[id] ?? html }}
      onBlur={(e) => onCommit(id, (e.currentTarget as HTMLElement).innerHTML)}
    />
  )
}

/** 편집 불가 — 그냥 HTML 문자열을 그리기만 할 때 (num 뱃지 등) */
export function Html({
  html,
  as: Tag = 'span',
  className,
}: {
  html: string
  as?: 'span' | 'div' | 'li'
  className?: string
}) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
