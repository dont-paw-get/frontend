/**
 * 백엔드 사서 채팅 API 클라이언트 (v1).
 *
 * 개발 환경에서는 Vite proxy를 통해 /api → localhost:8000 으로 프록시됩니다.
 * 백엔드 서버가 꺼져 있거나 에러 발생 시 null을 반환하여 프론트 로컬 fallback을 사용합니다.
 */

const API_BASE = '/api/v1';

/**
 * 사서에게 일반 JSON 채팅 메시지를 전송합니다 (단건 응답).
 *
 * @param {object} params
 * @param {string} params.message - 사용자 질문 메시지
 * @param {string|null} [params.sessionId] - 대화 세션 ID (첫 요청 시 null)
 * @returns {Promise<{text: string, sessionId: string}|null>} 응답 또는 null(실패 시)
 */
export async function sendChatMessage({ message, sessionId = null }) {
  try {
    const payload = {
      message,
      stream: false,
    };
    if (sessionId) {
      payload.session_id = sessionId;
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
      sessionId: data.session_id,
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
 * @param {(chunk: string, fullText: string) => void} [params.onChunk] - 청크 수신 시 콜백
 * @returns {Promise<{text: string, sessionId: string}|null>} 최종 응답 또는 null(실패 시)
 */
export async function streamChatMessage({ message, sessionId = null, onChunk }) {
  try {
    const payload = {
      message,
      stream: true,
    };
    if (sessionId) {
      payload.session_id = sessionId;
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

    // 응답 헤더에서 발급된 세션 ID 확인
    const activeSessionId = response.headers.get('X-Session-Id') || sessionId;

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
      sessionId: activeSessionId,
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
    const response = await fetch('/api/v1/health');
    return response.ok;
  } catch {
    return false;
  }
}

