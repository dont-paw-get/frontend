import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
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
 * 상호작용 (CLIAR-243: 인식 고도화 — hover 밀림을 줄이고 테두리 glow로 대체):
 *  - hover: 아주 살짝만 앞으로(+Z) 당겨지고(0.05, 예전 0.25), 테두리에 accent色 glow가 페이드인.
 *    예전엔 hover 시 책이 크게 밀려나 옆 책을 가리고, 그 밀림이 옆 책의 히트박스까지
 *    침범해 "이 책은 잘 잡히고 저 책은 안 잡히는" 인식 불균형을 만들었다.
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
 * @param {string} [glowColor] - hover/selected 시 테두리 glow 색상 (사서/테마 accent 색)
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
  glowColor = '#ff9a3c',
  onSelect,
  onHover,
}) {
  // 기본 자세: rotation([x,y,z]) 우선, 없으면 rotationY만
  const [rx, ry, rz] = rotation || [0, rotationY, 0];
  const groupRef = useRef(null);
  // 테두리 glow(핵심선 + 은은한 halo) 머티리얼 참조 — useFrame에서 opacity를 댐핑
  const edgeCoreRef = useRef(null);
  const edgeHaloRef = useRef(null);
  const [hovered, setHovered] = useState(false);

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
  useFrame((_, delta) => {
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
      // CLIAR-243: 옆 책을 가리지 않도록 밀림을 최소화(예전 0.25 → 0.05).
      // 선택 가능 여부는 아래 테두리 glow(Edges)로 표시한다.
      pull = 0.05;
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

    // 테두리 glow — hover/selected일 때 은은하게 페이드인 (CLIAR-243)
    // Edges의 ref는 Line2 메시를 가리키므로 실제 투명도는 .material.opacity에 있다.
    const glowOn = hovered || selected;
    const targetCore = glowOn ? 0.9 : 0;
    const targetHalo = glowOn ? 0.35 : 0;
    const coreMat = edgeCoreRef.current?.material;
    const haloMat = edgeHaloRef.current?.material;
    if (coreMat) {
      coreMat.opacity = THREE.MathUtils.damp(coreMat.opacity, targetCore, 10, delta);
    }
    if (haloMat) {
      haloMat.opacity = THREE.MathUtils.damp(haloMat.opacity, targetHalo, 10, delta);
    }
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
        {/*
         * 테두리 glow (CLIAR-243): 버튼 active 표시처럼 hover/선택된 책의 윤곽만 밝힌다.
         * 핵심선(core) + 살짝 더 두꺼운 halo 두 겹으로 은은한 발광 느낌을 낸다.
         * ref는 Edges가 만드는 Line2 메시를 가리키므로, opacity는 .material.opacity로 댐핑한다.
         * 초기 opacity 0이라 평소엔 보이지 않는다.
         */}
        <Edges
          ref={edgeCoreRef}
          scale={1.001}
          color={glowColor}
          lineWidth={2.5}
          transparent
          opacity={0}
          depthTest={false}
          toneMapped={false}
          raycast={() => null}
        />
        <Edges
          ref={edgeHaloRef}
          scale={1.03}
          color={glowColor}
          lineWidth={6}
          transparent
          opacity={0}
          depthTest={false}
          toneMapped={false}
          raycast={() => null}
        />
      </mesh>

      {/*
       * 넓은 투명 히트박스: 얇은 책도 hover/클릭이 잘 잡히도록.
       * CLIAR-243: 고정 최소값(0.5)이 책 사이 간격(0.02)보다 훨씬 커서 옆 책과
       * 히트박스가 크게 겹쳐, 어떤 책은 잘 잡히고 어떤 책은 안 잡히는 원인이었다.
       * 실제 두께에 비례한 여유(최대 +0.06)만 주어 이웃 책을 침범하지 않게 한다.
       */}
      <mesh>
        <boxGeometry args={[size[0] + Math.min(size[0] * 0.6, 0.06), size[1] * 1.1, size[2] * 1.15]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group >
  );
}
