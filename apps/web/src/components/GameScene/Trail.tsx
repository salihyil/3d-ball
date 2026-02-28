import { Trail as DreiTrail } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, useRef } from 'react';

import * as THREE from 'three';

interface TrailProps {
  id: string;
  team: 'red' | 'blue';
  target?: React.RefObject<THREE.Group | null>;
}

export const Trail = memo(({ id, team, target }: TrailProps) => {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const colorObj = useRef(new THREE.Color());
  // Trail IDs mapping
  const isNeonTrail = id === 'e1b2c3d4-0000-4000-8000-000000000003';
  const isFireTrail =
    id === '79d89ffc-987c-4d4c-bce7-30ae1d655527' ||
    id === '368c87e5-f3ca-4266-9832-d4469da4bdb3';

  // Rainbow Trail ID: e0b1c2d3-e4f5-478a-9bcf-1a2b3c4d5e6f
  const isRainbowTrail = id === 'e0b1c2d3-e4f5-478a-9bcf-1a2b3c4d5e6f';

  // Emerald Trail ID: f1c2d3e4-f5a6-489a-b0c1-d2e3f4a5b6c7
  const isEmeraldTrail = id === 'f1c2d3e4-f5a6-489a-b0c1-d2e3f4a5b6c7';

  useFrame((state) => {
    if (isRainbowTrail && materialRef.current) {
      const t = state.clock.getElapsedTime();
      const hue = (t * 0.2) % 1; // Slower, smoother cycle
      colorObj.current.setHSL(hue, 1, 0.5);
      materialRef.current.color.copy(colorObj.current);
      materialRef.current.emissive.copy(colorObj.current);
    }
  });

  if (!isNeonTrail && !isFireTrail && !isRainbowTrail && !isEmeraldTrail)
    return null;

  const color = isFireTrail
    ? '#ff4400'
    : isEmeraldTrail
      ? '#00ff66'
      : team === 'blue'
        ? '#00f2ff'
        : '#ff3300';

  const width = isFireTrail || isRainbowTrail ? 2 : 1;
  const length = isFireTrail ? 8 : isRainbowTrail ? 10 : 5;

  return (
    <DreiTrail
      width={width}
      length={length}
      color={color}
      attenuation={(t) => t * t}
      target={target as unknown as React.RefObject<THREE.Object3D>}
    >
      <meshStandardMaterial
        ref={materialRef}
        emissive={color}
        emissiveIntensity={2}
      />
    </DreiTrail>
  );
});
