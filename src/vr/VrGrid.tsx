import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { vrEngine } from './vrEngine';

export const VrGrid: React.FC = () => {
  const mode = useXR((xr) => xr.mode);
  const { scene } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const isVR = mode === 'immersive-vr';

  useEffect(() => {
    if (isVR) {
      scene.background = new THREE.Color('#050814');
    } else {
      scene.background = null;
    }
    return () => {
      scene.background = null;
    };
  }, [isVR, scene]);

  useFrame(() => {
    if (groupRef.current && isVR) {
      groupRef.current.position.copy(vrEngine.calibration.playerOrigin);
      groupRef.current.rotation.y = vrEngine.calibration.forwardYaw;
    }
  });

  if (!isVR) return null;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Primary Cyber Grid Floor */}
      <gridHelper
        args={[24, 24, '#00f0ff', '#0e2b45']}
        position={[0, 0, 0]}
      />

      {/* Center Arena Concentric Ring 1 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[1.4, 1.43, 64]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Center Arena Concentric Ring 2 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[2.4, 2.44, 64]} />
        <meshBasicMaterial
          color="#ff0077"
          transparent
          opacity={0.25}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Distant Horizon Guide Line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[6.0, 6.04, 64]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};
