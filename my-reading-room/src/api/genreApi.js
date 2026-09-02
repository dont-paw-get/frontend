/**
 * backend-discovery 도서 장르 분류 API 클라이언트 (CLIAR-241).
 *
 * 알라딘 도서 검색(backend-book의 ExternalBook)은 장르를 제공하지 않는다
 * (ADR-0003에서 그 이유로 genre를 제거했고, ADR-0010은 DB 필드만 되살렸다).
 * 그래서 장르는 backend-discovery의 분류 API로 채운다 — 제목/저자/ISBN/원본
 * 카테고리를 넘기면 backend-book genre_type과 동일한 16종 중 하나로 분류해 준다.
 *
 * 분류 실패(서버 미기동, 타임아웃 등)는 등록을 막지 않는다. 이 경우 null을 반환하고
 * 호출부가 'NONE'(미지정)으로 두거나 사용자가 직접 선택하게 한다.
 */

import { getAccessToken } from './authApi';
import { fetchWithTimeout } from './fetchWithTimeout';
import { GENRE_CODES, GENRE_NONE } from '../data/genres';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * 도서 메타데이터로 표준 장르(genre_type 16종)를 분류한다.
 *
 * @param {object} params
 * @param {string} params.title - 도서 제목 (필수)
 * @param {string} [params.author] - 저자명
 * @param {string} [params.isbn] - ISBN
 * @param {string} [params.rawCategory] - 알라딘/OCR 원본 카테고리 문자열
 * @returns {Promise<{genre: string, confidence: number}|null>} 분류 결과 또는 null(실패 시)
 */
export async function classifyGenre({ title, author = '', isbn = '', rawCategory = '' }) {
  if (!title?.trim()) return null;

  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetchWithTimeout(`${API_BASE}/classify-genre`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: title.trim(),
        author: author || '',
        isbn: isbn || '',
        raw_category: rawCategory || '',
      }),
    });

    if (!res.ok) {
      console.warn(`[genreApi] 장르 분류 실패 (${res.status})`);
      return null;
    }

    const data = await res.json();
    // 알 수 없는 값이 오면 미지정으로 처리해 잘못된 enum이 저장되는 걸 막는다.
    const genre = GENRE_CODES.includes(data?.genre) ? data.genre : GENRE_NONE;
    return { genre, confidence: data?.confidence ?? 0 };
  } catch (err) {
    console.warn('[genreApi] 장르 분류 요청 실패:', err.message);
    return null;
  }
}
