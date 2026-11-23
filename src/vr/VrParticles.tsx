import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { vrEngine, VrEngine } from './vrEngine';

const dummyMatrix = new THREE.Matrix4();
const dummyPosition = new THREE.Vector3();
const dummyScale = new THREE.Vector3();
const dummyRotation = new THREE.Quaternion();

export const VrParticles: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Pre-allocate instance colors buffer
  const colorArray = useMemo(() => {
    const arr = new Float32Array(VrEngine.MAX_PARTICLES * 3);
    for (let i = 0; i < VrEngine.MAX_PARTICLES; i++) {
      arr[i * 3] = 0;
      arr[i * 3 + 1] = 0.94;
      arr[i * 3 + 2] = 1;
    }
    return arr;
  }, []);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    }
  }, [colorArray]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < VrEngine.MAX_PARTICLES; i++) {
      const p = vrEngine.particles[i];
      if (p.active) {
        const progress = p.life / p.maxLife;
        const currentScale = Math.max(0.001, p.size * (1 - progress));

        dummyPosition.copy(p.position);
        dummyScale.set(currentScale, currentScale, currentScale);
        dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
        mesh.setMatrixAt(i, dummyMatrix);

        if (mesh.instanceColor) {
          mesh.setColorAt(i, p.color);
        }
      } else {
        dummyScale.set(0, 0, 0);
        dummyMatrix.compose(p.position, dummyRotation, dummyScale);
        mesh.setMatrixAt(i, dummyMatrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, VrEngine.MAX_PARTICLES]}
      frustumCulled={false}
    >
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
};
