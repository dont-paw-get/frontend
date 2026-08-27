import { detectGenreCode, genreLabel } from '../../data/genres';
import { librarianForGenre } from '../../data/librarians';

function titleList(books, max = 4) {
  const titles = books.slice(0, max).map((b) => `『${b.title}』`);
  const more = books.length > max ? ` 외 ${books.length - max}권` : '';
  return titles.join(', ') + more;
}

/**
 * 도서 DB 기반으로 질문 해석 → 답변 생성.
 * 백엔드 연동 전까지 프론트 로컬 fallback으로 사용.
 *
 * 장르 감지는 genres.js(백엔드 genre_type enum 단일 소스)의 detectGenreCode를 사용.
 * book.genre는 한글 라벨로 저장되어 있어 라벨 기준으로 매칭한다.
 * @returns {{ text: string, switchTo?: object }}
 */
export function answerQuestion({ text, mode, books, librarian }) {
  const q = text.trim();
  if (!q) return { text: '무엇을 찾아드릴까요냥? 🐾' };

  // 인사
  if (q.includes('안녕') || /^(hi|hello)/i.test(q)) {
    return {
      text: `안녕하세요, 집사님! 🐾 저는 ${librarian.name}예요. ${librarian.specialty}을 잘한답니다. 저자·제목·장르로 찾아드리거나 책을 추천해드릴게요 📚`,
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
    };
  }
  const key = q.toLowerCase();
  const matches = books.filter(
    (b) => b.title.toLowerCase().includes(key) || (b.author || '').toLowerCase().includes(key)
  );
  if (matches.length) {
    return { text: `찾았어요! 📚 ${titleList(matches)}` };
  }
  return {
    text: `'${q}'에 딱 맞는 책을 서재에서 찾지 못했어요 🐾 저자·제목·장르로 다시 알려주시면 찾아볼게요 📚`,
  };
}
