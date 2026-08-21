import { createWorker } from 'tesseract.js';

// 오렌지 UI와 어울리는 책 색상 팔레트 (RegisterBook과 동일 소스)
export const colorPresets = [
  { spine: '#c96b32', cover: '#e8944a' }, // 앰버
  { spine: '#8b4513', cover: '#b5651d' }, // 새들브라운
  { spine: '#a0522d', cover: '#cd853f' }, // 시에나
  { spine: '#d4763e', cover: '#f2a365' }, // 피치
  { spine: '#6b3a2a', cover: '#8c5a3c' }, // 다크 코코아
  { spine: '#bf7830', cover: '#e0a050' }, // 골든
];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * 이미지의 평균 색상을 계산해 가장 가까운 색상 프리셋 인덱스를 반환.
 * @param {HTMLImageElement} img
 * @returns {number} colorPresets 인덱스
 */
export function extractDominantColorIndex(img) {
  const canvas = document.createElement('canvas');
  const size = 32; // 다운샘플링해서 평균 계산 비용 절감
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);

  let r = 0, g = 0, b = 0, count = 0;
  const { data } = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }
  r /= count;
  g /= count;
  b /= count;

  let bestIdx = 0;
  let bestDist = Infinity;
  colorPresets.forEach((p, idx) => {
    const [pr, pg, pb] = hexToRgb(p.cover);
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

/**
 * 표지 이미지 파일에서 텍스트를 인식해 제목/저자 후보를 추출.
 * 정확한 구조 인식이 아니라 휴리스틱: 가장 긴 줄 → 제목, "저자/지음/글" 근처 줄 → 저자.
 * @param {File} file
 * @returns {Promise<{ title: string, author: string, rawText: string }>}
 */
export async function recognizeCover(file) {
  const worker = await createWorker('kor+eng');
  try {
    const { data } = await worker.recognize(file);
    const lines = (data.text || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    let author = '';
    const authorLineIdx = lines.findIndex((l) => /지음|저자|글\s*[·,]|저\s*$/.test(l));
    if (authorLineIdx >= 0) {
      author = lines[authorLineIdx].replace(/지음|저자|글|[·,]|저\s*$/g, '').trim();
    }

    const titleCandidates = lines.filter((_, i) => i !== authorLineIdx);
    const title = titleCandidates.sort((a, b) => b.length - a.length)[0] || '';

    return { title, author, rawText: data.text || '' };
  } finally {
    await worker.terminate();
  }
}

/**
 * File을 미리보기/색상추출용 <img>로 로드.
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
