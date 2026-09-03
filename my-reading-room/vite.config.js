import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 개발 서버 프록시.
 *
 * /api 요청은 서비스별로 다른 백엔드로 나뉜다. 기본값은 셋 다 로컬이고,
 * 로컬에 띄우지 않은 서비스만 .env.local에서 배포된 주소로 바꿔 쓰면 된다.
 * (VITE_ 접두사가 없어 브라우저 번들에는 들어가지 않는다 — dev 서버 전용)
 *
 *   AUTH_API=http://<배포된 backend-auth 주소>
 *   DISCOVERY_API=http://<배포된 backend-discovery 주소>
 *
 * 경로 → 서비스
 *   /api/v1/ocr/*                         → backend-record  (표지 OCR)
 *   /api/v1/books, /library/*, /librarian* → backend-book    (서재·도서 검색)
 *   /api/v1/classify-genre                 → backend-discovery (장르 분류)
 *   그 외 /api/*  (auth, users, terms)     → backend-auth
 *
 * localhost 대신 127.0.0.1을 명시해 Node의 IPv6(::1) 우선 해석으로 인한
 * ECONNREFUSED(AggregateError)를 피한다. uvicorn은 기본적으로 IPv4에만 바인딩된다.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const RECORD_API = env.RECORD_API || 'http://127.0.0.1:8002'
  const BOOK_API = env.BOOK_API || 'http://127.0.0.1:8080'
  const AUTH_API = env.AUTH_API || 'http://127.0.0.1:8000'
  const DISCOVERY_API = env.DISCOVERY_API || AUTH_API

  // 배포된 백엔드로 붙일 때 refresh 토큰 쿠키가 그 도메인에 묶이지 않도록 도메인을 지운다.
  const proxy = (target) => ({ target, changeOrigin: true, cookieDomainRewrite: '' })

  return {
    plugins: [react()],
    server: {
      // 먼저 선언한 규칙이 우선하므로 좁은 경로부터 나열한다.
      proxy: {
        '/api/v1/ocr': proxy(RECORD_API),
        '/api/v1/books': proxy(BOOK_API),
        '/api/v1/library': proxy(BOOK_API),
        '/api/v1/librarians': proxy(BOOK_API),
        '/api/v1/librarian-types': proxy(BOOK_API),
        '/api/v1/classify-genre': proxy(DISCOVERY_API),
        '/api': proxy(AUTH_API),
      },
    },
  }
})
