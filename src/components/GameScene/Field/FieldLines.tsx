import { memo } from 'react';
import { fieldLineMaterial } from '../materials';

interface FieldLinesProps {
  halfW: number;
  halfH: number;
  goalHalf: number;
}

export const FieldLines = memo(function FieldLines({
  halfW,
  halfH,
  goalHalf,
}: FieldLinesProps) {
  return (
    <group>
      {/* Center line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[0.15, halfH * 2]} />
        <primitive object={fieldLineMaterial} attach="material" />
      </mesh>

      {/* Center circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[7.9, 8.1, 48]} />
        <primitive object={fieldLineMaterial} attach="material" />
      </mesh>

      {/* Border lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -halfH]}>
        <planeGeometry args={[halfW * 2, 0.15]} />
        <primitive object={fieldLineMaterial} attach="material" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, halfH]}>
        <planeGeometry args={[halfW * 2, 0.15]} />
        <primitive object={fieldLineMaterial} attach="material" />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-halfW, 0.01, -(halfH + goalHalf) / 2]}
      >
        <planeGeometry args={[0.15, halfH - goalHalf]} />
        <primitive object={fieldLineMaterial} attach="material" />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-halfW, 0.01, (halfH + goalHalf) / 2]}
      >
        <planeGeometry args={[0.15, halfH - goalHalf]} />
        <primitive object={fieldLineMaterial} attach="material" />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[halfW, 0.01, -(halfH + goalHalf) / 2]}
      >
        <planeGeometry args={[0.15, halfH - goalHalf]} />
        <primitive object={fieldLineMaterial} attach="material" />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[halfW, 0.01, (halfH + goalHalf) / 2]}
      >
        <planeGeometry args={[0.15, halfH - goalHalf]} />
        <primitive object={fieldLineMaterial} attach="material" />
      </mesh>
    </group>
  );
});
