/**
 * 도서 시각 정보(책등 색/표지 색/두께/높이 계수) 로컬 브릿지 (CLIAR-186).
 *
 * backend-book은 현재 색상/두께를 저장하지 않는다. 사용자가 등록 시 고른 색·두께와
 * 3D 렌더링용 높이 계수를 bookId별로 localStorage에 임시 보관한다.
 * (후속 티켓에서 backend-book에 해당 필드가 추가되면 서버 값으로 이관 예정)
 *
 * 값이 없는 도서(예: 다른 기기에서 등록)는 bookId 해시로 결정론적 기본값을 만들어
 * 어디서 보든 같은 색/두께/높이로 안정적으로 렌더링되게 한다.
 */

const STORAGE_KEY = 'myReadingRoom.bookVisuals';

// RegisterBook / ocrUtils와 동일한 색상 팔레트
const COLOR_PRESETS = [
  { spine: '#7d4b3a', cover: '#a86a4c' }, // 브라운
  { spine: '#2f4858', cover: '#3d6070' }, // 딥블루그레이
  { spine: '#6b6b47', cover: '#8a8a5c' }, // 올리브
  { spine: '#8c3b3b', cover: '#b25050' }, // 버건디
  { spine: '#3a5a40', cover: '#588157' }, // 포레스트그린
  { spine: '#4a4058', cover: '#6d5f80' }, // 플럼
  { spine: '#b08968', cover: '#ddb892' }, // 샌드
  { spine: '#31363f', cover: '#4b515c' }, // 차콜
  { spine: '#c96b32', cover: '#e8944a' }, // 앰버 (기존 유지)
  { spine: '#1e3d59', cover: '#2a5a87' }, // 네이비
  { spine: '#5d4e75', cover: '#8b7ca3' }, // 라벤더그레이
  { spine: '#2d5a27', cover: '#3e7a36' }, // 딥그린
];

const THICKNESS_OPTIONS = [0.16, 0.22, 0.3];

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // 저장 실패(용량 등)는 무시 — 다음 조회 시 결정론적 기본값으로 대체됨
  }
}

// 문자열(bookId) → 안정적인 양의 정수 해시
function hashString(str) {
  let hash = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function deterministicVisual(bookId) {
  const h = hashString(bookId);
  const preset = COLOR_PRESETS[h % COLOR_PRESETS.length];

  // 높낮이를 더 다양하게 적용 (기존 0-1000 범위를 0.8-1.3 배율로 확장)
  const heightSeed = (h * 7919) % 10000; // 다른 시드로 더 랜덤하게
  const heightFactor = 0.8 + (heightSeed / 10000) * 0.5; // 0.8 ~ 1.3 범위

  return {
    spineColor: preset.spine,
    coverColor: preset.cover,
    thickness: THICKNESS_OPTIONS[h % THICKNESS_OPTIONS.length],
    heightFactor,
  };
}

/**
 * bookId의 시각 정보를 반환. 저장된 값이 없으면 결정론적 기본값을 만들어 저장 후 반환.
 * @param {string|number} bookId
 * @returns {{spineColor: string, coverColor: string, thickness: number, heightFactor: number}}
 */
export function getVisual(bookId) {
  const key = String(bookId);
  const map = loadAll();
  if (map[key]) return map[key];
  const visual = deterministicVisual(key);
  map[key] = visual;
  saveAll(map);
  return visual;
}

/**
 * 사용자가 고른 색/두께를 저장(등록 시 사용). heightFactor는 유지하거나 결정론적으로 생성.
 * @param {string|number} bookId
 * @param {{spineColor?: string, coverColor?: string, thickness?: number}} patch
 */
export function setVisual(bookId, { spineColor, coverColor, thickness } = {}) {
  const key = String(bookId);
  const map = loadAll();
  const base = map[key] || deterministicVisual(key);
  map[key] = {
    spineColor: spineColor ?? base.spineColor,
    coverColor: coverColor ?? base.coverColor,
    thickness: thickness ?? base.thickness,
    heightFactor: base.heightFactor,
  };
  saveAll(map);
  return map[key];
}
