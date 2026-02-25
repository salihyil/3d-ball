import { useFrame } from '@react-three/fiber';
import { MutableRefObject, memo, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GameSnapshot } from '@sasi/shared';
import { createPowerUpGeometry, createPowerUpMaterials } from './materials';

const MAX_POWERUPS = 5;

interface PowerUpPoolProps {
  latestRef: MutableRefObject<GameSnapshot | null>;
}

export const PowerUpPool = memo(function PowerUpPool({
  latestRef,
}: PowerUpPoolProps) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>(
    Array(MAX_POWERUPS).fill(null)
  );

  // Memoize assets for this context
  const geo = useMemo(() => createPowerUpGeometry(), []);
  const mats = useMemo(() => createPowerUpMaterials(), []);

  useFrame((state) => {
    const snapshot = latestRef.current;
    if (!snapshot || !snapshot.powerUps) return;

    const items = snapshot.powerUps;
    const time = state.clock.getElapsedTime();

    for (let i = 0; i < MAX_POWERUPS; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      if (i < items.length) {
        mesh.visible = true;
        mesh.position.set(
          items[i].position.x,
          items[i].position.y + Math.sin(time * 3 + i) * 0.5,
          items[i].position.z
        );
        mesh.rotation.x = time + i;
        mesh.rotation.y = time + i;
        mesh.material = mats[items[i].type as keyof typeof mats];
      } else {
        mesh.visible = false;
      }
    }
  });

  return (
    <>
      {Array.from({ length: MAX_POWERUPS }, (_, i) => (
        <mesh
          key={i}
          ref={(r) => {
            meshRefs.current[i] = r;
          }}
          geometry={geo}
          castShadow
          visible={false}
        />
      ))}
    </>
  );
});
