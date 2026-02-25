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

  if (id === 'e1b2c3d4-0000-4000-8000-000000000001') {
    // Aura Saturn Rings ID
    const auraColor = team === 'blue' ? '#00f2ff' : '#ff3300';
    const accentColor = team === 'blue' ? '#ff00ea' : '#ffaa00';

    return (
      <group ref={groupRef}>
        <mesh ref={ring1Ref}>
          <torusGeometry args={[1.5, 0.05, 16, 64]} />
          <meshStandardMaterial
            color={auraColor}
            emissive={auraColor}
            emissiveIntensity={2}
            transparent
            opacity={0.6}
          />
        </mesh>
        <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.7, 0.03, 12, 48]} />
          <meshStandardMaterial
            color={accentColor}
            emissive={accentColor}
            emissiveIntensity={1.5}
            transparent
            opacity={0.4}
          />
        </mesh>
      </group>
    );
  }

  return null;
});
