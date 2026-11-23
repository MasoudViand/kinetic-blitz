import React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { vrEngine } from './vrEngine';
import { VrBlitzOrb, VrVoltNode, VrLaserBarrier } from './vrTypes';

export const VrTargets: React.FC = () => {
  // Trigger R3F re-renders each frame cleanly without React state overhead
  const [, setFrameCount] = React.useState(0);
  useFrame(() => {
    // Only force re-render when targets exist
    if (
      vrEngine.blitzOrbs.length > 0 ||
      vrEngine.voltNodes.length > 0 ||
      vrEngine.laserBarriers.length > 0
    ) {
      setFrameCount((c) => (c + 1) % 1000000);
    }
  });

  return (
    <group>
      {/* 1. Blitz Orbs */}
      {vrEngine.blitzOrbs.map((orb) => (
        <BlitzOrbMesh key={orb.id} orb={orb} />
      ))}

      {/* 2. Volt Nodes */}
      {vrEngine.voltNodes.map((node) => (
        <VoltNodeMesh key={node.id} node={node} />
      ))}

      {/* 3. Laser Barriers */}
      {vrEngine.laserBarriers.map((laser) => (
        <LaserBarrierMesh key={laser.id} laser={laser} />
      ))}
    </group>
  );
};

// Blitz Orb Component
const BlitzOrbMesh: React.FC<{ orb: VrBlitzOrb }> = ({ orb }) => {
  const isTelegraph = orb.elapsed < orb.telegraphTime;
  const isCyan = orb.color === 'cyan';
  const colorHex = isCyan ? '#00f0ff' : '#ff0077';
  const glowHex = isCyan ? '#00bfff' : '#ff1493';

  // Telegraph ring scale shrinks toward orb as 650ms elapses
  const telegraphProgress = Math.min(1.0, orb.elapsed / orb.telegraphTime);
  const ringScale = isTelegraph ? 2.2 - telegraphProgress * 1.2 : 1.0;

  return (
    <group position={orb.currentPos}>
      {/* 650ms 3D Entry Ring Telegraph */}
      {isTelegraph && (
        <mesh scale={[ringScale, ringScale, ringScale]}>
          <ringGeometry args={[orb.radius * 1.2, orb.radius * 1.35, 32]} />
          <meshBasicMaterial
            color={colorHex}
            transparent
            opacity={0.85 * (1 - telegraphProgress * 0.3)}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Solid Inner Core */}
      <mesh>
        <sphereGeometry args={[orb.radius * 0.75, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Primary Colored Core */}
      <mesh>
        <sphereGeometry args={[orb.radius, 16, 16]} />
        <meshBasicMaterial color={colorHex} />
      </mesh>

      {/* Nested Additive Glow Shell 1 */}
      <mesh>
        <sphereGeometry args={[orb.radius * 1.28, 16, 16]} />
        <meshBasicMaterial
          color={glowHex}
          transparent
          opacity={orb.inStrikeZone ? 0.65 : 0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Nested Additive Glow Shell 2 */}
      <mesh>
        <sphereGeometry args={[orb.radius * 1.55, 12, 12]} />
        <meshBasicMaterial
          color={colorHex}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// Volt Node Component
const VoltNodeMesh: React.FC<{ node: VrVoltNode }> = ({ node }) => {
  const isTelegraph = node.elapsed < node.telegraphTime;
  const telegraphProgress = Math.min(1.0, node.elapsed / node.telegraphTime);
  const ringScale = isTelegraph ? 2.2 - telegraphProgress * 1.2 : 1.0;

  const chargeScale = 0.3 + node.holdProgress * 0.85;

  return (
    <group position={node.currentPos}>
      {/* Entry Ring Telegraph */}
      {isTelegraph && (
        <mesh scale={[ringScale, ringScale, ringScale]}>
          <ringGeometry args={[node.radius * 1.25, node.radius * 1.4, 32]} />
          <meshBasicMaterial
            color="#ffd700"
            transparent
            opacity={0.85 * (1 - telegraphProgress * 0.3)}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* White Hot Core */}
      <mesh>
        <sphereGeometry args={[node.radius * 0.65, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Golden Node Body */}
      <mesh>
        <sphereGeometry args={[node.radius, 16, 16]} />
        <meshBasicMaterial color="#ffbb00" />
      </mesh>

      {/* Outer Golden Glow Shell */}
      <mesh>
        <sphereGeometry args={[node.radius * 1.35, 16, 16]} />
        <meshBasicMaterial
          color="#ffd700"
          transparent
          opacity={node.isHeld ? 0.75 : 0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Expanding Charge Aura While Held */}
      {node.isHeld && (
        <mesh scale={[chargeScale, chargeScale, chargeScale]}>
          <sphereGeometry args={[node.radius * 1.7, 14, 14]} />
          <meshBasicMaterial
            color="#00f0ff"
            transparent
            opacity={0.45}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
};

// Laser Barrier Component
const LaserBarrierMesh: React.FC<{ laser: VrLaserBarrier }> = ({ laser }) => {
  const isSquat = laser.orientation === 'horizontal_squat';

  if (isSquat) {
    // Horizontal overhead bar (Duck/Squat)
    return (
      <group position={[0, laser.barY, laser.currentZ]}>
        {/* Core Dangerous Red Beam */}
        <mesh>
          <boxGeometry args={[laser.width, laser.height, 0.12]} />
          <meshBasicMaterial color="#ff0044" />
        </mesh>

        {/* Outer Crimson Additive Glow Shell */}
        <mesh>
          <boxGeometry args={[laser.width * 1.05, laser.height * 1.6, 0.22]} />
          <meshBasicMaterial
            color="#ff0022"
            transparent
            opacity={0.45}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  // Vertical Side Beam (Lean Left / Right)
  return (
    <group position={[laser.beamX, 1.4, laser.currentZ]}>
      {/* Core Beam */}
      <mesh>
        <boxGeometry args={[laser.width, laser.height, 0.12]} />
        <meshBasicMaterial color="#ff0044" />
      </mesh>

      {/* Outer Glow */}
      <mesh>
        <boxGeometry args={[laser.width * 1.15, laser.height * 1.05, 0.22]} />
        <meshBasicMaterial
          color="#ff0022"
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
