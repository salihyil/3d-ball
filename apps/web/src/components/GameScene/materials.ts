import { BALL_RADIUS, PLAYER_RADIUS } from '@sasi/shared';
import * as THREE from 'three';

// ---- Colors ----
export const BLUE_COLOR = new THREE.Color(0x3b82f6);
export const RED_COLOR = new THREE.Color(0xef4444);
export const BALL_COLOR = new THREE.Color(0xffffff);
export const FIELD_COLOR = new THREE.Color(0x1a5c2a);
export const FIELD_LINE_COLOR = new THREE.Color(0x2a8c44);
export const GOAL_BLUE_COLOR = new THREE.Color(0x1e3a5f);
export const GOAL_RED_COLOR = new THREE.Color(0x5f1e1e);

// ---- Factory Functions for Context Safety ----

export const createPlayerGeometry = () =>
  new THREE.SphereGeometry(PLAYER_RADIUS, 24, 16);
export const createBallGeometry = () =>
  new THREE.SphereGeometry(BALL_RADIUS, 32, 20);
export const createPowerUpGeometry = () => new THREE.BoxGeometry(2, 2, 2);
export const createAuraGeometry = () =>
  new THREE.TorusGeometry(PLAYER_RADIUS * 1.5, 0.2, 8, 24);
export const createBoostPadGeometry = () =>
  new THREE.CylinderGeometry(1, 1, 0.2, 32);
export const createShieldGeometry = () =>
  new THREE.SphereGeometry(PLAYER_RADIUS * 1.3, 32, 32);
export const createGoalNetGeometry = () => new THREE.PlaneGeometry(0.1, 3);
export const createObstacleRingGeometry = () =>
  new THREE.RingGeometry(1, 1.3, 32);
export const createBoostPadRingGeometry = () =>
  new THREE.RingGeometry(0.5, 0.8, 16);

export const createBlueMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: BLUE_COLOR,
    emissive: BLUE_COLOR,
    emissiveIntensity: 0.3,
    roughness: 0.3,
    metalness: 0.2,
  });

export const createRedMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: RED_COLOR,
    emissive: RED_COLOR,
    emissiveIntensity: 0.3,
    roughness: 0.3,
    metalness: 0.2,
  });

export const createBallMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: BALL_COLOR,
    roughness: 0.2,
    metalness: 0.1,
    emissive: new THREE.Color(0x333333),
    emissiveIntensity: 0.2,
  });

export const createPowerUpMaterials = () => ({
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
  gravity: new THREE.MeshStandardMaterial({
    color: 0x4b0082,
    emissive: 0x4b0082,
    emissiveIntensity: 0.8,
  }),
  speed: new THREE.MeshStandardMaterial({
    color: 0x39ff14,
    emissive: 0x39ff14,
    emissiveIntensity: 0.8,
  }),
  ghost: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xd1d1d1,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.4,
  }),
  shockwave: new THREE.MeshStandardMaterial({
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 1.0,
  }),
});

export const createObstacleMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.7,
    metalness: 0.5,
    emissive: new THREE.Color(0x111111),
    emissiveIntensity: 0.5,
  });

export const createBoostPadActiveMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: 0xffff00,
    emissive: 0xffaa00,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.8,
  });

export const createBoostPadInactiveMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: 0x444400,
    emissive: 0x000000,
    transparent: true,
    opacity: 0.3,
  });

export const createWallMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: 0x2a2a3a,
    transparent: true,
    opacity: 0.5,
  });

export const createObstacleRingMaterial = () =>
  new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });

export const createBoostPadRingMaterial = () =>
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });

export const createGoalNetMaterial = () =>
  new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });

export const createGoalBlueMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: GOAL_BLUE_COLOR,
    emissive: BLUE_COLOR,
    emissiveIntensity: 0.1,
  });

export const createGoalRedMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: GOAL_RED_COLOR,
    emissive: RED_COLOR,
    emissiveIntensity: 0.1,
  });

export const createFieldLineMaterial = () =>
  new THREE.MeshBasicMaterial({
    color: FIELD_LINE_COLOR,
    side: THREE.DoubleSide,
  });

export const createAcidMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: 0xccff00, // Neon Lime
    emissive: 0x33ff00,
    emissiveIntensity: 1.0,
    metalness: 0.9,
    roughness: 0.1,
  });
