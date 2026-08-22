import { useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Leva, useControls, folder } from 'leva';
import * as THREE from 'three';
import Book3D from '../bookshelf3d/Book3D';
import { useBooks } from '../../store/booksStore';
import { useTheme } from '../../store/themeStore';
import LibrarianChat from './LibrarianChat';
import LibrarianCursor from './LibrarianCursor';
import BookDetail from './BookDetail';
import { DEFAULT_LIBRARIAN_ID, getLibrarian } from '../../data/librarians';
import {
  BG_SRC,
  BG_ASPECT,
  DEFAULT_CAMERA,
  DEFAULT_SHELVES,
  placeBooks,
  makePreviewBooks,
} from './shelfLayout';

const isDev = import.meta.env.DEV;
const CALIB_KEY = 'myReadingRoom.calibration';

// 카메라를 매 프레임 지정 값으로 세팅 (그림 투시 정합)
function CameraRig({ fov, position, target }) {
  useFrame((state) => {
    const cam = state.camera;
    cam.fov = fov;
    cam.position.set(position[0], position[1], position[2]);
    cam.lookAt(target[0], target[1], target[2]);
    cam.updateProjectionMatrix();
  });
  return null;
}

// 캘리브레이션 모드에서 각 선반 위치를 반투명 박스로 표시(활성 선반은 강조)
function ShelfGuides({ shelves, activeIdx }) {
  return (
    <group>
      {shelves.map((s, i) => (
        <mesh
          key={s.id}
          position={s.pos}
          rotation={[
            THREE.MathUtils.degToRad(s.rotXdeg ?? 0),
            THREE.MathUtils.degToRad(s.rotYdeg ?? 0),
            THREE.MathUtils.degToRad(s.rotZdeg ?? 0),
          ]}
        >
          <boxGeometry args={[s.width, 0.02, s.depth]} />
          <meshBasicMaterial
            color={i === activeIdx ? '#00e5ff' : '#ff3b7b'}
            transparent
            opacity={i === activeIdx ? 0.55 : 0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

// leva 슬라이더 (카메라 + 활성 선반). calibrating일 때만 마운트됨.
function CalibrationControls({ camera, shelf, activeIdx, onCamera, onCamComp, onShelf, onShelfPos }) {
  // 카메라 (마운트 시 1회 초기화)
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

  // 활성 선반 (activeIdx 바뀌면 해당 선반 값으로 리셋됨)
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

function loadCalibration() {
  try {
    const raw = localStorage.getItem(CALIB_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function LibraryScene() {
  const { books } = useBooks();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [selectedId, setSelectedId] = useState(null);
  const [calibrating, setCalibrating] = useState(false);
  const [librarianId, setLibrarianId] = useState(DEFAULT_LIBRARIAN_ID);
  const [chatAnswer, setChatAnswer] = useState(null);
  const [hoveringBook, setHoveringBook] = useState(false);
  const librarian = getLibrarian(librarianId);

  const switchLibrarian = (id) => {
    setLibrarianId(id);
    const lib = getLibrarian(id);
    setChatAnswer({ text: `${lib.icon} ${lib.name}로 바꿨어요! ${lib.specialty}을 물어보세요 📚` });
  };
  const [previewCount, setPreviewCount] = useState(6);
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const [workingConfig, setWorkingConfig] = useState(
    () => loadCalibration() || { camera: DEFAULT_CAMERA, shelves: DEFAULT_SHELVES }
  );

  useEffect(() => {
    if (!isDev) return;
    try {
      localStorage.setItem(CALIB_KEY, JSON.stringify(workingConfig));
    } catch {
      // 무시
    }
  }, [workingConfig]);

  // ── 편집 핸들러 (함수형 업데이트로 stale closure 방지) ──
  const patchCamera = useCallback((patch) => {
    setWorkingConfig((prev) => ({ ...prev, camera: { ...prev.camera, ...patch } }));
  }, []);
  const setCamComp = useCallback((vecKey, idx, v) => {
    setWorkingConfig((prev) => {
      const arr = [...prev.camera[vecKey]];
      arr[idx] = v;
      return { ...prev, camera: { ...prev.camera, [vecKey]: arr } };
    });
  }, []);
  const patchShelf = useCallback((idx, patch) => {
    setWorkingConfig((prev) => ({
      ...prev,
      shelves: prev.shelves.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }, []);
  const setShelfPos = useCallback((idx, i, v) => {
    setWorkingConfig((prev) => ({
      ...prev,
      shelves: prev.shelves.map((s, k) => {
        if (k !== idx) return s;
        const pos = [...s.pos];
        pos[i] = v;
        return { ...s, pos };
      }),
    }));
  }, []);

  const addShelf = () => {
    setWorkingConfig((prev) => {
      const base = prev.shelves[activeIdx] || { id: 'shelf', pos: [0, 0, 0], rotXdeg: 0, rotYdeg: 0, rotZdeg: 0, width: 3.5, depth: 0.82, bookHeight: 1.1, heightVar: 0.15 };
      const shelves = [
        ...prev.shelves,
        { ...base, id: `shelf${prev.shelves.length + 1}`, pos: [base.pos[0], base.pos[1] - 1.2, base.pos[2]] },
      ];
      setActiveIdx(shelves.length - 1);
      return { ...prev, shelves };
    });
  };
  const deleteShelf = (idx) => {
    setWorkingConfig((prev) => {
      if (prev.shelves.length <= 1) return prev;
      const shelves = prev.shelves.filter((_, i) => i !== idx);
      setActiveIdx((a) => Math.max(0, Math.min(a, shelves.length - 1)));
      return { ...prev, shelves };
    });
  };
  const moveShelf = (idx, dir) => {
    const j = idx + dir;
    setWorkingConfig((prev) => {
      if (j < 0 || j >= prev.shelves.length) return prev;
      const shelves = [...prev.shelves];
      [shelves[idx], shelves[j]] = [shelves[j], shelves[idx]];
      return { ...prev, shelves };
    });
    if (j >= 0 && j < workingConfig.shelves.length) setActiveIdx(j);
  };

  const resetToDefaults = () => {
    setWorkingConfig({ camera: DEFAULT_CAMERA, shelves: DEFAULT_SHELVES });
    setActiveIdx(0);
    try {
      localStorage.removeItem(CALIB_KEY);
    } catch {
      // 무시
    }
  };

  const copyJson = async () => {
    const { camera, shelves } = workingConfig;
    const text = `export const DEFAULT_CAMERA = ${JSON.stringify(camera, null, 2)};\n\nexport const DEFAULT_SHELVES = ${JSON.stringify(shelves, null, 2)};`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 무시
    }
  };

  // 캘리브레이션 중이면 작업용 설정, 아니면 배포용 기본 설정
  const activeConfig = calibrating ? workingConfig : { camera: DEFAULT_CAMERA, shelves: DEFAULT_SHELVES };
  const sourceBooks = calibrating ? makePreviewBooks(previewCount) : books;
  const placements = placeBooks(sourceBooks, activeConfig.shelves);
  const { camera } = activeConfig;
  const activeShelf = workingConfig.shelves[activeIdx] || workingConfig.shelves[0];

  // 손전등 효과: 커서 위치를 컨테이너 CSS 변수로 갱신(리렌더 없음, 자식들이 상속)
  const handleFlashlightMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      onMouseMove={calibrating ? undefined : handleFlashlightMove}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: String(BG_ASPECT),
        backgroundImage: `url(${BG_SRC})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundColor: 'var(--bg)',
        cursor: calibrating ? 'auto' : 'none',
        '--mx': '50%',
        '--my': '50%',
      }}
    >
      {isDev && calibrating && <Leva collapsed={false} />}

      <Canvas
        gl={{ alpha: true, antialias: true }}
        style={{ position: 'absolute', inset: 0 }}
        camera={{ position: camera.position, fov: camera.fov }}
      >
        <CameraRig fov={camera.fov} position={camera.position} target={camera.target} />

        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 8, 6]} intensity={1.0} />
        <directionalLight position={[-5, 3, 4]} intensity={0.3} />

        {calibrating && <ShelfGuides shelves={activeConfig.shelves} activeIdx={activeIdx} />}

        {placements.map((b) => (
          <Book3D
            key={b.id}
            position={b.position}
            size={b.size}
            rotation={b.rotation}
            spineColor={b.spineColor}
            coverColor={b.coverColor}
            selected={selectedId === b.id}
            onSelect={() => setSelectedId((prev) => (prev === b.id ? null : b.id))}
            onHover={setHoveringBook}
          />
        ))}
      </Canvas>

      {/* 손전등 효과: 다크 모드에서만. 바깥은 어둡게 + 커서 주변은 따뜻한 빛으로 더 밝게 (캘리브레이션 중엔 끔) */}
      {isDark && !calibrating && (
        <>
          {/* 어둡게 하는 비네트 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 5,
              background:
                'radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(42,24,9,0) 0px, rgba(42,24,9,0) 150px, rgba(42,24,9,0.72) 330px)',
            }}
          />
          {/* 커서 주변 밝은 글로우 (빛을 더함) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 6,
              mixBlendMode: 'screen',
              background:
                'radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,214,150,0.4) 0px, rgba(255,200,130,0.2) 120px, rgba(255,190,120,0) 230px)',
            }}
          />
        </>
      )}

      {isDev && calibrating && (
        <CalibrationControls
          camera={workingConfig.camera}
          shelf={activeShelf}
          activeIdx={activeIdx}
          onCamera={patchCamera}
          onCamComp={setCamComp}
          onShelf={(patch) => patchShelf(activeIdx, patch)}
          onShelfPos={(i, v) => setShelfPos(activeIdx, i, v)}
        />
      )}

      {/* 개발 모드 캘리브레이션 진입 버튼 */}
      {isDev && !calibrating && (
        <button
          onClick={() => setCalibrating(true)}
          style={{ position: 'absolute', top: 10, left: 10, fontSize: 12, padding: '4px 8px', opacity: 0.7 }}
        >
          캘리브레이션
        </button>
      )}

      {/* 캘리브레이션 구조 조작 바 (선반 선택/추가/순서/복사) */}
      {isDev && calibrating && (
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
            <button onClick={() => setCalibrating(false)} style={{ fontSize: 11 }}>닫기</button>
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
      )}

      {/* 마우스를 따라다니는 사서 + 우상단 말풍선(답변) */}
      {!calibrating && <LibrarianCursor librarian={librarian} answer={chatAnswer} hovering={hoveringBook} />}

      {/* 사서 질문 입력 패널 (오른쪽 하단) */}
      {!calibrating && (
        <LibrarianChat
          librarian={librarian}
          answer={chatAnswer}
          onAnswer={setChatAnswer}
          onSwitch={switchLibrarian}
        />
      )}

      {/* 선택된 책 상세 팝업 (확대된 책 오른쪽) */}
      {selectedId && (() => {
        const book = books.find((b) => b.id === selectedId);
        return book ? <BookDetail book={book} onClose={() => setSelectedId(null)} /> : null;
      })()}
    </div>
  );
}
