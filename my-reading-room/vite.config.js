import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // /api 요청을 백엔드 서버(127.0.0.1:8000)로 프록시
      // localhost 대신 127.0.0.1을 명시해 Node의 IPv6(::1) 우선 해석으로 인한
      // ECONNREFUSED(AggregateError)를 피한다. uvicorn은 기본적으로 IPv4에만 바인딩된다.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
