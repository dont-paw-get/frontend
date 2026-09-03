/**
 * backend-record OCR API 클라이언트 (CLIAR-209 / CLIAR-228 / CLIAR-154).
 *
 * backend-record는 backend-auth 토큰을 그대로 검증하므로(내부적으로
 * GET /users/me 조회) authApi의 authFetch를 그대로 재사용해 Bearer 첨부와
 * 401 refresh 재시도 인프라를 공유한다.
 *
 * POST /api/v1/ocr/sentences는 이미지를 OCR로 인식하고 원본 이미지를 S3에
 * 업로드해 scrap_image_url을 생성한다. save_scrap 파라미터로 두 모드를 지원한다:
 *  - save_scrap=true : 인식 후 backend-book 스크랩까지 자동 저장(scrap_id 반환)
 *  - save_scrap=false: 인식과 S3 업로드만. 저장은 하지 않음(scrap_id=null).
 *                      사용자가 확인/수정 후 별도로 스크랩을 저장하는 흐름용(CLIAR-228).
 *
 * POST /api/v1/ocr/covers는 표지/바코드 사진에서 ISBN을 인식해 backend-book(알라딘 연동)이
 * 조회한 도서 메타데이터를 돌려준다. 책 등록 화면(RegisterBook)에서 쓴다.
 */

import { authFetch } from './authApi';

/**
 * 문장 사진을 업로드해 OCR로 텍스트를 추출한다.
 *
 * 기본은 OCR-only 모드(saveScrap=false): 인식 결과와 S3에 저장된 원본 이미지 URL만
 * 돌려주고 backend-book 저장은 하지 않는다. 호출부가 결과를 사용자에게 보여주고
 * 확인/수정 후 bookApi.createScrap(scrapImageUrl 포함)으로 저장한다.
 *
 * @param {object} params
 * @param {File} params.imageFile - 촬영/선택한 이미지 파일 (image/jpeg 또는 image/png, 최대 50MB)
 * @param {number|string} params.bookId - 스크랩을 연결할 backend-book 서재 도서 ID
 * @param {number|string|null} [params.pageNumber] - 문장이 위치한 페이지 번호 (선택)
 * @param {string|null} [params.memo] - 스크랩에 남길 메모 (선택, save_scrap=true일 때만 의미)
 * @param {boolean} [params.saveScrap=false] - true면 서버가 backend-book에 자동 저장
 * @returns {Promise<{text: string, lines: string[], scrapImageUrl: string, scrapId: any}>}
 */
export async function createOcrSentence({
  imageFile,
  bookId,
  pageNumber = null,
  memo = null,
  saveScrap = false,
}) {
  const form = new FormData();
  form.append('image', imageFile);
  form.append('book_id', String(bookId));
  if (pageNumber !== null && pageNumber !== '') form.append('page_number', String(pageNumber));
  if (memo) form.append('memo', memo);

  const res = await authFetch(`/ocr/sentences?save_scrap=${saveScrap}`, {
    method: 'POST',
    body: form,
  });

  return {
    text: res.text,
    lines: res.lines,
    // OCR에 사용한 원본 이미지를 S3에 저장한 URL. 확인 후 저장 시 backend-book으로 전달한다.
    scrapImageUrl: res.scrap_image_url,
    scrapId: res.scrap_id ?? null,
  };
}

// ISBN-13 본체: 978/979 접두사 + 10자리. 바코드 옆 부가기호(03330 등)나
// 정가 표기가 같은 줄에 섞여 들어와도 이 패턴만 뽑아낸다.
const ISBN13_RE = /97[89]\d{10}/;

/**
 * OCR로 인식된 줄 목록에서 ISBN-13을 찾는다.
 *
 * backend-record도 같은 일을 하지만(app/services/bedrock_ocr.py `_extract_isbn`),
 * 줄에서 숫자만 남긴 뒤 '앞 13자리'만 검사해서 ISBN 앞에 다른 숫자가 붙은 줄
 * (예: '값 15,000원 ISBN 978-89-349-3960-3')을 놓친다. OCR 결과의 줄 분할은
 * 실행마다 달라지므로, 응답의 isbn이 비어 있을 때 여기서 한 번 더 찾는다.
 *
 * @param {string[]} lines
 * @returns {string|null}
 */
function findIsbnInLines(lines) {
  for (const line of lines) {
    const digits = String(line).replace(/\D/g, '');
    const matched = digits.match(ISBN13_RE);
    if (matched) return matched[0];
  }
  return null;
}

/**
 * 표지/바코드 사진을 업로드해 ISBN과 제목·저자 후보를 인식한다 (CLIAR-154 후속).
 *
 * POST /api/v1/ocr/covers (backend-record app/api/ocr.py)
 *  - multipart/form-data, 이미지 필드명은 /ocr/sentences와 동일한 image
 *  - 응답: { title_candidate, author_candidates[], lines[], request_id, confidence,
 *           isbn, book_id, already_registered, book }
 *
 * 주의: 이 엔드포인트는 인식한 ISBN으로 backend-book을 조회한 뒤 사용자의 서재에
 * 책까지 등록하고 book_id를 돌려준다. 이미 서재에 있으면 already_registered=true와
 * 기존 book_id를 준다. 따라서 등록 화면은 이 book_id를 이어받아 새로 만들지 말고
 * 갱신해야 중복 등록이 생기지 않는다.
 *
 * @param {object} params
 * @param {File} params.imageFile - 촬영/선택한 이미지 파일 (image/jpeg 또는 image/png, 최대 50MB)
 * @param {string|null} [params.modelId] - 사용할 Bedrock 모델 ID (미지정 시 서버 설정값)
 * @returns {Promise<{isbn: string|null, titleCandidate: string, authorCandidates: string[],
 *   lines: string[], bookId: any, alreadyRegistered: boolean, book: object|null, requestId: string|null}>}
 */
export async function createOcrCover({ imageFile, modelId = null }) {
  const form = new FormData();
  form.append('image', imageFile);

  const query = modelId ? `?model_id=${encodeURIComponent(modelId)}` : '';
  const res = await authFetch(`/ocr/covers${query}`, { method: 'POST', body: form });

  const lines = res.lines ?? [];

  return {
    // 하이픈·공백이 제거된 숫자 문자열. 서버가 못 찾았으면 인식된 줄에서 직접 찾는다.
    isbn: res.isbn ?? findIsbnInLines(lines),
    titleCandidate: res.title_candidate ?? '',
    authorCandidates: res.author_candidates ?? [],
    lines,
    bookId: res.book_id ?? null,
    alreadyRegistered: Boolean(res.already_registered),
    // backend-book /search 결과(서재 도서 또는 알라딘 조회 결과). 못 찾으면 null.
    book: res.book ?? null,
    requestId: res.request_id ?? null,
  };
}
