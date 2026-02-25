import { useTexture } from '@react-three/drei';
import { memo, Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { FIELD_HEIGHT, FIELD_WIDTH, GOAL_WIDTH } from '@sasi/shared';
import { FIELD_COLOR } from '../materials';
import { FieldLines } from './FieldLines';
import { Goals } from './Goals';
import { Walls } from './Walls';

interface FieldWithTextureProps {
  textureUrl: string;
}

const FieldWithTexture = memo(function FieldWithTexture({
  textureUrl,
}: FieldWithTextureProps) {
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

interface FieldContentProps {
  texture?: THREE.Texture | null;
}

const FieldContent = memo(function FieldContent({
  texture,
}: FieldContentProps) {
  const halfW = FIELD_WIDTH / 2;
  const halfH = FIELD_HEIGHT / 2;
  const goalHalf = GOAL_WIDTH / 2;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_WIDTH + 10, FIELD_HEIGHT + 10]} />
        <meshStandardMaterial
          color={texture ? 0xffffff : FIELD_COLOR}
          map={texture || null}
          roughness={0.9}
        />
      </mesh>

      <FieldLines halfW={halfW} halfH={halfH} goalHalf={goalHalf} />
      <Walls halfW={halfW} halfH={halfH} goalHalf={goalHalf} />
      <Goals halfW={halfW} goalHalf={goalHalf} />
    </group>
  );
});

interface FieldProps {
  textureUrl?: string | null;
}

export const Field = memo(function Field({ textureUrl }: FieldProps) {
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
});
