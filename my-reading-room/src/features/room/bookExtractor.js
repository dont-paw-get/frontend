/**
 * AI 추천 에이전트 답변 및 추천 도서 정보 유틸리티 (CLIAR-229)
 */

// 제목 해시로 0~5 사이의 색상 인덱스 자동 배정
export function getColorIndex(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 6;
}

/**
 * 페이지 수에 따른 3D 도서 두께(thickness) 반환
 * @param {number|null} pageCount
 * @returns {number}
 */
export function getBookThickness(pageCount) {
  if (typeof pageCount !== 'number' || Number.isNaN(pageCount) || pageCount <= 0) {
    return 0.22;
  }
  return pageCount > 400 ? 0.3 : pageCount < 200 ? 0.16 : 0.22;
}

/**
 * 백엔드 API 응답의 recommended_books 배열을 프론트엔드 도서 구조로 매핑합니다. (CLIAR-229)
 * - 저자: recommended_books[i].author (쪽수 제외된 순수 저자명)
 * - 총 페이지 수: recommended_books[i].page_count (정수, 확인 불가 시 null)
 *
 * @param {Array<{title: string, author?: string, page_count?: number|null, reason?: string}>} recommendedBooks
 * @returns {Array<{title: string, author: string, page_count: number|null, totalPage: number|null, currentPage: number, colorIdx: number, thickness: number, reason: string}>}
 */
export function formatRecommendedBooks(recommendedBooks) {
  if (!Array.isArray(recommendedBooks) || recommendedBooks.length === 0) {
    return [];
  }

  return recommendedBooks.map((b) => {
    const title = (b.title || '').trim();
    const author = (b.author || '').trim();
    const pageCount =
      typeof b.page_count === 'number' && Number.isFinite(b.page_count) && b.page_count > 0
        ? b.page_count
        : null;

    return {
      title,
      author: author || '미상',
      page_count: pageCount,
      totalPage: pageCount, // 확인 불가 시 null -> 수동 입력 유도
      currentPage: 0,
      colorIdx: getColorIndex(title),
      thickness: getBookThickness(pageCount),
      reason: b.reason || '',
    };
  });
}

/**
 * 마크다운 텍스트에서 추천 도서 제목 목록만 최소한으로 추출 (fallback 용도)
 * 기존의 복잡한 저자/쪽수 정규식 파싱을 제거하고 수동 입력을 유도합니다. (CLIAR-229)
 * @param {string} text - AI 사서의 답변 텍스트
 * @returns {Array<{title: string, author: string, page_count: null, totalPage: null, currentPage: number, colorIdx: number, thickness: number}>}
 */
export function extractBooksFromAnswer(text) {
  if (!text || typeof text !== 'string') return [];

  const books = [];
  const seenTitles = new Set();

  // 마크다운 추천 도서 헤딩(### 📖) 패턴만 단순 추출
  const headingRegex = /^###\s*📖\s*([^\n]+)/gm;
  let match;
  while ((match = headingRegex.exec(text)) !== null) {
    const rawTitle = match[1] || '';
    const cleanTitle = rawTitle
      .trim()
      .replace(/^[『《"“'‘`<>\s]+|[』》"”'’`<>\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanTitle && cleanTitle.length >= 1 && cleanTitle.length <= 60 && !seenTitles.has(cleanTitle)) {
      seenTitles.add(cleanTitle);
      books.push({
        title: cleanTitle,
        author: '', // 정규식 파싱 제거 -> 수동 입력 fallback
        page_count: null, // 정규식 쪽수 파싱 제거 -> 수동 입력 fallback
        totalPage: null,
        currentPage: 0,
        colorIdx: getColorIndex(cleanTitle),
        thickness: 0.22,
      });
    }
  }

  return books;
}

/**
 * 텍스트에서 내 서재 도서 목록(### 📚)을 추출합니다. (ADR 0006 / CLIAR-211)
 * @param {string} text - AI 사서의 답변 텍스트
 * @returns {Array<{title: string, author: string, status: string}>} 추출된 내 서재 도서 목록
 */
export function extractLibraryBooksFromAnswer(text) {
  if (!text || typeof text !== 'string') return [];
  const books = [];
  const seenTitles = new Set();

  const headingBlockRegex = /^###\s*📚\s*([^\n]+?)\s*\n([\s\S]*?)(?=^###\s|$(?![\r\n]))/gm;
  let match;
  while ((match = headingBlockRegex.exec(text)) !== null) {
    const rawTitle = match[1];
    const body = match[2] || '';
    const cleanTitle = (rawTitle || '')
      .trim()
      .replace(/^[『《"“'‘`<>\s]+|[』》"”'’`<>\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanTitle && !seenTitles.has(cleanTitle)) {
      seenTitles.add(cleanTitle);
      const authorMatch = body.match(/\*\*저자\*\*\s*[:：]\s*([^\n]+)/);
      const statusMatch = body.match(/\*\*독서\s*상태\*\*\s*[:：]\s*([^\n]+)/);
      const author = authorMatch ? authorMatch[1].trim() : '';
      const status = statusMatch ? statusMatch[1].trim() : '';
      books.push({
        title: cleanTitle,
        author: author || '미상',
        status: status || '보유 중',
      });
    }
  }

  return books;
}
