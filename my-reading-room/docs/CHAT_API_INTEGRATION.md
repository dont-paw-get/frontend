# 📚 백엔드 AI 추천 에이전트 채팅 API 연동 & 도서 등록 연계 가이드

본 문서는 프론트엔드(`my-reading-room`)와 백엔드 Discovery 서비스(`/api/v1/chat`) 간의 추천 에이전트 대화, 실시간 스트리밍, 그리고 **추천 도서 바로 등록(자동완성) 기능** 구현 내역을 정리한 문서입니다.

---

## 1. 연동 개요

- **목적**:
  1. 사서 챗봇에서 사용자의 자연어 도서 추천 요청을 백엔드 AI 추천 에이전트(Strands + AWS Bedrock + Tavily 도서 검색 도구)로 전달하고, 실시간 스트리밍 답변 렌더링
  2. 추천 결과로 나온 도서를 감지하여 **[등록 ➔]** 버튼을 노출하고, 클릭 시 도서 등록 페이지(`/register`)로 이동하여 제목/저자/색상/두께를 자동 입력
- **작업 브랜치**: `CLIAR-66-Recommendation-Agent-Test` (타깃: `develop`)
- **주요 파일**:
  - `vite.config.js` (프록시 경로 설정)
  - `src/api/chatApi.js` (v1 API 클라이언트 & 스트리밍 수신 모듈)
  - `src/features/room/LibrarianChat.jsx` (도서 추천 AI / 일반 검색 모드 분기, 추천 도서 카드 & 등록 버튼)
  - `src/features/room/bookExtractor.js` (답변 텍스트 내 도서명/저자 파싱 유틸)
  - `src/pages/RegisterBook.jsx` (도서 등록 페이지 내 `location.state` 자동 기입 지원)

---

## 2. 주요 기능 및 변경점

### 1) 추천 도서 바로 등록 & 자동완성 플로우
```
[사서 질문 패널] 추천 결과 수신
       ↓ (bookExtractor 유틸로 도서명/저자 자동 감지)
[추천 도서 카드 리스트] "📚 불편한 편의점 (김호연)" [등록 ➔] 버튼 노출
       ↓ (클릭 시 navigate('/register', { state: { book: ... } }))
[도서 등록 페이지 /register] 제목·저자 자동 입력 & "AI 사서 추천 도서" 배너 노출
```

### 2) API 규격 요약
- **엔드포인트**: `POST /api/v1/chat`
- **요청 Body (JSON)**:
  ```json
  {
    "message": "따뜻하고 힐링되는 소설 2권 추천해줘",
    "session_id": "sess-1234-abcd",  // 첫 요청 시 null 또는 생략 가능 (서버 자동 발급)
    "stream": true                    // 실시간 스트리밍 활성화
  }
  ```
- **스트리밍 응답**: `text/plain; charset=utf-8` + 응답 헤더 `X-Session-Id`
- **헬스체크**: `GET /api/v1/health`

---

## 3. 프론트엔드 모듈 상세

| 파일 경로 | 역할 및 변경 내용 |
| :--- | :--- |
| **`src/features/room/bookExtractor.js`** | LLM 응답 텍스트(따옴표 `『...』`, 볼드 `**...**`, 목록 등)에서 도서 제목과 저자를 정확하게 추출 |
| **`src/features/room/LibrarianChat.jsx`** | AI 도서 추천 모드 기본값 설정, 답변 수신 시 추천 도서 카드 및 [등록 ➔] 버튼 동적 표시 |
| **`src/pages/RegisterBook.jsx`** | `useLocation()`을 통해 전달받은 도서 정보를 폼에 자동 입력하고, 안내 배너 표시 |
| **`src/api/chatApi.js`** | 백엔드 `/api/v1/chat` 스트리밍 처리 및 `session_id` 자동 세션 유지 |

---

## 4. 로컬 테스트 방법

1. **백엔드 기동**:
   ```bash
   docker compose up redis -d
   aws sso login  # AWS Bedrock 호출 인증
   uv run uvicorn discovery.main:app --reload --port 8000
   ```

2. **프론트엔드 기동**:
   ```bash
   cd my-reading-room
   npm run dev
   ```

3. **테스트 시나리오**:
   - 브라우저(`http://localhost:5173`) 접속
   - 우측 하단 **"사서에게 질문하기"** 클릭 → **`✨ 도서 추천 (AI)`** 모드에서 자연어 질문 입력
   - 사서 말풍선에 실시간 답변 출력 확인
   - 채팅 패널 하단에 나타난 **추천 도서 카드의 [등록 ➔] 버튼 클릭**
   - 도서 등록 페이지(`/register`)로 이동하며 제목과 저자가 자동으로 채워지는지 확인
