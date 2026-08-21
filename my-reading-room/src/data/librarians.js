// 장르 목록 (책 등록 + 검색/추천 공용)
export const GENRES = [
  // 소설(픽션)
  '추리·미스터리',
  '로맨스',
  '공포·스릴러',
  '무협',
  'SF',
  '판타지',
  // 일반(논픽션)
  '자기계발',
  '경제·경영',
  '에세이',
  '역사·문화',
  '인문·철학',
];

// 무드 목록 (등록용, 검색 안내에는 노출하지 않음)
export const MOODS = ['설렘', '위로', '긴장', '몰입', '잔잔', '먹먹'];

// 사서 캐릭터. 각 사서는 특화 장르(복수)를 담당.
export const LIBRARIANS = [
  {
    id: 'cat',
    name: '러시안 블루 사서',
    icon: '🐱',
    genres: ['추리·미스터리', '로맨스'],
    image: '/cursors/cat_03_lib.png', // 기본
    imageHover: '/cursors/cat_04_lib.png', // 책에 커서 올렸을 때
  },
  { id: 'stork', name: '넓적부리황새 사서', icon: '🐦', genres: ['공포·스릴러', '무협'] },
  { id: 'alien', name: '에일리언 사서', icon: '👽', genres: ['SF', '판타지'] },
  { id: 'redpanda', name: '레서판다 사서', icon: '🦝', genres: ['자기계발', '경제·경영'] },
  { id: 'snail', name: '바다달팽이 사서', icon: '🐌', genres: ['에세이', '역사·문화'] },
  { id: 'gecko', name: '게코 사서', icon: '🦎', genres: ['인문·철학'] },
];

export const DEFAULT_LIBRARIAN_ID = 'cat';

export function getLibrarian(id) {
  return LIBRARIANS.find((l) => l.id === id) || LIBRARIANS[0];
}

// 특정 장르를 담당하는 사서 찾기 (없으면 null)
export function librarianForGenre(genre) {
  return LIBRARIANS.find((l) => l.genres.includes(genre)) || null;
}
