import { useFrame } from '@react-three/fiber';
import { MutableRefObject, memo, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BALL_RADIUS, GameSnapshot } from '../../types';
import { AudioManager } from '../../utils/AudioManager';
import { createBallGeometry, createBallMaterial } from './materials';

interface BallProps {
  latestRef: MutableRefObject<GameSnapshot | null>;
}

export const Ball = memo(function Ball({ latestRef }: BallProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => createBallGeometry(), []);
  const material = useMemo(() => createBallMaterial(), []);
  const targetPos = useRef(new THREE.Vector3(0, BALL_RADIUS, 0));
  const targetVel = useRef(new THREE.Vector3(0, 0, 0));
  const lastTickRef = useRef<number>(-1);

  // Trail
  const trailRef = useRef<THREE.Points>(null);
  const trailPositions = useRef(new Float32Array(30 * 3)); // 30 trail points
  const trailIndex = useRef(0);
  const trailGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(30 * 3), 3)
    );
    return geo;
  }, []);

  useFrame((_, delta) => {
    const snapshot = latestRef.current;
    if (!snapshot || !meshRef.current) return;

    const isNewTick = snapshot.tick !== lastTickRef.current;
    if (isNewTick) {
      // Check for abrupt velocity change (kick or bounce)
      if (lastTickRef.current !== -1) {
        const dvx = snapshot.ball.velocity.x - targetVel.current.x;
        const dvz = snapshot.ball.velocity.z - targetVel.current.z;
        const deltaVMagSq = dvx * dvx + dvz * dvz;

        if (deltaVMagSq > 50) {
          const newMagSq =
            snapshot.ball.velocity.x ** 2 + snapshot.ball.velocity.z ** 2;
          const prevMagSq = targetVel.current.x ** 2 + targetVel.current.z ** 2;
          const intensity = Math.min(1, Math.sqrt(newMagSq) / 40);

          if (newMagSq > prevMagSq + 20) {
            AudioManager.playKick(intensity);
          } else {
            AudioManager.playBounce(intensity);
          }
        }
      }

      lastTickRef.current = snapshot.tick;

      // Authoritative update
      targetPos.current.set(
        snapshot.ball.position.x,
        snapshot.ball.position.y,
        snapshot.ball.position.z
      );
      targetVel.current.set(
        snapshot.ball.velocity.x,
        snapshot.ball.velocity.y,
        snapshot.ball.velocity.z
      );
    } else {
      // Extrapolate
      targetPos.current.addScaledVector(targetVel.current, delta);
    }

    // Tightly lerp mesh to target
    meshRef.current.position.lerp(targetPos.current, Math.min(1, delta * 25));

    // Rotate ball based on velocity
    const vx = snapshot.ball.velocity.x;
    const vz = snapshot.ball.velocity.z;
    const speed = Math.sqrt(vx * vx + vz * vz);
    meshRef.current.rotation.x += vz * delta * 0.5;
    meshRef.current.rotation.z -= vx * delta * 0.5;

    // Update trail
    if (speed > 2 && trailRef.current) {
      const pos = trailPositions.current;
      const idx = (trailIndex.current % 30) * 3;
      pos[idx] = meshRef.current.position.x;
      pos[idx + 1] = meshRef.current.position.y;
      pos[idx + 2] = meshRef.current.position.z;
      trailIndex.current++;

      const attr = trailGeo.getAttribute('position') as THREE.BufferAttribute;
      attr.array = pos;
      attr.needsUpdate = true;
    }
  });

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        castShadow
        position={[0, BALL_RADIUS, 0]}
      />
      <points ref={trailRef} geometry={trailGeo}>
        <pointsMaterial
          color={0xffffff}
          size={0.3}
          transparent
          opacity={0.3}
          sizeAttenuation
        />
      </points>
    </>
  );
});
