import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  const baseZ = position[2];
  const currentZ = useRef(baseZ);

  // Redraw canvas on state changes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const texture = textureRef.current;
    if (!canvas || !texture) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    const activeColor = isHovered ? (hoverColor || '#ffffff') : color;
    const isDanger = color === '#ef4444' || color === '#f87171';

    // Background panel with rounded corners
    const bgFill = isHovered
      ? isDanger
        ? 'rgba(68, 16, 24, 0.95)'
        : 'rgba(16, 36, 68, 0.95)'
      : isDanger
      ? 'rgba(38, 10, 16, 0.88)'
      : 'rgba(8, 15, 29, 0.88)';

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

    texture.needsUpdate = true;
  }, [color, hoverColor, isHovered, label, sublabel]);

  // Create texture once
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 180;
    canvasRef.current = canvas;

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    textureRef.current = texture;

    redraw();

    return () => {
      texture.dispose();
    };
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

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
        {textureRef.current && (
          <meshBasicMaterial
            map={textureRef.current}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        )}
      </mesh>
    </group>
  );
};
