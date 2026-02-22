import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { MutableRefObject, memo, useRef } from 'react';
import * as THREE from 'three';
import { socket } from '../../hooks/useNetwork';
import type { GameSnapshot, PlayerState, RoomInfo } from '../../types';
import { PLAYER_RADIUS } from '../../types';
import {
  auraGeometry,
  blueMaterial,
  playerGeometry,
  powerUpGeometry,
  powerUpMaterials,
  redMaterial,
} from './materials';

const MAX_POOL = 10;

interface PlayerPoolProps {
  latestRef: MutableRefObject<GameSnapshot | null>;
  room: RoomInfo | null;
  localPlayerPos: MutableRefObject<THREE.Vector3>;
}

export const PlayerPool = memo(function PlayerPool({
  latestRef,
  room,
  localPlayerPos,
}: PlayerPoolProps) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>(Array(MAX_POOL).fill(null));
  const nameRefs = useRef<(THREE.Group | null)[]>(Array(MAX_POOL).fill(null));
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

        mesh.material = p.team === 'red' ? redMaterial : blueMaterial;

        if (isNewTick) {
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
          targetPositions.current[i].addScaledVector(
            targetVelocities.current[i],
            delta
          );
        }

        mesh.position.lerp(targetPositions.current[i], Math.min(1, delta * 25));

        if (id === socket.id) {
          localPlayerPos.current.copy(mesh.position);
        }

        const nameGroup = nameRefs.current[i];
        if (nameGroup) {
          nameGroup.visible = true;
          nameGroup.position.copy(mesh.position);
          nameGroup.position.y += PLAYER_RADIUS + 1.2;

          const troikaText = textRefs.current[i];
          const nickname =
            room?.players.find((pl) => pl.id === id)?.nickname || 'Player';
          if (troikaText && troikaText.text !== nickname) {
            troikaText.text = nickname;
            if (troikaText.sync) troikaText.sync();
          }

          nameGroup.quaternion.copy(state.camera.quaternion);
        }

        const aura = auraRefs.current[i];
        if (aura) {
          if (p.activePowerUp) {
            aura.visible = true;
            aura.position.copy(mesh.position);

            if (p.activePowerUp.type === 'frozen') {
              aura.geometry = powerUpGeometry;
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
});
