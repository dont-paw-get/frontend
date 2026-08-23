/**
 * AI 추천 에이전트 답변 텍스트에서 추천 도서 정보(제목, 저자 등)를 추출하는 유틸리티
 */

/**
 * 텍스트에서 추천된 도서 목록을 추출합니다.
 * @param {string} text - AI 사서의 답변 텍스트
 * @returns {Array<{title: string, author: string}>} 추출된 도서 목록
 */
export function extractBooksFromAnswer(text) {
  if (!text || typeof text !== 'string') return [];

  const books = [];
  const seenTitles = new Set();

  function addBook(title, author = '') {
    const cleanTitle = (title || '').trim().replace(/^['"『"“`]|['"』"”`]$/g, '').trim();
    let cleanAuthor = (author || '').trim().replace(/^[(\[\s]*|[)\]\s]*$/g, '').trim();
    
    // '저', '지음', '글', '작가' 등의 접미사/접두사 정리
    cleanAuthor = cleanAuthor.replace(/(?:\s*저자?|\s*지음|\s*글|\s*작가|\s*옮김)$/g, '').trim();
    cleanAuthor = cleanAuthor.replace(/^(?:저자?|지은이|글|작가)[:\s]*/g, '').trim();

    if (cleanTitle && cleanTitle.length >= 1 && cleanTitle.length <= 60 && !seenTitles.has(cleanTitle)) {
      // 일반적인 안내 문구나 단어 제외
      const excludeWords = ['도서 추천', '추천 도서', '사서', '책', '소설', '에세이', '인문학', '자기계발', '답변', '제목'];
      if (!excludeWords.includes(cleanTitle)) {
        seenTitles.add(cleanTitle);
        books.push({
          title: cleanTitle,
          author: cleanAuthor,
        });
      }
    }
  }

  // 1. 『도서명』 (저자) 또는 『도서명』 - 저자 패턴
  const bracketRegex = /『([^』]+)』(?:(?:\s*[-–—:]\s*|\s*[(（])([^)）\n]+)[)）]|\s*(?:저자|지은이)?\s*[:\s]*([^\n,.]+))?/g;
  let match;
  while ((match = bracketRegex.exec(text)) !== null) {
    const title = match[1];
    const author = match[2] || match[3] || '';
    addBook(title, author);
  }

  // 2. 《도서명》 (저자) 패턴
  const doubleAngleRegex = /《([^》]+)》(?:(?:\s*[-–—:]\s*|\s*[(（])([^)）\n]+)[)）]|\s*(?:저자|지은이)?\s*[:\s]*([^\n,.]+))?/g;
  while ((match = doubleAngleRegex.exec(text)) !== null) {
    const title = match[1];
    const author = match[2] || match[3] || '';
    addBook(title, author);
  }

  // 3. **도서명** - 저자 또는 1. **도서명** 패턴
  const boldRegex = /\*\*([^*]+)\*\*(?:(?:\s*[-–—:]\s*|\s*[(（])([^)）\n]+)[)）]|\s*(?:저자|지은이)?\s*[:\s]*([^\n,.]+))?/g;
  while ((match = boldRegex.exec(text)) !== null) {
    const title = match[1];
    const author = match[2] || match[3] || '';
    addBook(title, author);
  }

  // 4. 번호 매김 리스트 패턴: "1. [제목] - [저자]" 또는 "1. 『제목』"
  const numberedListRegex = /(?:^|\n)\s*(?:\d+[.)]|\*|-)\s+([^\n\-–—(]+?)\s*[-–—]\s*([^\n(]+?)(?:\s*[(（][^)）\n]*[)）])?(?=\n|$)/g;
  while ((match = numberedListRegex.exec(text)) !== null) {
    const title = match[1];
    const author = match[2] || '';
    addBook(title, author);
  }

  return books;
}
