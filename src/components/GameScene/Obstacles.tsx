import { useFrame } from '@react-three/fiber';
import { MutableRefObject, memo, useRef } from 'react';
import * as THREE from 'three';
import type { GameSnapshot } from '../../types';
import { FIELD_OBSTACLES } from '../../types';
import {
  obstacleMaterial,
  obstacleRingGeometry,
  obstacleRingMaterial,
} from './materials';

interface ObstaclesProps {
  latestRef: MutableRefObject<GameSnapshot | null>;
}

export const Obstacles = memo(function Obstacles({
  latestRef,
}: ObstaclesProps) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    const snapshot = latestRef.current;
    if (!snapshot || !snapshot.obstacles) return;

    snapshot.obstacles.forEach((obs, i) => {
      const group = groupRefs.current[i];
      if (group) {
        group.position.set(obs.position.x, 0, obs.position.z);
      }
    });
  });

  return (
    <group>
      {FIELD_OBSTACLES.map((obs, i) => (
        <group
          key={obs.id}
          ref={(r) => {
            groupRefs.current[i] = r;
          }}
          position={[obs.position.x, 0, obs.position.z]}
        >
          <mesh position={[0, obs.height / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[obs.radius, obs.radius, obs.height, 32]} />
            <primitive object={obstacleMaterial} attach="material" />
          </mesh>
          <mesh
            position={[0, 0.05, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            geometry={obstacleRingGeometry}
            material={obstacleRingMaterial}
            scale={[obs.radius + 0.2, obs.radius + 0.2, 1]}
          />
        </group>
      ))}
    </group>
  );
});
