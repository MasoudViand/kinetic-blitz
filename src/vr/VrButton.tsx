import React, { useRef, useState, useMemo, useLayoutEffect, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { vrUiRegistry } from './vrUi';

interface VrButtonProps {
  id: string;
  label: string;
  sublabel?: string;
  width: number;
  height: number;
  position: [number, number, number];
  color: string;
  hoverColor?: string;
  onClick: () => void;
  disabled?: boolean;
}

function drawButtonToCanvas(
  canvas: HTMLCanvasElement,
  label: string,
  sublabel: string | undefined,
  color: string,
  hoverColor: string | undefined,
  isHovered: boolean
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cw = canvas.width;
  const ch = canvas.height;

  ctx.clearRect(0, 0, cw, ch);

  const activeColor = isHovered ? (hoverColor || '#ffffff') : color;
  const isDanger = color === '#ef4444' || color === '#f87171';

  // Background panel with rounded corners (never blank white)
  const bgFill = isHovered
    ? isDanger
      ? 'rgba(68, 16, 24, 0.96)'
      : 'rgba(16, 36, 68, 0.96)'
    : isDanger
    ? 'rgba(38, 10, 16, 0.90)'
    : 'rgba(8, 15, 29, 0.90)';

  ctx.fillStyle = bgFill;
  ctx.beginPath();
  ctx.roundRect(8, 8, cw - 16, ch - 16, 24);
  ctx.fill();

  // Glowing border (thicker and brighter on hover)
  ctx.strokeStyle = activeColor;
  ctx.lineWidth = isHovered ? 8 : 4;
  ctx.stroke();

  // Additional inner glow when hovered
  if (isHovered) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(14, 14, cw - 28, ch - 28, 20);
    ctx.stroke();
  }

  // Label Text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isHovered ? '#ffffff' : activeColor;
  ctx.font = isHovered ? '900 48px monospace' : '900 44px monospace';

  const textY = sublabel ? ch / 2 - 14 : ch / 2;
  ctx.fillText(label, cw / 2, textY);

  if (sublabel) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(sublabel, cw / 2, ch / 2 + 28);
  }
}

export const VrButton: React.FC<VrButtonProps> = ({
  id,
  label,
  sublabel,
  width,
  height,
  position,
  color,
  hoverColor,
  onClick,
  disabled = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);

  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  const baseZ = position[2];
  const currentZ = useRef(baseZ);

  // Synchronously create canvas, draw initial unhovered state, and instantiate CanvasTexture
  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 180;

    // Synchronously paint the initial unhovered state immediately
    drawButtonToCanvas(c, label, sublabel, color, hoverColor, false);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;

    return { canvas: c, texture: tex };
  }, []);

  // Dispose texture on unmount
  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  // Synchronously re-draw whenever label, sublabel, color, hoverColor, or isHovered changes
  useLayoutEffect(() => {
    drawButtonToCanvas(canvas, label, sublabel, color, hoverColor, isHovered);
    texture.needsUpdate = true;
  }, [canvas, texture, label, sublabel, color, hoverColor, isHovered]);

  // Register with VR UI Registry for Laser Pointer intersection
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || disabled) return;

    vrUiRegistry.registerButton({
      id,
      mesh,
      onClick: () => {
        onClickRef.current();
      },
      onHover: (hovered) => {
        setIsHovered(hovered);
      },
    });

    return () => {
      vrUiRegistry.unregisterButton(id);
    };
  }, [id, disabled]);

  // Visual hover feedback: +0.02m Z pop with smooth interpolation
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const targetZ = baseZ + (isHovered ? 0.02 : 0);
    currentZ.current += (targetZ - currentZ.current) * Math.min(1, delta * 18);
    groupRef.current.position.z = currentZ.current;
  });

  return (
    <group ref={groupRef} position={[position[0], position[1], baseZ]}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setIsHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setIsHovered(false);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClickRef.current();
        }}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={texture}
          transparent
          toneMapped={false}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
