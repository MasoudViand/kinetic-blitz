import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { vrEngine } from './vrEngine';
import { VrBlitzOrb, VrVoltNode, VrLaserBarrier, VR_COLORS } from './vrTypes';

export const VrTargets: React.FC = () => {
  // Store refs to 3D groups for imperative 90 FPS transform updates
  const orbGroups = useRef<Map<string, THREE.Group>>(new Map());
  const voltGroups = useRef<Map<string, THREE.Group>>(new Map());
  const laserGroups = useRef<Map<string, THREE.Group>>(new Map());

  // Store refs to visual sub-elements (targeting rings, charge auras)
  const orbTargetRings = useRef<Map<string, THREE.Mesh>>(new Map());
  const voltChargeAuras = useRef<Map<string, THREE.Mesh>>(new Map());

  // React state ONLY re-renders when targets are added or removed
  const [, setListVersion] = useState(0);

  useEffect(() => {
    vrEngine.onTargetsListChanged = () => {
      setListVersion((v) => v + 1);
    };
    return () => {
      vrEngine.onTargetsListChanged = undefined;
    };
  }, []);

  // Imperative per-frame update loop (Zero React re-renders)
  useFrame(() => {
    if (vrEngine.state === 'paused') return;

    // 1. Update Blitz Orbs
    for (let i = 0; i < vrEngine.blitzOrbs.length; i++) {
      const orb = vrEngine.blitzOrbs[i];
      const group = orbGroups.current.get(orb.id);
      if (group) {
        group.position.copy(orb.worldPos);

        // Punch-Ready Visual Cue: Show crisp targeting ring when in arm's reach
        const ring = orbTargetRings.current.get(orb.id);
        if (ring) {
          ring.visible = orb.inStrikeZone;
          if (orb.inStrikeZone) {
            // Subtle rotation animation for the targeting reticle
            ring.rotation.z += 0.05;
          }
        }
      }
    }

    // 2. Update Volt Nodes
    for (let i = 0; i < vrEngine.voltNodes.length; i++) {
      const node = vrEngine.voltNodes[i];
      const group = voltGroups.current.get(node.id);
      if (group) {
        group.position.copy(node.worldPos);

        // Update charge aura scale based on hold progress
        const aura = voltChargeAuras.current.get(node.id);
        if (aura) {
          aura.visible = node.isHeld;
          if (node.isHeld) {
            const chargeScale = 0.5 + node.holdProgress * 0.9;
            aura.scale.set(chargeScale, chargeScale, chargeScale);
          }
        }
      }
    }

    // 3. Update Laser Barriers
    for (let i = 0; i < vrEngine.laserBarriers.length; i++) {
      const laser = vrEngine.laserBarriers[i];
      const group = laserGroups.current.get(laser.id);
      if (group) {
        group.position.copy(laser.worldPos);
        group.rotation.y = laser.worldRotationY;
      }
    }
  });

  return (
    <group visible={vrEngine.state !== 'paused'}>
      {/* 1. Blitz Orbs */}
      {vrEngine.blitzOrbs.map((orb) => (
        <group
          key={orb.id}
          ref={(el) => {
            if (el) {
              orbGroups.current.set(orb.id, el);
              el.position.copy(orb.worldPos);
            } else {
              orbGroups.current.delete(orb.id);
              orbTargetRings.current.delete(orb.id);
            }
          }}
        >
          <BlitzOrbMesh
            orb={orb}
            setRingRef={(ringEl) => {
              if (ringEl) {
                orbTargetRings.current.set(orb.id, ringEl);
              } else {
                orbTargetRings.current.delete(orb.id);
              }
            }}
          />
        </group>
      ))}

      {/* 2. Volt Nodes */}
      {vrEngine.voltNodes.map((node) => (
        <group
          key={node.id}
          ref={(el) => {
            if (el) {
              voltGroups.current.set(node.id, el);
              el.position.copy(node.worldPos);
            } else {
              voltGroups.current.delete(node.id);
              voltChargeAuras.current.delete(node.id);
            }
          }}
        >
          <VoltNodeMesh
            node={node}
            setAuraRef={(auraEl) => {
              if (auraEl) {
                voltChargeAuras.current.set(node.id, auraEl);
              } else {
                voltChargeAuras.current.delete(node.id);
              }
            }}
          />
        </group>
      ))}

      {/* 3. Laser Barriers */}
      {vrEngine.laserBarriers.map((laser) => (
        <group
          key={laser.id}
          ref={(el) => {
            if (el) {
              laserGroups.current.set(laser.id, el);
              el.position.copy(laser.worldPos);
              el.rotation.y = laser.worldRotationY;
            } else {
              laserGroups.current.delete(laser.id);
            }
          }}
        >
          <LaserBarrierMesh laser={laser} />
        </group>
      ))}
    </group>
  );
};

// Blitz Orb Visuals
const BlitzOrbMesh: React.FC<{
  orb: VrBlitzOrb;
  setRingRef: (el: THREE.Mesh | null) => void;
}> = ({ orb, setRingRef }) => {
  const isCyan = orb.color === 'cyan';
  const colorHex = isCyan ? VR_COLORS.leftCyan : VR_COLORS.rightMagenta;
  const glowHex = isCyan ? VR_COLORS.leftGlow : VR_COLORS.rightGlow;

  return (
    <group>
      {/* Punch-Ready Subtle Targeting Ring (Shown when localZ >= -0.80m) */}
      <mesh ref={setRingRef} visible={false}>
        <ringGeometry args={[orb.radius * 1.35, orb.radius * 1.50, 32]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* White Hot Solid Core */}
      <mesh>
        <sphereGeometry args={[orb.radius * 0.72, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Primary Colored Core */}
      <mesh>
        <sphereGeometry args={[orb.radius, 16, 16]} />
        <meshBasicMaterial color={colorHex} />
      </mesh>

      {/* Outer Additive Glow Shell 1 */}
      <mesh>
        <sphereGeometry args={[orb.radius * 1.32, 16, 16]} />
        <meshBasicMaterial
          color={glowHex}
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Outer Additive Glow Shell 2 */}
      <mesh>
        <sphereGeometry args={[orb.radius * 1.62, 12, 12]} />
        <meshBasicMaterial
          color={colorHex}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// Volt Node Visuals
const VoltNodeMesh: React.FC<{
  node: VrVoltNode;
  setAuraRef: (el: THREE.Mesh | null) => void;
}> = ({ node, setAuraRef }) => {
  return (
    <group>
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
          color={VR_COLORS.goldNode}
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Expanding Charge Aura While Held */}
      <mesh ref={setAuraRef} visible={false}>
        <sphereGeometry args={[node.radius * 1.7, 14, 14]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// Laser Barrier Visuals
const LaserBarrierMesh: React.FC<{ laser: VrLaserBarrier }> = ({ laser }) => {
  const isSquat = laser.orientation === 'horizontal_squat';

  if (isSquat) {
    return (
      <group>
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
    <group>
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
