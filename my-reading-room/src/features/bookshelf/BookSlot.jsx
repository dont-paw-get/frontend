import { useEffect, useRef } from 'react';
import { drawImageToQuad } from '../../lib/perspectiveTransform';

export default function BookSlot({ quad, coverUrl, onClick, canvasSize }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0 || canvasSize.height === 0) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.src = coverUrl;
    img.onload = () => drawImageToQuad(ctx, img, quad);
    img.onerror = () => console.error('[BookSlot] 이미지 로드 실패:', coverUrl);
  }, [quad, coverUrl, canvasSize]);

  // 클릭 판정용 폴리곤 path
  function handleClick(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(...quad.TL);
    ctx.lineTo(...quad.TR);
    ctx.lineTo(...quad.BR);
    ctx.lineTo(...quad.BL);
    ctx.closePath();
    if (ctx.isPointInPath(x, y)) onClick();
  }

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize.width}
      height={canvasSize.height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
      }}
      onClick={handleClick}
    />
  );
}