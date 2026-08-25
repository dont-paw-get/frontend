# AWS 배포 인프라 설정 가이드 (S3 + CloudFront + CloudWatch)

이 문서는 AWS 콘솔에서 dev/prod 두 환경의 정적 호스팅 인프라를 수동으로 구성하고,
GitHub Actions CI/CD(`.github/workflows/deploy-dev.yml`, `deploy-prod.yml`)가
사용할 값을 GitHub Environments에 등록하는 절차를 안내합니다.

## 아키텍처

```
GitHub Actions (push)
  develop → dev 환경
  main    → prod 환경
        │
        ▼
  vite build (dist/)
        │
        ▼
  S3 버킷 (비공개, 오리진 전용) ──origin──▶ CloudFront 배포 ──▶ 사용자
                                              │
                                    /api/*   (없음 — 백엔드는 별도 도메인 api.xxx.com 직접 호출)
CloudWatch: CloudFront 표준 로그 + 5xx 에러율 알람
```

프론트엔드는 `VITE_API_BASE_URL`(예: `https://api.xxx.com/api/v1`)을 빌드 타임에 주입해
백엔드를 별도 도메인으로 직접 호출합니다. 백엔드 CORS 설정에 CloudFront 도메인(및 커스텀 도메인)을
허용 오리진으로 추가해야 합니다.

dev/prod 각각 아래 절차를 **두 번** 반복해서 완전히 분리된 리소스를 만드세요.

---

## 1. S3 버킷 생성

1. S3 콘솔 → **버킷 만들기**
2. 버킷 이름: `my-reading-room-dev` / `my-reading-room-prod` (전역 고유해야 하므로 필요시 접미사 추가)
3. 리전: 사용할 리전 선택 (dev/prod 동일 리전 권장)
4. **퍼블릭 액세스 차단 설정: 모두 체크(기본값 유지)** — CloudFront가 OAC로만 접근하므로 버킷을 공개할 필요가 없습니다.
5. 버킷 버전 관리: 선택 사항 (롤백 편의를 위해 활성화 권장)
6. 나머지 기본값으로 생성

## 2. CloudFront 배포 생성

1. CloudFront 콘솔 → **배포 생성**
2. 오리진 도메인: 위에서 만든 S3 버킷 선택 (버킷의 REST API 엔드포인트가 자동 제안됨 — `s3-website` 엔드포인트 아님)
3. **오리진 액세스: Origin Access Control(OAC)** 선택 → 새 OAC 생성 → 생성 후 안내되는 **버킷 정책을 S3 버킷에 그대로 붙여넣기** (콘솔이 정책 문구를 제공합니다)
4. 뷰어 프로토콜 정책: **Redirect HTTP to HTTPS**
5. 캐시 정책: `CachingOptimized` (기본값)
6. Default root object: `index.html`
7. **오류 페이지 (SPA 라우팅 대응)** — 배포 생성 후 "오류 페이지" 탭에서 커스텀 오류 응답 추가:
   - HTTP 오류 코드 `403` → 응답 페이지 경로 `/index.html` → HTTP 응답 코드 `200`
   - HTTP 오류 코드 `404` → 응답 페이지 경로 `/index.html` → HTTP 응답 코드 `200`
   - (React Router가 클라이언트 사이드에서 라우팅하므로, 존재하지 않는 경로 요청도 index.html을 반환해야 합니다)
8. 커스텀 도메인을 쓸 경우 ACM 인증서(반드시 **us-east-1** 리전)를 발급받아 대체 도메인 이름(CNAME)에 연결

배포는 생성 후 전 세계 엣지 로케이션에 전파되는 데 몇 분 걸립니다.

## 3. CloudWatch 모니터링

1. **표준 로그**: CloudFront 배포 → 로깅 탭 → 표준 로그 활성화 → 로그 저장용 S3 버킷 지정(오리진 버킷과 별도 버킷 권장, 예: `my-reading-room-logs`)
2. **알람 (5xx 에러율)**: CloudWatch 콘솔 → 알람 생성
   - 지표: `CloudFront` → `Per-Distribution Metrics` → `5xxErrorRate` (배포별 지표를 보려면 배포 설정에서 "추가 지표" 활성화 필요)
   - 조건: 5분 평균이 5% 초과 시
   - 알림: SNS 주제 생성 후 이메일 구독 등록
3. (선택) `OriginLatency`, `4xxErrorRate` 등 추가 알람도 동일한 방식으로 생성

## 4. GitHub Actions용 IAM 사용자 생성

dev/prod 각각 별도 IAM 사용자를 만들어 자격 증명을 분리하는 것을 권장합니다.

1. IAM 콘솔 → 사용자 생성 → `github-actions-deploy-dev` (prod는 `-prod`)
2. **콘솔 액세스 없음**, 프로그래밍 방식 액세스만 필요
3. 아래 정책을 인라인 정책으로 연결 (버킷명/배포ID를 실제 값으로 교체):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3DeployAccess",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::my-reading-room-dev",
        "arn:aws:s3:::my-reading-room-dev/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidation",
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "arn:aws:cloudfront::<AWS_ACCOUNT_ID>:distribution/<CLOUDFRONT_DISTRIBUTION_ID>"
    }
  ]
}
```

4. 사용자 생성 후 **액세스 키 발급** → Access Key ID / Secret Access Key를 안전한 곳에 임시 보관 (다음 단계에서 GitHub에 등록 후 즉시 폐기 권장)

## 5. GitHub Environments 설정

리포지토리 → Settings → Environments 에서 `dev`, `prod` 두 환경을 각각 생성하고 아래 값을 등록합니다.

| 이름 | 종류 | dev 값 예시 | prod 값 예시 |
|---|---|---|---|
| `AWS_ACCESS_KEY_ID` | Secret | dev IAM 사용자 키 | prod IAM 사용자 키 |
| `AWS_SECRET_ACCESS_KEY` | Secret | dev IAM 사용자 시크릿 | prod IAM 사용자 시크릿 |
| `AWS_REGION` | Variable | `ap-northeast-2` | `ap-northeast-2` |
| `S3_BUCKET` | Variable | `my-reading-room-dev` | `my-reading-room-prod` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Variable | `E1XXXXXXXXXXX` | `E2XXXXXXXXXXX` |
| `VITE_API_BASE_URL` | Variable | `https://api-dev.xxx.com/api/v1` | `https://api.xxx.com/api/v1` |

`prod` 환경은 Settings → Environments → `prod` → **Deployment branches** 를 `main`으로 제한해서
실수로 다른 브랜치에서 prod 시크릿을 사용하지 못하도록 막아두는 것을 권장합니다.

## 6. 배포 확인

1. `develop` 브랜치에 push → Actions 탭에서 `Deploy to Dev` 워크플로우 실행 확인
2. CloudFront 배포 도메인(`dxxxxxxx.cloudfront.net`)으로 접속해 사이트 정상 로딩 확인
3. 브라우저에서 존재하지 않는 경로(`/foo/bar`) 접속 시 404 대신 SPA가 정상 렌더링되는지 확인 (2단계 오류 페이지 설정 검증)
4. 사서 채팅 기능을 사용해 `VITE_API_BASE_URL`이 올바르게 백엔드와 통신하는지 확인 (백엔드 CORS에 CloudFront 도메인이 허용되어 있어야 함)
5. `main` 브랜치 병합 후 동일하게 `Deploy to Prod` 확인
