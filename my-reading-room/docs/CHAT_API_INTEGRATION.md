# 📚 백엔드 AI 추천 에이전트 채팅 API 연동 & 도서 등록 연계 가이드

본 문서는 프론트엔드(`my-reading-room`)와 백엔드 Discovery 서비스(`/api/v1/chat`) 간의 추천 에이전트 대화, 실시간 스트리밍, **마크다운 렌더링 뷰어**, 그리고 **추천 도서 바로 등록(자동완성) 기능** 구현 내역을 정리한 문서입니다.

---

## 1. 연동 개요

- **목적**:
  1. 사서 챗봇에서 사용자의 자연어 도서 추천 요청을 백엔드 AI 추천 에이전트(Strands + AWS Bedrock + Tavily 도서 검색 도구)로 전달하고, 실시간 스트리밍 답변 렌더링
  2. 백엔드에서 내려온 마크다운 텍스트(`###`, `**`, 리스트 등)를 날것의 기호 노출 없이 전용 뷰어로 스타일링하여 렌더링
  3. 추천 결과로 나온 도서를 감지하여 우측 하단 고정 패널에 **[등록 ➔]** 버튼을 노출하고, 클릭 시 도서 등록 페이지(`/register`)로 이동하여 제목/저자/페이지수/색상/두께를 100% 자동 입력
  4. 마우스 커서의 사서 말풍선은 가벼운 1~2줄 요약 리액션 문구로 간결화하여 시인성 및 인터랙션 품질 유지
- **작업 브랜치**: `CLIAR-66-Recommendation-Agent-Test` (타깃: `develop`)
- **주요 파일**:
  - `vite.config.js` (프록시 경로 설정)
  - `src/api/chatApi.js` (v1 API 클라이언트 & 스트리밍 수신 모듈)
  - `src/features/room/MarkdownRenderer.jsx` (마크다운 텍스트 파싱 및 전용 리치 뷰어)
  - `src/features/room/LibrarianChat.jsx` (도서 추천 AI / 일반 검색 모드 분기, 마크다운 메시지 박스 및 추천 도서 등록 전담)
  - `src/features/room/LibrarianCursor.jsx` (마우스 커서 사서 캐릭터의 1~2줄 리액션 말풍선)
  - `src/features/room/bookExtractor.js` (답변 텍스트 내 헤딩/마크다운 도서 정보 파싱 유틸)
  - `src/pages/RegisterBook.jsx` (도서 등록 페이지 내 `location.state` 자동 기입 지원)

---

## 2. 주요 기능 및 UI 구조

```
[사서 질문 패널] 추천 결과 수신
       ↓ (bookExtractor 유틸로 도서명/저자/페이지수 자동 감지)
[커서 사서 말풍선] "✨ 추천 도서 3권을 찾았어요냥! 📚 아래 채팅창에서 확인해보세요 🐾" (간결한 리액션)
[고정 채팅 패널] 
   ├─ [사서 답변 뷰어] MarkdownRenderer로 깔끔하게 스타일링된 도서 추천 이유/줄거리 렌더링
   └─ [추천 도서 카드] "📚 불편한 편의점 (김호연)" [등록 ➔] 버튼 노출
       ↓ (클릭 시 navigate('/register', { state: { book: ... } }))
[도서 등록 페이지 /register] 제목·저자·페이지수·색상·두께 자동 완성 & 등록 버튼 활성화
```

### 1) 마크다운 포매팅 뷰어 (`MarkdownRenderer.jsx`)
- `### 📖 제목` → 강조 헤딩 스타일로 변환 (`color: var(--accent)`, `fontWeight: 700`)
- `**텍스트**` → `<strong>` 볼드체로 변환
- `- **저자**: 김호연` → 깔끔한 리스트 아이템으로 변환
- 일반 단락은 가독성 좋은 줄간격(`lineHeight: 1.55`)으로 렌더링
- 날것의 특수문자(`###`, `**`)가 지저분하게 노출되는 현상 완전 해결

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
| **`src/features/room/MarkdownRenderer.jsx`** | 헤딩, 볼드체, 글머리 기호 목록, 단락을 파싱하여 날것의 기호 없이 가독성 높은 UI로 렌더링 |
| **`src/features/room/LibrarianChat.jsx`** | 마크다운 답변 스크롤 박스 및 추천 도서 카드 & [등록 ➔] 버튼 전담 배치 |
| **`src/features/room/LibrarianCursor.jsx`** | 마우스를 따라다니는 사서 말풍선으로, 1~2줄의 친절한 요약 리액션 문구만 노출 |
| **`src/features/room/bookExtractor.js`** | 마크다운 헤딩(`### 📖 제목` + `- **저자**: ...`) 및 4개 fallback 패턴(『』, 《》, 볼드, 번호목록)으로 도서 정보 파싱 |
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
   - 고정 패널에서 마크다운 특수기호(`###`, `**`) 없이 깔끔하게 포매팅된 답변 텍스트 확인
   - 답변 하단에 나타난 **추천 도서 카드의 [등록 ➔] 버튼 클릭**
   - 도서 등록 페이지(`/register`)로 이동하며 제목, 저자, 페이지수, 색상 등이 자동으로 채워지는지 확인
