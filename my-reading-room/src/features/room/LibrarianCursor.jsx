import { extractBooksFromAnswer } from './bookExtractor';

/**
 * LibrarianCursor — 마우스를 따라다니는 사서 이미지 + 우상단 말풍선.
 * 위치는 컨테이너의 CSS 변수(--mx, --my)를 따라감(부모가 mousemove로 갱신).
 * 실제 커서는 부모에서 숨김(cursor:none).
 *
 * 상세한 추천 도서 목록 및 등록 액션은 우측 하단 고정 패널(LibrarianChat)에서 전담하며,
 * 마우스 커서의 말풍선은 1~2줄의 가벼운 리액션/안내 문구만 표시합니다.
 *
 * @param {object} librarian - { name, icon, image }
 * @param {{text:string}|null} answer - 표시할 답변(없으면 말풍선 숨김)
 */
// 표시 크기(px)
const IMG_SIZE = 200;

// 이미지별 손끝(뻗은 앞발) 위치 비율 — 실제 이미지 알파 채널 측정값.
const FINGERTIP = {
  default: { x: 0.26, y: 0.287 }, // cat_03
  hover: { x: 0.143, y: 0.357 }, // cat_04
};

/**
 * 말풍선에 노출할 짧은 1~2줄 리액션 텍스트 생성
 */
function getShortBubbleText(rawText, librarian) {
  if (!rawText) return '';
  const text = rawText.trim();

  // 1. 짧은 문구(로딩 중, 사서 변경 알림, 단순 안내 등)는 마크다운 기호 정제 후 표시
  if (text.length <= 80 && text.split('\n').length <= 2) {
    return text
      .replace(/^#{1,4}\s+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/^[-*•]\s+/gm, '')
      .trim();
  }

  // 2. 도서 추천 결과 등 장문인 경우 요약 리액션 문구 생성
  const books = extractBooksFromAnswer(text);
  if (books.length >= 2) {
    return `✨ 추천 도서 ${books.length}권을 찾았어요냥! 📚\n아래 채팅창에서 확인해보세요 🐾`;
  }
  if (books.length === 1) {
    return `✨ 『${books[0].title}』 책을 찾았어요냥! 📚\n아래 채팅창에서 확인해보세요 🐾`;
  }

  return `✨ 사서 답변이 도착했어요냥! 📚\n아래 채팅창에서 확인해보세요 🐾`;
}

export default function LibrarianCursor({ librarian, answer, hovering }) {
  const useHover = hovering && librarian.imageHover;
  const imgSrc = useHover ? librarian.imageHover : librarian.image;

  // 손끝이 실제 커서 지점(--mx, --my)에 오도록 이미지를 이동
  const tip = useHover ? FINGERTIP.hover : FINGERTIP.default;
  const offsetX = -(tip.x * IMG_SIZE);
  const offsetY = -(tip.y * IMG_SIZE);

  const bubbleText = answer?.text ? getShortBubbleText(answer.text, librarian) : '';

  return (
    <div
      style={{
        position: 'absolute',
        left: 'var(--mx, 50%)',
        top: 'var(--my, 50%)',
        transform: `translate(${offsetX}px, ${offsetY}px)`,
        zIndex: 99,
        pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'relative' }}>
        {/* 사서 이미지 (없으면 이모지) */}
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={librarian.name}
            style={{ width: IMG_SIZE, height: IMG_SIZE, objectFit: 'contain', display: 'block', userSelect: 'none' }}
            draggable={false}
          />
        ) : (
          <div style={{ fontSize: 90, lineHeight: 1 }}>{librarian.icon}</div>
        )}

        {/* 우상단 말풍선 (가벼운 1~2줄 리액션) */}
        {bubbleText && (
          <div
            style={{
              position: 'absolute',
              left: '78%',
              bottom: '72%',
              width: 210,
              background: 'var(--bg)',
              color: 'var(--text-h)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '10px 12px',
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: 'pre-line',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            }}
          >
            {bubbleText}
            {/* 말풍선 꼬리 */}
            <span
              style={{
                position: 'absolute',
                left: -8,
                bottom: 16,
                width: 0,
                height: 0,
                borderTop: '6px solid transparent',
                borderBottom: '6px solid transparent',
                borderRight: '8px solid var(--border)',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
