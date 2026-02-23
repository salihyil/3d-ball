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

// Hoisted static parts following Vercel's best practices (rendering-hoist-jsx)
// While Three.js geometries are usually hoisted in materials.ts, we can also hoist
// sub-accessory structures here if they were static.

export const Character = memo(
  forwardRef<CharacterHandle, CharacterProps>(
    ({ initialTeam = 'blue', forceAccessories }, ref) => {
      const [team, setTeamState] = useState<Team>(initialTeam);
      const [equippedAccessories, setAccessoriesState] = useState<string[]>([]);
      const groupRef = useRef<THREE.Group>(null);

      // Expose methods to update state without parent re-render if needed,
      // though state changes here will still re-render this specific Character.
      // This is okay as it only happens on join/team-change.
      useImperativeHandle(ref, () => ({
        setTeam: (t) => setTeamState(t),
        setAccessories: (accs) => setAccessoriesState(accs),
        getGroup: () => groupRef.current,
      }));

      // Memoize materials for this component instance/context
      const blueMat = useMemo(() => createBlueMaterial(), []);
      const redMat = useMemo(() => createRedMaterial(), []);
      const acidMat = useMemo(() => createAcidMaterial(), []);

      // Use forced accessories if provided (for previews), otherwise use internal state
      const accessoriesToRender = forceAccessories || equippedAccessories;

      return (
        <group ref={groupRef}>
          {/* Main Player Body - Isolated in Suspense for material load stability */}
          <Suspense fallback={<PlayerSphereFallback team={team} />}>
            <CharacterBody
              team={team}
              accessoriesToRender={accessoriesToRender}
              blueMat={blueMat}
              redMat={redMat}
              acidMat={acidMat}
            />
          </Suspense>

          {/* Dynamic Accessories Section */}
          {accessoriesToRender.map((accId) => (
            <group key={accId}>
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

// Isolated Body Component to handle heavy material/texture logic
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
    ); // Acid Glitch ID

    // Use texture ONLY if acid skin is requested, otherwise Suspense might wait unnecessarily
    const acidTexture = useTexture(
      isAcid ? '/textures/acid_texture.png' : '/textures/acid_texture.png', // Keep path stable
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }
    );

    // Use team-specific material, or premium acid skin
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
        {/* Rendering decals as children of the mesh ensures they are properly parented */}
        {accessoriesToRender.map((accId) => (
          <Suspense key={accId} fallback={null}>
            <Decal id={accId} team={team} />
          </Suspense>
        ))}
      </mesh>
    );
  }
);

// Fallback to show while textures are loading to prevent flicker/vanish
const PlayerSphereFallback = ({ team }: { team: Team }) => {
  return (
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[PLAYER_RADIUS, 12, 8]} />
      <meshStandardMaterial color={team === 'red' ? '#ff3333' : '#3333ff'} />
    </mesh>
  );
};

// Modular Accessory Component
const Accessory = memo(({ id }: { id: string }) => {
  // Hoist these if they become complex
  // rerender-memo, rendering-hoist-jsx

  if (id.includes('hat')) {
    return (
      <mesh position={[0, PLAYER_RADIUS * 1.1, 0]}>
        <coneGeometry args={[0.6, 1.2, 16]} />
        <meshStandardMaterial color="#ffd700" metalness={0.7} roughness={0.2} />
      </mesh>
    );
  }

  if (id.includes('skin_gold')) {
    // This could be a overlay or change the main mesh,
    // but for now let's make it a ring
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

// Preload common assets if they existed
// useGLTF.preload('/models/hat.glb');
