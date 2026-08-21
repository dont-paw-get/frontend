import { lazy, Suspense } from 'react';

// 3D 씬(three.js)은 서재 페이지 진입 시에만 로드
const LibraryScene = lazy(() => import('../features/room/LibraryScene'));

export default function MyLibrary() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>서재 불러오는 중…</div>}>
      <LibraryScene />
    </Suspense>
  );
}
