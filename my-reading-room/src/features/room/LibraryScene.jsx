import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Leva, useControls, folder } from 'leva';
import * as THREE from 'three';
import Book3D from '../bookshelf3d/Book3D';
import { useBooks } from '../../store/booksStore';
import { useTheme } from '../../store/themeStore';
import LibrarianChat from './LibrarianChat';
import LibrarianCursor from './LibrarianCursor';
import BookDetail from './BookDetail';
import { getLibrarian } from '../../data/librarians';
import { useLibrarian, loadSavedChatSession } from '../../store/librarianStore';
import { toKoreanStatus } from '../../api/bookApi';
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

/*
 * 책 hover/선택 시 테두리 glow 색상 (CLIAR-243).
 * index.css의 --accent 값과 동일하게 맞춰, 서재 배경/사서별 팔레트와 일관되게 한다.
 * (CSS 변수를 3D 캔버스 안에서 직접 읽기 어려워 값을 그대로 복제해 둔다)
 */
const GLOW_COLOR = {
  cat: { dark: '#ff9a3c', light: '#e06a10' },
  stork: { dark: '#9b7bf0', light: '#7d50c0' },
};

function getGlowColor(librarianId, isDark) {
  const palette = GLOW_COLOR[librarianId] || GLOW_COLOR.cat;
  return isDark ? palette.dark : palette.light;
}

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
  // CLIAR-280: 책 위에 커서를 올리면(클릭 없이) 제목/저자를 말풍선으로 보여준다.
  const [hoveredBook, setHoveredBook] = useState(null);
  const [calibrating, setCalibrating] = useState(false);
  // 사서 상태는 전역(LibrarianProvider) — Gnb·사서 프로필 페이지와 공유
  const { activeId: librarianId, setActiveId, librarian, names } = useLibrarian();
  // CLIAR-257: 추천 도서 등록 후 복귀 시 이전 대화/추천 카드 유지를 위해 sessionStorage에서 복원
  const [chatAnswer, setChatAnswer] = useState(() => {
    const saved = loadSavedChatSession();
    return saved?.answer || null;
  });
  const sceneRef = useRef(null);

  const switchLibrarian = (id) => {
    setActiveId(id);
    const lib = getLibrarian(id);
    const displayName = names[id] || lib.defaultName;
    setChatAnswer({ text: `${lib.icon} ${displayName}로 바꿨어요! ${lib.specialty}을 물어보세요 📚` });
  };
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

  /*
   * 커서 위치 추적 (CLIAR-214).
   * 사서 커서와 손전등 효과는 컨테이너의 --mx/--my를 따른다. 예전에는 씬 컨테이너의
   * onMouseMove로만 갱신했는데, GNB는 fixed 오버레이이면서 씬 컨테이너의 DOM 자식이
   * 아니라 상단 바 위에서는 이벤트가 오지 않아 사서 커서가 멈춰 있었다. 그 상태에서
   * OS 커서까지 숨기면 아무 커서도 안 보이므로, window에서 좌표를 받아 상단 바 위에서도
   * 사서 커서가 따라오게 한다(리렌더 없이 CSS 변수만 갱신).
   */
  useEffect(() => {
    if (calibrating) return;
    const handleMove = (e) => {
      const el = sceneRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      el.style.setProperty('--my', `${e.clientY - rect.top}px`);
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [calibrating]);

  // 서재 페이지에서는 OS 커서를 숨긴다 (CLIAR-214).
  // 씬 컨테이너는 cursor:none이지만 #root 고정폭(1126px) 바깥 레터박스나 씬 박스
  // 주변 여백으로 마우스가 나가면 body의 기본 커서가 드러나, 사서 커서 위를 지나
  // 좌우로 움직일 때 일반 포인터가 튀어 보였다. body에 클래스를 걸어 서재에 있는
  // 동안 커서를 감춘다. 버튼·링크는 각자 cursor를 지정하므로 클릭 대상엔 여전히
  // 포인터가 보인다.
  useEffect(() => {
    document.body.classList.add('reading-room');
    return () => document.body.classList.remove('reading-room');
  }, []);

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

  // 캘리브레이션 중이면 작업용 설정, 아니면 해당 사서의 배포용 기본 설정
  const activeConfig = calibrating ? workingConfig : { camera: getDefaultCamera(librarianId), shelves: getDefaultShelves(librarianId) };
  const sourceBooks = calibrating ? makePreviewBooks(previewCount) : books;
  const placements = placeBooks(sourceBooks, activeConfig.shelves);
  const { camera } = activeConfig;
  const activeShelf = workingConfig.shelves[activeIdx] || workingConfig.shelves[0];

  return (
    <div
      ref={sceneRef}
      style={{
        position: 'relative',
        // CLIAR-288: 서재는 몰입형 화면이라 #root(1126px) 좌우 레터박스 여백을 없애고
        // 뷰포트 전체(가로·세로)를 채운다. 배경/3D는 아래 16:9 레이어에서 처리.
        width: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        height: '100svh',
        cursor: calibrating ? 'auto' : 'none',
        // 화면을 덮도록 확대한 16:9 레이어의 넘치는 부분(위쪽)과 커서 추종 요소를 잘라낸다.
        overflow: 'hidden',
        '--mx': '50%',
        '--my': '50%',
      }}
    >
      {isDev && calibrating && <Leva collapsed={false} />}

      {/*
       * CLIAR-288: 배경 그림과 3D 캔버스를 같은 16:9 레이어에 담아, 이 레이어를
       * 뷰포트를 덮도록 확대(cover)하고 하단 정렬한다. 화면이 16:9보다 넓으면(짧으면)
       * 레이어가 뷰포트보다 커져 위쪽이 잘리고, 좁으면 좌우가 잘린다.
       * 배경과 캔버스가 항상 같은 16:9 박스를 공유하므로 3D 책과 책장 정합이 유지된다.
       */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: `max(100vw, calc(100svh * ${BG_ASPECT}))`,
          aspectRatio: String(BG_ASPECT),
          backgroundImage: `url(${librarianId === 'stork' ? BG_SRC_STORK : BG_SRC_CAT})`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      >
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
              glowColor={getGlowColor(librarianId, isDark)}
              onSelect={() => setSelectedId((prev) => (prev === b.id ? null : b.id))}
              onHover={(over) =>
                setHoveredBook((cur) => (over ? b : cur?.id === b.id ? null : cur))
              }
            />
          ))}
        </Canvas>
      </div>

      {/* 손전등 효과: 다크 모드에서만. 바깥은 어둡게 + 커서 주변은 따뜻한 빛으로 더 밝게 (캘리브레이션 중엔 끔) */}
      {isDark && !calibrating && (
        <>
          {/*
           * 어둡게 하는 비네트 (CLIAR-181: 손전등이 비추는 부분만 보이도록 훨씬 더 어둡게)
           * CLIAR-249: 비추는 범위를 30% 넓힘 (75px→98px, 140px→182px)
           */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 5,
              background:
                'radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(5,3,1,0) 0px, rgba(5,3,1,0.55) 98px, rgba(5,3,1,0.97) 182px)',
            }}
          />
          {/*
           * 커서 주변 밝은 글로우 (빛을 더함, CLIAR-181: 범위 50% 축소)
           * CLIAR-249: 비네트와 함께 30% 넓힘 (60px→78px, 115px→150px)
           */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 6,
              mixBlendMode: 'screen',
              background:
                'radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,214,150,0.4) 0px, rgba(255,200,130,0.2) 78px, rgba(255,190,120,0) 150px)',
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

      {/* CLIAR-280: 책 호버 시 제목/저자 말풍선 툴팁.
          커서(--mx/--my)를 따라 커서 위쪽에 뜨며, 클릭(선택)한 책에는 표시하지 않는다. */}
      {!calibrating && hoveredBook && hoveredBook.id !== selectedId && (
        <div
          style={{
            position: 'absolute',
            left: 'var(--mx, 50%)',
            top: 'var(--my, 50%)',
            transform: 'translate(-50%, calc(-100% - 18px))',
            maxWidth: 220,
            background: 'var(--bg)',
            color: 'var(--text-h)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '8px 12px',
            fontSize: 13,
            lineHeight: 1.45,
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
            wordBreak: 'break-word',
            zIndex: 10,
          }}
        >
          <span style={{ fontWeight: 700 }}>📖 {hoveredBook.title || '제목 미상'}</span>
          {hoveredBook.author && (
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text)', marginTop: 2 }}>
              ✍️ {hoveredBook.author}
            </span>
          )}
          {/* 말풍선 아래쪽 꼬리 */}
          <span
            style={{
              position: 'absolute',
              left: '50%',
              bottom: -7,
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop: '7px solid var(--border)',
            }}
          />
        </div>
      )}

      {/* 마우스를 따라다니는 사서 + 우상단 말풍선(답변).
          커서 모션은 hover가 아니라 책을 선택(클릭)했을 때만 전환된다 (CLIAR-239). */}
      {!calibrating && <LibrarianCursor librarian={librarian} answer={chatAnswer} active={selectedId != null} />}

      {/* 사서 질문 입력 패널 (오른쪽 하단) */}
      {!calibrating && (
        <LibrarianChat
          librarian={librarian}
          answer={chatAnswer}
          onAnswer={setChatAnswer}
          onSwitch={switchLibrarian}
          onOpenDetail={(bookOrId) => {
            if (typeof bookOrId === 'object' && bookOrId !== null) {
              const bookId = bookOrId.book_id ?? bookOrId.bookId ?? bookOrId.id;
              const found = books.find(
                (b) =>
                  b.bookId === bookId ||
                  b.id === String(bookId) ||
                  b.id === bookId ||
                  b.title === bookOrId.title
              );
              if (found) {
                setSelectedId(found.id);
              } else {
                setSelectedId({
                  id: String(bookId || 'custom'),
                  bookId: bookId,
                  title: bookOrId.title,
                  author: bookOrId.author,
                  status: toKoreanStatus(bookOrId.reading_status || bookOrId.readingStatus || bookOrId.status),
                  progress: bookOrId.progress,
                });
              }
            } else {
              const found = books.find(
                (b) =>
                  b.bookId === bookOrId ||
                  b.id === String(bookOrId) ||
                  b.id === bookOrId ||
                  b.title === bookOrId
              );
              if (found) {
                setSelectedId(found.id);
              } else {
                setSelectedId(bookOrId);
              }
            }
          }}
        />
      )}

      {/* 선택된 책 상세 팝업 (확대된 책 오른쪽) */}
      {selectedId && (() => {
        const book =
          typeof selectedId === 'object'
            ? selectedId
            : books.find(
              (b) =>
                b.id === selectedId ||
                b.bookId === selectedId ||
                String(b.bookId) === String(selectedId) ||
                b.title === selectedId
            );
        return book ? <BookDetail book={book} onClose={() => setSelectedId(null)} /> : null;
      })()}
    </div>
  );
}
