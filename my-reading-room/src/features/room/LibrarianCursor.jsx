/**
 * LibrarianCursor — 마우스를 따라다니는 사서 이미지 + 우상단 말풍선.
 * 위치는 컨테이너의 CSS 변수(--mx, --my)를 따라감(부모가 mousemove로 갱신).
 * 실제 커서는 부모에서 숨김(cursor:none).
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
  const useHover = hovering && librarian.imageHover;
  const imgSrc = useHover ? librarian.imageHover : librarian.image;

  // 손끝이 실제 커서 지점(--mx, --my)에 오도록 이미지를 이동
  const tip = useHover ? FINGERTIP.hover : FINGERTIP.default;
  const offsetX = -(tip.x * IMG_SIZE);
  const offsetY = -(tip.y * IMG_SIZE);

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

        {/* 우상단 말풍선 */}
        {answer && (
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
            {answer.text}
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
