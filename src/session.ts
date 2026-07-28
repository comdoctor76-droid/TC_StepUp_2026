/* ══════════════════════════════════════════════════════════════════════
   접근 제어

   뷰어  : meta/auth.viewerHash 와 SHA-256 비교 → 통과 시 익명 인증
   관리자: 사번 + 비밀번호로 로그인한다. Firebase Auth 는 이메일 형식이
           필요해 내부적으로만 사번을 가짜 이메일(adminEmailOf)로 바꿔 쓴다 —
           화면에는 절대 이 이메일을 노출하지 않는다. 실제 권한 판정은
           firestore.rules 의 admins/{uid} 문서 존재 여부로 한다.
   ══════════════════════════════════════════════════════════════════════ */

import { deleteApp, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { app, auth, db } from './firebase'
import { loadAuthMeta, sha256 } from './data/repository'
import { normalizeCode } from './data/shard'

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

/** 사번 → Firebase Auth 용 가짜 이메일. 실제 메일함이 아니라 로그인 식별자일 뿐이다. */
function adminEmailOf(code: string): string {
  return `${normalizeCode(code)}@admin.tc-stepup.local`
}

/** 관리자 로그인 — 사번 + 비밀번호 */
export async function adminSignIn(code: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, adminEmailOf(code), password)
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

export interface AdminProfile {
  code: string
  name: string
}

/** 관리자 화면 상단바 표기용 — 로그인용 가짜 이메일 대신 사번·성명을 보여준다 */
export async function loadAdminProfile(uid: string): Promise<AdminProfile | null> {
  const snap = await getDoc(doc(db, 'admins', uid))
  return snap.exists() ? (snap.data() as AdminProfile) : null
}

/**
 * 새 관리자 계정 생성 — 지금 로그인해 있는 관리자만 부를 수 있다(firestore.rules
 * admins/{uid} 쓰기 규칙 참고). Firebase Auth 클라이언트 SDK는 새 계정을 만들면
 * 그 계정으로 즉시 로그인 상태가 바뀌어 버리는 문제가 있어(현재 관리자 세션이
 * 새로 만든 계정으로 뒤바뀜), 보조 Firebase 앱 인스턴스에서 계정만 만들고
 * 바로 지운다 — 원래 admin 세션(auth)은 전혀 건드리지 않는다.
 */
export async function createAdminAccount(code: string, password: string, name: string): Promise<void> {
  const email = adminEmailOf(code)
  const secondaryApp = initializeApp(app.options, `admin-create-${Date.now()}`)
  const secondaryAuth = getAuth(secondaryApp)
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    // db(=원래 app의 Firestore)는 여전히 기존 관리자 세션(auth)으로 인증되므로
    // 이 쓰기는 "관리자가 새 관리자 문서를 등록하는" 정상적인 admins 쓰기다.
    await setDoc(doc(db, 'admins', cred.user.uid), {
      code: normalizeCode(code),
      name,
      createdAt: new Date().toISOString(),
    })
  } finally {
    await secondaryAuth.signOut().catch(() => {})
    await deleteApp(secondaryApp).catch(() => {})
  }
}
