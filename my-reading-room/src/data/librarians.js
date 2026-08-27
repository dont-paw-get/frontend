/**
 * 사서 캐릭터 및 무드 레지스트리.
 * 백엔드(backend-librarian/app/librarian/librarians.py)와 동기화된 데이터입니다.
 *
 * 날씨/시간대/기분 정보는 두 사서 모두 활용 가능 (더 이상 stork만의 전유물이 아님).
 * cat: 반말·"~냥" 어미, 친근하고 사교적. 모든 장르 추천 가능하며 미스터리·스릴러 장르에 특화(더 상세)
 * stork: 존댓말·공손체("~두둥"), 차분하고 정중함. 모든 장르 추천 가능하며 비즈니스·경제 장르에 특화(더 상세)
 *
 * 장르 정의는 genres.js(백엔드 genre_type enum 단일 소스)를 참조합니다.
 */

import { GENRE_LABELS, genreLabel } from './genres';

// 장르 한글 라벨 목록 (genres.js에서 파생 — 백엔드 genre_type enum과 정합)
export const GENRES = GENRE_LABELS;

// 무드 목록 — 백엔드 curation/mood.py의 무드 enum과 동기화
export const MOODS = ['cozy', 'adventurous', 'reflective', 'dreamy', 'thrilling', 'calm'];

// 사서 캐릭터 2종 (백엔드 LIBRARIAN_REGISTRY와 1:1 대응)
// specialtyCode: 해당 사서가 특히 자세히 다루는 genre_type enum code
export const LIBRARIANS = [
  {
    id: 'cat',
    name: '고양이 사서',
    icon: '🐱',
    specialtyCode: 'MYSTERY_THRILLER',
    image: '/cursors/cat_03.webp',
    imageHover: '/cursors/cat_04.webp',
  },
  {
    id: 'stork',
    name: '황새 사서',
    icon: '🪿',
    specialtyCode: 'BUSINESS_ECONOMICS',
    image: null,
    imageHover: null,
  },
].map((l) => ({
  ...l,
  // 특화 장르 한글 라벨 (파생)
  specialtyGenre: genreLabel(l.specialtyCode),
  // "○○ 장르 추천" 형태의 표시 문구 (파생)
  specialty: `${genreLabel(l.specialtyCode)} 장르 추천`,
}));

export const DEFAULT_LIBRARIAN_ID = 'cat';

export function getLibrarian(id) {
  return LIBRARIANS.find((l) => l.id === id) || LIBRARIANS[0];
}

/**
 * 특정 장르(code 또는 label)를 특화로 담당하는 사서 찾기 (없으면 null).
 * @param {string} genre - genre code 또는 한글 label
 */
export function librarianForGenre(genre) {
  return (
    LIBRARIANS.find((l) => l.specialtyCode === genre || l.specialtyGenre === genre) || null
  );
}

// 현재 사서가 아닌 다른 사서 반환 (switchTo용)
export function getOtherLibrarian(currentId) {
  return LIBRARIANS.find((l) => l.id !== currentId) || null;
}
