/**
 * backend-book 서재(도서/문장수집) API 클라이언트 (CLIAR-186).
 *
 * backend-book은 backend-auth와 동일한 Cognito JWT를 검증하고, 모든 서재 데이터는
 * 토큰의 sub(memberId)로 사용자별 스코프가 걸린다. 따라서 authApi의 authFetch를
 * 그대로 재사용해 Authorization 헤더 첨부 + 401 refresh 재시도 인프라를 공유한다.
 *
 * 주의: backend-book은 도서의 색상/두께(시각 정보)를 저장하지 않는다.
 *       해당 값은 프론트에서 bookVisuals(localStorage)로 임시 보관한다(후속 티켓에서
 *       백엔드 DB 필드 추가 시 이관).
 */

import { authFetch } from './authApi';

// ── 상태 매핑: 프론트 한글 상태 ↔ 백엔드 ReadingStatus enum ──
// 백엔드는 PLANNED / READING / COMPLETED 3가지만 지원한다.
// '잠시 멈춤'은 대응 enum이 없어 READING으로 매핑한다(백엔드에 PAUSED 추가되면 조정).
const STATUS_TO_READING = {
  시작전: 'PLANNED',
  읽는중: 'READING',
  '읽는 중': 'READING',
  '잠시 멈춤': 'READING',
  완독: 'COMPLETED',
};

const READING_TO_STATUS = {
  PLANNED: '시작전',
  READING: '읽는 중',
  COMPLETED: '완독',
};

export function toReadingStatus(krStatus) {
  return STATUS_TO_READING[krStatus] || 'PLANNED';
}

export function toKoreanStatus(readingStatus) {
  return READING_TO_STATUS[readingStatus] || '시작전';
}

// ── 도서 ──

/**
 * 내 서재의 모든 도서를 조회한다(페이지네이션 전체 순회, 최대 페이지 크기 100).
 * @returns {Promise<Array>} LibraryBookSummary 배열
 */
export async function listLibraryBooks() {
  const size = 100;
  let page = 0;
  const all = [];
  for (; ;) {
    const res = await authFetch(`/library/books?page=${page}&size=${size}`);
    if (Array.isArray(res?.books)) all.push(...res.books);
    const totalPages = res?.totalPages ?? 1;
    if (page + 1 >= totalPages) break;
    page += 1;
  }
  return all;
}

/**
 * 도서 상세 조회 (목록엔 없는 currentPage/totalPages/isbn 등 포함).
 */
export function getLibraryBook(bookId) {
  return authFetch(`/library/books/${bookId}`);
}

/**
 * 도서 등록. shelfId 미전달 시 백엔드가 기본 책장에 자동 배치한다.
 * 색상/두께 등 시각 정보는 백엔드가 저장하지 않으므로 전송하지 않는다.
 */
export function createLibraryBook({ title, author, totalPages = null, readingStatus = 'PLANNED' }) {
  return authFetch('/library/books', {
    method: 'POST',
    body: {
      title,
      author,
      isbn: null,
      genre: 'NONE',
      publisher: null,
      publishedDate: null,
      totalPages,
      coverUrl: null,
      readingStatus,
      shelfId: null,
    },
  });
}

/**
 * 도서 메타데이터 수정. backend-book PATCH는 전체 페이로드를 요구하므로
 * 호출부가 기존 상세값 + 변경값을 합쳐 전달해야 한다.
 */
export function updateLibraryBookMeta(bookId, meta) {
  const {
    title,
    author,
    isbn = null,
    genre = 'NONE',
    publisher = null,
    publishedDate = null,
    coverUrl = null,
    readingStatus = 'PLANNED',
    totalPages = null,
  } = meta;
  return authFetch(`/library/books/${bookId}`, {
    method: 'PATCH',
    body: { title, author, isbn, genre, publisher, publishedDate, coverUrl, readingStatus, totalPages },
  });
}

/**
 * 독서 진행도(현재 페이지) 갱신.
 */
export function updateReadingProgress(bookId, currentPage, totalPages = null) {
  return authFetch(`/library/books/${bookId}/progress`, {
    method: 'PATCH',
    body: { currentPage, totalPages },
  });
}

export function deleteLibraryBook(bookId) {
  return authFetch(`/library/books/${bookId}`, { method: 'DELETE' });
}

// ── 문장수집(scrap) ──

export function getScrap(scrapId) {
  return authFetch(`/library/scraps/${scrapId}`);
}

/**
 * 특정 도서의 문장 목록 조회.
 * 목록(ScrapSummary)에는 memo가 없어, memo까지 필요하므로 각 scrap 상세를 함께 조회한다.
 * (문장 개수가 많지 않은 개인 서재 특성상 허용. 후속에 목록 응답에 memo 포함 시 최적화)
 * @returns {Promise<Array<{scrapId, sentence, pageNumber, memo}>>}
 */
export async function listScraps(bookId) {
  const size = 100;
  let page = 0;
  const summaries = [];
  for (; ;) {
    const res = await authFetch(`/library/books/${bookId}/scraps?page=${page}&size=${size}`);
    if (Array.isArray(res?.scraps)) summaries.push(...res.scraps);
    const totalPages = res?.totalPages ?? 1;
    if (page + 1 >= totalPages) break;
    page += 1;
  }
  return Promise.all(summaries.map((s) => getScrap(s.scrapId)));
}

/**
 * 문장 스크랩 생성.
 * backend-book은 scrapImageUrl을 필수(non-blank)로 요구한다. 스크랩 원본 이미지는
 * backend-record가 OCR 시 S3에 업로드해 URL을 만들어 주므로, 그 URL을 그대로 넘긴다.
 */
export function createScrap(bookId, { sentence, pageNumber = null, memo = null, scrapImageUrl }) {
  return authFetch(`/library/books/${bookId}/scraps`, {
    method: 'POST',
    body: { sentence, pageNumber, scrapImageUrl, memo },
  });
}

/**
 * 문장 스크랩 수정. PATCH도 scrapImageUrl을 필수로 요구하므로,
 * 호출부가 기존 스크랩의 scrapImageUrl을 함께 전달해야 한다.
 */
export function updateScrap(scrapId, { sentence, pageNumber = null, memo = null, scrapImageUrl }) {
  return authFetch(`/library/scraps/${scrapId}`, {
    method: 'PATCH',
    body: { sentence, pageNumber, scrapImageUrl, memo },
  });
}

export function deleteScrap(scrapId) {
  return authFetch(`/library/scraps/${scrapId}`, { method: 'DELETE' });
}
