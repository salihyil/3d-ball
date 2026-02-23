import { Decal as DreiDecal, useTexture } from '@react-three/drei';
import { memo } from 'react';

interface DecalProps {
  id: string;
  team: 'red' | 'blue';
}

export const Decal = memo(({ id, team }: DecalProps) => {
  // rerender-memo, rendering-hoist-jsx

  if (id === 'e1b2c3d4-0000-4000-8000-000000000002') {
    // Decal Cyber Mask ID
    return <CyberMaskDecal team={team} />;
  }

  return null;
});

const CyberMaskDecal = memo(({ team }: { team: 'red' | 'blue' }) => {
  const texture = useTexture('/textures/cyber_mask.png');
  const emissiveColor = team === 'blue' ? '#00f2ff' : '#ff3300';

  return (
    <DreiDecal
      position={[0, 0, 0.9]} // Positioned slightly in front of the sphere (z-forward)
      rotation={[0, 0, 0]}
      scale={[1.2, 1.2, 1.2]} // Scale to fit the face area
    >
      <meshStandardMaterial
        map={texture}
        alphaTest={0.5} // Simple transparency for the black background
        transparent
        polygonOffset
        polygonOffsetFactor={-10} // Ensure it renders on top of the sphere
        emissive={emissiveColor}
        emissiveIntensity={1}
      />
    </DreiDecal>
  );
});
