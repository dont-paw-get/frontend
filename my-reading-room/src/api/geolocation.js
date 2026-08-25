/**
 * 브라우저 Geolocation API 래퍼.
 *
 * - 세션 중 한 번만 사용자에게 위치 권한을 요청하고 결과를 캐싱합니다.
 * - 권한 거부/실패/미지원 시 null을 반환하며, 백엔드는 이 경우 기본 위치(서울)로 폴백합니다.
 * - HTTPS(또는 localhost) 환경에서만 동작합니다.
 */

let cachedPosition = null; // { latitude, longitude } | null
let requestPromise = null; // 중복 요청 방지용 진행 중 Promise

/**
 * 사용자의 현재 위치를 가져옵니다. 세션 중 최초 1회만 실제 요청하고 이후엔 캐시를 반환합니다.
 *
 * @param {object} [options]
 * @param {number} [options.timeout=5000] - 위치 요청 타임아웃(ms)
 * @returns {Promise<{latitude: number, longitude: number}|null>}
 */
export function getUserLocation({ timeout = 5000 } = {}) {
  if (cachedPosition) {
    return Promise.resolve(cachedPosition);
  }
  if (requestPromise) {
    return requestPromise;
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  requestPromise = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        cachedPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        requestPromise = null;
        resolve(cachedPosition);
      },
      (err) => {
        // 권한 거부, 타임아웃, 위치 정보 사용 불가 등 → null 반환 (백엔드 기본값 사용)
        console.warn('[geolocation] 위치 정보를 가져오지 못했습니다:', err.message);
        requestPromise = null;
        resolve(null);
      },
      { timeout, maximumAge: 10 * 60 * 1000 } // 10분간 캐시 허용
    );
  });

  return requestPromise;
}
