/**
 * 사서 캐릭터 및 장르/무드 레지스트리.
 * 백엔드(backend-librarian/app/librarian/librarians.py)와 동기화된 데이터입니다.
 *
 * 날씨/시간대/기분 정보는 두 사서 모두 활용 가능 (더 이상 stork만의 전유물이 아님).
 * cat: 반말·"~냥" 어미, 친근하고 사교적. 모든 장르 추천 가능하며 미스터리 장르에 특화(더 상세)
 * stork: 존댓말·공손체("~두둥"), 차분하고 정중함. 모든 장르 추천 가능하며 비즈니스 장르에 특화(더 상세)
 */

// 장르 목록 — 백엔드 fake_agent.py의 _GENRE_BOOKS 키와 동기화
export const GENRES = [
  '소설',
  '에세이',
  '시',
  '자기계발',
  '심리학',
  '인문학',
  '미스터리',
  '판타지',
  'SF',
  '여행',
  '과학',
  '역사',
  '힐링',
  '로맨스',
  '예술',
  '스릴러',
  '추리',
  '공포',
  '모험',
  '철학',
  '비즈니스',
];

// 무드 목록 — 백엔드 curation/mood.py의 무드 enum과 동기화
export const MOODS = ['cozy', 'adventurous', 'reflective', 'dreamy', 'thrilling', 'calm'];

// 사서 캐릭터 2종 (백엔드 LIBRARIAN_REGISTRY와 1:1 대응)
// typeCode:    DB librarian_type enum (RUSSIAN_BLUE | SHOEBILL)
// species:     사서 종(품종) 표시명
// defaultName: 가입 직후 기본 사서 이름 — 사서 프로필에서 사용자가 변경 가능
export const LIBRARIANS = [
  {
    id: 'cat',
    typeCode: 'RUSSIAN_BLUE',
    name: '고양이 사서',
    species: '러시안블루',
    defaultName: '블루',
    icon: '🐱',
    persona: '반말과 "~냥" 어미로 친근하게 이야기해요',
    // 모든 장르 추천 가능, 미스터리 장르는 더 자세하게 (특화)
    genres: ['소설', '에세이', '시', '자기계발', '심리학', '인문학', '미스터리'],
    specialty: '미스터리 장르 추천',
    image: '/cursors/cat_03.webp',
    imageHover: '/cursors/cat_04.webp',
  },
  {
    id: 'stork',
    typeCode: 'SHOEBILL',
    name: '황새 사서',
    species: '슈빌',
    defaultName: '슈빌',
    icon: '🪿',
    persona: '존댓말과 공손한 말투로 차분하게 안내해요',
    // 모든 장르 추천 가능, 비즈니스 장르는 더 자세하게 (특화)
    genres: ['판타지', 'SF', '여행', '과학', '역사', '비즈니스'],
    specialty: '비즈니스 장르 추천',
    image: null,
    imageHover: null,
  },
];

export const DEFAULT_LIBRARIAN_ID = 'cat';

export function getLibrarian(id) {
  return LIBRARIANS.find((l) => l.id === id) || LIBRARIANS[0];
}

/**
 * 사서의 특화 장르 표시 라벨 ("미스터리 장르 추천" → "미스터리").
 * @param {object} librarian
 * @returns {string}
 */
export function genreLabelForLibrarian(librarian) {
  return (librarian?.specialty || '').replace(/\s*장르 추천$/, '');
}

/**
 * 사서 이름(사용자 지정 이름 포함)이나 캐릭터 키워드로 사서를 찾습니다.
 * 채팅에서 "황새 사서", "슈빌" 등을 입력했을 때 전환 대상을 감지하는 데 사용합니다.
 *
 * @param {string} text - 사용자 입력
 * @param {Record<string,string>} [names] - { [id]: 사용자 지정 이름 }
 * @returns {object|null} 매칭된 사서 (없으면 null)
 */
export function findLibrarianByKeyword(text, names = {}) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return null;

  for (const lib of LIBRARIANS) {
    const keywords = [
      names[lib.id],
      lib.defaultName,
      lib.name,
      lib.species,
      lib.name.replace(/\s*사서$/, ''), // '고양이 사서' → '고양이'
    ]
      .filter(Boolean)
      .map((k) => k.toLowerCase());

    if (keywords.some((k) => t.includes(k))) return lib;
  }
  return null;
}

// 특정 장르를 담당하는 사서 찾기 (없으면 null)
export function librarianForGenre(genre) {
  return LIBRARIANS.find((l) => l.genres.includes(genre)) || null;
}

// 현재 사서가 아닌 다른 사서 반환 (switchTo용)
export function getOtherLibrarian(currentId) {
  return LIBRARIANS.find((l) => l.id !== currentId) || null;
}
