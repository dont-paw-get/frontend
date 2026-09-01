/**
 * AI 추천 에이전트 답변 텍스트에서 추천 도서 정보(제목, 저자, 페이지 수 등)를 추출하는 유틸리티
 */

/**
 * 텍스트에서 추천된 도서 목록을 추출합니다.
 * @param {string} text - AI 사서의 답변 텍스트
 * @returns {Array<{title: string, author: string, totalPage: number, currentPage: number, colorIdx: number, thickness: number}>} 추출된 도서 목록
 */
export function extractBooksFromAnswer(text) {
  if (!text || typeof text !== 'string') return [];

  const books = [];
  const seenTitles = new Set();

  // 제목 해시로 0~5 사이의 색상 인덱스 자동 배정
  function getColorIndex(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 6;
  }

  function addBook(title, author = '', contextSnippet = '') {
    const cleanTitle = (title || '')
      .trim()
      .replace(/^[『《"“'‘`<>\s]+|[』》"”'’`<>\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    let cleanAuthor = (author || '').trim().replace(/^[([\s]*|[)\]\s]*$/g, '').trim();

    // 페이지 수 추출 (author 또는 contextSnippet에서 숫자+쪽/페이지/p 패턴 검색)
    let totalPage = 300; // 기본 단행본 권장 페이지 수
    const pageMatch = (author + ' ' + contextSnippet).match(/(\d{2,4})\s*(?:쪽|페이지|p|pages)/i);
    if (pageMatch) {
      const parsedPage = parseInt(pageMatch[1], 10);
      if (parsedPage >= 30 && parsedPage <= 2000) {
        totalPage = parsedPage;
      }
    }

    // 저자 텍스트 내 괄호 페이지 수 정리 (예: "피터 드러커 (308쪽)" -> "피터 드러커")
    cleanAuthor = cleanAuthor.replace(/\s*[(（]\s*\d+\s*(?:쪽|페이지|p|pages)\s*[)）]/gi, '').trim();
    cleanAuthor = cleanAuthor.replace(/,\s*\d+\s*(?:쪽|페이지|p|pages).*$/i, '').trim();
    // 저자 텍스트 내 불필요 접두사/접미사 정리
    cleanAuthor = cleanAuthor.replace(/(?:\s*저자?|\s*지음|\s*글|\s*작가|\s*옮김)$/g, '').trim();
    cleanAuthor = cleanAuthor.replace(/^(?:저자?|지은이|글|작가)[:\s]*/g, '').trim();

    if (cleanTitle && cleanTitle.length >= 1 && cleanTitle.length <= 60 && !seenTitles.has(cleanTitle)) {
      const excludeWords = [
        '도서 추천', '추천 도서', '사서', '책', '소설', '에세이', '인문학', '자기계발',
        '답변', '제목', '저자', '추천 이유', '줄거리', '요약', '카테고리', '목록', '리스트',
        '사서 분석 정보', '추천 포커스 장르', '사용자 무드', '현재 날씨'
      ];
      if (!excludeWords.some((w) => cleanTitle.includes(w))) {
        seenTitles.add(cleanTitle);
        books.push({
          title: cleanTitle,
          author: cleanAuthor || '미상',
          totalPage,
          currentPage: 0,
          colorIdx: getColorIndex(cleanTitle),
          thickness: totalPage > 400 ? 0.3 : totalPage < 200 ? 0.16 : 0.22,
        });
      }
    }
  }

  // 0. 마크다운 추천 도서 헤딩(### 📖) + 키-값 목록 패턴
  //    ### 📖 제목
  //    - **저자**: 이름
  //    - **추천 이유**: 설명...
  const headingBlockRegex = /^###\s*📖\s*([^\n]+?)\s*\n([\s\S]*?)(?=^###\s|$(?![\r\n]))/gm;
  let match;
  while ((match = headingBlockRegex.exec(text)) !== null) {
    const title = match[1];
    const body = match[2] || '';
    const authorMatch = body.match(/\*\*저자\*\*\s*[:：]\s*([^\n]+)/);
    const author = authorMatch ? authorMatch[1] : '';
    if (title.trim()) {
      addBook(title, author, body);
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
