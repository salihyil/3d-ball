import { useFrame } from '@react-three/fiber';
import { MutableRefObject, memo, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GameSnapshot } from '../../types';
import { FIELD_BOOST_PADS } from '../../types';
import {
  createBoostPadActiveMaterial,
  createBoostPadGeometry,
  createBoostPadInactiveMaterial,
  createBoostPadRingGeometry,
  createBoostPadRingMaterial,
} from './materials';

interface BoostPadsProps {
  latestRef: MutableRefObject<GameSnapshot | null>;
}

export const BoostPads = memo(function BoostPads({
  latestRef,
}: BoostPadsProps) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>(
    Array(FIELD_BOOST_PADS.length).fill(null)
  );
  const lastTickRef = useRef<number>(-1);
  const padStateMapRef = useRef<Map<string, boolean>>(new Map());

  // Memoize assets for this context
  const activeMat = useMemo(() => createBoostPadActiveMaterial(), []);
  const inactiveMat = useMemo(() => createBoostPadInactiveMaterial(), []);
  const geo = useMemo(() => createBoostPadGeometry(), []);
  const ringGeo = useMemo(() => createBoostPadRingGeometry(), []);
  const ringMat = useMemo(() => createBoostPadRingMaterial(), []);

  useFrame((state, delta) => {
    const snapshot = latestRef.current;
    if (!snapshot || !snapshot.boostPads) return;

    if (snapshot.tick !== lastTickRef.current) {
      lastTickRef.current = snapshot.tick;
      padStateMapRef.current.clear();
      snapshot.boostPads.forEach((p) => {
        padStateMapRef.current.set(p.id, p.active);
      });
    }

    const padStateMap = padStateMapRef.current;

    for (let i = 0; i < FIELD_BOOST_PADS.length; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      const isActive = padStateMap.has(FIELD_BOOST_PADS[i].id)
        ? padStateMap.get(FIELD_BOOST_PADS[i].id)
        : true;

      if (isActive) {
        mesh.material = activeMat;
        mesh.rotation.y += delta * 2;
      } else {
        mesh.material = inactiveMat;
      }
    }
  });

  return (
    <group>
      {FIELD_BOOST_PADS.map((pad, i) => (
        <group key={pad.id} position={[pad.position.x, 0.1, pad.position.z]}>
          <mesh
            ref={(r) => {
              meshRefs.current[i] = r;
            }}
            geometry={geo}
            scale={[pad.radius, 1, pad.radius]}
            receiveShadow
            material={activeMat}
          />
          <mesh
            position={[0, 0.11, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            geometry={ringGeo}
            material={ringMat}
            scale={[pad.radius, pad.radius, 1]}
          />
        </group>
      ))}
    </group>
  );
});
