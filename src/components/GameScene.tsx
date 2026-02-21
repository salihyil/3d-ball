import { Text, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  MutableRefObject,
  Suspense,
  memo,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import * as THREE from 'three';
import { socket } from '../hooks/useNetwork';
import type { GameSnapshot, PlayerState } from '../types';
import {
  BALL_RADIUS,
  FIELD_BOOST_PADS,
  FIELD_HEIGHT,
  FIELD_OBSTACLES,
  FIELD_WIDTH,
  GOAL_DEPTH,
  GOAL_WIDTH,
  PLAYER_RADIUS,
} from '../types';
import { AudioManager } from '../utils/AudioManager';

interface GameSceneProps {
  latestRef: MutableRefObject<GameSnapshot | null>;
  room: import('../types').RoomInfo | null;
  pitchTextureUrl?: string;
}

// ---- Colors ----
const BLUE_COLOR = new THREE.Color(0x3b82f6);
const RED_COLOR = new THREE.Color(0xef4444);
const BALL_COLOR = new THREE.Color(0xffffff);
const FIELD_COLOR = new THREE.Color(0x1a5c2a);
const FIELD_LINE_COLOR = new THREE.Color(0x2a8c44);
const GOAL_BLUE_COLOR = new THREE.Color(0x1e3a5f);
const GOAL_RED_COLOR = new THREE.Color(0x5f1e1e);

// ---- Shared Geometries & Materials (pooled) ----
const playerGeometry = new THREE.SphereGeometry(PLAYER_RADIUS, 24, 16);
const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 20);

const blueMaterial = new THREE.MeshStandardMaterial({
  color: BLUE_COLOR,
  emissive: BLUE_COLOR,
  emissiveIntensity: 0.3,
  roughness: 0.3,
  metalness: 0.2,
});

const redMaterial = new THREE.MeshStandardMaterial({
  color: RED_COLOR,
  emissive: RED_COLOR,
  emissiveIntensity: 0.3,
  roughness: 0.3,
  metalness: 0.2,
});

const ballMaterial = new THREE.MeshStandardMaterial({
  color: BALL_COLOR,
  roughness: 0.2,
  metalness: 0.1,
  emissive: new THREE.Color(0x333333),
  emissiveIntensity: 0.2,
});

const powerUpGeometry = new THREE.BoxGeometry(2, 2, 2);
const powerUpMaterials = {
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

const auraGeometry = new THREE.TorusGeometry(PLAYER_RADIUS * 1.5, 0.2, 8, 24);

// ---- Player Mesh Pool ----
const MAX_POOL = 10;

function PlayerPool({
  latestRef,
  room,
  localPlayerPos,
}: {
  latestRef: MutableRefObject<GameSnapshot | null>;
  room: import('../types').RoomInfo | null;
  localPlayerPos: MutableRefObject<THREE.Vector3>;
}) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>(Array(MAX_POOL).fill(null));
  const nameRefs = useRef<(THREE.Group | null)[]>(Array(MAX_POOL).fill(null));
  // Minimal interface for Troika text from @react-three/drei
  const textRefs = useRef<{ text: string; sync?: () => void }[]>(
    Array(MAX_POOL).fill(null)
  );
  const auraRefs = useRef<(THREE.Mesh | null)[]>(Array(MAX_POOL).fill(null));

  const targetPositions = useRef<THREE.Vector3[]>(
    Array.from({ length: MAX_POOL }, () => new THREE.Vector3())
  );
  const targetVelocities = useRef<THREE.Vector3[]>(
    Array.from({ length: MAX_POOL }, () => new THREE.Vector3())
  );
  const lastTickRef = useRef<number>(-1);

  useFrame((state, delta) => {
    const snapshot = latestRef.current;
    if (!snapshot) return;

    const isNewTick = snapshot.tick !== lastTickRef.current;
    if (isNewTick) {
      lastTickRef.current = snapshot.tick;
    }

    const playerEntries = Object.entries(snapshot.players);

    for (let i = 0; i < MAX_POOL; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      if (i < playerEntries.length) {
        const [id, p] = playerEntries[i] as [string, PlayerState];
        mesh.visible = true;

        // Set correct material based on team from snapshot
        mesh.material = p.team === 'red' ? redMaterial : blueMaterial;

        if (isNewTick) {
          // Authoritative update from server
          targetPositions.current[i].set(
            p.position.x,
            p.position.y,
            p.position.z
          );
          targetVelocities.current[i].set(
            p.velocity.x,
            p.velocity.y,
            p.velocity.z
          );
        } else {
          // Dead reckoning: advance target smoothly between server ticks
          targetPositions.current[i].addScaledVector(
            targetVelocities.current[i],
            delta
          );
        }

        // Tightly lerp mesh to the extrapolated target for buttery smoothness
        mesh.position.lerp(targetPositions.current[i], Math.min(1, delta * 25));

        if (id === socket.id) {
          localPlayerPos.current.copy(mesh.position);
        }

        // Show name label
        const nameGroup = nameRefs.current[i];
        if (nameGroup) {
          nameGroup.visible = true;
          nameGroup.position.copy(mesh.position);
          nameGroup.position.y += PLAYER_RADIUS + 1.2;

          // Force text update if it changed
          const troikaText = textRefs.current[i];
          const nickname =
            room?.players.find((pl) => pl.id === id)?.nickname || 'Player';
          if (troikaText && troikaText.text !== nickname) {
            troikaText.text = nickname;
            if (troikaText.sync) troikaText.sync();
          }

          // Make text always face the camera
          nameGroup.quaternion.copy(state.camera.quaternion);
        }

        // Show active power-up aura
        const aura = auraRefs.current[i];
        if (aura) {
          if (p.activePowerUp) {
            aura.visible = true;
            aura.position.copy(mesh.position);

            if (p.activePowerUp.type === 'frozen') {
              // Show as an ice block around player
              aura.geometry = powerUpGeometry; // 2x2x2 cube
              aura.material = powerUpMaterials.frozen;
              aura.rotation.x = 0;
              aura.rotation.y = 0;
              aura.rotation.z = 0;
            } else {
              aura.geometry = auraGeometry;
              aura.material = powerUpMaterials[p.activePowerUp.type];
              aura.position.y -= PLAYER_RADIUS * 0.5;
              aura.rotation.x = Math.PI / 2;
              aura.rotation.z = state.clock.getElapsedTime() * 5;
            }
          } else {
            aura.visible = false;
          }
        }
      } else {
        mesh.visible = false;
        const nameGroup = nameRefs.current[i];
        if (nameGroup) nameGroup.visible = false;
        const aura = auraRefs.current[i];
        if (aura) aura.visible = false;
      }
    }
  });

  // We need room info to know teams. We'll determine from snapshot + socket
  // Since we don't have team info in PlayerState, we track it from the initial room info
  // For simplicity, blue players have even index, red have odd...
  // Actually, let's use a different approach — get team from Room info stored client-side

  return (
    <>
      {Array.from({ length: MAX_POOL }, (_, i) => (
        <group key={i}>
          <mesh
            ref={(r) => {
              meshRefs.current[i] = r;
            }}
            geometry={playerGeometry}
            material={i < 5 ? blueMaterial : redMaterial}
            castShadow
            visible={false}
          />
          <group
            ref={(r) => {
              nameRefs.current[i] = r;
            }}
            visible={false}
          >
            <Text
              ref={(r) => {
                textRefs.current[i] = r;
              }}
              fontSize={0.8}
              color="white"
              anchorX="center"
              anchorY="bottom"
              outlineColor="black"
              outlineWidth={0.05}
              font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
              fontWeight={800}
            >
              {' '}
            </Text>
          </group>
          <mesh
            ref={(r) => {
              auraRefs.current[i] = r;
            }}
            visible={false}
          />
        </group>
      ))}
    </>
  );
}

// ---- PowerUps ----
const MAX_POWERUPS = 5;

function PowerUpPool({
  latestRef,
}: {
  latestRef: MutableRefObject<GameSnapshot | null>;
}) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>(
    Array(MAX_POWERUPS).fill(null)
  );

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
        mesh.material = powerUpMaterials[items[i].type];
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
          geometry={powerUpGeometry}
          castShadow
          visible={false}
        />
      ))}
    </>
  );
}

// ---- Ball ----
function Ball({
  latestRef,
}: {
  latestRef: MutableRefObject<GameSnapshot | null>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
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
        geometry={ballGeometry}
        material={ballMaterial}
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
}

// ---- Camera Follow ----
function CameraFollow({
  latestRef,
  localPlayerPos,
}: {
  latestRef: MutableRefObject<GameSnapshot | null>;
  localPlayerPos: MutableRefObject<THREE.Vector3>;
}) {
  const offset = useRef(new THREE.Vector3(0, 25, 30));
  const targetPos = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());

  useFrame(({ camera }, delta) => {
    const snapshot = latestRef.current;
    if (!snapshot) return;

    const myPlayer = snapshot.players[socket.id!];
    if (myPlayer && localPlayerPos.current.lengthSq() > 0) {
      targetPos.current.set(
        localPlayerPos.current.x + offset.current.x,
        offset.current.y,
        localPlayerPos.current.z + offset.current.z
      );
      lookTarget.current.set(
        localPlayerPos.current.x,
        0,
        localPlayerPos.current.z
      );
    } else {
      // Spectator: look at ball
      targetPos.current.set(
        snapshot.ball.position.x,
        35,
        snapshot.ball.position.z + 35
      );
      lookTarget.current.set(
        snapshot.ball.position.x,
        0,
        snapshot.ball.position.z
      );
    }

    camera.position.lerp(targetPos.current, Math.min(1, delta * 15));
    camera.lookAt(lookTarget.current);
  });

  return null;
}

// ---- Field ----
const FieldWithTexture = memo(function FieldWithTexture({
  textureUrl,
}: {
  textureUrl: string;
}) {
  const texture = useTexture(textureUrl);

  useEffect(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(4, 4);
      texture.needsUpdate = true;
    }
  }, [texture]);

  return <FieldContent texture={texture} />;
});

function FieldContent({ texture }: { texture?: THREE.Texture | null }) {
  const halfW = FIELD_WIDTH / 2;
  const halfH = FIELD_HEIGHT / 2;
  const goalHalf = GOAL_WIDTH / 2;

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_WIDTH + 10, FIELD_HEIGHT + 10]} />
        <meshStandardMaterial
          color={texture ? 0xffffff : FIELD_COLOR}
          map={texture || null}
          roughness={0.9}
        />
      </mesh>

      {/* Field lines */}
      <FieldLines halfW={halfW} halfH={halfH} goalHalf={goalHalf} />

      {/* Walls */}
      <Walls halfW={halfW} halfH={halfH} goalHalf={goalHalf} />

      {/* Goals */}
      <Goals halfW={halfW} goalHalf={goalHalf} />
    </group>
  );
}

export function Field({ textureUrl }: { textureUrl?: string | null }) {
  // If no textureUrl is provided or it's 'none', Fallback to null
  const isValidTexture =
    textureUrl && textureUrl !== 'none' && textureUrl.trim() !== '';

  return (
    <Suspense fallback={<FieldContent texture={null} />}>
      {isValidTexture ? (
        <FieldWithTexture textureUrl={textureUrl} />
      ) : (
        <FieldContent texture={null} />
      )}
    </Suspense>
  );
}

function FieldLines({
  halfW,
  halfH,
  goalHalf,
}: {
  halfW: number;
  halfH: number;
  goalHalf: number;
}) {
  return (
    <group>
      {/* Center line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[0.15, FIELD_HEIGHT]} />
        <meshBasicMaterial color={FIELD_LINE_COLOR} />
      </mesh>

      {/* Center circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[7.9, 8.1, 48]} />
        <meshBasicMaterial color={FIELD_LINE_COLOR} side={THREE.DoubleSide} />
      </mesh>

      {/* Border lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -halfH]}>
        <planeGeometry args={[FIELD_WIDTH, 0.15]} />
        <meshBasicMaterial color={FIELD_LINE_COLOR} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, halfH]}>
        <planeGeometry args={[FIELD_WIDTH, 0.15]} />
        <meshBasicMaterial color={FIELD_LINE_COLOR} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-halfW, 0.01, -(halfH + goalHalf) / 2]}
      >
        <planeGeometry args={[0.15, halfH - goalHalf]} />
        <meshBasicMaterial color={FIELD_LINE_COLOR} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-halfW, 0.01, (halfH + goalHalf) / 2]}
      >
        <planeGeometry args={[0.15, halfH - goalHalf]} />
        <meshBasicMaterial color={FIELD_LINE_COLOR} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[halfW, 0.01, -(halfH + goalHalf) / 2]}
      >
        <planeGeometry args={[0.15, halfH - goalHalf]} />
        <meshBasicMaterial color={FIELD_LINE_COLOR} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[halfW, 0.01, (halfH + goalHalf) / 2]}
      >
        <planeGeometry args={[0.15, halfH - goalHalf]} />
        <meshBasicMaterial color={FIELD_LINE_COLOR} />
      </mesh>
    </group>
  );
}

function Walls({
  halfW,
  halfH,
  goalHalf,
}: {
  halfW: number;
  halfH: number;
  goalHalf: number;
}) {
  return (
    <group>
      <mesh position={[0, 1, -halfH - 0.5]}>
        <boxGeometry args={[FIELD_WIDTH + 2, 2, 1]} />
        <meshStandardMaterial color={0x2a2a3a} transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 1, halfH + 0.5]}>
        <boxGeometry args={[FIELD_WIDTH + 2, 2, 1]} />
        <meshStandardMaterial color={0x2a2a3a} transparent opacity={0.5} />
      </mesh>
      <mesh position={[-halfW - 0.5, 1, -(halfH + goalHalf) / 2]}>
        <boxGeometry args={[1, 2, halfH - goalHalf]} />
        <meshStandardMaterial color={0x2a2a3a} transparent opacity={0.5} />
      </mesh>
      <mesh position={[-halfW - 0.5, 1, (halfH + goalHalf) / 2]}>
        <boxGeometry args={[1, 2, halfH - goalHalf]} />
        <meshStandardMaterial color={0x2a2a3a} transparent opacity={0.5} />
      </mesh>
      <mesh position={[halfW + 0.5, 1, -(halfH + goalHalf) / 2]}>
        <boxGeometry args={[1, 2, halfH - goalHalf]} />
        <meshStandardMaterial color={0x2a2a3a} transparent opacity={0.5} />
      </mesh>
      <mesh position={[halfW + 0.5, 1, (halfH + goalHalf) / 2]}>
        <boxGeometry args={[1, 2, halfH - goalHalf]} />
        <meshStandardMaterial color={0x2a2a3a} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function Goals({ halfW, goalHalf }: { halfW: number; goalHalf: number }) {
  return (
    <group>
      <group position={[-halfW - GOAL_DEPTH / 2, 0, 0]}>
        <mesh position={[-GOAL_DEPTH / 2, 1.5, 0]}>
          <boxGeometry args={[0.3, 3, GOAL_WIDTH]} />
          <meshStandardMaterial
            color={GOAL_BLUE_COLOR}
            emissive={BLUE_COLOR}
            emissiveIntensity={0.1}
          />
        </mesh>
        <mesh position={[0, 3, 0]}>
          <boxGeometry args={[GOAL_DEPTH, 0.3, GOAL_WIDTH]} />
          <meshStandardMaterial
            color={GOAL_BLUE_COLOR}
            emissive={BLUE_COLOR}
            emissiveIntensity={0.1}
          />
        </mesh>
        <mesh position={[0, 1.5, -goalHalf]}>
          <boxGeometry args={[GOAL_DEPTH, 3, 0.3]} />
          <meshStandardMaterial
            color={GOAL_BLUE_COLOR}
            emissive={BLUE_COLOR}
            emissiveIntensity={0.15}
          />
        </mesh>
        <mesh position={[0, 1.5, goalHalf]}>
          <boxGeometry args={[GOAL_DEPTH, 3, 0.3]} />
          <meshStandardMaterial
            color={GOAL_BLUE_COLOR}
            emissive={BLUE_COLOR}
            emissiveIntensity={0.15}
          />
        </mesh>
        <mesh position={[-GOAL_DEPTH / 2 + 0.2, 1.5, 0]}>
          <planeGeometry args={[0.1, 3]} />
          <meshBasicMaterial
            color={BLUE_COLOR}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      <group position={[halfW + GOAL_DEPTH / 2, 0, 0]}>
        <mesh position={[GOAL_DEPTH / 2, 1.5, 0]}>
          <boxGeometry args={[0.3, 3, GOAL_WIDTH]} />
          <meshStandardMaterial
            color={GOAL_RED_COLOR}
            emissive={RED_COLOR}
            emissiveIntensity={0.1}
          />
        </mesh>
        <mesh position={[0, 3, 0]}>
          <boxGeometry args={[GOAL_DEPTH, 0.3, GOAL_WIDTH]} />
          <meshStandardMaterial
            color={GOAL_RED_COLOR}
            emissive={RED_COLOR}
            emissiveIntensity={0.1}
          />
        </mesh>
        <mesh position={[0, 1.5, -goalHalf]}>
          <boxGeometry args={[GOAL_DEPTH, 3, 0.3]} />
          <meshStandardMaterial
            color={GOAL_RED_COLOR}
            emissive={RED_COLOR}
            emissiveIntensity={0.15}
          />
        </mesh>
        <mesh position={[0, 1.5, goalHalf]}>
          <boxGeometry args={[GOAL_DEPTH, 3, 0.3]} />
          <meshStandardMaterial
            color={GOAL_RED_COLOR}
            emissive={RED_COLOR}
            emissiveIntensity={0.15}
          />
        </mesh>
        <mesh position={[GOAL_DEPTH / 2 - 0.2, 1.5, 0]}>
          <planeGeometry args={[0.1, 3]} />
          <meshBasicMaterial
            color={RED_COLOR}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

// ---- Obstacles ----
const obstacleMaterial = new THREE.MeshStandardMaterial({
  color: 0x222222,
  roughness: 0.7,
  metalness: 0.5,
  emissive: new THREE.Color(0x111111),
  emissiveIntensity: 0.5,
});

export function Obstacles() {
  return (
    <group>
      {FIELD_OBSTACLES.map((obs) => (
        <group key={obs.id} position={[obs.position.x, 0, obs.position.z]}>
          <mesh position={[0, obs.height / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[obs.radius, obs.radius, obs.height, 32]} />
            <primitive object={obstacleMaterial} attach="material" />
          </mesh>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[obs.radius + 0.2, obs.radius + 0.5, 32]} />
            <meshBasicMaterial
              color={0xffaa00}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---- Boost Pads ----
const boostPadActiveMaterial = new THREE.MeshStandardMaterial({
  color: 0xffff00,
  emissive: 0xffaa00,
  emissiveIntensity: 1.5,
  transparent: true,
  opacity: 0.8,
});

const boostPadInactiveMaterial = new THREE.MeshStandardMaterial({
  color: 0x444400,
  emissive: 0x000000,
  transparent: true,
  opacity: 0.3,
});

const boostPadGeometry = new THREE.CylinderGeometry(1, 1, 0.2, 32);

export function BoostPads({
  latestRef,
}: {
  latestRef: MutableRefObject<GameSnapshot | null>;
}) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>(
    Array(FIELD_BOOST_PADS.length).fill(null)
  );
  const lastTickRef = useRef<number>(-1);
  const padStateMapRef = useRef<Map<string, boolean>>(new Map());

  useFrame((state, delta) => {
    const snapshot = latestRef.current;
    if (!snapshot || !snapshot.boostPads) return;

    // Update lookup map if it's a new tick
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
        mesh.material = boostPadActiveMaterial;
        mesh.rotation.y += delta * 2;
      } else {
        mesh.material = boostPadInactiveMaterial;
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
            geometry={boostPadGeometry}
            scale={[pad.radius, 1, pad.radius]}
            receiveShadow
          >
            <primitive object={boostPadActiveMaterial} attach="material" />
          </mesh>
          <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[pad.radius * 0.5, pad.radius * 0.8, 16]} />
            <meshBasicMaterial
              color={0xffffff}
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---- Main Scene ----
export default function GameScene({
  latestRef,
  room,
  pitchTextureUrl,
}: GameSceneProps) {
  const localPlayerPos = useRef(new THREE.Vector3());

  return (
    <>
      <color attach="background" args={['#1e1e24']} />

      {/* Lights */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[50, 80, 20]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-FIELD_WIDTH / 2}
        shadow-camera-right={FIELD_WIDTH / 2}
        shadow-camera-top={FIELD_HEIGHT / 2}
        shadow-camera-bottom={-FIELD_HEIGHT / 2}
        shadow-camera-near={0.5}
        shadow-camera-far={150}
      />
      {/* Soft fill light from opposite side */}
      <directionalLight position={[-50, 40, -20]} intensity={0.4} />

      {/* Environment */}
      <Field textureUrl={pitchTextureUrl} />
      {room?.enableFeatures !== false ? (
        <>
          <Obstacles />
          <BoostPads latestRef={latestRef} />
        </>
      ) : null}

      {/* Entities */}
      <PlayerPool
        latestRef={latestRef}
        room={room}
        localPlayerPos={localPlayerPos}
      />
      <PowerUpPool latestRef={latestRef} />
      <Ball latestRef={latestRef} />
      <CameraFollow latestRef={latestRef} localPlayerPos={localPlayerPos} />
    </>
  );
}
