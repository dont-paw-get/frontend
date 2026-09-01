/**
 * backend-record OCR API 클라이언트 (CLIAR-209).
 *
 * backend-record는 backend-auth 토큰을 그대로 검증하므로(내부적으로
 * GET /users/me 조회) authApi의 authFetch를 그대로 재사용해 Bearer 첨부와
 * 401 refresh 재시도 인프라를 공유한다.
 *
 * POST /api/v1/ocr/sentences는 OCR 인식과 backend-book 스크랩 저장을
 * 서버가 한 번에 처리한다(멀티파트: image + book_id + page_number/memo).
 * 그래서 프론트가 별도로 scrap 생성 API를 호출하지 않는다 — 이중 저장 방지.
 */

import { authFetch } from './authApi';

/**
 * 문장 사진을 업로드해 OCR로 텍스트를 추출하고, 해당 도서의 스크랩으로 저장한다.
 *
 * @param {object} params
 * @param {File} params.imageFile - 촬영/선택한 이미지 파일 (image/jpeg 또는 image/png, 최대 50MB)
 * @param {number|string} params.bookId - 스크랩을 연결할 backend-book 서재 도서 ID
 * @param {number|string|null} [params.pageNumber] - 문장이 위치한 페이지 번호 (선택)
 * @param {string|null} [params.memo] - 스크랩에 남길 메모 (선택)
 * @returns {Promise<{text: string, lines: string[], scrapId: any, pageNumber: number|null, memo: string}>}
 */
export async function createOcrSentence({ imageFile, bookId, pageNumber = null, memo = null }) {
  const form = new FormData();
  form.append('image', imageFile);
  form.append('book_id', String(bookId));
  if (pageNumber !== null && pageNumber !== '') form.append('page_number', String(pageNumber));
  if (memo) form.append('memo', memo);

  const res = await authFetch('/ocr/sentences', { method: 'POST', body: form });

  // OcrSentencesResponse는 text/lines/scrap_id 등만 반환하고 page_number/memo는
  // 되돌려주지 않으므로, 요청 시 보낸 값을 그대로 화면 표시용으로 함께 반환한다.
  return {
    text: res.text,
    lines: res.lines,
    scrapId: res.scrap_id,
    pageNumber: pageNumber !== null && pageNumber !== '' ? Number(pageNumber) : null,
    memo: memo || '',
  };
}
