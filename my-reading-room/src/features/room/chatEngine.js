import { GENRES, librarianForGenre } from '../../data/librarians';

// 장르 키워드 별칭
const GENRE_ALIASES = {
  '추리·미스터리': ['추리', '미스터리', 'mystery'],
  '로맨스': ['로맨스', '로맨', 'romance', '연애'],
  '공포·스릴러': ['공포', '스릴러', 'horror', 'thriller', '호러'],
  '무협': ['무협', '무협지'],
  'SF': ['sf', '에스에프', '공상과학'],
  '판타지': ['판타지', 'fantasy'],
  '자기계발': ['자기계발', '자기 계발', '자기개발'],
  '경제·경영': ['경제', '경영', 'business'],
  '에세이': ['에세이', 'essay', '산문'],
  '역사·문화': ['역사', '문화', 'history'],
  '인문·철학': ['인문', '철학', 'philosophy'],
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
 * @returns {{ text: string, switchTo?: object }}
 */
export function answerQuestion({ text, mode, books, librarian }) {
  const q = text.trim();
  if (!q) return { text: '무엇을 찾아드릴까요냥? 🐾' };

  // 인사
  if (q.includes('안녕') || /^(hi|hello)/i.test(q)) {
    return {
      text: `안녕하세요, 집사님! 🐾 저는 ${librarian.name} 냥사서예요냥. 저자·제목·장르로 찾아드리거나 책을 추천해드릴게요냥 📚`,
    };
  }

  const isRecommend = mode === 'recommend' || q.includes('추천');

  // ── 도서 추천 ──
  if (isRecommend) {
    const targetGenre = detectGenre(q) || librarian.genres[0];
    const matches = books.filter((b) => b.genre === targetGenre);

    if (matches.length === 0) {
      return {
        text: `아직 서재에 ${targetGenre} 책이 없네요냥 🐾 먼저 등록해 주시면 정성껏 찾아드릴게요냥 📚`,
      };
    }

    const base = `지금 서재에서 ${targetGenre} 책으로는 ${titleList(matches)} 이 있어요냥 📚 마음이 편안해지는 책 한 권 골라보시겠어요냥? 🐾`;
    if (!librarian.genres.includes(targetGenre)) {
      const other = librarianForGenre(targetGenre);
      if (other && other.id !== librarian.id) {
        return {
          text: `${base}\n\n${targetGenre}는 ${other.icon} ${other.name}가 더 잘 알아요냥. 바꿔서 물어보시겠어요냥?`,
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
        ? `${g} 책은 ${titleList(matches)} 이 있어요냥 📚`
        : `서재에 ${g} 책이 아직 없네요냥 🐾`,
    };
  }
  const key = q.toLowerCase();
  const matches = books.filter(
    (b) => b.title.toLowerCase().includes(key) || (b.author || '').toLowerCase().includes(key)
  );
  if (matches.length) {
    return { text: `찾았어요냥! 📚 ${titleList(matches)}` };
  }
  return {
    text: `'${q}'에 딱 맞는 책을 서재에서 찾지 못했어요냥 🐾 저자·제목·장르로 다시 알려주시면 찾아볼게요냥 📚`,
  };
}
