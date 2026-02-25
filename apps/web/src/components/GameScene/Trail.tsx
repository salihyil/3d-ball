import { Trail as DreiTrail } from '@react-three/drei';
import { memo } from 'react';

import * as THREE from 'three';

interface TrailProps {
  id: string;
  team: 'red' | 'blue';
  target?: React.RefObject<THREE.Group | null>;
}

export const Trail = memo(({ id, team, target }: TrailProps) => {
  // Trail IDs mapping (these should match the database/types)
  const isNeonTrail = id === 'e1b2c3d4-0000-4000-8000-000000000003';
  const isFireTrail =
    id === '79d89ffc-987c-4d4c-bce7-30ae1d655527' ||
    id === '368c87e5-f3ca-4266-9832-d4469da4bdb3';

  if (!isNeonTrail && !isFireTrail) return null;

  const color = isFireTrail
    ? '#ff4400'
    : team === 'blue'
      ? '#00f2ff'
      : '#ff3300';

  const width = isFireTrail ? 2 : 1;
  const length = isFireTrail ? 8 : 5;

  return (
    <DreiTrail
      width={width}
      length={length}
      color={color}
      attenuation={(t) => t * t}
      target={target as unknown as React.RefObject<THREE.Object3D>}
    >
      {/* The trail attaches to its parent's movement */}
    </DreiTrail>
  );
});
