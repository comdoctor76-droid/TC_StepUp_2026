/* ══════════════════════════════════════════════════════════════════════
   접근 제어

   뷰어  : meta/auth.viewerHash 와 SHA-256 비교 → 통과 시 익명 인증
   관리자: Firebase Auth 이메일/비밀번호 로그인 (firestore.rules 에서 UID 화이트리스트)
   ══════════════════════════════════════════════════════════════════════ */

import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'
import { loadAuthMeta, sha256 } from './data/repository'

const VIEWER_KEY = 'tc-stepup:viewer'

export function isViewerUnlocked(): boolean {
  return sessionStorage.getItem(VIEWER_KEY) === '1'
}

export interface ViewerResult {
  ok: boolean
  /** 실패 사유 (사용자에게 그대로 보여준다) */
  message?: string
}

/** 공통 비밀번호 검증 → 익명 인증 */
export async function unlockViewer(password: string): Promise<ViewerResult> {
  const meta = await loadAuthMeta().catch(() => null)

  if (!meta?.viewerHash) {
    return {
      ok: false,
      message:
        '접속 비밀번호가 아직 설정되지 않았습니다. 관리자 화면(/#/admin)에서 엑셀 업로드와 함께 비밀번호를 먼저 설정해 주세요.',
    }
  }

  const hash = await sha256(password)
  if (hash !== meta.viewerHash) {
    return { ok: false, message: '비밀번호가 올바르지 않습니다.' }
  }

  await signInAnonymously(auth)
  sessionStorage.setItem(VIEWER_KEY, '1')
  return { ok: true }
}

export function lockViewer() {
  sessionStorage.removeItem(VIEWER_KEY)
  void signOut(auth)
}

/** 관리자 로그인 */
export async function adminSignIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function adminSignOut() {
  await signOut(auth)
}

export function watchAuth(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, cb)
}

/** 현재 세션이 익명이 아닌(=관리자 로그인) 상태인지 */
export function isAdminUser(u: User | null): boolean {
  return !!u && !u.isAnonymous
}
