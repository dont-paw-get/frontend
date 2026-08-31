# frontend

귀여운 동물 사서가 큐레이션 해주는 나만의 가상 서재 **Don't Paw-get Your Book** 클라이언트 (Web)

3D 서재에 내 책을 꽂아두고, 사서 캐릭터(고양이 블루 / 황새 슈빌)와 대화하며 날씨·시간대·기분에 맞는 책을 추천받는 웹 애플리케이션입니다.

---

## 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [시작하기](#시작하기)
- [프로젝트 구조](#프로젝트-구조)
- [백엔드 연동](#백엔드-연동)
- [상태 관리](#상태-관리)
- [라우팅](#라우팅)
- [배포](#배포)
- [개발 규칙](#개발-규칙)
- [관련 저장소](#관련-저장소)

---

## 주요 기능

| 기능 | 설명 |
|---|---|
| 3D 내 서재 | React Three Fiber로 렌더링한 책장에 등록한 책이 꽂힘. 책 클릭 시 상세/수정/삭제 |
| 사서 채팅 | 오케스트레이터에 스트리밍 요청. 날씨·무드 뱃지, 사서 전환 제안, 추천 도서 바로 등록 |
| 사서 캐릭터 | 마우스를 따라다니는 사서 커서(책 위 호버 시 모션 전환), 사서별 테마 컬러 |
| 라이트/다크 모드 | 다크 모드는 손전등 효과(커서 주변만 밝게) |
| 인증 | 회원가입·이메일 인증·로그인·비밀번호 찾기/재설정/변경·회원 탈퇴 |
| 책 등록 | 표지 촬영/업로드 → OCR로 제목·저자 인식 → 색상·두께 지정 후 등록 |
| 문장 수집 | 책 페이지 촬영 → OCR로 문장 추출 → 메모·페이지와 함께 스크랩 |

## 기술 스택

| 구분 | 사용 기술 |
|---|---|
| 프레임워크 | React 19, Vite 8 |
| 라우팅 | React Router 7 |
| 3D | Three.js, @react-three/fiber, @react-three/drei |
| OCR | tesseract.js (브라우저 내 인식) |
| 개발 도구 | leva(3D 배치 캘리브레이션), ESLint 10 |
| 상태 관리 | React Context + Provider (별도 상태 라이브러리 없음) |

## 시작하기

### 요구 사항

- Node.js 20 이상 (CI 기준 20)
- npm

### 설치 및 실행

```bash
cd my-reading-room
npm install
npm run dev
```

기본 주소는 `http://localhost:5173` 입니다.

### 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 실행 (HMR) |
| `npm run build` | 프로덕션 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과 로컬 확인 |
| `npm run lint` | ESLint 검사 |

> 커밋 전에 `npm run build`와 `npm run lint`를 실행해 주세요.

### 로컬 백엔드 연동

개발 서버는 `/api` 요청을 로컬 백엔드로 프록시합니다 (`vite.config.js`).

```
/api/*  →  http://127.0.0.1:8000
```

`localhost` 대신 `127.0.0.1`을 명시한 이유는, Node가 IPv6(`::1`)를 우선 해석해
IPv4에만 바인딩하는 uvicorn 기본 설정과 어긋나 `ECONNREFUSED`가 발생하기 때문입니다.

## 프로젝트 구조

```text
frontend/
├── .github/workflows/        # CI/CD (dev/prod 배포, PR 컨벤션 검사)
└── my-reading-room/          # Vite 앱 루트
    ├── public/
    │   └── cursors/          # 사서 커서 이미지 (cat/, stork/)
    └── src/
        ├── api/              # 백엔드 API 클라이언트
        │   ├── authApi.js    # backend-auth + 토큰 인프라(authFetch)
        │   ├── bookApi.js    # backend-book 서재/문장수집
        │   ├── chatApi.js    # discovery 사서 채팅(스트리밍)
        │   └── geolocation.js
        ├── components/       # 공통 컴포넌트 (Gnb, ProtectedRoute 등)
        ├── data/             # 정적 데이터 (librarians, genres)
        ├── features/
        │   ├── bookshelf3d/  # 3D 책 모델
        │   ├── register/     # 책 등록(OCR 유틸)
        │   └── room/         # 서재 씬, 사서 채팅/커서, 책 상세, 문장 수집
        ├── pages/            # 라우트 단위 화면
        ├── store/            # Context Provider + 스토어
        └── styles/
```

## 백엔드 연동

MSA 구조로, 프론트는 경로별로 서로 다른 백엔드 서비스를 호출합니다.
운영 환경에서는 CloudFront가 경로 기준으로 각 서비스 오리진에 라우팅합니다.

| 경로 | 서비스 | 담당 |
|---|---|---|
| `/api/v1/auth/*`, `/api/v1/users/*`, `/api/v1/terms` | **backend-auth** | 인증, 회원 정보, 약관 |
| `/api/v1/library/*` | **backend-book** | 서재 도서 CRUD, 문장 수집(scrap) |
| `/api/v1/chat` | **backend-discovery** | 오케스트레이터(사서 상담·도서 추천) |
| `/api/v1/ocr/*` | **backend-record** | 이미지 OCR |

### API base URL

```js
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
```

- **로컬**: 환경변수 없이 상대 경로 → Vite 프록시가 로컬 백엔드로 전달
- **배포**: 프론트와 백엔드가 같은 도메인(CloudFront)을 쓰므로 상대 경로 그대로 사용
  - `VITE_API_BASE_URL`은 별도 도메인을 쓸 때만 필요 (GitHub Environment 변수)

같은 도메인 라우팅을 택한 이유는, 별도 도메인일 경우 Refresh Token의 HttpOnly 쿠키가
서드파티 쿠키로 취급되어 브라우저가 차단할 위험이 있기 때문입니다.

### 인증 방식

- **Access Token**: 메모리에만 보관 (localStorage 저장하지 않음)
- **Refresh Token**: 백엔드가 HttpOnly 쿠키로 관리 (JS 접근 불가)
- 인증 요청은 `credentials: 'include'`로 쿠키를 함께 전송
- `401` 응답 시 `/auth/refresh`로 1회 갱신 후 원 요청을 재시도하고, 갱신도 실패하면 세션 만료 처리
- 이 로직은 `authApi.js`의 `authFetch`에 있으며, `bookApi.js`도 이를 재사용

## 상태 관리

별도 라이브러리 없이 Context + Provider로 구성합니다. 중첩 순서는 `App.jsx` 기준입니다.

```text
AuthProvider          # member, status(loading|authenticated|unauthenticated), login/logout
└── ThemeProvider     # light | dark (data-theme 속성 + localStorage)
    └── LibrarianProvider   # 활성 사서, 사용자 지정 사서 이름
        └── BooksProvider   # 서재 도서 목록(backend-book), 문장 수집
```

각 스토어는 Context 정의(`*Store.js`)와 Provider 구현(`*Provider.jsx`)을 분리해,
Fast Refresh가 깨지지 않게 하고 훅만 가볍게 import할 수 있도록 했습니다.

`BooksProvider`는 로그인 시 서버에서 도서 목록을 불러오고 로그아웃 시 비웁니다.
도서의 색상·두께 등 렌더링용 값은 백엔드가 저장하지 않아 `bookVisuals.js`가
`bookId`별로 로컬에 보관합니다(값이 없으면 `bookId` 해시로 결정론적 기본값 생성).

## 라우팅

| 경로 | 화면 | 인증 |
|---|---|---|
| `/login` | 로그인 | 불필요 |
| `/signup` | 회원가입 + 이메일 인증 | 불필요 |
| `/password/forgot` | 비밀번호 찾기·재설정 | 불필요 |
| `/library` | 내 서재 (3D) | 필요 |
| `/register` | 책 등록 | 필요 |
| `/mypage` | 마이페이지 | 필요 |
| `/librarians` | 사서 프로필 | 필요 |

인증이 필요한 화면은 `ProtectedRoute`로 감싸고, 비로그인 시 `/login`으로 이동합니다.
알 수 없는 경로는 `/library`로 리다이렉트합니다.

## 배포

GitHub Actions로 S3 + CloudFront에 배포합니다.

| 브랜치 | 환경 | 워크플로 |
|---|---|---|
| `develop` | dev | `.github/workflows/deploy-dev.yml` |
| `main` | prod | `.github/workflows/deploy-prod.yml` |

두 워크플로는 `_deploy-frontend.yml`(reusable)을 호출하며, 다음 순서로 동작합니다.

1. `npm ci` → `npm run build` (`VITE_API_BASE_URL` 주입)
2. `dist/`를 S3에 동기화 — 해시 파일명 정적 자산은 장기 캐싱(`max-age=31536000, immutable`)
3. `index.html`은 별도 업로드 — 즉시 반영되도록 `no-cache`
4. CloudFront 캐시 무효화(`/*`)

### 환경 설정

GitHub Environment(`dev` / `prod`)에 아래 값이 필요합니다.

| 종류 | 이름 |
|---|---|
| Variables | `AWS_REGION`, `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `VITE_API_BASE_URL`(선택) |
| Secrets | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |

## 개발 규칙

### 브랜치

- `main`: 배포 / `develop`: 통합
- 작업 브랜치는 `develop`에서 분기하고, PR의 base도 `develop`
- `main`에 직접 커밋하지 않으며, 머지는 squash 후 브랜치를 삭제

### 커밋 메시지

```text
<type>[(scope)]: [CLIAR-XXX] 명사형 제목
```

- `type`: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `style`
- 제목은 한국어 명사형, 마침표 없이 작성
- 본문에는 변경 내역과 판단 근거를 정리

PR 제목 컨벤션은 `.github/workflows/pr-convention-check.yml`에서 자동 검사합니다.

### 검증

커밋 전에 아래를 실행합니다.

```bash
cd my-reading-room
npm run build
npm run lint
```

## 관련 저장소

| 저장소 | 역할 |
|---|---|
| `backend-auth` | 인증(Cognito 연동), 회원, 약관 |
| `backend-book` | 서재 도서 CRUD, 책장, 문장 수집 |
| `backend-discovery` | 오케스트레이터, 도서 추천 에이전트 |
| `backend-librarian` | 사서 페르소나, 날씨·무드 시그널 |
| `backend-record` | 이미지 OCR |
| `infra` | 관측 스택(Prometheus/Grafana/Loki), RCA Agent |
