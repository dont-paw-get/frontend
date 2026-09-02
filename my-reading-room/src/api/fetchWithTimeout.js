/**
 * 타임아웃이 걸린 fetch 래퍼 (CLIAR-240).
 *
 * 기본 fetch는 타임아웃이 없어 백엔드가 응답 없이 멈추면 요청이 무한정
 * 대기한다. AbortController로 지정 시간(기본 60초) 후 요청을 중단시켜
 * 프론트가 "응답 없음" 상태로 계속 매달리지 않게 한다.
 *
 * 외부에서 signal을 이미 넘겼다면 그 signal을 그대로 존중하고 타임아웃을
 * 추가하지 않는다(호출부가 직접 취소를 제어하는 경우와 충돌 방지).
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [timeoutMs=60000] - 타임아웃(ms). 기본 60초.
 * @returns {Promise<Response>}
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 60000;

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  if (options.signal) {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`요청 시간이 초과됐습니다 (${Math.round(timeoutMs / 1000)}초).`, { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
