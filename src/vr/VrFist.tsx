import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useXRInputSourceStateContext, XRSpace } from '@react-three/xr';
import { vrEngine } from './vrEngine';

interface VrFistProps {
  handedness: 'left' | 'right';
}

export const VrFist: React.FC<VrFistProps> = ({ handedness }) => {
  const groupRef = useRef<THREE.Group>(null);
  const trailRef1 = useRef<THREE.Mesh>(null);
  const trailRef2 = useRef<THREE.Mesh>(null);
  const trailRef3 = useRef<THREE.Mesh>(null);

  const prevPositions = useRef<THREE.Vector3[]>([
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);

  const lastButtonAPressed = useRef(false);
  const state = useXRInputSourceStateContext('controller');
  const { camera } = useThree();

  const isLeft = handedness === 'left';
  const colorHex = isLeft ? '#00f0ff' : '#ff0077';

  const tempWorldPos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Get current world position of fist
    groupRef.current.getWorldPosition(tempWorldPos.current);

    // Feed to vrEngine physics & collision loop
    vrEngine.updateHand(
      handedness,
      tempWorldPos.current,
      state?.inputSource || null,
      delta
    );

    // Update velocity ribbon trail positions
    const currPos = tempWorldPos.current;
    if (trailRef1.current) {
      trailRef1.current.position.copy(prevPositions.current[0]);
    }
    if (trailRef2.current) {
      trailRef2.current.position.copy(prevPositions.current[1]);
    }
    if (trailRef3.current) {
      trailRef3.current.position.copy(prevPositions.current[2]);
    }

    prevPositions.current[2].copy(prevPositions.current[1]);
    prevPositions.current[1].copy(prevPositions.current[0]);
    prevPositions.current[0].copy(currPos);

    // Check Controller Button A / X for Recalibration
    const gamepad = state?.inputSource?.gamepad;
    if (gamepad && gamepad.buttons && gamepad.buttons.length > 4) {
      const buttonAorX = gamepad.buttons[4]; // Button A on Right, Button X on Left
      if (buttonAorX?.pressed && !lastButtonAPressed.current) {
        vrEngine.recalibrate(camera);
      }
      lastButtonAPressed.current = !!buttonAorX?.pressed;
    }
  });

  return (
    <XRSpace space="grip-space">
      <group ref={groupRef}>
        {/* Core Knuckle Orb */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial color={colorHex} />
        </mesh>

        {/* Outer Additive Glow Shell 1 */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.065, 16, 16]} />
          <meshBasicMaterial
            color={colorHex}
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Outer Additive Glow Shell 2 */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshBasicMaterial
            color={colorHex}
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Knuckle Energy Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.07, 0.007, 8, 24]} />
          <meshBasicMaterial
            color={colorHex}
            transparent
            opacity={0.8}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </XRSpace>
  );
};

export const VrFistLeft: React.FC = () => <VrFist handedness="left" />;
export const VrFistRight: React.FC = () => <VrFist handedness="right" />;
