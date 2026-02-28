import { useFrame } from '@react-three/fiber';
import { memo, useRef } from 'react';
import * as THREE from 'three';

interface AuraProps {
  id: string;
  team: 'red' | 'blue';
}

export const Aura = memo(({ id, team }: AuraProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = t * 1.5;
      ring1Ref.current.rotation.y = t * 0.8;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = t * 1.2;
      ring2Ref.current.rotation.y = -t * 0.5;
    }
  });

  // Electric Aura ID: a2d3e4f5-6a7b-49ac-b1d2-e3f4a5b6c7d8
  const isElectricAura = id === 'a2d3e4f5-6a7b-49ac-b1d2-e3f4a5b6c7d8';

  // Void Aura ID: b3e4f5a6-7b8c-40ad-b1e2-f3a4b5c6d7e8
  const isVoidAura = id === 'b3e4f5a6-7b8c-40ad-b1e2-f3a4b5c6d7e8';

  if (
    id === 'e1b2c3d4-0000-4000-8000-000000000001' ||
    isElectricAura ||
    isVoidAura
  ) {
    // Aura Saturn Rings ID or New Auras
    let auraColor = team === 'blue' ? '#00f2ff' : '#ff3300';
    let accentColor = team === 'blue' ? '#ff00ea' : '#ffaa00';
    let opacity1 = 0.6;
    const opacity2 = 0.4 + Math.sin(Date.now() * 0.002) * 0.1;

    if (isElectricAura) {
      auraColor = '#ffff00';
      accentColor = '#ffffff';
      opacity1 = 0.8;
    } else if (isVoidAura) {
      auraColor = '#220044';
      accentColor = '#000000';
      opacity1 = 0.9;
    }

    return (
      <group ref={groupRef}>
        <mesh ref={ring1Ref}>
          <torusGeometry args={[1.5, isElectricAura ? 0.08 : 0.05, 16, 64]} />
          <meshStandardMaterial
            color={auraColor}
            emissive={auraColor}
            emissiveIntensity={isElectricAura ? 4 : 2}
            transparent
            opacity={opacity1}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.7, 0.03, 12, 48]} />
          <meshStandardMaterial
            color={accentColor}
            emissive={accentColor}
            emissiveIntensity={isElectricAura ? 2 : 1}
            transparent
            opacity={opacity2}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  return null;
});
