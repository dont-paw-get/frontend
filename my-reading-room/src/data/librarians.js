/**
 * 사서 캐릭터 및 무드 레지스트리.
 * 백엔드(backend-librarian/app/librarian/librarians.py)와 동기화된 데이터입니다.
 *
 * 날씨/시간대/기분 정보는 두 사서 모두 활용 가능 (더 이상 stork만의 전유물이 아님).
 * cat: 반말·"~냥" 어미, 친근하고 사교적. 모든 장르 추천 가능하며 미스터리·스릴러 장르에 특화(더 상세)
 * stork: 존댓말·공손체("~두둥"), 차분하고 정중함. 모든 장르 추천 가능하며 비즈니스·경제 장르에 특화(더 상세)
 *
 * 장르 정의는 genres.js(백엔드 genre_type enum 단일 소스, 한글 라벨은 프론트가 정의)를 참조합니다.
 */

import { GENRE_LABELS, genreLabel } from './genres';

// 장르 한글 라벨 목록 (genres.js에서 파생 — 백엔드 genre_type enum과 정합)
export const GENRES = GENRE_LABELS;

// 무드 목록 — 백엔드 curation/mood.py의 무드 enum과 동기화
export const MOODS = ['cozy', 'adventurous', 'reflective', 'dreamy', 'thrilling', 'calm'];

// 사서 캐릭터 2종 (백엔드 LIBRARIAN_REGISTRY와 1:1 대응)
// typeCode:      DB librarian_type enum (RUSSIAN_BLUE | SHOEBILL)
// species:       사서 종(품종) 표시명
// defaultName:    가입 직후 기본 사서 이름 — 사서 프로필에서 사용자가 변경 가능
// specialtyCode: 해당 사서가 특히 자세히 다루는 genre_type enum code
export const LIBRARIANS = [
  {
    id: 'cat',
    typeCode: 'RUSSIAN_BLUE',
    name: '고양이 사서',
    species: '러시안블루',
    defaultName: '블루',
    icon: '🐱',
    persona: '반말과 "~냥" 어미로 친근하게 이야기해요',
    specialtyCode: 'MYSTERY_THRILLER',
    image: '/cursors/cat/cat_03.webp',
    imageHover: '/cursors/cat/cat_04.webp',
    // GNB·마이페이지 등에서 쓰는 프로필 사진 (사서 캐릭터와 별개 에셋)
    profileImage: '/profile.webp',
    // 커서 이미지에서 실제 포인터가 될 지점(뻗은 앞발 끝) — 이미지 알파 채널 실측 비율
    tip: { x: 0.26, y: 0.287 },
    tipHover: { x: 0.143, y: 0.357 },
  },
  {
    id: 'stork',
    typeCode: 'SHOEBILL',
    name: '황새 사서',
    species: '슈빌',
    defaultName: '슈빌',
    icon: '🪿',
    persona: '존댓말과 공손한 말투로 차분하게 안내해요',
    specialtyCode: 'BUSINESS_ECONOMICS',
    // 황새 서재로 전환했을 때 기본으로 유지되는 커서 이미지 (CLIAR-198)
    image: '/cursors/stork/stork_1.webp',
    // 책 위에 올렸을 때: 날개를 펄럭이는 2프레임 애니메이션 WebP 1장
    // (원본 stork_2·stork_3을 합쳐 에셋 장수는 고양이와 동일하게 2장 유지)
    imageHover: '/cursors/stork/stork_hover.webp',
    // 포인터 지점은 부리 끝 — 알파 채널 실측값 (168,84)/300, hover는 (178,65)/300
    tip: { x: 0.56, y: 0.28 },
    tipHover: { x: 0.593, y: 0.217 },
    /*
     * 커서 표시 배율 (CLIAR-198). 황새는 몸이 가늘고 길어 고양이와 같은 크기로
     * 그리면 작게 보여 확대한다 (1.3 → 1.56, 기존 대비 20% 추가 확대).
     * 이미지 안에서 키우지 않고 표시 배율로 처리해
     * (stork_3은 이미 캔버스 높이를 꽉 채워 확대 시 날개가 잘림) 세 이미지가
     * 동일 비율로 커지고 프레임 정렬도 그대로 유지된다.
     */
    imgScale: 1.56,
    // GNB·마이페이지 등에서 쓰는 프로필 사진 (사서 캐릭터와 별개 에셋)
    profileImage: '/profile_stork.webp',
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
 * 사서의 특화 장르 표시 라벨 ("미스터리·스릴러 장르 추천" → "미스터리·스릴러").
 * @param {object} librarian
 * @returns {string}
 */
export function genreLabelForLibrarian(librarian) {
  return librarian?.specialtyGenre ?? '';
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
