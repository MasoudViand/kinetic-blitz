import { Landmark3D, Point2D } from '../types/game';

/**
 * Calculates the visual fist / punch center position from MediaPipe pose landmarks.
 * Rather than using the wrist joint (landmarks 15/16) which sits behind the hand on the forearm,
 * this function tracks the knuckles (index 19/20, pinky 17/18, thumb 21/22)
 * or projects along the forearm vector from elbow through wrist.
 */
export function getFistPosition(landmarks: Landmark3D[], hand: 'left' | 'right'): Point2D | null {
  const isLeft = hand === 'left';
  const wrist = isLeft ? landmarks[15] : landmarks[16];
  const pinky = isLeft ? landmarks[17] : landmarks[18];
  const index = isLeft ? landmarks[19] : landmarks[20];
  const thumb = isLeft ? landmarks[21] : landmarks[22];
  const elbow = isLeft ? landmarks[13] : landmarks[14];

  if (!wrist || (wrist.visibility ?? 1) < 0.25) return null;

  const indexVis = index?.visibility ?? 0;
  const pinkyVis = pinky?.visibility ?? 0;
  const thumbVis = thumb?.visibility ?? 0;
  const elbowVis = elbow?.visibility ?? 0;

  // 1. Forearm geometry
  let forearmDir: Point2D | null = null;
  let forearmLen = 0;
  if (elbow && elbowVis > 0.2) {
    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;
    forearmLen = Math.hypot(dx, dy);
    if (forearmLen > 0.03) {
      forearmDir = { x: dx / forearmLen, y: dy / forearmLen };
    }
  }

  // 2. Gather visible knuckle/hand landmarks
  const visibleFingers: Point2D[] = [];
  if (index && indexVis > 0.2) visibleFingers.push({ x: index.x, y: index.y });
  if (pinky && pinkyVis > 0.2) visibleFingers.push({ x: pinky.x, y: pinky.y });
  if (thumb && thumbVis > 0.2) visibleFingers.push({ x: thumb.x, y: thumb.y });

  if (visibleFingers.length > 0) {
    const knuckleCenter = {
      x: visibleFingers.reduce((s, p) => s + p.x, 0) / visibleFingers.length,
      y: visibleFingers.reduce((s, p) => s + p.y, 0) / visibleFingers.length,
    };

    const dKnuckleX = knuckleCenter.x - wrist.x;
    const dKnuckleY = knuckleCenter.y - wrist.y;
    const knuckleDist = Math.hypot(dKnuckleX, dKnuckleY);

    // If knuckles are clearly distinguished from wrist:
    if (knuckleDist > 0.02) {
      return knuckleCenter;
    }
  }

  // 3. If knuckles are not clearly separated (e.g. tightly clenched fist),
  // project along forearm vector by ~28% of forearm length
  if (forearmDir && forearmLen > 0.03) {
    const extension = forearmLen * 0.28;
    return {
      x: wrist.x + forearmDir.x * extension,
      y: wrist.y + forearmDir.y * extension,
    };
  }

  // 4. Fallback to wrist
  return { x: wrist.x, y: wrist.y };
}
