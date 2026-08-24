import { useNavigate } from 'react-router-dom';
import { extractBooksFromAnswer } from './bookExtractor';

/**
 * LibrarianCursor — 마우스를 따라다니는 사서 이미지 + 우상단 말풍선.
 * 위치는 컨테이너의 CSS 변수(--mx, --my)를 따라감(부모가 mousemove로 갱신).
 * 실제 커서는 부모에서 숨김(cursor:none).
 * 말풍선 내부의 링크/버튼은 pointerEvents: 'auto'로 인터랙션 가능.
 *
 * @param {object} librarian - { name, icon, image }
 * @param {{text:string}|null} answer - 표시할 답변(없으면 말풍선 숨김)
 */
// 표시 크기(px)
const IMG_SIZE = 200;

// 이미지별 손끝(뻗은 앞발) 위치 비율 — 실제 이미지 알파 채널 측정값.
// 호버 시 앞발 자세가 달라 위치가 다르므로 상태별로 오프셋을 분리한다.
const FINGERTIP = {
  default: { x: 0.26, y: 0.287 }, // cat_03
  hover: { x: 0.143, y: 0.357 }, // cat_04
};

export default function LibrarianCursor({ librarian, answer, hovering }) {
  const navigate = useNavigate();
  const useHover = hovering && librarian.imageHover;
  const imgSrc = useHover ? librarian.imageHover : librarian.image;

  // 손끝이 실제 커서 지점(--mx, --my)에 오도록 이미지를 이동
  const tip = useHover ? FINGERTIP.hover : FINGERTIP.default;
  const offsetX = -(tip.x * IMG_SIZE);
  const offsetY = -(tip.y * IMG_SIZE);

  // 답변 텍스트에서 추천 도서 정보 자동 추출
  const books = answer?.text ? extractBooksFromAnswer(answer.text) : [];

  const handleRegister = (book) => {
    navigate('/register', {
      state: {
        fromAIRecommendation: true,
        book: {
          title: book.title,
          author: book.author,
          totalPage: book.totalPage ?? 300,
          currentPage: book.currentPage ?? 0,
          colorIdx: book.colorIdx ?? 0,
          thickness: book.thickness ?? 0.22,
        },
      },
    });
  };

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

        {/* 우상단 말풍선 (클릭 및 스크롤 상호작용 가능) */}
        {answer && (
          <div
            style={{
              position: 'absolute',
              left: '78%',
              bottom: '72%',
              width: 250,
              maxHeight: 260,
              overflowY: 'auto',
              background: 'var(--bg)',
              color: 'var(--text-h)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '10px 12px',
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: 'pre-line',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              pointerEvents: 'auto',
              cursor: 'auto',
            }}
          >
            <div>{answer.text}</div>

            {/* 추천 도서 바로 등록 버튼 카드 목록 */}
            {books.length > 0 && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                  ✨ 추천 도서 서재에 등록하기:
                </span>
                {books.map((b, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleRegister(b)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: '1px solid var(--accent-border, var(--border))',
                      background: 'var(--accent-bg, var(--code-bg))',
                      color: 'var(--text-h)',
                      cursor: 'pointer',
                      fontSize: 12,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: 600 }}>
                      📖 {b.title}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'var(--accent)',
                        color: '#fff',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      등록 ➔
                    </span>
                  </button>
                ))}
              </div>
            )}

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
                pointerEvents: 'none',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
