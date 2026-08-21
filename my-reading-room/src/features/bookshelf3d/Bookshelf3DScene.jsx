import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Book3D from './Book3D';
import WoodShelf from './WoodShelf';
import { shelfTiers } from './books3dData';

// 레이아웃 상수
const SHELF_WIDTH = 7;
const SHELF_DEPTH = 1;
const TIER_BASE_Y = [0, 1.5, 3]; // 아래 / 중간 / 위 tier 바닥
const TOP_Y = 4.3;
const BOOK_GAP = 0.02;

// 한 tier의 책들을 X축 상에 중앙 정렬로 배치한 위치 계산
function layoutTier(books, baseY) {
  const totalWidth =
    books.reduce((sum, b) => sum + b.thickness, 0) + BOOK_GAP * (books.length - 1);
  let cursor = -totalWidth / 2;

  return books.map((book) => {
    const x = cursor + book.thickness / 2;
    cursor += book.thickness + BOOK_GAP;
    return {
      ...book,
      position: [x, baseY + book.height / 2, 0],
      size: [book.thickness, book.height, book.depth],
    };
  });
}

export default function Bookshelf3DScene() {
  const [selectedBook, setSelectedBook] = useState(null);

  // tier는 위에서부터 정의됐으므로 Y는 역순 매핑 (index 0 = 맨 위)
  const tiersTopToBottom = [...TIER_BASE_Y].reverse();
  const placedTiers = shelfTiers.map((books, i) =>
    layoutTier(books, tiersTopToBottom[i])
  );

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#1a1418' }}>
      <Canvas
        shadows
        camera={{ position: [0, 2.3, 8.5], fov: 42 }}
        dpr={[1, 2]}
      >
        {/* 조명 */}
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[4, 8, 6]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-5, 3, 4]} intensity={0.35} />

        {/* 책장 프레임 */}
        <WoodShelf
          width={SHELF_WIDTH}
          depth={SHELF_DEPTH}
          tierBaseY={TIER_BASE_Y}
          topY={TOP_Y}
        />

        {/* 책들 */}
        {placedTiers.flat().map((book) => (
          <Book3D
            key={book.id}
            position={book.position}
            size={book.size}
            spineColor={book.spineColor}
            coverColor={book.coverColor}
            selected={selectedBook?.id === book.id}
            onSelect={() =>
              setSelectedBook((prev) => (prev?.id === book.id ? null : book))
            }
          />
        ))}

        <OrbitControls
          target={[0, 2.1, 0]}
          enablePan={false}
          minDistance={4}
          maxDistance={14}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.9}
        />
      </Canvas>

      {selectedBook && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          선택된 책: {selectedBook.title}
          <button
            onClick={() => setSelectedBook(null)}
            style={{
              marginLeft: 10,
              background: 'transparent',
              border: '1px solid #fff',
              color: '#fff',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
