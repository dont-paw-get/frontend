/**
 * 백엔드 사서 채팅 API 클라이언트.
 *
 * 개발 환경에서는 Vite proxy를 통해 /api → localhost:8000 으로 프록시됩니다.
 * 백엔드 서버가 꺼져 있으면 null을 반환하여 프론트 로컬 fallback을 사용합니다.
 */

const API_BASE = '/api';

/**
 * 사서에게 채팅 메시지를 전송합니다.
 *
 * @param {object} params
 * @param {string} params.message - 사용자 메시지
 * @param {string} params.librarianId - 현재 사서 id ('cat' | 'stork')
 * @param {string} params.sessionId - 세션 식별자
 * @param {number|null} [params.latitude] - 위도 (날씨 연동용)
 * @param {number|null} [params.longitude] - 경도 (날씨 연동용)
 * @returns {Promise<{text: string, switchTo: object|null}|null>} 응답 또는 null(실패 시)
 */
export async function sendChatMessage({ message, librarianId, sessionId, latitude = null, longitude = null }) {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        librarian_id: librarianId,
        session_id: sessionId,
        latitude,
        longitude,
      }),
    });

    if (!response.ok) {
      console.warn(`[chatApi] 서버 응답 오류: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // 백엔드 snake_case → 프론트 camelCase 변환
    return {
      text: data.text,
      switchTo: data.switch_to
        ? {
            id: data.switch_to.id,
            name: data.switch_to.name,
            icon: data.switch_to.icon,
            genres: data.switch_to.genres,
          }
        : null,
    };
  } catch (err) {
    // 네트워크 오류 (백엔드 미실행 등) → 로컬 fallback 사용
    console.warn('[chatApi] 백엔드 연결 실패, 로컬 fallback 사용:', err.message);
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
