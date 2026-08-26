import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Book3D — boxGeometry 기반 단일 3D 책
 *
 * 좌표계: 책등(spine)이 +Z(정면)을 향하도록 배치.
 *  - +Z 면: 책등(spine)  → 선반에서 보이는 면
 *  - +X / -X 면: 앞표지 / 뒤표지 (넓은 면)
 *  - +Y / -Y / -Z 면: 책배(페이지 단면)
 *
 * BoxGeometry material 인덱스 순서: [+X, -X, +Y, -Y, +Z, -Z]
 *
 * 상호작용:
 *  - hover: 책이 살짝 앞으로(+Z) 당겨짐
 *  - selected: 책이 앞으로 빠져나와 위로 올라오고, Y축 -90° 회전하여 앞표지(+X)를 카메라로 향함
 *
 * @param {[number,number,number]} position - 책 중심 위치(선반에 꽂힌 기본 위치)
 * @param {[number,number,number]} size - [thickness(책등폭), height(높이), depth(앞뒤 깊이)]
 * @param {string} spineColor - 책등 색상 (map 없을 때 fallback)
 * @param {string} coverColor - 표지 색상
 * @param {THREE.Texture} [spineMap] - 책등 텍스처
 * @param {THREE.Texture} [coverMap] - 표지 텍스처
 * @param {string} [pageColor] - 페이지 단면 색상
 * @param {boolean} [selected] - 선택 상태
 * @param {number} [rotationY] - 기본 Y축 회전(선반 방향 정렬용, 라디안)
 * @param {number} [pullDir] - 선택 시 빠져나오는 로컬 방향 부호(+1 또는 -1)
 * @param {number} [selectedDepthScale] - 선택 시 depth(로컬 Z) 추가 확대 배율
 * @param {number} [selectedScale] - 선택 시 전체 크기 확대 배율
 * @param {function} [onSelect] - 클릭 콜백
 */
export default function Book3D({
  position = [0, 0, 0],
  size = [0.22, 1.2, 0.85],
  spineColor = '#8a5a44',
  coverColor = '#c9a06a',
  spineMap = null,
  coverMap = null,
  pageColor = '#f2ead6',
  selected = false,
  rotationY = 0,
  rotation = null,
  pullDir = 1,
  selectedDepthScale = 2.6,
  selectedScale = 2.6,
  onSelect,
  onHover,
}) {
  // 기본 자세: rotation([x,y,z]) 우선, 없으면 rotationY만
  const [rx, ry, rz] = rotation || [0, rotationY, 0];
  const groupRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree((s) => s.invalidate);

  // demand 모드: hover/select 전환 시 애니메이션 루프를 킥오프 (이후 useFrame이 self-invalidate)
  useEffect(() => {
    invalidate();
  }, [hovered, selected, invalidate]);

  const materials = useMemo(() => {
    const spine = new THREE.MeshStandardMaterial({
      color: spineMap ? '#ffffff' : spineColor,
      map: spineMap || null,
      roughness: 0.7,
      metalness: 0.05,
    });
    const cover = new THREE.MeshStandardMaterial({
      color: coverMap ? '#ffffff' : coverColor,
      map: coverMap || null,
      roughness: 0.6,
      metalness: 0.05,
    });
    const pages = new THREE.MeshStandardMaterial({
      color: pageColor,
      roughness: 0.9,
      metalness: 0,
    });

    // [+X, -X, +Y, -Y, +Z, -Z]
    // +X: 앞표지, -X: 뒤표지, +Y/-Y: 페이지 위/아래, +Z: 책등, -Z: 페이지 뒤
    return [cover, cover, pages, pages, spine, pages];
  }, [spineColor, coverColor, spineMap, coverMap, pageColor]);

  // 책등(+Z 로컬)이 회전 적용 후 향하는 월드 방향 = 빠져나오는 방향
  const forward = useMemo(() => {
    const v = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(rx, ry, rz));
    return [v.x, v.y, v.z];
  }, [rx, ry, rz]);

  // 상태별 목표 변환값
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;

    // 빠져나오는 거리/상승/추가 회전
    let pull = 0;
    let lift = 0;
    let extraRotY = 0;

    if (selected) {
      pull = 1.6;
      lift = 0.35;
      extraRotY = (-Math.PI / 2) * pullDir; // 앞표지가 보이도록
    } else if (hovered) {
      pull = 0.25;
    }

    const targetX = position[0] + forward[0] * pull * pullDir;
    const targetY = position[1] + lift + forward[1] * pull * pullDir;
    const targetZ = position[2] + forward[2] * pull * pullDir;
    // 선택 시 전체 크기 확대 + depth(로컬 Z)는 추가로 더 두툼하게
    const targetScaleXY = selected ? selectedScale : 1;
    const targetScaleZ = selected ? selectedScale * selectedDepthScale : 1;

    // 프레임 독립적 damping
    const lambda = 8;
    g.position.x = THREE.MathUtils.damp(g.position.x, targetX, lambda, delta);
    g.position.y = THREE.MathUtils.damp(g.position.y, targetY, lambda, delta);
    g.position.z = THREE.MathUtils.damp(g.position.z, targetZ, lambda, delta);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, rx, lambda, delta);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, ry + extraRotY, lambda, delta);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, rz, lambda, delta);
    g.scale.x = THREE.MathUtils.damp(g.scale.x, targetScaleXY, lambda, delta);
    g.scale.y = THREE.MathUtils.damp(g.scale.y, targetScaleXY, lambda, delta);
    g.scale.z = THREE.MathUtils.damp(g.scale.z, targetScaleZ, lambda, delta);

    // frameloop="demand" 모드: 아직 목표에 도달하지 않았으면 다음 프레임을 요청.
    // 정지 상태에서는 렌더를 멈춰 유휴 시 GPU/CPU 사용량을 0으로 유지한다.
    const eps = 0.0006;
    const settled =
      Math.abs(g.position.x - targetX) < eps &&
      Math.abs(g.position.y - targetY) < eps &&
      Math.abs(g.position.z - targetZ) < eps &&
      Math.abs(g.rotation.y - (ry + extraRotY)) < eps &&
      Math.abs(g.scale.x - targetScaleXY) < eps &&
      Math.abs(g.scale.z - targetScaleZ) < eps;
    if (!settled) state.invalidate();
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[rx, ry, rz]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover?.(true);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover?.(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      <mesh castShadow receiveShadow material={materials}>
        <boxGeometry args={size} />
      </mesh>

      {/* 넓은 투명 히트박스: 얇은 책도 hover/클릭이 잘 잡히도록 */}
      <mesh>
        <boxGeometry args={[Math.max(size[0] * 3, 0.5), size[1] * 1.1, Math.max(size[2] * 1.3, 0.5)]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group >
  );
}
