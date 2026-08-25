import * as THREE from 'three';

// 배경 라인드로잉 (public/room/)
export const BG_SRC_CAT = '/room/room_lineart.png';
export const BG_SRC_STORK = '/room/room_lineart_stork.png';
export const BG_SRC = BG_SRC_CAT; // 기본값 (하위 호환)
// 배경 원본 비율 (원본 픽셀에 맞게 조정)
export const BG_ASPECT = 768 / 432;

// ─────────────────────────────────────────────────────────────
// 배포되는 "저장된 배치 설정" (source of truth).
// 개발 모드의 캘리브레이션 도구에서 값을 맞춘 뒤,
// "설정 JSON 복사" 버튼으로 복사한 내용을 아래에 그대로 붙여넣으면
// 모든 사용자에게 그 배치가 적용된다.
// 사서(cat/stork)별로 배경 그림이 다르므로 카메라/선반 배치도 독립적으로 관리한다.
// ─────────────────────────────────────────────────────────────

// 그림 투시에 맞춘 카메라 (고양이 서재)
const CAT_CAMERA = {
  fov: 28,
  position: [-9.38, -0.89, 24],
  target: [7.52, -0.13, 0.67],
};

/**
 * 고양이 서재 선반 배치.
 *  - id:      식별용 이름
 *  - pos:     선반 바닥면 중심 [x, y, z]
 *  - rotYdeg: 선반의 좌우 기울기(도)
 *  - width:   선반 폭(이 폭을 넘으면 다음 선반으로)
 *  - depth:   책 앞뒤 깊이
 *  - capacity: 이 선반의 최대 권수 (0=무제한, 초과 시 다음 선반으로)
 */
const CAT_SHELVES = [
  {
    id: 'top',
    pos: [-1.09, 0.96, -0.4],
    rotXdeg: -7,
    rotYdeg: -3.5,
    rotZdeg: -2.5,
    width: 2.13,
    depth: 0.2,
    bookHeight: 0.8,
    heightVar: 0.27,
    capacity: 10, // 이 권수를 넘으면 다음 선반으로
  },
  {
    id: 'shelf2',
    pos: [-2.8, -0.11, 4.61],
    rotXdeg: -8.5,
    rotYdeg: -2,
    rotZdeg: -4,
    width: 1.65,
    depth: 0.2,
    bookHeight: 0.54,
    heightVar: 0.27,
  },
];

// 그림 투시에 맞춘 카메라 (황새 서재)
const STORK_CAMERA = {
  fov: 24,
  position: [-8.98, 1.76, 24],
  target: [7.52, -0.15, 0.67],
};

// 황새 서재 선반 배치
const STORK_SHELVES = [
  {
    id: 'shelf1',
    pos: [-2.76, 1, 4.07],
    rotXdeg: -6,
    rotYdeg: -0.5,
    rotZdeg: -2.5,
    width: 1.2,
    depth: 0.2,
    bookHeight: 0.8,
    heightVar: 0.27,
    capacity: 8, // 최대 8권, 9번째부터 다음 선반으로
  },
  {
    id: 'shelf2',
    pos: [-2.57, 0, 3.35],
    rotXdeg: -6,
    rotYdeg: -0.5,
    rotZdeg: -2.5,
    width: 1.2,
    depth: 0.35,
    bookHeight: 0.68,
    heightVar: 0.27,
    capacity: 0, // 무제한 (마지막 선반)
  },
];

// 사서 id별 기본 카메라/선반 배치
export const CAMERA_BY_LIBRARIAN = {
  cat: CAT_CAMERA,
  stork: STORK_CAMERA,
};

export const SHELVES_BY_LIBRARIAN = {
  cat: CAT_SHELVES,
  stork: STORK_SHELVES,
};

// 하위 호환용 기본값 (고양이 기준)
export const DEFAULT_CAMERA = CAT_CAMERA;
export const DEFAULT_SHELVES = CAT_SHELVES;

/** 사서 id에 맞는 기본 카메라 설정을 반환 (없으면 고양이 기준) */
export function getDefaultCamera(librarianId) {
  return CAMERA_BY_LIBRARIAN[librarianId] || CAT_CAMERA;
}

/** 사서 id에 맞는 기본 선반 배치를 반환 (없으면 고양이 기준) */
export function getDefaultShelves(librarianId) {
  return SHELVES_BY_LIBRARIAN[librarianId] || CAT_SHELVES;
}

// 선반에 bookHeight가 없을 때 기본 책 높이
const FALLBACK_BOOK_HEIGHT = 1.1;
const MIN_BOOK_HEIGHT = 0.3;

// 문자열 id → 0~1 사이 고정값 (heightFactor 없는 기존 책 대비용)
function hash01(str = '') {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const GAP = 0.02; // 책 사이 간격

const MIN_SQUEEZE = 0.02; // 압축 하한(너무 얇아지지 않게)

/**
 * 등록된 책 목록을 선반들에 배치.
 *  - 책은 선반 순서대로(위 선반부터) 채워짐. 선반의 capacity(권수)로 다음 선반 넘김(0/미설정=무제한).
 *  - 한 선반 안에서 width는 "squeeze 폭": 자연 두께 합이 width를 넘으면 그만큼 압축, 남으면 원래 두께 유지.
 *  - 책 행은 선반 중앙 정렬.
 * @param {Array} books - { id, title, thickness, heightFactor, spineColor, coverColor }
 * @param {Array} shelves - 선반 설정 배열
 * @returns {Array} placements - { ...book, position, size, rotation }
 */
export function placeBooks(books, shelves = DEFAULT_SHELVES) {
  const placements = [];
  if (!shelves.length) return placements;

  // 1) 책을 선반별로 분배 (capacity 기준, 없으면 마지막 선반이 나머지 전부)
  let ptr = 0;
  const groups = shelves.map((shelf, i) => {
    const isLast = i === shelves.length - 1;
    const cap = shelf.capacity && shelf.capacity > 0 ? shelf.capacity : Infinity;
    const take = isLast ? books.length - ptr : Math.min(cap, books.length - ptr);
    const slice = books.slice(ptr, ptr + Math.max(0, take));
    ptr += slice.length;
    return slice;
  });

  // 2) 각 선반 안에서 squeeze 배치
  shelves.forEach((shelf, i) => {
    const shelfBooks = groups[i];
    if (!shelfBooks.length) return;

    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(shelf.rotXdeg ?? 0),
      THREE.MathUtils.degToRad(shelf.rotYdeg ?? 0),
      THREE.MathUtils.degToRad(shelf.rotZdeg ?? 0),
      'XYZ'
    );
    const dirX = new THREE.Vector3(1, 0, 0).applyEuler(euler);
    const up = new THREE.Vector3(0, 1, 0).applyEuler(euler);

    const n = shelfBooks.length;
    const gaps = GAP * (n - 1);
    const sumT = shelfBooks.reduce((a, b) => a + b.thickness, 0);
    // 폭 초과 시에만 압축(squeeze). 여유 있으면 원래 두께 유지.
    let scale = 1;
    if (sumT + gaps > shelf.width) {
      scale = Math.max(MIN_SQUEEZE, (shelf.width - gaps) / sumT);
    }
    let cursor = -shelf.width / 2; // 왼쪽 끝부터 오른쪽으로 채움
    for (const book of shelfBooks) {
      const t = book.thickness * scale;
      const centerOffset = cursor + t / 2;
      cursor += t + GAP;

      const base = shelf.bookHeight ?? book.height ?? FALLBACK_BOOK_HEIGHT;
      const factor = typeof book.heightFactor === 'number' ? book.heightFactor : hash01(book.id);
      const height = Math.max(MIN_BOOK_HEIGHT, base - factor * (shelf.heightVar ?? 0));

      placements.push({
        ...book,
        rotation: [euler.x, euler.y, euler.z],
        size: [t, height, shelf.depth],
        position: [
          shelf.pos[0] + dirX.x * centerOffset + up.x * (height / 2),
          shelf.pos[1] + dirX.y * centerOffset + up.y * (height / 2),
          shelf.pos[2] + dirX.z * centerOffset + up.z * (height / 2),
        ],
      });
    }
  });

  return placements;
}

// 캘리브레이션 미리보기용 더미 책 생성 (store에는 저장되지 않음)
const previewPalette = [
  { spine: '#7d4b3a', cover: '#a86a4c' },
  { spine: '#2f4858', cover: '#3d6070' },
  { spine: '#6b6b47', cover: '#8a8a5c' },
  { spine: '#8c3b3b', cover: '#b25050' },
  { spine: '#3a5a40', cover: '#588157' },
  { spine: '#4a4058', cover: '#6d5f80' },
];

export function makePreviewBooks(count) {
  return Array.from({ length: count }, (_, i) => {
    const p = previewPalette[i % previewPalette.length];
    return {
      id: `preview-${i}`,
      title: `미리보기 ${i + 1}`,
      spineColor: p.spine,
      coverColor: p.cover,
      thickness: 0.16 + ((i * 7) % 5) * 0.03,
      heightFactor: ((i * 37) % 100) / 100,
    };
  });
}
