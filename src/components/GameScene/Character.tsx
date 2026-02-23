import { useTexture } from '@react-three/drei';
import {
  forwardRef,
  memo,
  Suspense,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { PLAYER_RADIUS, Team } from '../../types';
import { Aura } from './Aura';
import { Decal } from './Decal';
import { Trail } from './Trail';
import {
  createAcidMaterial,
  createBlueMaterial,
  createRedMaterial,
} from './materials';

interface CharacterProps {
  id: string;
  initialTeam?: 'blue' | 'red';
  forceAccessories?: string[];
}

export interface CharacterHandle {
  setTeam: (team: 'blue' | 'red') => void;
  setAccessories: (accessories: string[]) => void;
  getGroup: () => THREE.Group | null;
}

export const Character = memo(
  forwardRef<CharacterHandle, CharacterProps>(
    ({ initialTeam = 'blue', forceAccessories }, ref) => {
      const [team, setTeamState] = useState<Team>(initialTeam);
      const [equippedAccessories, setAccessoriesState] = useState<string[]>([]);
      const groupRef = useRef<THREE.Group>(null);

      useImperativeHandle(ref, () => ({
        setTeam: (t) => setTeamState(t),
        setAccessories: (accs) => setAccessoriesState(accs),
        getGroup: () => groupRef.current,
      }));

      const blueMat = useMemo(() => createBlueMaterial(), []);
      const redMat = useMemo(() => createRedMaterial(), []);
      const acidMat = useMemo(() => createAcidMaterial(), []);

      const accessoriesToRender = forceAccessories || equippedAccessories;

      return (
        <group ref={groupRef}>
          {/* Movement Trail - Always at the root of the character group */}
          {accessoriesToRender.map((accId) => (
            <Suspense key={`trail-${accId}`} fallback={null}>
              <Trail id={accId} team={team} target={groupRef} />
            </Suspense>
          ))}

          {/* Main Player Body */}
          <Suspense fallback={<PlayerSphereFallback team={team} />}>
            <CharacterBody
              team={team}
              accessoriesToRender={accessoriesToRender}
              blueMat={blueMat}
              redMat={redMat}
              acidMat={acidMat}
            />
          </Suspense>

          {/* Overlay Accessories (Hats, Auras) */}
          {accessoriesToRender.map((accId) => (
            <group key={`acc-${accId}`}>
              <Accessory id={accId} />
              <Suspense fallback={null}>
                <Aura id={accId} team={team} />
              </Suspense>
            </group>
          ))}
        </group>
      );
    }
  )
);

const CharacterBody = memo(
  ({
    team,
    accessoriesToRender,
    blueMat,
    redMat,
    acidMat,
  }: {
    team: Team;
    accessoriesToRender: string[];
    blueMat: THREE.Material;
    redMat: THREE.Material;
    acidMat: THREE.MeshStandardMaterial;
  }) => {
    const isAcid = accessoriesToRender.includes(
      'f2a9d2b2-6b9a-4e2b-9e4a-4d2b2f2a9d2b'
    );

    const acidTexture = useTexture(
      isAcid ? '/textures/acid_texture.png' : '/textures/acid_texture.png',
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }
    );

    const material = useMemo(() => {
      const mat = isAcid ? acidMat : team === 'red' ? redMat : blueMat;
      if (isAcid && mat instanceof THREE.MeshStandardMaterial) {
        mat.map = acidTexture;
        mat.needsUpdate = true;
      }
      return mat;
    }, [isAcid, team, blueMat, redMat, acidMat, acidTexture]);

    return (
      <mesh castShadow receiveShadow material={material}>
        <sphereGeometry args={[PLAYER_RADIUS, 32, 24]} />
        {/* Projecting decals onto the skin */}
        {accessoriesToRender.map((accId) => (
          <Suspense key={`decal-${accId}`} fallback={null}>
            <Decal id={accId} team={team} />
          </Suspense>
        ))}
      </mesh>
    );
  }
);

const PlayerSphereFallback = ({ team }: { team: Team }) => {
  return (
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[PLAYER_RADIUS, 12, 8]} />
      <meshStandardMaterial color={team === 'red' ? '#ff3333' : '#3333ff'} />
    </mesh>
  );
};

const Accessory = memo(({ id }: { id: string }) => {
  const isVikingHelmet =
    id === '9c647409-c38b-4ce7-b0a4-4be8e8765795' ||
    id === '56a75016-010a-4280-a89c-3b5ca570ace1';

  if (isVikingHelmet) {
    return (
      <mesh position={[0, PLAYER_RADIUS * 1.1, 0]}>
        <coneGeometry args={[0.6, 1.2, 16]} />
        <meshStandardMaterial color="#ffd700" metalness={0.7} roughness={0.2} />
      </mesh>
    );
  }

  if (id.includes('skin_gold')) {
    return (
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[PLAYER_RADIUS * 1.05, 0.05, 16, 32]} />
        <meshStandardMaterial
          color="gold"
          emissive="orange"
          emissiveIntensity={0.5}
        />
      </mesh>
    );
  }

  return null;
});
