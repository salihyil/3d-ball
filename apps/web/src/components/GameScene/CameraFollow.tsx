import { useFrame } from '@react-three/fiber';
import { MutableRefObject, memo, useRef } from 'react';
import * as THREE from 'three';
import { socket } from '../../hooks/useNetwork';
import type { GameSnapshot } from '@sasi/shared';

interface CameraFollowProps {
  latestRef: MutableRefObject<GameSnapshot | null>;
  localPlayerPos: MutableRefObject<THREE.Vector3>;
}

export const CameraFollow = memo(function CameraFollow({
  latestRef,
  localPlayerPos,
}: CameraFollowProps) {
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
});
