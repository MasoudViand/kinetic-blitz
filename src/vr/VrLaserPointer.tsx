import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { vrEngine } from './vrEngine';
import { soundEngine } from '../audio/soundEngine';
import { vrUiRegistry, VrUiButtonEntry } from './vrUi';

interface VrLaserRayProps {
  handedness: 'left' | 'right';
  inputSource: XRInputSource;
}

export const VrLaserRay: React.FC<VrLaserRayProps> = ({ handedness, inputSource }) => {
  const rootGroup = useRef<THREE.Group>(null);
  const beamMesh = useRef<THREE.Mesh>(null);
  const reticleMesh = useRef<THREE.Group>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const reticleRingMat = useRef<THREE.MeshBasicMaterial>(null);
  const reticleDotMat = useRef<THREE.MeshBasicMaterial>(null);

  const lastHoveredButton = useRef<VrUiButtonEntry | null>(null);
  const lastClickTime = useRef<number>(0);
  const prevTriggerPressed = useRef<boolean>(false);
  const currentOpacity = useRef<number>(0);

  const raycaster = useRef(new THREE.Raycaster());
  const tempOrigin = useRef(new THREE.Vector3());
  const tempQuat = useRef(new THREE.Quaternion());
  const tempForward = useRef(new THREE.Vector3());

  // Cleanup hover state on unmount
  useEffect(() => {
    return () => {
      if (lastHoveredButton.current) {
        lastHoveredButton.current.onHover(false);
        lastHoveredButton.current = null;
      }
    };
  }, []);

  useFrame((_, delta) => {
    if (!rootGroup.current) return;

    // 1. Compute World Origin and Forward Direction for targetRaySpace
    rootGroup.current.getWorldPosition(tempOrigin.current);
    rootGroup.current.getWorldQuaternion(tempQuat.current);
    tempForward.current.set(0, 0, -1).applyQuaternion(tempQuat.current);

    raycaster.current.set(tempOrigin.current, tempForward.current);
    raycaster.current.far = 8;

    // 2. Raycast Against Interactive 3D Buttons
    const buttons = vrUiRegistry.getButtons();
    const buttonMeshes = buttons.map((b) => b.mesh);

    let hitDistance = 2.0;
    let hoveredButton: VrUiButtonEntry | null = null;
    let aimingAtHud = false;

    if (buttonMeshes.length > 0) {
      const hits = raycaster.current.intersectObjects(buttonMeshes, true);
      if (hits.length > 0) {
        hitDistance = hits[0].distance;
        const hitMesh = hits[0].object;
        hoveredButton =
          buttons.find((b) => b.mesh === hitMesh || b.mesh.children.includes(hitMesh)) || null;
      }
    }

    // If no button is hit, test against the HUD panel plane
    if (!hoveredButton && vrUiRegistry.hudPlane) {
      const hudHits = raycaster.current.intersectObject(vrUiRegistry.hudPlane, false);
      if (hudHits.length > 0) {
        hitDistance = hudHits[0].distance;
        aimingAtHud = true;
      }
    }

    // 3. Hover State Transitions & Haptic Feedback
    if (hoveredButton !== lastHoveredButton.current) {
      if (lastHoveredButton.current) {
        lastHoveredButton.current.onHover(false);
      }
      if (hoveredButton) {
        hoveredButton.onHover(true);
        // Haptic tick on hover (0.15 intensity, 15ms duration)
        vrEngine.pulseHaptic(handedness, 0.15, 15);
      }
      lastHoveredButton.current = hoveredButton;
    }

    // 4. Trigger Click Handling (Rising-edge detection on buttons[0])
    const gamepad = inputSource.gamepad;
    const isTriggerPressed = gamepad?.buttons?.[0]?.pressed ?? false;
    const isTriggerRisingEdge = isTriggerPressed && !prevTriggerPressed.current;
    prevTriggerPressed.current = isTriggerPressed;

    if (isTriggerRisingEdge && hoveredButton) {
      const now = performance.now();
      if (now - lastClickTime.current >= 350) {
        lastClickTime.current = now;
        // Haptic click (0.40 intensity, 40ms duration)
        vrEngine.pulseHaptic(handedness, 0.40, 40);
        // Audio click
        soundEngine.playButtonClick();
        // Invoke button callback
        hoveredButton.onClick();
      }
    }

    // 5. Smart Visibility Logic
    const phase = vrEngine.phase;
    let targetOpacity = 0;

    if (phase === 'PAUSED' || phase === 'SUMMARY') {
      // Always visible in PAUSED and SUMMARY menus
      targetOpacity = 0.85;
    } else if (phase === 'PLAYING') {
      const hand = vrEngine.hands[handedness];
      const punchSpeed = hand.active ? hand.velocity.length() : 0;

      if (punchSpeed > 1.2) {
        // Completely hidden during punches
        targetOpacity = 0;
      } else if (hoveredButton || aimingAtHud) {
        // Automatically fades in when aiming at HUD / Pause button plane
        targetOpacity = 0.85;
      } else {
        targetOpacity = 0;
      }
    }

    // Smooth opacity transition
    const alpha = Math.min(1.0, delta * 14);
    currentOpacity.current += (targetOpacity - currentOpacity.current) * alpha;
    const opacity = currentOpacity.current;
    const isVisible = opacity > 0.02;

    // 6. Update Laser Beam Geometry (Local -Z)
    if (beamMesh.current && beamMat.current) {
      beamMesh.current.visible = isVisible;
      if (isVisible) {
        beamMesh.current.position.set(0, 0, -hitDistance / 2);
        beamMesh.current.scale.set(1, hitDistance, 1);
        beamMat.current.opacity = opacity * 0.8;
      }
    }

    // 7. Update Cursor Reticle (Local -Z)
    if (reticleMesh.current && reticleRingMat.current && reticleDotMat.current) {
      const reticleVisible = isVisible && (hoveredButton !== null || aimingAtHud);
      reticleMesh.current.visible = reticleVisible;
      if (reticleVisible) {
        reticleMesh.current.position.set(0, 0, -hitDistance + 0.005);
        const scale = hoveredButton ? 1.35 : 1.0;
        reticleMesh.current.scale.set(scale, scale, scale);

        reticleRingMat.current.opacity = hoveredButton ? Math.min(1.0, opacity * 1.2) : opacity * 0.8;
        reticleDotMat.current.opacity = hoveredButton ? Math.min(1.0, opacity * 1.4) : opacity * 0.9;
      }
    }
  });

  return (
    <group ref={rootGroup}>
      {/* Laser Ray Beam: 1m base cylinder along Y, rotated around X to point along -Z */}
      <mesh ref={beamMesh} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <cylinderGeometry args={[0.0016, 0.0028, 1, 8]} />
        <meshBasicMaterial
          ref={beamMat}
          color="#00f0ff"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Cursor Reticle Dot & Ring placed at intersection */}
      <group ref={reticleMesh} visible={false}>
        {/* Outer Ring */}
        <mesh>
          <ringGeometry args={[0.012, 0.019, 24]} />
          <meshBasicMaterial
            ref={reticleRingMat}
            color="#00f0ff"
            transparent
            opacity={0.8}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Center Point */}
        <mesh>
          <circleGeometry args={[0.006, 16]} />
          <meshBasicMaterial
            ref={reticleDotMat}
            color="#ffffff"
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
};
