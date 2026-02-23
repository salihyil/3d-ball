import { useFrame } from '@react-three/fiber';
import { memo, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Team } from '../../types';
import { FIELD_WIDTH } from '../../types';

interface GoalExplosionProps {
  type: string; // 'Neon Shockwave' | 'Fireworks Burst' | 'Void Portal'
  team: Team;
  onComplete: () => void;
}

// ---- Shared Constants ----
const GOAL_X = FIELD_WIDTH / 2; // Goal mouth is at field edge
const GOAL_Y = 2; // Center height
const DURATION = 2.5; // seconds

// ---- Particle count per effect ----
const PARTICLE_COUNT = 80;

/**
 * GoalExplosion — renders animated 3D particles at the goal mouth
 * when a goal is scored by a player who has an equipped goal_explosion.
 * Auto-removes after DURATION seconds via onComplete callback.
 */
export const GoalExplosion = memo(function GoalExplosion({
  type,
  team,
  onComplete,
}: GoalExplosionProps) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const [completed, setCompleted] = useState(false);

  // Goal position: blue team scores on right (+X), red on left (-X)
  const goalX = team === 'blue' ? GOAL_X : -GOAL_X;

  // Pre-compute particle data for each effect type
  const particles = useMemo(() => {
    const arr: {
      offset: THREE.Vector3;
      velocity: THREE.Vector3;
      color: THREE.Color;
      scale: number;
    }[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = (i / PARTICLE_COUNT) * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      if (type === 'Neon Shockwave') {
        // Expanding ring of neon particles
        arr.push({
          offset: new THREE.Vector3(0, 0, 0),
          velocity: new THREE.Vector3(
            Math.cos(theta) * (3 + Math.random() * 2),
            Math.sin(phi) * 2 - 0.5,
            Math.sin(theta) * (3 + Math.random() * 2)
          ),
          color: new THREE.Color().setHSL(
            0.5 + Math.random() * 0.15, // Cyan-to-blue range
            1,
            0.6 + Math.random() * 0.3
          ),
          scale: 0.08 + Math.random() * 0.12,
        });
      } else if (type === 'Fireworks Burst') {
        // Upward shooting sparks
        arr.push({
          offset: new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            0,
            (Math.random() - 0.5) * 2
          ),
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            3 + Math.random() * 5, // Strong upward
            (Math.random() - 0.5) * 4
          ),
          color: new THREE.Color().setHSL(
            Math.random() * 0.12, // Warm: red-orange-yellow
            1,
            0.5 + Math.random() * 0.4
          ),
          scale: 0.06 + Math.random() * 0.1,
        });
      } else {
        // Void Portal — imploding dark sphere
        const radius = 4 + Math.random() * 3;
        arr.push({
          offset: new THREE.Vector3(
            Math.cos(theta) * Math.sin(phi) * radius,
            Math.cos(phi) * radius,
            Math.sin(theta) * Math.sin(phi) * radius
          ),
          velocity: new THREE.Vector3(
            -Math.cos(theta) * Math.sin(phi) * 2,
            -Math.cos(phi) * 2,
            -Math.sin(theta) * Math.sin(phi) * 2
          ),
          color: new THREE.Color().setHSL(
            0.75 + Math.random() * 0.1, // Purple range
            0.8,
            0.15 + Math.random() * 0.25
          ),
          scale: 0.1 + Math.random() * 0.15,
        });
      }
    }
    return arr;
  }, [type]);

  // Materials — cached per effect
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  const geometry = useMemo(() => {
    return new THREE.SphereGeometry(1, 6, 6);
  }, []);

  useFrame((_, delta) => {
    if (completed) return;
    elapsed.current += delta;
    const t = elapsed.current / DURATION;

    if (t >= 1) {
      setCompleted(true);
      onComplete();
      return;
    }

    const group = groupRef.current;
    if (!group) return;

    // Fade out in last 30% of duration
    const fadeOut = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;

    group.children.forEach((mesh, i) => {
      const p = particles[i];
      if (!p) return;

      const m = mesh as THREE.Mesh;

      // Position: offset + velocity * time
      m.position.set(
        p.offset.x + p.velocity.x * elapsed.current,
        p.offset.y + p.velocity.y * elapsed.current,
        p.offset.z + p.velocity.z * elapsed.current
      );

      // Gravity for fireworks
      if (type === 'Fireworks Burst') {
        m.position.y -= 4.9 * elapsed.current * elapsed.current; // Half gravity
      }

      // Scale pulse
      const scalePulse =
        type === 'Void Portal' ? 1 - t * 0.8 : 1 + Math.sin(t * Math.PI) * 0.5;
      m.scale.setScalar(p.scale * scalePulse);

      // Material
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.copy(p.color);
      mat.opacity = fadeOut * (0.6 + Math.random() * 0.4);
    });
  });

  if (completed) return null;

  return (
    <group ref={groupRef} position={[goalX, GOAL_Y, 0]}>
      {particles.map((_, i) => (
        <mesh key={i} geometry={geometry} material={material.clone()}>
          <meshBasicMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
});
