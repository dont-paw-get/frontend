import { createWorker } from 'tesseract.js';

// 색상 관련 유틸(colorPresets, extractDominantColorIndex, loadImage)은
// tesseract 의존성이 없는 colorUtils.js로 분리되었습니다. 소비 측에서 직접 import 하세요.

/**
 * 표지 이미지 파일에서 텍스트를 인식해 제목/저자 후보를 추출.
 * 정확한 구조 인식이 아니라 휴리스틱: 가장 긴 줄 → 제목, "저자/지음/글" 근처 줄 → 저자.
 *
 * ⚠️ tesseract.js(대용량)를 끌어오므로, 실제 스캔 시점에 동적 import 로만 사용하세요.
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
