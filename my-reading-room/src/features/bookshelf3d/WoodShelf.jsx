/**
 * WoodShelf — 3D 나무 책장 프레임 (측판 + 뒤판 + 선반 널판)
 *
 * @param {number} width - 선반 내부 폭
 * @param {number} depth - 선반 깊이
 * @param {number[]} tierBaseY - 각 tier에서 책이 놓이는 바닥면 Y 좌표 배열 (아래→위 무관, 값 그대로 사용)
 * @param {number} topY - 책장 맨 위 천장판 Y
 * @param {string} color - 목재 색상
 */
export default function WoodShelf({
  width = 7,
  depth = 1,
  tierBaseY = [0, 1.5, 3],
  topY = 4.3,
  color = '#5b3a29',
}) {
  const plankThickness = 0.08;
  const sideThickness = 0.12;
  const backThickness = 0.06;

  const minY = Math.min(...tierBaseY) - plankThickness;
  const maxY = topY;
  const totalHeight = maxY - minY;
  const centerY = (maxY + minY) / 2;

  const outerWidth = width + sideThickness * 2;

  const woodProps = {
    roughness: 0.75,
    metalness: 0.05,
  };

  return (
    <group>
      {/* 좌측판 */}
      <mesh position={[-(width / 2 + sideThickness / 2), centerY, 0]} castShadow receiveShadow>
        <boxGeometry args={[sideThickness, totalHeight, depth]} />
        <meshStandardMaterial color={color} {...woodProps} />
      </mesh>

      {/* 우측판 */}
      <mesh position={[width / 2 + sideThickness / 2, centerY, 0]} castShadow receiveShadow>
        <boxGeometry args={[sideThickness, totalHeight, depth]} />
        <meshStandardMaterial color={color} {...woodProps} />
      </mesh>

      {/* 뒤판 */}
      <mesh position={[0, centerY, -(depth / 2 - backThickness / 2)]} receiveShadow>
        <boxGeometry args={[outerWidth, totalHeight, backThickness]} />
        <meshStandardMaterial color={'#4a2f21'} {...woodProps} />
      </mesh>

      {/* 각 tier 바닥 널판 */}
      {tierBaseY.map((y, i) => (
        <mesh key={i} position={[0, y - plankThickness / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[outerWidth, plankThickness, depth]} />
          <meshStandardMaterial color={color} {...woodProps} />
        </mesh>
      ))}

      {/* 천장판 */}
      <mesh position={[0, topY, 0]} castShadow receiveShadow>
        <boxGeometry args={[outerWidth, plankThickness, depth]} />
        <meshStandardMaterial color={color} {...woodProps} />
      </mesh>
    </group>
  );
}
