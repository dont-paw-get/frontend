/**
 * 사서 캐릭터 및 장르/무드 레지스트리.
 * 백엔드(backend-librarian/app/librarian/librarians.py)와 동기화된 데이터입니다.
 *
 * cat: 대화/독서이력 기반 추천 (주력), 간단한 무드 추천도 가능
 * stork: 날씨/시간대 기반 분위기 매칭 추천 (주력)
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
];

// 무드 목록 — 백엔드 curation/mood.py의 무드 enum과 동기화
export const MOODS = ['cozy', 'adventurous', 'reflective', 'dreamy', 'thrilling', 'calm'];

// 사서 캐릭터 2종 (백엔드 LIBRARIAN_REGISTRY와 1:1 대응)
export const LIBRARIANS = [
  {
    id: 'cat',
    name: '고양이 사서',
    icon: '🐱',
    genres: ['소설', '에세이', '시', '자기계발', '심리학', '인문학'],
    specialty: '대화/독서이력 기반 추천',
    image: '/cursors/cat_03.png',
    imageHover: '/cursors/cat_04.png',
  },
  {
    id: 'stork',
    name: '황새 사서',
    icon: '🪿',
    genres: ['미스터리', '판타지', 'SF', '여행', '과학', '역사'],
    specialty: '날씨/시간대 기반 분위기 매칭 추천',
    image: null,
    imageHover: null,
  },
];

export const DEFAULT_LIBRARIAN_ID = 'cat';

export function getLibrarian(id) {
  return LIBRARIANS.find((l) => l.id === id) || LIBRARIANS[0];
}

// 특정 장르를 담당하는 사서 찾기 (없으면 null)
export function librarianForGenre(genre) {
  return LIBRARIANS.find((l) => l.genres.includes(genre)) || null;
}

// 현재 사서가 아닌 다른 사서 반환 (switchTo용)
export function getOtherLibrarian(currentId) {
  return LIBRARIANS.find((l) => l.id !== currentId) || null;
}
