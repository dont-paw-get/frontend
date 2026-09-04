import { createWorker } from 'tesseract.js';

// 오렌지 UI와 어울리는 책 색상 팔레트 (RegisterBook과 동일 소스)
export const colorPresets = [
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
 * 이미지 파일에서 순수 텍스트를 인식 (문장 수집용).
 * 제목/저자 구조화 없이 원문 텍스트만 반환한다.
 * @param {File} file
 * @returns {Promise<string>} 인식된 텍스트
 */
export async function recognizeText(file) {
  const worker = await createWorker('kor+eng');
  try {
    const { data } = await worker.recognize(file);
    return (data.text || '').trim();
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
