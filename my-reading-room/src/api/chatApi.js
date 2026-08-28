/**
 * 백엔드 사서 채팅 API 클라이언트 (v1).
 *
 * 개발 환경에서는 Vite proxy를 통해 /api → localhost:8000 으로 프록시됩니다.
 * 배포 환경에서는 VITE_API_BASE_URL(예: https://api.xxx.com/api/v1)을 빌드 타임에 주입해
 * 별도 도메인의 백엔드를 직접 호출합니다. 설정되지 않으면 상대 경로(/api/v1)를 사용합니다.
 * 백엔드 서버가 꺼져 있거나 에러 발생 시 null을 반환하여 프론트 로컬 fallback을 사용합니다.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * 위도/경도 값이 유효한 범위인지 검증합니다 (위도 -90~90, 경도 -180~180).
 * @param {*} latitude
 * @param {*} longitude
 * @returns {boolean}
 */
function isValidCoords(latitude, longitude) {
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
 * 사서에게 일반 JSON 채팅 메시지를 전송합니다 (단건 응답).
 *
 * @param {object} params
 * @param {string} params.message - 사용자 질문 메시지
 * @param {string|null} [params.sessionId] - 대화 세션 ID (첫 요청 시 null)
 * @param {string} [params.librarianId] - 사서 id ('cat' | 'stork', 미전달 시 백엔드 기본값 cat)
 * @param {number} [params.latitude] - 사용자 위치 위도 (날씨 연동용, 없으면 백엔드가 서울 기본값 사용)
 * @param {number} [params.longitude] - 사용자 위치 경도
 * @returns {Promise<{text: string, sessionId: string, switchTo: object|null, signals: object|null}|null>} 응답 또는 null(실패 시)
 */
export async function sendChatMessage({ message, sessionId = null, librarianId = null, latitude = null, longitude = null }) {
  try {
    const payload = {
      message,
      stream: false,
    };
    if (sessionId) {
      payload.session_id = sessionId;
    }
    if (librarianId) {
      payload.librarian_id = librarianId;
    }
    if (isValidCoords(latitude, longitude)) {
      payload.latitude = latitude;
      payload.longitude = longitude;
    } else if (latitude != null || longitude != null) {
      console.warn('[chatApi] 유효하지 않은 좌표라 전송하지 않습니다:', { latitude, longitude });
    }

    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorDetail = await response.text();
      console.warn(`[chatApi] 서버 응답 오류 (${response.status}):`, errorDetail);
      return null;
    }

    const data = await response.json();
    return {
      text: data.message,
      switchTo: data.switch_to ?? null,
      sessionId: data.session_id,
      signals: data.signals ?? null,
    };
  } catch (err) {
    console.warn('[chatApi] 백엔드 연결 실패, 로컬 fallback 사용:', err.message);
    return null;
  }
}

/**
 * 사서에게 실시간 스트리밍 대화 메시지를 요청합니다.
 *
 * @param {object} params
 * @param {string} params.message - 사용자 질문 메시지
 * @param {string|null} [params.sessionId] - 대화 세션 ID (첫 요청 시 null)
 * @param {string} [params.librarianId] - 사서 id ('cat' | 'stork', 미전달 시 백엔드 기본값 cat)
 * @param {number} [params.latitude] - 사용자 위치 위도 (날씨 연동용, 없으면 백엔드가 서울 기본값 사용)
 * @param {number} [params.longitude] - 사용자 위치 경도
 * @param {(chunk: string, fullText: string) => void} [params.onChunk] - 청크 수신 시 콜백
 * @returns {Promise<{text: string, sessionId: string, switchTo: object|null, signals: object|null}|null>} 최종 응답 또는 null(실패 시)
 */
export async function streamChatMessage({ message, sessionId = null, librarianId = null, latitude = null, longitude = null, onChunk }) {
  try {
    const payload = {
      message,
      stream: true,
    };
    if (sessionId) {
      payload.session_id = sessionId;
    }
    if (librarianId) {
      payload.librarian_id = librarianId;
    }
    if (isValidCoords(latitude, longitude)) {
      payload.latitude = latitude;
      payload.longitude = longitude;
    } else if (latitude != null || longitude != null) {
      console.warn('[chatApi] 유효하지 않은 좌표라 전송하지 않습니다:', { latitude, longitude });
    }

    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorDetail = await response.text();
      console.warn(`[chatApi] 스트리밍 요청 오류 (${response.status}):`, errorDetail);
      return null;
    }

    // 응답 헤더에서 세션 ID, switchTo, signals 확인
    const activeSessionId = response.headers.get('X-Session-Id') || sessionId;
    const switchToHeader = response.headers.get('X-Switch-To');
    let switchTo = null;
    if (switchToHeader) {
      try {
        switchTo = JSON.parse(decodeURIComponent(switchToHeader));
      } catch {
        try {
          switchTo = JSON.parse(switchToHeader);
        } catch {
          switchTo = null;
        }
      }
    }

    // signals(날씨·무드)는 스트리밍에서 X-Signals 헤더(JSON 문자열)로 전달됨 (없으면 null)
    let signals = null;
    const signalsHeader = response.headers.get('X-Signals');
    if (signalsHeader) {
      try {
        signals = JSON.parse(decodeURIComponent(signalsHeader));
      } catch {
        try {
          signals = JSON.parse(signalsHeader);
        } catch {
          signals = null;
        }
      }
    }

    if (!response.body) {
      console.warn('[chatApi] 스트리밍 응답 바디가 없습니다.');
      return null;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      if (onChunk) {
        onChunk(chunk, fullText);
      }
    }

    return {
      text: fullText,
      switchTo,
      sessionId: activeSessionId,
      signals,
    };
  } catch (err) {
    console.warn('[chatApi] 스트리밍 실패, 로컬 fallback 사용:', err.message);
    return null;
  }
}

/**
 * 백엔드 헬스체크.
 * @returns {Promise<boolean>} 서버 정상 여부
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

