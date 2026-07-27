import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/**
 * Firebase 웹 config 는 공개 값이다 (브라우저 번들에 그대로 들어간다).
 * 실제 접근 제어는 firestore.rules 에서 한다.
 *
 * getAnalytics 는 쓰지 않는다 — 사내망/GitHub Pages 환경에서 초기화가
 * 실패할 수 있고 이 앱에 필요 없다.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyDr7jcye3Jc-86VDEk6eVIZtjdcjhn5N_g',
  authDomain: 'tc-stepup.firebaseapp.com',
  projectId: 'tc-stepup',
  storageBucket: 'tc-stepup.firebasestorage.app',
  messagingSenderId: '1028594568199',
  appId: '1:1028594568199:web:649e5657b3f88dbddfaea2',
  measurementId: 'G-ZJ32VPJ9TG',
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
