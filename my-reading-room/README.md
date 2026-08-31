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

개발 서버는 `/api` 요청을 `http://127.0.0.1:8000`으로 프록시합니다(`vite.config.js`).
백엔드를 로컬에서 함께 띄우면 별도 설정 없이 연동됩니다.
