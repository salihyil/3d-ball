import { memo, useRef } from 'react';
import * as THREE from 'three';
import type { GameSnapshot, RoomInfo } from '@sasi/shared';
import { FIELD_HEIGHT, FIELD_WIDTH } from '@sasi/shared';

// Components
import { Ball } from './Ball';
import { BoostPads } from './BoostPads';
import { CameraFollow } from './CameraFollow';
import { Field } from './Field/Field';
import { Obstacles } from './Obstacles';
import { PlayerPool } from './PlayerPool';
import { PowerUpPool } from './PowerUpPool';

interface GameSceneProps {
  latestRef: React.MutableRefObject<GameSnapshot | null>;
  room: RoomInfo | null;
  pitchTextureUrl?: string;
}

export const GameScene = memo(function GameScene({
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
          <Obstacles latestRef={latestRef} />
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
});

export default GameScene;
