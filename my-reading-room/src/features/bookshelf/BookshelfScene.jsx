import { useState, useRef, useEffect } from 'react';
import BookSlot from './BookSlot';
import { mockBooksByTier } from './mockBooks';
import { splitTierIntoBooks } from '../../lib/perspectiveTransform';
import slotCoordsRatio from './slotCoords.json';

export default function BookshelfScene() {
  const containerRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 768, height: 432 });
  const [selectedBook, setSelectedBook] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setCanvasSize({ width: Math.round(width), height: Math.round(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function ratioToPx(quadRatio) {
    const { width, height } = canvasSize;
    const toPx = ([rx, ry]) => [rx * width, ry * height];
    return {
      TL: toPx(quadRatio.TL),
      TR: toPx(quadRatio.TR),
      BR: toPx(quadRatio.BR),
      BL: toPx(quadRatio.BL),
    };
  }

  // tier별로 book quad 계산해서 렌더링용 flat 배열 만들기
  const renderedBooks = [];
  for (const [tierName, books] of Object.entries(mockBooksByTier)) {
    const tierRatioQuad = slotCoordsRatio[tierName];
    if (!tierRatioQuad) {
      console.warn(`slotCoords.json에 ${tierName} 좌표가 없습니다`);
      continue;
    }
    const tierPxQuad = ratioToPx(tierRatioQuad);
    const widths = books.map(b => b.widthRatio || 1);
    const bookQuads = splitTierIntoBooks(tierPxQuad, widths);

    books.forEach((book, i) => {
      renderedBooks.push({ ...book, quad: bookQuads[i] });
    });
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
      <img src="/shelves/space_1.png" alt="서재 배경"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

      {renderedBooks.map(book => (
        <BookSlot
          key={book.id}
          quad={book.quad}
          coverUrl={book.coverUrl}
          canvasSize={canvasSize}
          onClick={() => setSelectedBook(book)}
        />
      ))}

      {selectedBook && (
        <div style={{ position: 'absolute', bottom: 0, background: '#fff', padding: '4px 8px' }}>
          선택된 책: {selectedBook.title}
        </div>
      )}
    </div>
  );
}