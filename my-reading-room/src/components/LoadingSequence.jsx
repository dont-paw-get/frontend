import { useState, useEffect } from 'react';

// 인식/분석 대기 중 재생할 로딩 프레임 (CLIAR-285)
// loading_0 → 1 → 2 → 3 → 4 → full 순서로 순차 재생한다.
const LOADING_FRAMES = [
  '/loading/loading_0.png',
  '/loading/loading_1.png',
  '/loading/loading_2.png',
  '/loading/loading_3.png',
  '/loading/loading_4.png',
  '/loading/loading_full.png',
];

/**
 * 인식/분석 대기 중 표시하는 순차 로딩 애니메이션 (CLIAR-285).
 * loading_0부터 full까지 프레임을 순서대로 넘기며, 완료 전까지 반복한다.
 *
 * @param {number} [size=140] 프레임 이미지 가로 크기(px)
 * @param {string} [label='분석 중이에요...'] 하단 안내 문구
 * @param {number} [padding=32] 상하 여백(px)
 */
export default function LoadingSequence({ size = 140, label = '분석 중이에요...', padding = 32 }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % LOADING_FRAMES.length);
    }, 450);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: `${padding}px 12px`,
      }}
    >
      <img
        src={LOADING_FRAMES[frame]}
        alt="분석 중"
        draggable={false}
        style={{ width: size, height: 'auto' }}
      />
      {label && <span style={{ color: 'var(--text)', fontSize: 14 }}>{label}</span>}
    </div>
  );
}
