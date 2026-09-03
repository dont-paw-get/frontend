# my-reading-room

**Don't Paw-get Your Book** 프론트엔드 애플리케이션(React + Vite)입니다.

프로젝트 개요, 구조, 백엔드 연동, 배포 방법은 저장소 루트의 [README](../README.md)를 참고해 주세요.
이 문서는 이 디렉터리에서 바로 쓰는 명령만 정리합니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 실행 (HMR) |
| `npm run build` | 프로덕션 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과 로컬 확인 |
| `npm run lint` | ESLint 검사 |

커밋 전에 `npm run build`와 `npm run lint`를 실행해 주세요.

## 로컬 백엔드 프록시

개발 서버는 `/api` 요청을 경로별로 각 백엔드에 프록시합니다(`vite.config.js`).

| 경로 | 서비스 | 기본 대상 |
|---|---|---|
| `/api/v1/ocr/*` | backend-record | `http://127.0.0.1:8002` |
| `/api/v1/books`, `/api/v1/library/*`, `/api/v1/librarian*` | backend-book | `http://127.0.0.1:8080` |
| `/api/v1/classify-genre` | backend-discovery | `AUTH_API`와 동일 |
| 그 외 `/api/*` (auth, users, terms) | backend-auth | `http://127.0.0.1:8000` |

로컬에 띄우지 않은 서비스는 `.env.local`에 배포된 주소를 넣으면 됩니다
(`AUTH_API` / `RECORD_API` / `BOOK_API` / `DISCOVERY_API`, `.env.example` 참고).
넷 다 배포된 dev 주소를 넣으면 로컬 백엔드 없이 개발할 수 있습니다.
`.env.local`과 `vite.config.js`는 개발 서버 시작 시에만 읽으므로 변경 후 재시작이 필요합니다.

`VITE_API_BASE_URL`을 채우면 프록시를 거치지 않고 브라우저가 그 주소로 직접
요청합니다. 이 경우 백엔드의 CORS 허용 오리진에 개발 서버 주소가 있어야 합니다.
