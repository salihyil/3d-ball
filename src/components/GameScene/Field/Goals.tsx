import { memo } from 'react';
import { GOAL_DEPTH, GOAL_WIDTH } from '../../../types';
import {
  goalBlueMaterial,
  goalNetGeometry,
  goalNetMaterial,
  goalRedMaterial,
} from '../materials';

interface GoalsProps {
  halfW: number;
  goalHalf: number;
}

export const Goals = memo(function Goals({ halfW, goalHalf }: GoalsProps) {
  return (
    <group>
      {/* Blue Goal */}
      <group position={[-halfW - GOAL_DEPTH / 2, 0, 0]}>
        <mesh position={[-GOAL_DEPTH / 2, 1.5, 0]} material={goalBlueMaterial}>
          <boxGeometry args={[0.3, 3, GOAL_WIDTH]} />
        </mesh>
        <mesh position={[0, 3, 0]} material={goalBlueMaterial}>
          <boxGeometry args={[GOAL_DEPTH, 0.3, GOAL_WIDTH]} />
        </mesh>
        <mesh position={[0, 1.5, -goalHalf]} material={goalBlueMaterial}>
          <boxGeometry args={[GOAL_DEPTH, 3, 0.3]} />
        </mesh>
        <mesh position={[0, 1.5, goalHalf]} material={goalBlueMaterial}>
          <boxGeometry args={[GOAL_DEPTH, 3, 0.3]} />
        </mesh>
        <mesh
          position={[-GOAL_DEPTH / 2 + 0.2, 1.5, 0]}
          geometry={goalNetGeometry}
          material={goalNetMaterial}
        />
      </group>

      {/* Red Goal */}
      <group position={[halfW + GOAL_DEPTH / 2, 0, 0]}>
        <mesh position={[GOAL_DEPTH / 2, 1.5, 0]} material={goalRedMaterial}>
          <boxGeometry args={[0.3, 3, GOAL_WIDTH]} />
        </mesh>
        <mesh position={[0, 3, 0]} material={goalRedMaterial}>
          <boxGeometry args={[GOAL_DEPTH, 0.3, GOAL_WIDTH]} />
        </mesh>
        <mesh position={[0, 1.5, -goalHalf]} material={goalRedMaterial}>
          <boxGeometry args={[GOAL_DEPTH, 3, 0.3]} />
        </mesh>
        <mesh position={[0, 1.5, goalHalf]} material={goalRedMaterial}>
          <boxGeometry args={[GOAL_DEPTH, 3, 0.3]} />
        </mesh>
        <mesh
          position={[GOAL_DEPTH / 2 - 0.2, 1.5, 0]}
          geometry={goalNetGeometry}
          material={goalNetMaterial}
        />
      </group>
    </group>
  );
});
