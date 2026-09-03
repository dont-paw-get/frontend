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

/**
 * 응답 키를 camelCase로 통일한다.
 * backend-record는 snake_case(scrap_image_url 등)를 쓰지만 표지 응답은
 * 알라딘 원본 필드가 섞여 들어올 수 있어 호출부가 키 표기에 흔들리지 않도록 한다.
 */
function toCamelKeys(obj) {
  if (!obj || typeof obj !== 'object') return {};
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v])
  );
}

function firstValue(source, ...keys) {
  for (const key of keys) {
    const v = source[key];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

/**
 * 표지/바코드 사진을 업로드해 ISBN을 인식하고, 그 ISBN으로 backend-book이
 * 알라딘에서 조회한 도서 정보를 받는다 (CLIAR-154 후속).
 *
 * POST /api/v1/ocr/covers
 *  - multipart/form-data, 이미지 필드명은 /ocr/sentences와 동일한 image
 *  - 응답: 인식된 ISBN + 알라딘 도서 메타데이터(제목/저자/출판사/쪽수/카테고리 등)
 *
 * 도서 정보가 book/bookInfo 같은 하위 객체로 오는 경우와 페이지 수 필드명
 * (total_pages / page_count) 차이를 흡수해 화면에서 바로 쓸 형태로 정규화한다.
 *
 * @param {object} params
 * @param {File} params.imageFile - 촬영/선택한 이미지 파일 (image/jpeg 또는 image/png)
 * @returns {Promise<{isbn: string|null, title: string, author: string, publisher: string|null,
 *   publishedDate: string|null, coverUrl: string|null, totalPages: number|null,
 *   category: string, raw: object}>}
 */
export async function createOcrCover({ imageFile }) {
  const form = new FormData();
  form.append('image', imageFile);

  const res = await authFetch('/ocr/covers', { method: 'POST', body: form });

  const top = toCamelKeys(res);
  const book = { ...top, ...toCamelKeys(top.book ?? top.bookInfo) };
  const pages = Number(firstValue(book, 'totalPages', 'pageCount', 'itemPage'));

  return {
    isbn: firstValue(book, 'isbn13', 'isbn'),
    title: firstValue(book, 'title') || '',
    author: firstValue(book, 'author', 'authors') || '',
    publisher: firstValue(book, 'publisher'),
    publishedDate: firstValue(book, 'publishedDate', 'pubDate'),
    coverUrl: firstValue(book, 'coverUrl', 'cover'),
    totalPages: Number.isFinite(pages) && pages > 0 ? pages : null,
    // 장르 자동 분류(genreApi.classifyGenre)의 rawCategory로 넘길 알라딘 원본 분류 문자열
    category: firstValue(book, 'category', 'rawCategory', 'categoryName') || '',
    raw: res,
  };
}
