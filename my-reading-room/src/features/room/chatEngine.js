import { GENRES, librarianForGenre } from '../../data/librarians';

// 장르 키워드 별칭 — 백엔드 장르 체계와 동기화
const GENRE_ALIASES = {
  '소설': ['소설', '문학', 'novel', 'fiction'],
  '에세이': ['에세이', 'essay', '산문'],
  '시': ['시', '시집', 'poetry', 'poem'],
  '자기계발': ['자기계발', '자기 계발', '자기개발', 'self-help'],
  '심리학': ['심리학', '심리', 'psychology'],
  '인문학': ['인문학', '인문', 'humanities'],
  '미스터리': ['미스터리', 'mystery'],
  '판타지': ['판타지', 'fantasy'],
  'SF': ['sf', '에스에프', '공상과학', 'sci-fi'],
  '여행': ['여행', 'travel'],
  '과학': ['과학', 'science'],
  '역사': ['역사', 'history'],
  '힐링': ['힐링', 'healing', '치유'],
  '로맨스': ['로맨스', '로맨', 'romance', '연애'],
  '예술': ['예술', 'art', '미술'],
  '스릴러': ['스릴러', 'thriller'],
  '추리': ['추리', '탐정', 'detective'],
  '공포': ['공포', '호러', 'horror'],
  '모험': ['모험', 'adventure'],
  '철학': ['철학', 'philosophy'],
  '비즈니스': ['비즈니스', 'business', '경영', '경제'],
};

function detectGenre(text) {
  const t = text.toLowerCase();
  for (const g of GENRES) {
    if ((GENRE_ALIASES[g] || []).some((a) => t.includes(a.toLowerCase()))) return g;
  }
  return null;
}

function titleList(books, max = 4) {
  const titles = books.slice(0, max).map((b) => `『${b.title}』`);
  const more = books.length > max ? ` 외 ${books.length - max}권` : '';
  return titles.join(', ') + more;
}

/**
 * 도서 DB 기반으로 질문 해석 → 답변 생성.
 * 백엔드 연동 전까지 프론트 로컬 fallback으로 사용.
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
    const targetGenre = detectGenre(q) || librarian.genres[0];
    const matches = books.filter((b) => b.genre === targetGenre);

    if (matches.length === 0) {
      return {
        text: `아직 서재에 ${targetGenre} 책이 없네요 🐾 먼저 등록해 주시면 정성껏 찾아드릴게요 📚`,
      };
    }

    const suffix = librarian.id === 'cat' ? '냥' : '';
    const base = `지금 서재에서 ${targetGenre} 책으로는 ${titleList(matches)} 이 있어요${suffix} 📚 마음에 드는 책 한 권 골라보시겠어요? 🐾`;

    if (!librarian.genres.includes(targetGenre)) {
      const other = librarianForGenre(targetGenre);
      if (other && other.id !== librarian.id) {
        return {
          text: `${base}\n\n${targetGenre}는 ${other.icon} ${other.name}가 더 잘 알아요. 바꿔서 물어보시겠어요?`,
          switchTo: other,
        };
      }
    }
    return { text: base };
  }

  // ── 일반 검색 ──
  const g = detectGenre(q);
  if (g) {
    const matches = books.filter((b) => b.genre === g);
    return {
      text: matches.length
        ? `${g} 책은 ${titleList(matches)} 이 있어요 📚`
        : `서재에 ${g} 책이 아직 없네요 🐾`,
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
