import { memo, useMemo } from 'react';
import { createWallMaterial } from '../materials';

interface WallsProps {
  halfW: number;
  halfH: number;
  goalHalf: number;
}

export const Walls = memo(function Walls({
  halfW,
  halfH,
  goalHalf,
}: WallsProps) {
  const material = useMemo(() => createWallMaterial(), []);

  return (
    <group>
      <mesh position={[0, 1, -halfH - 0.5]} material={material}>
        <boxGeometry args={[halfW * 2 + 2, 2, 1]} />
      </mesh>
      <mesh position={[0, 1, halfH + 0.5]} material={material}>
        <boxGeometry args={[halfW * 2 + 2, 2, 1]} />
      </mesh>
      <mesh
        position={[-halfW - 0.5, 1, -(halfH + goalHalf) / 2]}
        material={material}
      >
        <boxGeometry args={[1, 2, halfH - goalHalf]} />
      </mesh>
      <mesh
        position={[-halfW - 0.5, 1, (halfH + goalHalf) / 2]}
        material={material}
      >
        <boxGeometry args={[1, 2, halfH - goalHalf]} />
      </mesh>
      <mesh
        position={[halfW + 0.5, 1, -(halfH + goalHalf) / 2]}
        material={material}
      >
        <boxGeometry args={[1, 2, halfH - goalHalf]} />
      </mesh>
      <mesh
        position={[halfW + 0.5, 1, (halfH + goalHalf) / 2]}
        material={material}
      >
        <boxGeometry args={[1, 2, halfH - goalHalf]} />
      </mesh>
    </group>
  );
});
