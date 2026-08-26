import { Leva, useControls, folder } from 'leva';

/**
 * CalibrationTools — 개발 모드 전용 배치 캘리브레이션 UI.
 *
 * leva(디버그 UI)를 이 모듈에만 가둬서 React.lazy 로 분리 → 프로덕션 번들 및
 * LibraryScene 청크에서 leva를 제외한다. isDev && calibrating 일 때만 마운트된다.
 */

// leva 슬라이더 (카메라 + 활성 선반). activeIdx가 바뀌면 해당 선반 값으로 리셋됨.
function CalibrationControls({ camera, shelf, activeIdx, onCamera, onCamComp, onShelf, onShelfPos }) {
  useControls(
    () => ({
      카메라: folder({
        fov: { value: camera.fov, min: 10, max: 90, step: 0.5, onChange: (v, _p, c) => c.fromPanel && onCamera({ fov: v }) },
        posX: { value: camera.position[0], min: -12, max: 12, step: 0.01, onChange: (v, _p, c) => c.fromPanel && onCamComp('position', 0, v) },
        posY: { value: camera.position[1], min: -6, max: 12, step: 0.01, onChange: (v, _p, c) => c.fromPanel && onCamComp('position', 1, v) },
        posZ: { value: camera.position[2], min: 0.5, max: 24, step: 0.01, onChange: (v, _p, c) => c.fromPanel && onCamComp('position', 2, v) },
        tgtX: { value: camera.target[0], min: -12, max: 12, step: 0.01, onChange: (v, _p, c) => c.fromPanel && onCamComp('target', 0, v) },
        tgtY: { value: camera.target[1], min: -6, max: 12, step: 0.01, onChange: (v, _p, c) => c.fromPanel && onCamComp('target', 1, v) },
        tgtZ: { value: camera.target[2], min: -12, max: 12, step: 0.01, onChange: (v, _p, c) => c.fromPanel && onCamComp('target', 2, v) },
      }),
    }),
    []
  );

  useControls(
    () => ({
      [`선반 #${activeIdx + 1} (${shelf.id})`]: folder({
        sPosX: { value: shelf.pos[0], min: -12, max: 12, step: 0.01, onChange: (v, _p, c) => c.fromPanel && onShelfPos(0, v) },
        sPosY: { value: shelf.pos[1], min: -8, max: 12, step: 0.01, onChange: (v, _p, c) => c.fromPanel && onShelfPos(1, v) },
        sPosZ: { value: shelf.pos[2], min: -12, max: 12, step: 0.01, onChange: (v, _p, c) => c.fromPanel && onShelfPos(2, v) },
        rotXdeg: { value: shelf.rotXdeg ?? 0, min: -90, max: 90, step: 0.5, onChange: (v, _p, c) => c.fromPanel && onShelf({ rotXdeg: v }) },
        rotYdeg: { value: shelf.rotYdeg ?? 0, min: -90, max: 90, step: 0.5, onChange: (v, _p, c) => c.fromPanel && onShelf({ rotYdeg: v }) },
        rotZdeg: { value: shelf.rotZdeg ?? 0, min: -90, max: 90, step: 0.5, onChange: (v, _p, c) => c.fromPanel && onShelf({ rotZdeg: v }) },
        width: { value: shelf.width, min: 0.5, max: 12, step: 0.01, onChange: (v, _p, c) => c.fromPanel && onShelf({ width: v }) },
        depth: { value: shelf.depth, min: 0.2, max: 2, step: 0.01, onChange: (v, _p, c) => c.fromPanel && onShelf({ depth: v }) },
        bookHeight: { value: shelf.bookHeight ?? 1.1, min: 0.3, max: 3, step: 0.01, onChange: (v, _p, c) => c.fromPanel && onShelf({ bookHeight: v }) },
        heightVar: { value: shelf.heightVar ?? 0.15, min: 0, max: 1, step: 0.01, onChange: (v, _p, c) => c.fromPanel && onShelf({ heightVar: v }) },
        capacity: { value: shelf.capacity ?? 0, min: 0, max: 40, step: 1, onChange: (v, _p, c) => c.fromPanel && onShelf({ capacity: v }) },
      }),
    }),
    [activeIdx]
  );

  return null;
}

export default function CalibrationTools({
  workingConfig,
  activeShelf,
  activeIdx,
  setActiveIdx,
  patchCamera,
  setCamComp,
  patchShelf,
  setShelfPos,
  addShelf,
  deleteShelf,
  moveShelf,
  previewCount,
  setPreviewCount,
  copyJson,
  copied,
  resetToDefaults,
  onClose,
}) {
  return (
    <>
      <Leva collapsed={false} />

      <CalibrationControls
        camera={workingConfig.camera}
        shelf={activeShelf}
        activeIdx={activeIdx}
        onCamera={patchCamera}
        onCamComp={setCamComp}
        onShelf={(patch) => patchShelf(activeIdx, patch)}
        onShelfPos={(i, v) => setShelfPos(activeIdx, i, v)}
      />

      {/* 캘리브레이션 구조 조작 바 (선반 선택/추가/순서/복사) */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(20,20,24,0.92)',
          color: '#eee',
          padding: 10,
          borderRadius: 8,
          fontSize: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxWidth: 260,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>선반 편집</strong>
          <button onClick={onClose} style={{ fontSize: 11 }}>닫기</button>
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {workingConfig.shelves.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveIdx(i)}
              title={s.id}
              style={{
                fontSize: 11,
                padding: '2px 7px',
                background: i === activeIdx ? '#00e5ff' : '#333',
                color: i === activeIdx ? '#000' : '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {i + 1}
            </button>
          ))}
          <button onClick={addShelf} style={{ fontSize: 11, padding: '2px 7px' }}>+ 추가</button>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => moveShelf(activeIdx, -1)} style={{ fontSize: 11 }}>↑ 순서</button>
          <button onClick={() => moveShelf(activeIdx, 1)} style={{ fontSize: 11 }}>↓ 순서</button>
          <button onClick={() => deleteShelf(activeIdx)} style={{ fontSize: 11, color: '#f88' }}>선반 삭제</button>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          미리보기 책 수
          <input
            type="number"
            min={0}
            max={40}
            value={previewCount}
            onChange={(e) => setPreviewCount(Number(e.target.value))}
            style={{ width: 50, background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 4 }}
          />
        </label>

        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={copyJson} style={{ flex: 1, padding: '6px 0', fontWeight: 700 }}>
            {copied ? '복사됨!' : '설정 JSON 복사'}
          </button>
          <button onClick={resetToDefaults} style={{ fontSize: 11 }}>기본값 초기화</button>
        </div>
        <span style={{ color: '#999', lineHeight: 1.4 }}>
          수치 조절은 우측 leva 슬라이더에서. 다 맞추면 JSON 복사 → shelfLayout.js의 DEFAULT_* 교체.
        </span>
      </div>
    </>
  );
}
