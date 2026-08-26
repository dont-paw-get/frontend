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
 * 위도/경도 값이 유효한 범위인지 검증합니다.
 * (위도: -90~90, 경도: -180~180, 숫자이고 NaN이 아니어야 함)
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean}
 */
export function isValidCoords(latitude, longitude) {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * 사용자의 현재 위치를 가져옵니다. 세션 중 최초 1회만 실제 요청하고 이후엔 캐시를 반환합니다.
 * 브라우저가 반환한 좌표가 유효 범위(위도 -90~90, 경도 -180~180)를 벗어나면 null로 처리합니다.
 *
 * @param {object} [options]
 * @param {number} [options.timeout=15000] - 위치 요청 타임아웃(ms). GPS/네트워크 위치 첫 조회는 느릴 수 있어 넉넉히 둠.
 * @returns {Promise<{latitude: number, longitude: number}|null>}
 */
export function getUserLocation({ timeout = 15000 } = {}) {
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
        const { latitude, longitude } = position.coords;

        if (!isValidCoords(latitude, longitude)) {
          console.warn('[geolocation] 유효 범위를 벗어난 좌표를 무시합니다:', { latitude, longitude });
          requestPromise = null;
          resolve(null);
          return;
        }

        cachedPosition = { latitude, longitude };
        requestPromise = null;
        resolve(cachedPosition);
      },
      (err) => {
        // 권한 거부, 타임아웃, 위치 정보 사용 불가 등 → null 반환 (백엔드 기본값 사용)
        console.warn('[geolocation] 위치 정보를 가져오지 못했습니다:', err.message);
        requestPromise = null;
        resolve(null);
      },
      {
        timeout,
        maximumAge: 10 * 60 * 1000, // 10분 이내 캐시된 위치 재사용 (재조회 안 함 → 타임아웃 회피)
        enableHighAccuracy: false, // 정확도보다 속도 우선 (책 추천엔 대략 위치면 충분)
      }
    );
  });

  return requestPromise;
}
