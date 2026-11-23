import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { vrEngine } from './vrEngine';

export const VrCorridorAnchor: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringMeshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(vrEngine.calibration.playerOrigin);
    groupRef.current.rotation.y = vrEngine.calibration.forwardYaw;

    // Head-drift guard pulse
    const isDrifted = vrEngine.calibration.isDrifted;
    const mat = ringMatRef.current;
    const ringMesh = ringMeshRef.current;

    if (mat && ringMesh) {
      if (isDrifted) {
        const pulse = 0.5 + Math.sin(performance.now() * 0.008) * 0.4;
        mat.color.set('#f59e0b'); // Warning amber
        mat.opacity = 0.4 + pulse * 0.4;
        const scale = 1.0 + pulse * 0.08;
        ringMesh.scale.set(scale, scale, 1);
      } else {
        mat.color.set('#00f0ff'); // Crisp cyan
        mat.opacity = 0.45;
        ringMesh.scale.set(1, 1, 1);
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.005, 0]}>
      {/* 1. Anchored Player Playspace Center Ring (radius ~0.35m) */}
      <mesh ref={ringMeshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[0.34, 0.36, 48]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color="#00f0ff"
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Center Dot Indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[0.04, 24]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 2. Facing Direction Forward Chevron Marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, -0.35]}>
        <ringGeometry args={[0.06, 0.08, 3, 1, 0, Math.PI]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.7}
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
