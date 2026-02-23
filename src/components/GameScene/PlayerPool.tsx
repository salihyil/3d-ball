import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { MutableRefObject, memo, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { socket } from '../../hooks/useNetwork';
import type { GameSnapshot, PlayerState, RoomInfo } from '../../types';
import { PLAYER_RADIUS } from '../../types';
import { Character, CharacterHandle } from './Character';
import {
  createAuraGeometry,
  createPowerUpGeometry,
  createPowerUpMaterials,
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
  const charRefs = useRef<(CharacterHandle | null)[]>(
    Array(MAX_POOL).fill(null)
  );
  const nameRefs = useRef<(THREE.Group | null)[]>(Array(MAX_POOL).fill(null));
  const textRefs = useRef<{ text: string; sync?: () => void }[]>(
    Array(MAX_POOL).fill(null)
  );
  const auraRefs = useRef<(THREE.Mesh | null)[]>(Array(MAX_POOL).fill(null));

  // Keep track of which player ID is currently assigned to which pool slot
  const slotPayerIds = useRef<(string | null)[]>(Array(MAX_POOL).fill(null));
  const slotAccessories = useRef<(string[] | null)[]>(
    Array(MAX_POOL).fill(null)
  );

  const targetPositions = useRef<THREE.Vector3[]>(
    Array.from({ length: MAX_POOL }, () => new THREE.Vector3())
  );
  const targetVelocities = useRef<THREE.Vector3[]>(
    Array.from({ length: MAX_POOL }, () => new THREE.Vector3())
  );
  const lastTickRef = useRef<number>(-1);

  // Memoize shared geometries and materials for this context
  const powerUpGeo = useMemo(() => createPowerUpGeometry(), []);
  const auraGeo = useMemo(() => createAuraGeometry(), []);
  const powerUpMats = useMemo(() => createPowerUpMaterials(), []);

  useFrame((state, delta) => {
    const snapshot = latestRef.current;
    if (!snapshot) return;

    const isNewTick = snapshot.tick !== lastTickRef.current;
    if (isNewTick) {
      lastTickRef.current = snapshot.tick;
    }

    const playerEntries = Object.entries(snapshot.players);

    for (let i = 0; i < MAX_POOL; i++) {
      const char = charRefs.current[i];
      if (!char) continue;

      const group = char.getGroup();
      if (!group) continue;

      if (i < playerEntries.length) {
        const [id, p] = playerEntries[i] as [string, PlayerState];
        group.visible = true;

        // Dynamic look update if player in slot changed or team changed
        if (slotPayerIds.current[i] !== id) {
          slotPayerIds.current[i] = id;
          char.setTeam(p.team);

          const accs = p.equippedAccessories || [];
          char.setAccessories(accs);
          slotAccessories.current[i] = accs;
        } else {
          if (slotPayerIds.current[i] === id) {
            // Check for team or accessory changes from snapshot data
            // (Wait, we already check changes if slotPlayerIds match)
            // But if we use snapshot p, it's always up-to-date.
            // Let's just update if they differ to avoid setXXX overhead.

            const currentAccs = p.equippedAccessories || [];
            if (
              JSON.stringify(currentAccs) !==
              JSON.stringify(slotAccessories.current[i])
            ) {
              char.setAccessories(currentAccs);
              slotAccessories.current[i] = currentAccs;
            }
          }
        }

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

        group.position.lerp(
          targetPositions.current[i],
          Math.min(1, delta * 25)
        );

        if (id === socket.id) {
          localPlayerPos.current.copy(group.position);
        }

        const nameGroup = nameRefs.current[i];
        if (nameGroup) {
          nameGroup.visible = true;
          nameGroup.position.copy(group.position);
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
            aura.position.copy(group.position);

            if (p.activePowerUp.type === 'frozen') {
              aura.geometry = powerUpGeo;
              aura.material = powerUpMats.frozen;
              aura.rotation.x = 0;
              aura.rotation.y = 0;
              aura.rotation.z = 0;
            } else {
              aura.geometry = auraGeo;
              aura.material = powerUpMats[p.activePowerUp.type];
              aura.position.y -= PLAYER_RADIUS * 0.5;
              aura.rotation.x = Math.PI / 2;
              aura.rotation.z = state.clock.getElapsedTime() * 5;
            }
          } else {
            aura.visible = false;
          }
        }
      } else {
        group.visible = false;
        slotPayerIds.current[i] = null;
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
          <Character
            ref={(r) => {
              charRefs.current[i] = r;
            }}
            id={`pool-${i}`}
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
