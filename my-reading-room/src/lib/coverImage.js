/**
 * 도서 표지 이미지 URL 유틸.
 *
 * 백엔드가 내려주는 표지 URL(알라딘 이미지)은 경로에 크기 구간이 들어 있다.
 *   .../product/00/00/coversum/xxxxx.jpg   ← 썸네일(작은 이미지)
 *   .../product/00/00/cover500/xxxxx.jpg   ← 고화질
 * 구간 이름만 바꾸면 같은 이미지의 다른 해상도가 나오므로, 프론트에서
 * 표시 직전에 고화질 구간으로 치환한다.
 *
 * React 용어로는 컴포넌트/훅이 아닌 순수 함수 모음이라 "유틸(util) 모듈"이라 부른다.
 * 훅이 아니므로 파일명·함수명에 use 접두사를 붙이지 않고 lib/ 아래에 둔다.
 */

// 알라딘 URL의 표지 크기 구간: coversum / covermid / coverbig / cover200 / cover500 ...
const COVER_SIZE_SEGMENT = /\/cover(?:sum|small|mid|big|\d+)\//i;

/**
 * 표지 URL을 고화질(cover500) 버전으로 바꿔 준다.
 *
 * - 값이 없거나 문자열이 아니면 그대로 반환한다(호출부에서 falsy 체크 그대로 사용 가능).
 * - 알라딘 크기 구간이 없는 URL(다른 도메인 등)은 건드리지 않고 그대로 반환한다.
 *
 * @param {string|null|undefined} url - 원본 표지 URL
 * @param {string} [size='cover500'] - 바꿀 크기 구간 이름
 * @returns {string|null|undefined} 고화질 URL (또는 원본 그대로)
 */
export function highResCoverUrl(url, size = 'cover500') {
  if (typeof url !== 'string' || !url) return url;
  return url.replace(COVER_SIZE_SEGMENT, `/${size}/`);
}
