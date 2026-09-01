import { extractBooksFromAnswer } from './bookExtractor';
import './LibrarianCursor.css';

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
// 기본 표시 크기(px). 사서별 배율은 librarians.js의 imgScale로 조정한다.
const IMG_SIZE = 200;

/**
 * 포인터 지점 기본값 — 사서 데이터(librarians.js)에 tip이 없을 때만 사용.
 * 사서별 실측 좌표는 librarians.js의 tip/tipHover가 단일 소스다.
 */
const FALLBACK_TIP = { x: 0.26, y: 0.287 };

/**
 * 말풍선에 노출할 짧은 1~2줄 리액션 텍스트 생성
 */
function getShortBubbleText(rawText, librarian, answer) {
  if (!rawText) return '';
  const text = rawText.trim();
  const isStork = librarian?.id === 'stork';

  // 1. 내 서재 도서 결과가 있는 경우
  const libraryBooks = answer?.library_books || answer?.libraryBooks || [];
  if (libraryBooks.length > 0) {
    return isStork
      ? `✨ 두둥! 서재에서 도서 ${libraryBooks.length}권을 확인했습니다 🪶\n아래 채팅창에서 확인해 보세요`
      : `✨ 서재에서 책 ${libraryBooks.length}권을 찾았다냥! 📚\n아래 채팅창에서 확인해보라냥 🐾`;
  }

  // 2. 짧은 문구(로딩 중, 사서 변경 알림, 단순 안내 등)는 마크다운 기호 정제 후 표시
  if (text.length <= 80 && text.split('\n').length <= 2) {
    return text
      .replace(/^#{1,4}\s+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/^[-*•]\s+/gm, '')
      .trim();
  }

  // 3. 도서 추천 결과 등 장문인 경우 요약 리액션 문구 생성
  const isRecommend = text.includes('### 📖') || text.includes('###');
  const books = isRecommend ? extractBooksFromAnswer(text) : [];
  if (books.length >= 2) {
    return isStork
      ? `✨ 두둥! 추천 도서 ${books.length}권을 선별했습니다 🪶\n아래 채팅창에서 확인해 보세요`
      : `✨ 추천 도서 ${books.length}권을 찾았다냥! 📚\n아래 채팅창에서 확인해보라냥 🐾`;
  }
  if (books.length === 1) {
    return isStork
      ? `✨ 두둥! 『${books[0].title}』 도서를 선별했습니다 🪶\n아래 채팅창에서 확인해 보세요`
      : `✨ 『${books[0].title}』 책을 찾았다냥! 📚\n아래 채팅창에서 확인해보라냥 🐾`;
  }

  return isStork
    ? `✨ 두둥! 사서의 답변이 도착했습니다 🪶\n아래 채팅창에서 확인해 보세요`
    : `✨ 사서 답변이 도착했다냥! 📚\n아래 채팅창에서 확인해보라냥 🐾`;
}

export default function LibrarianCursor({ librarian, answer, hovering }) {
  const useHover = hovering && librarian.imageHover;
  const imgSrc = useHover ? librarian.imageHover : librarian.image;

  // 사서별 표시 크기 (imgScale 미지정 시 기본 배율)
  const imgSize = Math.round(IMG_SIZE * (librarian.imgScale ?? 1));

  // 포인터 지점(손끝·부리 끝)이 실제 커서 위치(--mx, --my)에 오도록 이미지를 이동
  const tip = (useHover ? librarian.tipHover : librarian.tip) || librarian.tip || FALLBACK_TIP;
  const offsetX = -(tip.x * imgSize);
  const offsetY = -(tip.y * imgSize);

  const bubbleText = answer?.text ? getShortBubbleText(answer.text, librarian, answer) : '';

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
          /*
           * key에 src를 넣어 호버 상태가 바뀔 때마다 img 요소를 새로 마운트한다.
           * 황새 호버 이미지는 1회 재생 후 마지막 프레임에 멈추는 애니메이션 WebP라,
           * 같은 요소의 src만 교체하면 브라우저가 완료된 애니메이션을 다시 재생하지
           * 않을 수 있다. 요소를 새로 만들면 책 위에 올릴 때마다 처음부터 재생된다.
           */
          <img
            key={imgSrc}
            className={`librarian-cursor-img${useHover ? ' librarian-cursor-img--hover' : ''}`}
            src={imgSrc}
            alt={librarian.name}
            style={{ width: imgSize, height: imgSize }}
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
