import { useCallback, useEffect, useLayoutEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Book3D from '../bookshelf3d/Book3D';
import { useBooks } from '../../store/booksStore';
import { useTheme } from '../../store/themeStore';
import LibrarianChat from './LibrarianChat';
import LibrarianCursor from './LibrarianCursor';
import BookDetail from './BookDetail';
import { DEFAULT_LIBRARIAN_ID, getLibrarian } from '../../data/librarians';
import {
  BG_SRC_CAT,
  BG_SRC_STORK,
  BG_ASPECT,
  getDefaultCamera,
  getDefaultShelves,
  placeBooks,
  makePreviewBooks,
} from './shelfLayout';

const isDev = import.meta.env.DEV;
const CALIB_KEY_PREFIX = 'myReadingRoom.calibration';

function getCalibKey(librarianId) {
  return `${CALIB_KEY_PREFIX}.${librarianId}`;
}

// dev 캘리브레이션 도구(leva 포함)는 필요 시점에만 로드 → 프로덕션 번들에서 제외
const CalibrationTools = lazy(() => import('./CalibrationTools'));

// 카메라를 지정 값으로 세팅 (그림 투시 정합).
// 고정 카메라이므로 매 프레임 대신 값이 바뀔 때만 세팅하고 1프레임 렌더를 요청한다.
function CameraRig({ fov, position, target }) {
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const [px, py, pz] = position;
  const [tx, ty, tz] = target;

  useLayoutEffect(() => {
    const cam = get().camera;
    cam.fov = fov;
    cam.position.set(px, py, pz);
    cam.lookAt(tx, ty, tz);
    cam.updateProjectionMatrix();
    invalidate();
  }, [get, invalidate, fov, px, py, pz, tx, ty, tz]);

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

// 캘리브레이션 leva 컨트롤은 CalibrationTools.jsx(lazy)로 분리되어 프로덕션 번들에서 제외됨.

function loadCalibration(librarianId) {
  try {
    const raw = localStorage.getItem(getCalibKey(librarianId));
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
    document.documentElement.setAttribute('data-librarian', id);
    const lib = getLibrarian(id);
    setChatAnswer({ text: `${lib.icon} ${lib.name}로 바꿨어요! ${lib.specialty}을 물어보세요 📚` });
  };

  // 초기 로드 시 data-librarian 속성 설정
  useEffect(() => {
    document.documentElement.setAttribute('data-librarian', librarianId);
    return () => document.documentElement.removeAttribute('data-librarian');
  }, []);
  const [previewCount, setPreviewCount] = useState(6);
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const [workingConfig, setWorkingConfig] = useState(
    () => loadCalibration(librarianId) || { camera: getDefaultCamera(librarianId), shelves: getDefaultShelves(librarianId) }
  );

  // 사서 전환 시 해당 사서의 캘리브레이션 다시 로드 (없으면 그 사서의 기본값)
  useEffect(() => {
    const saved = loadCalibration(librarianId);
    setWorkingConfig(saved || { camera: getDefaultCamera(librarianId), shelves: getDefaultShelves(librarianId) });
  }, [librarianId]);

  useEffect(() => {
    if (!isDev) return;
    try {
      localStorage.setItem(getCalibKey(librarianId), JSON.stringify(workingConfig));
    } catch {
      // 무시
    }
  }, [workingConfig, librarianId]);

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
    // 추가 후 새 선반의 인덱스 = 현재 선반 개수 (setState updater 밖에서 계산)
    const newIdx = workingConfig.shelves.length;
    setWorkingConfig((prev) => {
      const base = prev.shelves[activeIdx] || { id: 'shelf', pos: [0, 0, 0], rotXdeg: 0, rotYdeg: 0, rotZdeg: 0, width: 3.5, depth: 0.82, bookHeight: 1.1, heightVar: 0.15 };
      const shelves = [
        ...prev.shelves,
        { ...base, id: `shelf${prev.shelves.length + 1}`, pos: [base.pos[0], base.pos[1] - 1.2, base.pos[2]] },
      ];
      return { ...prev, shelves };
    });
    setActiveIdx(newIdx);
  };
  const deleteShelf = (idx) => {
    if (workingConfig.shelves.length <= 1) return;
    setWorkingConfig((prev) => ({
      ...prev,
      shelves: prev.shelves.filter((_, i) => i !== idx),
    }));
    // 삭제 후 길이 = 기존 길이 - 1 → 최대 인덱스는 (기존 길이 - 2)
    setActiveIdx((a) => Math.max(0, Math.min(a, workingConfig.shelves.length - 2)));
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
    setWorkingConfig({ camera: getDefaultCamera(librarianId), shelves: getDefaultShelves(librarianId) });
    setActiveIdx(0);
    try {
      localStorage.removeItem(getCalibKey(librarianId));
    } catch {
      // 무시
    }
  };

  const copyJson = async () => {
    const { camera, shelves } = workingConfig;
    const camName = librarianId === 'stork' ? 'STORK_CAMERA' : 'CAT_CAMERA';
    const shelvesName = librarianId === 'stork' ? 'STORK_SHELVES' : 'CAT_SHELVES';
    const text = `// ${librarian.name} (${librarianId}) 서재 배치\nconst ${camName} = ${JSON.stringify(camera, null, 2)};\n\nconst ${shelvesName} = ${JSON.stringify(shelves, null, 2)};`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 무시
    }
  };

  // 캘리브레이션 중이면 작업용 설정, 아니면 해당 사서의 배포용 기본 설정 (cat/stork 분리)
  const activeConfig = calibrating
    ? workingConfig
    : { camera: getDefaultCamera(librarianId), shelves: getDefaultShelves(librarianId) };
  // 사서/캘리브레이션이 바뀔 때만 선반 참조가 갱신되도록 메모이즈 (placements useMemo 안정화)
  const shelves = useMemo(
    () => (calibrating ? workingConfig.shelves : getDefaultShelves(librarianId)),
    [calibrating, workingConfig, librarianId]
  );
  const sourceBooks = useMemo(
    () => (calibrating ? makePreviewBooks(previewCount) : books),
    [calibrating, previewCount, books]
  );
  // 책 배치 계산은 책/선반이 바뀔 때만 (호버 등 잦은 리렌더에서 재계산 방지)
  const placements = useMemo(() => placeBooks(sourceBooks, shelves), [sourceBooks, shelves]);
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
        backgroundImage: `url(${librarianId === 'stork' ? BG_SRC_STORK : BG_SRC_CAT})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundColor: 'var(--bg)',
        cursor: calibrating ? 'auto' : 'none',
        '--mx': '50%',
        '--my': '50%',
      }}
    >
      <Canvas
        frameloop="demand"
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

      {/* 개발 모드 캘리브레이션 진입 버튼 */}
      {isDev && !calibrating && (
        <button
          onClick={() => setCalibrating(true)}
          style={{ position: 'absolute', top: 10, left: 10, fontSize: 12, padding: '4px 8px', opacity: 0.7 }}
        >
          캘리브레이션
        </button>
      )}

      {/* 캘리브레이션 도구(leva 포함)는 dev + 활성화 시에만 lazy 로드 */}
      {isDev && calibrating && (
        <Suspense fallback={null}>
          <CalibrationTools
            workingConfig={workingConfig}
            activeShelf={activeShelf}
            activeIdx={activeIdx}
            setActiveIdx={setActiveIdx}
            patchCamera={patchCamera}
            setCamComp={setCamComp}
            patchShelf={patchShelf}
            setShelfPos={setShelfPos}
            addShelf={addShelf}
            deleteShelf={deleteShelf}
            moveShelf={moveShelf}
            previewCount={previewCount}
            setPreviewCount={setPreviewCount}
            copyJson={copyJson}
            copied={copied}
            resetToDefaults={resetToDefaults}
            onClose={() => setCalibrating(false)}
          />
        </Suspense>
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
