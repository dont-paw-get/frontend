/**
 * 장르 정의 단일 소스 (Single Source of Truth).
 *
 * 백엔드 genre_type enum(DB 스키마)과 1:1 대응합니다.
 * 백엔드는 영문 enum만 관리하며, 한글 라벨/검색 별칭은 프론트에서 자유롭게 정의합니다(CLIAR-139).
 *
 *   code:    백엔드 enum 값 (저장/전송 시 사용)
 *   label:   UI 한글 표기 (표시 시 사용)
 *   aliases: 검색·추천 키워드 매칭용 (로컬 fallback detectGenre 등)
 *
 * 병합/신규 라벨 결정 (프론트 정의, 확정본):
 *   - POETRY_DRAMA: 기존 '시' 흡수 → '시·희곡'
 *   - HUMANITIES: 기존 '심리학'·'철학' 흡수 → '인문학'
 *   - MYSTERY_THRILLER: 기존 '추리'·'스릴러'·'공포' 흡수 → '미스터리·스릴러' (cat 특화)
 *   - BUSINESS_ECONOMICS: '비즈니스·경제' (stork 특화)
 *   - 기존 프론트 전용 장르('여행'·'힐링'·'모험')는 enum 대응이 없어 제거
 *   - RELIGION('종교')·COMPUTER_IT('IT·컴퓨터')는 신규 추가
 */

// 'NONE'은 미지정 값이라 선택 목록에서 제외
export const GENRE_DEFS = [
  { code: 'LITERARY_FICTION', label: '소설', aliases: ['소설', '문학', 'novel', 'fiction'] },
  { code: 'ESSAY', label: '에세이', aliases: ['에세이', '산문', 'essay'] },
  { code: 'POETRY_DRAMA', label: '시·희곡', aliases: ['시', '시집', '희곡', 'poetry', 'poem', 'drama'] },
  { code: 'SELF_HELP', label: '자기계발', aliases: ['자기계발', '자기 계발', '자기개발', 'self-help'] },
  { code: 'HUMANITIES', label: '인문학', aliases: ['인문학', '인문', '심리', '심리학', '철학', 'humanities', 'psychology', 'philosophy'] },
  { code: 'MYSTERY_THRILLER', label: '미스터리·스릴러', aliases: ['미스터리', '스릴러', '추리', '탐정', '공포', '호러', 'mystery', 'thriller', 'detective', 'horror'] },
  { code: 'FANTASY', label: '판타지', aliases: ['판타지', 'fantasy'] },
  { code: 'SCIENCE_FICTION', label: 'SF', aliases: ['sf', '에스에프', '공상과학', 'sci-fi', 'science fiction'] },
  { code: 'ROMANCE', label: '로맨스', aliases: ['로맨스', '로맨', '연애', 'romance'] },
  { code: 'HISTORY', label: '역사', aliases: ['역사', 'history'] },
  { code: 'SCIENCE', label: '과학', aliases: ['과학', 'science'] },
  { code: 'ARTS', label: '예술', aliases: ['예술', '미술', 'art', 'arts'] },
  { code: 'BUSINESS_ECONOMICS', label: '비즈니스·경제', aliases: ['비즈니스', '경영', '경제', 'business', 'economics'] },
  { code: 'RELIGION', label: '종교', aliases: ['종교', 'religion'] },
  { code: 'COMPUTER_IT', label: 'IT·컴퓨터', aliases: ['it', '컴퓨터', '프로그래밍', '개발', 'computer', 'programming'] },
];

// 미지정 값 (백엔드 default)
export const GENRE_NONE = 'NONE';

export const GENRE_CODES = GENRE_DEFS.map((g) => g.code);
export const GENRE_LABELS = GENRE_DEFS.map((g) => g.label);

const BY_CODE = new Map(GENRE_DEFS.map((g) => [g.code, g]));
const BY_LABEL = new Map(GENRE_DEFS.map((g) => [g.label, g]));

/**
 * enum code → 한글 label. 없으면 빈 문자열.
 * @param {string} code
 * @returns {string}
 */
export function genreLabel(code) {
  return BY_CODE.get(code)?.label ?? '';
}

/**
 * 한글 label → enum code. 없으면 null.
 * @param {string} label
 * @returns {string|null}
 */
export function genreCode(label) {
  return BY_LABEL.get(label)?.code ?? null;
}

/**
 * 자유 텍스트에서 장르를 감지해 code를 반환 (별칭 기반). 없으면 null.
 * @param {string} text
 * @returns {string|null} genre code
 */
export function detectGenreCode(text) {
  const t = (text || '').toLowerCase();
  for (const g of GENRE_DEFS) {
    if (g.aliases.some((a) => t.includes(a.toLowerCase()))) return g.code;
  }
  return null;
}
