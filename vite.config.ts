import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 프로젝트 페이지로 배포되므로 저장소명이 base 경로가 된다.
// https://comdoctor76-droid.github.io/TC_StepUp_2026/
export default defineConfig({
  base: '/TC_StepUp_2026/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
})
