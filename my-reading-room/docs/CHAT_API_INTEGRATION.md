# 📚 백엔드 AI 추천 에이전트 채팅 API 연동 가이드

본 문서는 프론트엔드(`my-reading-room`)와 백엔드 Discovery 서비스(`/api/v1/chat`) 간의 추천 에이전트 대화 및 실시간 스트리밍 연동 내역을 정리한 문서입니다.

---

## 1. 연동 개요

- **목적**: 사서 챗봇에서 사용자의 자연어 도서 추천 요청을 백엔드 AI 추천 에이전트(Strands + AWS Bedrock + Tavily 도서 검색 도구)로 전달하고, 실시간 스트리밍 답변을 화면에 렌더링
- **브랜치**: `feat/chat-api-v1-integration` (타깃: `develop`)
- **주요 변경 파일**:
  - `vite.config.js` (프록시 경로 설정)
  - `src/api/chatApi.js` (v1 API 클라이언트 & 스트리밍 수신 모듈)
  - `src/features/room/LibrarianChat.jsx` (도서 추천 AI / 일반 검색 모드 분기 및 세션 유지)

---

## 2. API 규격 요약

### 1) 추천 에이전트 대화 (`POST /api/v1/chat`)

- **요청 Body (JSON)**:
  ```json
  {
    "message": "따뜻하고 힐링되는 소설 2권 추천해줘",
    "session_id": "sess-1234-abcd",  // 첫 요청 시 null 또는 생략 가능
    "stream": true                    // 실시간 스트리밍 활성화
  }
  ```

- **스트리밍 응답 (`stream: true`)**:
  - **HTTP 상태**: `200 OK`
  - **헤더**: `X-Session-Id: <발급된 세션 UUID>`
  - **본문**: `text/plain; charset=utf-8` (청크 단위 텍스트 스트림)

- **일반 JSON 응답 (`stream: false`)**:
  - **본문**:
    ```json
    {
      "session_id": "81d7f014-1fc8-4eab-b207-a2a8586e978a",
      "message": "안녕하세요! 마음을 따뜻하게 해주는 소설로 『불편한 편의점』을 추천합니다..."
    }
    ```

### 2) 헬스체크 (`GET /api/v1/health`)
- **응답**: `{"status": "ok"}`

---

## 3. 프론트엔드 구현 상세

### 1) Vite 프록시 (`vite.config.js`)
개발 환경에서 `/api`로 시작하는 모든 요청을 `http://localhost:8000`으로 프록시합니다 (별도 rewrite 없이 직결).

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
}
```

### 2) API 클라이언트 (`src/api/chatApi.js`)
- `streamChatMessage({ message, sessionId, onChunk })`:
  - `ReadableStream`과 `TextDecoder`를 활용하여 실시간으로 수신되는 글자 조각(Chunk)을 콜백으로 전달합니다.
  - 응답 헤더의 `X-Session-Id`를 추출하여 반환하므로 이전 대화 문맥(Multi-turn)을 이어갈 수 있습니다.
  - 백엔드 미실행이나 네트워크 에러 발생 시 안전하게 `null`을 반환하여 프론트가 멈추지 않도록 설계되었습니다.

### 3) 채팅 UI 컴포넌트 (`src/features/room/LibrarianChat.jsx`)
- **`✨ 도서 추천 (AI)` 모드 (기본값)**:
  - 사용자의 자연어 입력 시 백엔드 AI 에이전트로 스트리밍 요청을 보냅니다.
  - 답변이 생성되는 즉시 사서의 말풍선에 실시간 타이핑 효과로 출력됩니다.
- **`🔍 일반 검색 (내 서재)` 모드**:
  - 내 서재에 등록된 도서 DB를 로컬에서 즉시 필터링(제목/저자/장르)합니다.

---

## 4. 로컬 실행 및 테스트 방법

### 1) 백엔드 기동 (터미널 1)
```bash
# Redis 실행
docker compose up redis -d

# AWS 자격증명 확인 (Bedrock 호출용)
aws sso login  # 또는 AWS_ACCESS_KEY_ID 설정

# 백엔드 서버 실행
uv run uvicorn discovery.main:app --reload --port 8000
```

### 2) 프론트엔드 기동 (터미널 2)
```bash
cd my-reading-room
npm install
npm run dev
```

### 3) 브라우저 테스트
1. 브라우저에서 `http://localhost:5173` 접속
2. 우측 하단 **"사서에게 질문하기"** 클릭
3. **`✨ 도서 추천 (AI)`** 모드에서 *"위로가 되는 에세이 추천해줘"* 입력
4. 실시간으로 추천 답변이 출력되는지 확인

---

## 5. 트러블슈팅 가이드

| 증상 | 원인 | 해결 방법 |
| :--- | :--- | :--- |
| **422 Unprocessable Entity** | `session_id: null` 유효성 검사 실패 | 첫 요청 시 `session_id` 키를 생략하거나 백엔드 `ChatRequest`에서 `str | None = None` 지원 확인 |
| **500 Internal Server Error** | AWS Bedrock 인증 만료 (`InvalidClientTokenId`) | 백엔드 실행 터미널에서 `aws sso login` 또는 AWS Credentials 갱신 |
| **"검색한 도서가 없습니다" 출력** | 백엔드 API 에러로 로컬 fallback 동작 | 백엔드 실행 상태 및 F12 콘솔의 `[chatApi]` 에러 로그 확인 |
