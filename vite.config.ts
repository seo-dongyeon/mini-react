import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 페이지가 둘이라 빌드할 HTML을 둘 다 알려 준다. 개발 서버는 설정 없이도 둘 다 연다.
  build: {
    rollupOptions: { input: ['index.html', 'phase2.html'] },
  },
  test: {
    environment: 'jsdom',
  },
})
