// 3D 책장용 mock 데이터.
// 색상 기반(텍스처 없이도 동작). 나중에 spineMap/coverMap 텍스처로 교체 가능.

// 책등/표지 색상 팔레트 (차분한 서재 톤)
const palette = [
  { spine: '#7d4b3a', cover: '#a86a4c' }, // 브라운
  { spine: '#2f4858', cover: '#3d6070' }, // 딥블루그레이
  { spine: '#6b6b47', cover: '#8a8a5c' }, // 올리브
  { spine: '#8c3b3b', cover: '#b25050' }, // 버건디
  { spine: '#3a5a40', cover: '#588157' }, // 포레스트그린
  { spine: '#4a4058', cover: '#6d5f80' }, // 플럼
  { spine: '#b08968', cover: '#ddb892' }, // 샌드
  { spine: '#31363f', cover: '#4b515c' }, // 차콜
];

const titles = [
  '아몬드', '나를 보내지 마', '달러구트 꿈 백화점', '불편한 편의점',
  '역행자', '데미안', '1984', '해변의 카프카', '작은 아씨들',
  '트렌드 코리아', '사피엔스', '총 균 쇠', '코스모스', '이기적 유전자',
];

// 한 tier(선반 한 칸)에 들어갈 책들을 생성
function makeTier(count, seed = 0) {
  const books = [];
  for (let i = 0; i < count; i++) {
    const p = palette[(i + seed) % palette.length];
    // 책마다 두께/높이를 살짝 다르게 (자연스러움)
    const thickness = 0.16 + ((i * 7 + seed * 3) % 5) * 0.03; // 0.16 ~ 0.28
    const height = 1.05 + ((i * 3 + seed) % 4) * 0.08;        // 1.05 ~ 1.29
    books.push({
      id: `${seed}-${i}`,
      title: titles[(i + seed * 2) % titles.length],
      spineColor: p.spine,
      coverColor: p.cover,
      thickness,
      height,
      depth: 0.82,
    });
  }
  return books;
}

// 3개 tier 구성 (위에서부터)
export const shelfTiers = [
  makeTier(11, 0),
  makeTier(12, 3),
  makeTier(10, 5),
];
