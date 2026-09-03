/**
 * backend-auth REST API 클라이언트 + 토큰 관리 인프라 (CLIAR-163).
 *
 * 최종 인증 구조: Frontend → backend-auth REST API → Cognito → RDS
 * 프론트는 Cognito/Amplify SDK를 직접 사용하지 않고 backend-auth API만 호출한다.
 *
 * 토큰 관리 원칙:
 *  - Access Token: 프론트 메모리에만 보관 (localStorage 저장 금지)
 *  - Refresh Token: backend-auth가 HttpOnly Cookie로 설정 → JS에서 접근하지 않음
 *  - 인증 요청은 credentials: 'include'로 쿠키를 주고받는다
 *  - 401 발생 시 /auth/refresh(body 없음) 1회 시도 → 새 access_token으로 원 요청 1회 재시도
 *  - refresh도 401이면 세션 만료로 보고 onSessionExpired 콜백 호출
 */

import { fetchWithTimeout } from './fetchWithTimeout';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// ── Access Token (메모리 보관) ──
let accessToken = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function clearAccessToken() {
  accessToken = null;
}

// 세션 만료(refresh 실패) 시 호출될 콜백 — AuthProvider에서 등록
let onSessionExpired = null;

export function setOnSessionExpired(cb) {
  onSessionExpired = typeof cb === 'function' ? cb : null;
}

/**
 * 응답 본문을 안전하게 JSON으로 파싱 (204/빈 본문이면 null).
 * @param {Response} res
 */
async function parseBody(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * 응답이 JSON이 아니라 HTML인지 판별한다.
 *
 * API 경로가 백엔드로 라우팅되지 않으면(배포 환경의 CloudFront SPA fallback,
 * 프록시 설정 누락 등) 프론트엔드의 index.html이 200으로 돌아온다. 이때 본문을
 * 문자열 그대로 넘기면 호출부는 필드가 전부 undefined인 '빈 응답'으로 오해하고
 * 엉뚱한 곳을 디버깅하게 되므로, 여기서 원인을 밝혀 에러로 만든다.
 */
function looksLikeHtml(body) {
  return typeof body === 'string' && /^\s*<(!doctype|html)/i.test(body);
}

/**
 * API 에러 객체. status와 백엔드가 준 code/detail을 담는다.
 */
export class ApiError extends Error {
  constructor(status, body) {
    // backend-auth는 오류를 detail에 담는다. detail은 문자열이거나
    // { code, message } 객체(예: EMAIL_NOT_VERIFIED)일 수 있다.
    const detail = body?.detail;
    const code = body?.code || detail?.code || body?.error || null;
    const message =
      body?.message ||
      detail?.message ||
      (typeof detail === 'string' ? detail : null) ||
      `요청 실패 (${status})`;
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/**
 * refresh 진행 중이면 그 Promise를 공유해 동시 401에서 중복 refresh를 막는다.
 * @type {Promise<boolean>|null}
 */
let refreshPromise = null;

/**
 * Access Token 갱신. Refresh Token은 HttpOnly Cookie에 있으므로 body는 없다.
 * @returns {Promise<boolean>} 갱신 성공 여부
 */
export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = await parseBody(res);
      if (data?.access_token) {
        setAccessToken(data.access_token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * backend-auth 공통 fetch.
 * - credentials: 'include' 항상 포함
 * - auth=true(기본)면 Authorization: Bearer 자동 첨부
 * - 401이고 refresh 가능하면 refresh 후 1회 재시도, 실패 시 onSessionExpired
 *
 * @param {string} path - '/auth/login' 등 API_BASE 기준 경로
 * @param {object} [options]
 * @param {string} [options.method='GET']
 * @param {object} [options.body] - JSON 직렬화할 본문 (FormData면 그대로 전송, Content-Type 미지정)
 * @param {boolean} [options.auth=true] - Authorization 헤더 첨부 여부
 * @param {boolean} [options._retry] - 내부 재시도 플래그
 * @returns {Promise<any>} 파싱된 응답 본문
 * @throws {ApiError}
 */
export async function authFetch(path, { method = 'GET', body, auth = true, _retry = false } = {}) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = {};
  // FormData는 Content-Type을 지정하지 않아야 브라우저가 boundary를 포함해 자동 설정한다.
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    ...(body !== undefined ? { body: isFormData ? body : JSON.stringify(body) } : {}),
  });

  // 401 → refresh 1회 시도 후 재시도 (refresh/login 자체는 제외)
  if (res.status === 401 && auth && !_retry && path !== '/auth/refresh') {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return authFetch(path, { method, body, auth, _retry: true });
    }
    clearAccessToken();
    if (onSessionExpired) onSessionExpired();
    throw new ApiError(401, await parseBody(res));
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseBody(res));
  }

  // 이름이 authFetch의 요청 body와 겹치지 않도록 data로 받는다.
  const data = await parseBody(res);
  if (looksLikeHtml(data)) {
    throw new ApiError(res.status, {
      detail: `API가 JSON 대신 HTML을 반환했습니다 (${API_BASE}${path}). 요청이 백엔드로 라우팅되지 않고 있습니다 — 배포 환경이면 CloudFront의 /api 동작과 VITE_API_BASE_URL을, 로컬이면 vite.config.js의 프록시 설정을 확인하세요.`,
    });
  }
  return data;
}

// ============================================================
// 인증 엔드포인트 (CLIAR-164/165에서 화면과 연동)
// 요청 필드명은 backend-auth Swagger 계약 기준.
// ============================================================

// ── 약관 ──
/**
 * 서비스 이용약관/개인정보처리방침/AI 분석 활용 동의 전문 조회 (로그인 불필요).
 * TERMS_OF_SERVICE → PRIVACY → AI_ANALYSIS 순서로 고정 반환.
 * AI_ANALYSIS는 선택 약관이라 DB에 없으면 배열에서 빠질 수 있다(에러 아님).
 * 필수 약관(TERMS_OF_SERVICE/PRIVACY) 미설정 시 503.
 * @returns {Promise<Array<{code: string, name: string, content: string, is_required: boolean}>>}
 */
export function getTerms() {
  return authFetch('/terms', { auth: false });
}

// ── 회원가입 / 이메일 인증 ──
export function signup(payload) {
  // payload: { email, password, nickname, birth_date, gender, 약관 동의 등 }
  return authFetch('/auth/signup', { method: 'POST', body: payload, auth: false });
}

export function confirmSignup({ email, code }) {
  return authFetch('/auth/signup/confirm', { method: 'POST', body: { email, code }, auth: false });
}

export function resendSignupCode({ email }) {
  return authFetch('/auth/signup/resend', { method: 'POST', body: { email }, auth: false });
}

// ── 로그인 / 로그아웃 ──
/**
 * 로그인. 성공 시 access_token을 메모리에 저장하고 응답을 반환한다.
 * Refresh Token은 backend-auth가 HttpOnly Cookie로 설정한다.
 * @returns {Promise<{access_token, id_token, expires_in, token_type, member}>}
 */
export async function login({ email, password }) {
  const data = await authFetch('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  if (data?.access_token) setAccessToken(data.access_token);
  return data;
}

export async function logout() {
  try {
    await authFetch('/auth/logout', { method: 'POST', auth: false });
  } finally {
    // 서버 실패 여부와 무관하게 메모리 토큰은 제거
    clearAccessToken();
  }
}

// ── 비밀번호 ──
export function forgotPassword({ email }) {
  return authFetch('/auth/password/forgot', { method: 'POST', body: { email }, auth: false });
}

export function resetPassword({ email, code, newPassword }) {
  return authFetch('/auth/password/reset', {
    method: 'POST',
    body: { email, code, new_password: newPassword },
    auth: false,
  });
}

export function changePassword({ currentPassword, newPassword }) {
  // member_id/sub/email은 보내지 않음 — Access Token으로 대상 판단
  return authFetch('/auth/password/change', {
    method: 'POST',
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

// ── 사용자 (로그인 이후) ──
export function getMe() {
  return authFetch('/users/me');
}

export function updateMe(patch) {
  return authFetch('/users/me', { method: 'PATCH', body: patch });
}

export function deleteMe() {
  return authFetch('/users/me', { method: 'DELETE' });
}
