import { useTexture } from '@react-three/drei';
import { PLAYER_RADIUS, Team } from '@sasi/shared';
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

  // King's Crown ID: c8e1f2a3-b4c5-4d6e-8f8a-9b0c1d2e3f4a
  const isKingsCrown = id === 'c8e1f2a3-b4c5-4d6e-8f8a-9b0c1d2e3f4a';

  // Wizard Hat ID: d9f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b
  const isWizardHat = id === 'd9f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b';

  if (isVikingHelmet) {
    return (
      <mesh position={[0, PLAYER_RADIUS * 1.1, 0]}>
        <coneGeometry args={[0.6, 1.2, 16]} />
        <meshStandardMaterial color="#ffd700" metalness={0.7} roughness={0.2} />
      </mesh>
    );
  }

  if (isKingsCrown) {
    return (
      <group position={[0, PLAYER_RADIUS * 1.05, 0]}>
        {/* Base Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.6, 0.1, 16, 32]} />
          <meshStandardMaterial
            color="#ffd700"
            metalness={1}
            roughness={0.1}
            emissive="#b8860b"
            emissiveIntensity={0.2}
          />
        </mesh>
        {/* Crowns Spikes/Pointy bits */}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i * Math.PI * 2) / 5) * 0.55,
              0.2,
              Math.sin((i * Math.PI * 2) / 5) * 0.55,
            ]}
            rotation={[0, -(i * Math.PI * 2) / 5, 0]}
          >
            <cylinderGeometry args={[0.05, 0.15, 0.4, 4]} />
            <meshStandardMaterial
              color="#ffd700"
              metalness={1}
              roughness={0.1}
            />
          </mesh>
        ))}
      </group>
    );
  }

  if (isWizardHat) {
    return (
      <group position={[0, PLAYER_RADIUS * 1.1, 0]}>
        {/* Hat Cone */}
        <mesh>
          <coneGeometry args={[0.7, 1.4, 16]} />
          <meshStandardMaterial color="#4b0082" />
        </mesh>
        {/* Gold Band */}
        <mesh position={[0, -0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.05, 12, 24]} />
          <meshStandardMaterial color="#ffd700" metalness={0.8} />
        </mesh>
        {/* Wide Rim */}
        <mesh position={[0, -0.65, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.8, 0.05, 12, 32]} />
          <meshStandardMaterial color="#4b0082" />
        </mesh>
      </group>
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
