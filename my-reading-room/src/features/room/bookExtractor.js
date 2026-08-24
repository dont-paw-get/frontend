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
    const cleanTitle = (title || '').trim().replace(/^['"『"“`《<]|['"』"”`》>]$/g, '').trim();
    let cleanAuthor = (author || '').trim().replace(/^[(\[\s]*|[)\]\s]*$/g, '').trim();

    // 저자 텍스트 내 불필요 접두사/접미사 정리
    cleanAuthor = cleanAuthor.replace(/(?:\s*저자?|\s*지음|\s*글|\s*작가|\s*옮김)$/g, '').trim();
    cleanAuthor = cleanAuthor.replace(/^(?:저자?|지은이|글|작가)[:\s]*/g, '').trim();
    // 괄호 안에 페이지 수나 출판사 정보가 섞여 있는 경우 분리
    cleanAuthor = cleanAuthor.replace(/,\s*\d+\s*(?:쪽|페이지|p|pages).*$/i, '').trim();

    // 페이지 수 추출 (snippet이나 author 부분에서 숫자+쪽/페이지/p 패턴 검색)
    let totalPage = 300; // 기본 단행본 권장 페이지 수
    const pageMatch = (contextSnippet + ' ' + author).match(/(\d{2,4})\s*(?:쪽|페이지|p|pages)\b/i);
    if (pageMatch) {
      const parsedPage = parseInt(pageMatch[1], 10);
      if (parsedPage >= 30 && parsedPage <= 2000) {
        totalPage = parsedPage;
      }
    }

    if (cleanTitle && cleanTitle.length >= 1 && cleanTitle.length <= 60 && !seenTitles.has(cleanTitle)) {
      const excludeWords = [
        '도서 추천', '추천 도서', '사서', '책', '소설', '에세이', '인문학', '자기계발',
        '답변', '제목', '저자', '추천 이유', '줄거리', '요약', '카테고리', '목록', '리스트'
      ];
      if (!excludeWords.includes(cleanTitle)) {
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

  // 1. 『도서명』 (저자 / 페이지) 또는 『도서명』 - 저자 패턴
  const bracketRegex = /『([^』]+)』(?:(?:\s*[-–—:]\s*|\s*[(（])([^)）\n]+)[)）]|\s*(?:저자|지은이)?\s*[:\s]*([^\n,.]+))?/g;
  let match;
  while ((match = bracketRegex.exec(text)) !== null) {
    addBook(match[1], match[2] || match[3] || '', match[0]);
  }

  // 2. 《도서명》 (저자) 패턴
  const doubleAngleRegex = /《([^》]+)》(?:(?:\s*[-–—:]\s*|\s*[(（])([^)）\n]+)[)）]|\s*(?:저자|지은이)?\s*[:\s]*([^\n,.]+))?/g;
  while ((match = doubleAngleRegex.exec(text)) !== null) {
    addBook(match[1], match[2] || match[3] || '', match[0]);
  }

  // 3. **도서명** - 저자 패턴
  const boldRegex = /\*\*([^*]+)\*\*(?:(?:\s*[-–—:]\s*|\s*[(（])([^)）\n]+)[)）]|\s*(?:저자|지은이)?\s*[:\s]*([^\n,.]+))?/g;
  while ((match = boldRegex.exec(text)) !== null) {
    addBook(match[1], match[2] || match[3] || '', match[0]);
  }

  // 4. 번호 매김 리스트 패턴: "1. [제목] - [저자]"
  const numberedListRegex = /(?:^|\n)\s*(?:\d+[.)]|\*|-)\s+([^\n\-–—(]+?)\s*[-–—]\s*([^\n(]+?)(?:\s*[(（]([^)）\n]*)[)）])?(?=\n|$)/g;
  while ((match = numberedListRegex.exec(text)) !== null) {
    addBook(match[1], match[2] || '', match[0]);
  }

  return books;
}
