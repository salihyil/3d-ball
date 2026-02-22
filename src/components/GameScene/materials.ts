import * as THREE from 'three';
import { BALL_RADIUS, PLAYER_RADIUS } from '../../types';

// ---- Colors ----
export const BLUE_COLOR = new THREE.Color(0x3b82f6);
export const RED_COLOR = new THREE.Color(0xef4444);
export const BALL_COLOR = new THREE.Color(0xffffff);
export const FIELD_COLOR = new THREE.Color(0x1a5c2a);
export const FIELD_LINE_COLOR = new THREE.Color(0x2a8c44);
export const GOAL_BLUE_COLOR = new THREE.Color(0x1e3a5f);
export const GOAL_RED_COLOR = new THREE.Color(0x5f1e1e);

// ---- Geometries ----
export const playerGeometry = new THREE.SphereGeometry(PLAYER_RADIUS, 24, 16);
export const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 20);
export const powerUpGeometry = new THREE.BoxGeometry(2, 2, 2);
export const auraGeometry = new THREE.TorusGeometry(
  PLAYER_RADIUS * 1.5,
  0.2,
  8,
  24
);
export const boostPadGeometry = new THREE.CylinderGeometry(1, 1, 0.2, 32);

// ---- Materials ----
export const blueMaterial = new THREE.MeshStandardMaterial({
  color: BLUE_COLOR,
  emissive: BLUE_COLOR,
  emissiveIntensity: 0.3,
  roughness: 0.3,
  metalness: 0.2,
});

export const redMaterial = new THREE.MeshStandardMaterial({
  color: RED_COLOR,
  emissive: RED_COLOR,
  emissiveIntensity: 0.3,
  roughness: 0.3,
  metalness: 0.2,
});

export const ballMaterial = new THREE.MeshStandardMaterial({
  color: BALL_COLOR,
  roughness: 0.2,
  metalness: 0.1,
  emissive: new THREE.Color(0x333333),
  emissiveIntensity: 0.2,
});

export const powerUpMaterials = {
  magnet: new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0xa855f7,
    emissiveIntensity: 0.5,
  }),
  freeze: new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.5,
  }),
  rocket: new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xf97316,
    emissiveIntensity: 0.5,
  }),
  frozen: new THREE.MeshStandardMaterial({
    color: 0x87ceeb,
    emissive: 0x87ceeb,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.5,
  }),
} as Record<string, THREE.Material>;

export const obstacleMaterial = new THREE.MeshStandardMaterial({
  color: 0x222222,
  roughness: 0.7,
  metalness: 0.5,
  emissive: new THREE.Color(0x111111),
  emissiveIntensity: 0.5,
});

export const boostPadActiveMaterial = new THREE.MeshStandardMaterial({
  color: 0xffff00,
  emissive: 0xffaa00,
  emissiveIntensity: 1.5,
  transparent: true,
  opacity: 0.8,
});

export const boostPadInactiveMaterial = new THREE.MeshStandardMaterial({
  color: 0x444400,
  emissive: 0x000000,
  transparent: true,
  opacity: 0.3,
});

export const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x2a2a3a,
  transparent: true,
  opacity: 0.5,
});

export const obstacleRingMaterial = new THREE.MeshBasicMaterial({
  color: 0xffaa00,
  transparent: true,
  opacity: 0.5,
  side: THREE.DoubleSide,
});

export const boostPadRingMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.3,
  side: THREE.DoubleSide,
});

export const goalNetMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0.15,
  side: THREE.DoubleSide,
});

export const goalBlueMaterial = new THREE.MeshStandardMaterial({
  color: GOAL_BLUE_COLOR,
  emissive: BLUE_COLOR,
  emissiveIntensity: 0.1,
});

export const goalRedMaterial = new THREE.MeshStandardMaterial({
  color: GOAL_RED_COLOR,
  emissive: RED_COLOR,
  emissiveIntensity: 0.1,
});

export const fieldLineMaterial = new THREE.MeshBasicMaterial({
  color: FIELD_LINE_COLOR,
  side: THREE.DoubleSide,
});

// Common Geometries
export const shieldGeometry = new THREE.SphereGeometry(
  PLAYER_RADIUS * 1.3,
  32,
  32
);
export const goalNetGeometry = new THREE.PlaneGeometry(0.1, 3);
export const obstacleRingGeometry = new THREE.RingGeometry(1, 1.3, 32); // Scaled per usage
export const boostPadRingGeometry = new THREE.RingGeometry(0.5, 0.8, 16); // Scaled per usage
