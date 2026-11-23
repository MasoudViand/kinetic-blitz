import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useXRInputSourceStateContext, XRSpace } from '@react-three/xr';
import { vrEngine } from './vrEngine';
import { VR_COLORS } from './vrTypes';

interface VrHandFistProps {
  handedness: 'left' | 'right';
}

export const VrHandFist: React.FC<VrHandFistProps> = ({ handedness }) => {
  const groupRef = useRef<THREE.Group>(null);
  const state = useXRInputSourceStateContext('hand');

  // Exact color matching: Left Hand = Electric Cyan, Right Hand = Neon Magenta
  const isLeft = handedness === 'left';
  const colorHex = isLeft ? VR_COLORS.leftCyan : VR_COLORS.rightMagenta;
  const tempWorldPos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    groupRef.current.getWorldPosition(tempWorldPos.current);

    vrEngine.updateHand(
      handedness,
      tempWorldPos.current,
      state?.inputSource || null,
      delta
    );
  });

  const handSpace =
    state?.inputSource?.hand?.get('middle-finger-metacarpal') ||
    state?.inputSource?.hand?.get('wrist') ||
    state?.inputSource?.targetRaySpace ||
    'target-ray-space';

  return (
    <XRSpace space={handSpace}>
      <group ref={groupRef}>
        {/* Core Knuckle Orb */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.042, 14, 14]} />
          <meshBasicMaterial color={colorHex} />
        </mesh>

        {/* Outer Glow Shell */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.062, 14, 14]} />
          <meshBasicMaterial
            color={colorHex}
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Outer Halo */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.082, 12, 12]} />
          <meshBasicMaterial
            color={colorHex}
            transparent
            opacity={0.12}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </XRSpace>
  );
};

export const VrHandFistLeft: React.FC = () => <VrHandFist handedness="left" />;
export const VrHandFistRight: React.FC = () => <VrHandFist handedness="right" />;
