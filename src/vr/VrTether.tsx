import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { vrEngine } from './vrEngine';

export const VrTether: React.FC = () => {
  const pointsCount = 8;
  const positions = useRef(new Float32Array(pointsCount * 3));

  const { innerLine, glowLine } = useMemo(() => {
    const geom1 = new THREE.BufferGeometry();
    geom1.setAttribute('position', new THREE.BufferAttribute(positions.current, 3));
    const mat1 = new THREE.LineBasicMaterial({
      color: '#ffd700',
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
    });
    const line1 = new THREE.Line(geom1, mat1);
    line1.visible = false;

    const geom2 = new THREE.BufferGeometry();
    geom2.setAttribute('position', new THREE.BufferAttribute(positions.current, 3));
    const mat2 = new THREE.LineBasicMaterial({
      color: '#00f0ff',
      linewidth: 4,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const line2 = new THREE.Line(geom2, mat2);
    line2.visible = false;

    return { innerLine: line1, glowLine: line2 };
  }, []);

  useEffect(() => {
    return () => {
      innerLine.geometry.dispose();
      (innerLine.material as THREE.Material).dispose();
      glowLine.geometry.dispose();
      (glowLine.material as THREE.Material).dispose();
    };
  }, [innerLine, glowLine]);

  useFrame(() => {
    const activeVolt = vrEngine.voltNodes.find((v) => v.isHeld && v.heldHand);

    if (!activeVolt || !activeVolt.heldHand) {
      innerLine.visible = false;
      glowLine.visible = false;
      return;
    }

    const hand = vrEngine.hands[activeVolt.heldHand];
    if (!hand.active) {
      innerLine.visible = false;
      glowLine.visible = false;
      return;
    }

    innerLine.visible = true;
    glowLine.visible = true;

    const start = hand.position;
    const end = activeVolt.currentPos;
    const posArr = positions.current;

    for (let i = 0; i < pointsCount; i++) {
      const t = i / (pointsCount - 1);
      const x = THREE.MathUtils.lerp(start.x, end.x, t);
      const y = THREE.MathUtils.lerp(start.y, end.y, t);
      const z = THREE.MathUtils.lerp(start.z, end.z, t);

      const jitter = (i > 0 && i < pointsCount - 1) ? 0.02 : 0;
      posArr[i * 3] = x + (Math.random() - 0.5) * jitter;
      posArr[i * 3 + 1] = y + (Math.random() - 0.5) * jitter;
      posArr[i * 3 + 2] = z + (Math.random() - 0.5) * jitter;
    }

    innerLine.geometry.attributes.position.needsUpdate = true;
    glowLine.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group>
      <primitive object={innerLine} />
      <primitive object={glowLine} />
    </group>
  );
};
