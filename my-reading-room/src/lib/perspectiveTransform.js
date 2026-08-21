// tier 전체 quad를 책 개수(widths 배열)만큼 등분
// depthInset: 상단을 안쪽으로 좁혀서 책이 선반 안으로 기울어진 입체감을 줌 (0~1, 기본 0.15)
export function splitTierIntoBooks(tier, widths, { depthInset = 0.15 } = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const lerp = (p1, p2, t) => [
    p1[0] + (p2[0] - p1[0]) * t,
    p1[1] + (p2[1] - p1[1]) * t
  ];

  let acc = 0;
  const books = [];
  for (const w of widths) {
    const t0 = acc / total;
    const t1 = (acc + w) / total;

    const baseTL = lerp(tier.TL, tier.TR, t0);
    const baseTR = lerp(tier.TL, tier.TR, t1);
    const baseBL = lerp(tier.BL, tier.BR, t0);
    const baseBR = lerp(tier.BL, tier.BR, t1);

    // 상단을 안쪽으로 inset: 좌우로 좁히고 약간 아래로 내림 (선반 깊이감)
    const bookWidth = baseTR[0] - baseTL[0];
    const bookHeight = baseBL[1] - baseTL[1];
    const insetX = bookWidth * depthInset * 0.5;
    const insetY = bookHeight * depthInset * 0.35;

    books.push({
      TL: [baseTL[0] + insetX, baseTL[1] + insetY],
      TR: [baseTR[0] - insetX, baseTR[1] + insetY],
      BL: baseBL,
      BR: baseBR,
    });
    acc += w;
  }
  return books;
}
// 삼각형 3점 대응(affine) 변환으로 이미지 일부를 캔버스에 그리기
function drawTriangle(ctx, img, srcPts, dstPts) {
  const [s0, s1, s2] = srcPts;
  const [d0, d1, d2] = dstPts;

  ctx.save();
  // 목적지 삼각형으로 클리핑
  ctx.beginPath();
  ctx.moveTo(d0[0], d0[1]);
  ctx.lineTo(d1[0], d1[1]);
  ctx.lineTo(d2[0], d2[1]);
  ctx.closePath();
  ctx.clip();

  // source 삼각형 → destination 삼각형 affine 행렬 계산
  const denom = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]);
  const a = (d0[0] * (s1[1] - s2[1]) + d1[0] * (s2[1] - s0[1]) + d2[0] * (s0[1] - s1[1])) / denom;
  const b = (d0[1] * (s1[1] - s2[1]) + d1[1] * (s2[1] - s0[1]) + d2[1] * (s0[1] - s1[1])) / denom;
  const c = (d0[0] * (s2[0] - s1[0]) + d1[0] * (s0[0] - s2[0]) + d2[0] * (s1[0] - s0[0])) / denom;
  const d = (d0[1] * (s2[0] - s1[0]) + d1[1] * (s0[0] - s2[0]) + d2[1] * (s1[0] - s0[0])) / denom;
  const e = (d0[0] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[0] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[0] * (s0[0] * s1[1] - s1[0] * s0[1])) / denom;
  const f = (d0[1] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[1] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[1] * (s0[0] * s1[1] - s1[0] * s0[1])) / denom;

  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// quad = {TL, TR, BR, BL} 목적지 좌표, img는 원본 책 표지 이미지
export function drawImageToQuad(ctx, img, quad) {
  const { TL, TR, BR, BL } = quad;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // source 사각형(원본 이미지 전체)을 같은 방식으로 2개 삼각형으로 분할
  const srcTL = [0, 0], srcTR = [w, 0], srcBR = [w, h], srcBL = [0, h];

  drawTriangle(ctx, img, [srcTL, srcTR, srcBL], [TL, TR, BL]);
  drawTriangle(ctx, img, [srcTR, srcBR, srcBL], [TR, BR, BL]);
}