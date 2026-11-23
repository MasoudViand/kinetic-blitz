import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { vrEngine } from './vrEngine';

export const VrCorridorAnchor: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(vrEngine.calibration.playerOrigin);
    groupRef.current.rotation.y = vrEngine.calibration.forwardYaw;
  });

  return (
    <group ref={groupRef} position={[0, 0.005, 0]}>
      {/* 1. Player Stance Ring (y = 0.01) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[0.42, 0.44, 48]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 2. Facing Direction Chevron Marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, -0.42]}>
        <ringGeometry args={[0.06, 0.08, 3, 1, 0, Math.PI]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 3. Left Corridor Rail Line (x = -0.55m, stretching from z = 0 to z = -5.5m) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.55, 0.005, -2.75]}>
        <planeGeometry args={[0.02, 5.5]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 4. Right Corridor Rail Line (x = +0.55m, stretching from z = 0 to z = -5.5m) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.55, 0.005, -2.75]}>
        <planeGeometry args={[0.02, 5.5]} />
        <meshBasicMaterial
          color="#ff0077"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 5. Depth Markers at 2.0m, 4.0m, and 5.5m Spawn Distance */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -2.0]}>
        <planeGeometry args={[1.1, 0.015]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -4.0]}>
        <planeGeometry args={[1.1, 0.015]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -5.5]}>
        <planeGeometry args={[1.1, 0.025]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
