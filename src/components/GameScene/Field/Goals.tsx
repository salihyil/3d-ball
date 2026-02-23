import { memo, useMemo } from 'react';
import { GOAL_DEPTH, GOAL_WIDTH } from '../../../types';
import {
  createGoalBlueMaterial,
  createGoalNetGeometry,
  createGoalNetMaterial,
  createGoalRedMaterial,
} from '../materials';

interface GoalsProps {
  halfW: number;
  goalHalf: number;
}

export const Goals = memo(function Goals({ halfW, goalHalf }: GoalsProps) {
  const blueMat = useMemo(() => createGoalBlueMaterial(), []);
  const redMat = useMemo(() => createGoalRedMaterial(), []);
  const netGeo = useMemo(() => createGoalNetGeometry(), []);
  const netMat = useMemo(() => createGoalNetMaterial(), []);

  return (
    <group>
      {/* Blue Goal */}
      <group position={[-halfW - GOAL_DEPTH / 2, 0, 0]}>
        <mesh position={[-GOAL_DEPTH / 2, 1.5, 0]} material={blueMat}>
          <boxGeometry args={[0.3, 3, GOAL_WIDTH]} />
        </mesh>
        <mesh position={[0, 3, 0]} material={blueMat}>
          <boxGeometry args={[GOAL_DEPTH, 0.3, GOAL_WIDTH]} />
        </mesh>
        <mesh position={[0, 1.5, -goalHalf]} material={blueMat}>
          <boxGeometry args={[GOAL_DEPTH, 3, 0.3]} />
        </mesh>
        <mesh position={[0, 1.5, goalHalf]} material={blueMat}>
          <boxGeometry args={[GOAL_DEPTH, 3, 0.3]} />
        </mesh>
        <mesh
          position={[-GOAL_DEPTH / 2 + 0.2, 1.5, 0]}
          geometry={netGeo}
          material={netMat}
        />
      </group>

      {/* Red Goal */}
      <group position={[halfW + GOAL_DEPTH / 2, 0, 0]}>
        <mesh position={[GOAL_DEPTH / 2, 1.5, 0]} material={redMat}>
          <boxGeometry args={[0.3, 3, GOAL_WIDTH]} />
        </mesh>
        <mesh position={[0, 3, 0]} material={redMat}>
          <boxGeometry args={[GOAL_DEPTH, 0.3, GOAL_WIDTH]} />
        </mesh>
        <mesh position={[0, 1.5, -goalHalf]} material={redMat}>
          <boxGeometry args={[GOAL_DEPTH, 3, 0.3]} />
        </mesh>
        <mesh position={[0, 1.5, goalHalf]} material={redMat}>
          <boxGeometry args={[GOAL_DEPTH, 3, 0.3]} />
        </mesh>
        <mesh
          position={[GOAL_DEPTH / 2 - 0.2, 1.5, 0]}
          geometry={netGeo}
          material={netMat}
        />
      </group>
    </group>
  );
});
