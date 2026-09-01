import { detectGenreCode, genreLabel } from '../../data/genres';
import { librarianForGenre, findLibrarianByKeyword } from '../../data/librarians';

function titleList(books, max = 4) {
  const titles = books.slice(0, max).map((b) => `『${b.title}』`);
  const more = books.length > max ? ` 외 ${books.length - max}권` : '';
  return titles.join(', ') + more;
}

/**
 * 도서 DB 기반으로 질문 해석 → 답변 생성.
 * 백엔드 연결 실패 시 로컬 fallback으로만 사용된다.
 * (평상시 라우팅은 백엔드 오케스트레이터가 담당하며, mode 인자 없이 호출된다.)
 * @param {object} p
 * @param {string} p.text
 * @param {'recommend'|'search'} [p.mode] - 선택. 미지정 시 '추천' 키워드 포함 여부로 추천/검색 판단
 * @returns {{ text: string, switchTo?: object }}
 */
export function answerQuestion({ text, mode, books, librarian, librarianNames = {} }) {
  const q = text.trim();
  if (!q) return { text: '무엇을 찾아드릴까요냥? 🐾' };

  // 인사
  if (q.includes('안녕') || /^(hi|hello)/i.test(q)) {
    const myName = librarianNames[librarian.id] || librarian.defaultName || librarian.name;
    return {
      text: `안녕하세요, 집사님! 🐾 저는 ${myName}예요. ${librarian.specialty}을 잘한답니다. 저자·제목·장르로 찾아드리거나 책을 추천해드릴게요 📚`,
    };
  }

  // 다른 사서의 이름/키워드를 입력하면 전환할지 물어봄
  // (예: 대표 사서가 블루일 때 "슈빌 사서", "슈빌", "황새" 등을 입력)
  const mentioned = findLibrarianByKeyword(q, librarianNames);
  if (mentioned && mentioned.id !== librarian.id) {
    const rawTargetName = librarianNames[mentioned.id] || mentioned.defaultName || mentioned.name;
    const targetName = rawTargetName.replace(/\s*사서$/, '');
    return {
      text: `${mentioned.icon} ${targetName} 사서를 찾으시나요? ${mentioned.specialty}에 특히 자세해요. 지금 바꿔드릴까요?`,
      switchTo: mentioned,
    };
  }

  // 날씨/시간대/기분 정보는 두 사서 모두 활용 가능 (더 이상 stork만의 전유물이 아님) → 강제 전환하지 않음

  const isRecommend = mode === 'recommend' || q.includes('추천');

  // ── 도서 추천 ──
  if (isRecommend) {
    // 감지된 장르(code) → 없으면 현재 사서의 특화 장르
    const targetCode = detectGenreCode(q) || librarian.specialtyCode;
    const targetGenre = genreLabel(targetCode);
    const matches = books.filter((b) => b.genre === targetGenre);

    if (matches.length === 0) {
      return {
        text: `아직 서재에 ${targetGenre} 책이 없네요 🐾 먼저 등록해 주시면 정성껏 찾아드릴게요 📚`,
      };
    }

    const suffix = librarian.id === 'cat' ? '냥' : '';
    const base = `지금 서재에서 ${targetGenre} 책으로는 ${titleList(matches)} 이 있어요${suffix} 📚 마음에 드는 책 한 권 골라보시겠어요? 🐾`;

    // 다른 사서의 특화 장르면, 그 사서가 더 자세하다고 안내 (강제 아님)
    if (targetCode !== librarian.specialtyCode) {
      const other = librarianForGenre(targetCode);
      if (other && other.id !== librarian.id) {
        return {
          text: `${base}\n\n${targetGenre}는 ${other.icon} ${other.name}가 더 자세히 알아요. 바꿔서 물어보시겠어요?`,
          switchTo: other,
        };
      }
    }
    return { text: base };
  }

  // ── 일반 검색 ──
  const gCode = detectGenreCode(q);
  if (gCode) {
    const label = genreLabel(gCode);
    const matches = books.filter((b) => b.genre === label);
    return {
      text: matches.length
        ? `${label} 책은 ${titleList(matches)} 이 있어요 📚`
        : `서재에 ${label} 책이 아직 없네요 🐾`,
      library_books: matches.map((b) => ({
        book_id: b.bookId || b.id,
        bookId: b.bookId || b.id,
        id: b.id,
        title: b.title,
        author: b.author,
        reading_status: b.status,
        readingStatus: b.status,
        progress: b.progress,
      })),
    };
  }
  const key = q.toLowerCase();
  const matches = books.filter(
    (b) => b.title.toLowerCase().includes(key) || (b.author || '').toLowerCase().includes(key)
  );
  if (matches.length) {
    return {
      text: `찾았어요! 📚 ${titleList(matches)}`,
      library_books: matches.map((b) => ({
        book_id: b.bookId || b.id,
        bookId: b.bookId || b.id,
        id: b.id,
        title: b.title,
        author: b.author,
        reading_status: b.status,
        readingStatus: b.status,
        progress: b.progress,
      })),
    };
  }
  return {
    text: `'${q}'에 딱 맞는 책을 서재에서 찾지 못했어요 🐾 저자·제목·장르로 다시 알려주시면 찾아볼게요 📚`,
    library_books: [],
  };
}
