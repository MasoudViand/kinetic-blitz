import { Landmark3D, PostureType, CalibrationData, Point2D } from '../types/game';

export class PostureDetector {
  private absentStartTime: number | null = null;
  private readonly absentThresholdMs = 2000;

  // Calibration accumulator
  private calibrationSamples: {
    shoulderCenter: Point2D;
    shoulderWidth: number;
    torsoHeight: number;
    headY: number;
    posture: PostureType;
  }[] = [];

  public checkPresence(landmarks: Landmark3D[] | null): boolean {
    if (!landmarks || landmarks.length < 17) {
      return false;
    }

    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    const minConf = 0.55;
    const noseOk = (nose.visibility ?? 1.0) >= minConf;
    const shouldersOk = (leftShoulder.visibility ?? 1.0) >= minConf && (rightShoulder.visibility ?? 1.0) >= minConf;
    const oneWristOk = (leftWrist.visibility ?? 1.0) >= minConf || (rightWrist.visibility ?? 1.0) >= minConf;

    return noseOk && shouldersOk && oneWristOk;
  }

  public handlePresenceTracking(
    isPresent: boolean,
    now: number,
    onAutoPause: () => void
  ) {
    if (!isPresent) {
      if (this.absentStartTime === null) {
        this.absentStartTime = now;
      } else if (now - this.absentStartTime > this.absentThresholdMs) {
        onAutoPause();
      }
    } else {
      this.absentStartTime = null;
    }
  }

  public classifyPosture(landmarks: Landmark3D[]): PostureType {
    if (landmarks.length < 27) return 'seated';

    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    const hipVis = ((leftHip.visibility ?? 0) + (rightHip.visibility ?? 0)) / 2;
    const kneeVis = ((leftKnee.visibility ?? 0) + (rightKnee.visibility ?? 0)) / 2;

    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const kneeY = (leftKnee.y + rightKnee.y) / 2;

    const torsoLength = Math.max(0.15, hipY - shoulderY);
    const thighLength = kneeY - hipY;

    // Standing criteria:
    // Hips and knees clearly visible AND vertical separation between hip and knee exceeds 0.55x torso
    if (hipVis > 0.45 && kneeVis > 0.45 && thighLength > torsoLength * 0.55) {
      return 'standing';
    }

    return 'seated';
  }

  public resetCalibration() {
    this.calibrationSamples = [];
  }

  public addCalibrationSample(landmarks: Landmark3D[]) {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const nose = landmarks[0];

    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
    const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
    const dx = rightShoulder.x - leftShoulder.x;
    const dy = rightShoulder.y - leftShoulder.y;
    const shoulderWidth = Math.max(0.12, Math.sqrt(dx * dx + dy * dy));

    let torsoHeight = shoulderWidth * 1.4;
    if (landmarks.length > 24) {
      const hipCenterY = (landmarks[23].y + landmarks[24].y) / 2;
      torsoHeight = Math.max(torsoHeight, hipCenterY - shoulderCenterY);
    }

    const posture = this.classifyPosture(landmarks);

    this.calibrationSamples.push({
      shoulderCenter: { x: shoulderCenterX, y: shoulderCenterY },
      shoulderWidth,
      torsoHeight,
      headY: nose.y,
      posture,
    });
  }

  public finalizeCalibration(manualOverride?: PostureType): CalibrationData {
    if (this.calibrationSamples.length === 0) {
      return {
        shoulderCenter: { x: 0.5, y: 0.4 },
        shoulderWidth: 0.24,
        torsoHeight: 0.35,
        headY: 0.25,
        reachRadiusX: 0.4,
        reachRadiusY: 0.35,
        posture: manualOverride || 'standing',
        calibratedAt: Date.now(),
      };
    }

    let sumX = 0;
    let sumY = 0;
    let sumWidth = 0;
    let sumTorso = 0;
    let sumHeadY = 0;
    let standingVotes = 0;

    for (const s of this.calibrationSamples) {
      sumX += s.shoulderCenter.x;
      sumY += s.shoulderCenter.y;
      sumWidth += s.shoulderWidth;
      sumTorso += s.torsoHeight;
      sumHeadY += s.headY;
      if (s.posture === 'standing') standingVotes++;
    }

    const count = this.calibrationSamples.length;
    const avgShoulderWidth = sumWidth / count;
    const detectedPosture: PostureType = manualOverride || (standingVotes / count > 0.5 ? 'standing' : 'seated');

    return {
      shoulderCenter: { x: sumX / count, y: sumY / count },
      shoulderWidth: avgShoulderWidth,
      torsoHeight: sumTorso / count,
      headY: sumHeadY / count,
      reachRadiusX: avgShoulderWidth * (detectedPosture === 'standing' ? 2.0 : 1.6),
      reachRadiusY: avgShoulderWidth * (detectedPosture === 'standing' ? 1.7 : 1.3),
      posture: detectedPosture,
      calibratedAt: Date.now(),
    };
  }
}

export const postureDetector = new PostureDetector();
