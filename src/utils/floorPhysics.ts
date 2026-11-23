export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RoomRect {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  doors: Array<{
    side: 'top' | 'bottom' | 'left' | 'right';
    start: number; // relative offset along that edge in meters
    end: number;   // relative offset along that edge in meters
  }>;
}

export const USER_COLLISION_RADIUS = 0.34; // meters

export const FLOOR_ROOMS: RoomRect[] = [
  {
    id: 'room_101',
    name: 'Lab 101',
    x: 2,
    y: 2,
    w: 10,
    h: 8.5,
    doors: [
      { side: 'right', start: 3.4, end: 5.6 },  // East corridor door (y: 5.4..7.6)
      { side: 'bottom', start: 7.4, end: 9.6 }, // South hallway door (x: 9.4..11.6)
    ],
  },
  {
    id: 'room_102',
    name: 'Conference Room A',
    x: 20,
    y: 2,
    w: 10,
    h: 8.5,
    doors: [
      { side: 'left', start: 3.4, end: 5.6 },   // West corridor door (y: 5.4..7.6)
      { side: 'bottom', start: 0.4, end: 2.6 }, // South hallway door (x: 20.4..22.6)
    ],
  },
  {
    id: 'room_105',
    name: 'Server Hub',
    x: 13,
    y: 1.5,
    w: 6,
    h: 4,
    doors: [
      { side: 'bottom', start: 1.9, end: 4.1 }, // South door to North Corridor (x: 14.9..17.1)
    ],
  },
  {
    id: 'room_103',
    name: 'Cafeteria',
    x: 2,
    y: 15.5,
    w: 10,
    h: 8.5,
    doors: [
      { side: 'right', start: 2.9, end: 5.1 }, // East door to South Corridor (y: 18.4..20.6)
      { side: 'top', start: 7.4, end: 9.6 },   // North door to West Hallway (x: 9.4..11.6)
    ],
  },
  {
    id: 'room_104',
    name: 'Executive Suite',
    x: 20,
    y: 15.5,
    w: 10,
    h: 8.5,
    doors: [
      { side: 'left', start: 2.9, end: 5.1 }, // West door to South Corridor (y: 18.4..20.6)
      { side: 'top', start: 0.4, end: 2.6 },  // North door to East Hallway (x: 20.4..22.6)
    ],
  },
  {
    id: 'corr_center',
    name: 'Central Atrium',
    x: 12,
    y: 9.5,
    w: 8,
    h: 7,
    doors: [
      { side: 'top', start: 2.6, end: 5.4 },    // North archway (x: 14.6..17.4)
      { side: 'bottom', start: 2.6, end: 5.4 }, // South archway (x: 14.6..17.4)
      { side: 'left', start: 2.1, end: 4.9 },   // West archway (y: 11.6..14.4)
      { side: 'right', start: 2.1, end: 4.9 },  // East archway (y: 11.6..14.4)
    ],
  },
];

function splitEdgeWithDoors(
  length: number,
  doors: Array<{ start: number; end: number }>
): Array<[number, number]> {
  if (doors.length === 0) return [[0, length]];
  const sorted = [...doors].sort((a, b) => a.start - b.start);
  const segments: Array<[number, number]> = [];
  let cursor = 0;

  for (const door of sorted) {
    const dStart = Math.max(0, door.start);
    const dEnd = Math.min(length, door.end);
    if (dStart > cursor + 0.01) {
      segments.push([cursor, dStart]);
    }
    cursor = Math.max(cursor, dEnd);
  }
  if (cursor < length - 0.01) {
    segments.push([cursor, length]);
  }
  return segments;
}

export function buildWallSegments(rooms: RoomRect[] = FLOOR_ROOMS): WallSegment[] {
  const walls: WallSegment[] = [
    // Building outer perimeter walls (meters)
    { x1: 1.0, y1: 1.0, x2: 31.0, y2: 1.0 },
    { x1: 31.0, y1: 1.0, x2: 31.0, y2: 24.1 },
    { x1: 31.0, y1: 24.1, x2: 1.0, y2: 24.1 },
    { x1: 1.0, y1: 24.1, x2: 1.0, y2: 1.0 },
  ];

  for (const room of rooms) {
    const topDoors = room.doors.filter((d) => d.side === 'top');
    const bottomDoors = room.doors.filter((d) => d.side === 'bottom');
    const leftDoors = room.doors.filter((d) => d.side === 'left');
    const rightDoors = room.doors.filter((d) => d.side === 'right');

    for (const [s, e] of splitEdgeWithDoors(room.w, topDoors)) {
      walls.push({ x1: room.x + s, y1: room.y, x2: room.x + e, y2: room.y });
    }
    for (const [s, e] of splitEdgeWithDoors(room.w, bottomDoors)) {
      walls.push({ x1: room.x + s, y1: room.y + room.h, x2: room.x + e, y2: room.y + room.h });
    }
    for (const [s, e] of splitEdgeWithDoors(room.h, leftDoors)) {
      walls.push({ x1: room.x, y1: room.y + s, x2: room.x, y2: room.y + e });
    }
    for (const [s, e] of splitEdgeWithDoors(room.h, rightDoors)) {
      walls.push({ x1: room.x + room.w, y1: room.y + s, x2: room.x + room.w, y2: room.y + e });
    }
  }

  return walls;
}

export const FLOOR_WALL_SEGMENTS: WallSegment[] = buildWallSegments(FLOOR_ROOMS);

function distPointToSegmentSq(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-8) {
    return wx * wx + wy * wy;
  }
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));
  const cx = x1 + t * vx;
  const cy = y1 + t * vy;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

function ccw(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (cy - ay) * (bx - ax) - (by - ay) * (cx - ax);
}

function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
): boolean {
  const d1 = ccw(cx, cy, dx, dy, ax, ay);
  const d2 = ccw(cx, cy, dx, dy, bx, by);
  const d3 = ccw(ax, ay, bx, by, cx, cy);
  const d4 = ccw(ax, ay, bx, by, dx, dy);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

function isMoveClear(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  walls: WallSegment[],
  radius: number
): boolean {
  const rSq = radius * radius;
  for (const w of walls) {
    if (segmentsIntersect(fromX, fromY, toX, toY, w.x1, w.y1, w.x2, w.y2)) {
      return false;
    }
    if (distPointToSegmentSq(toX, toY, w.x1, w.y1, w.x2, w.y2) < rSq) {
      return false;
    }
  }
  return true;
}

/**
 * Resolves movement from (fromX, fromY) by (dx, dy) against building walls with smooth wall-sliding.
 * Guarantees the user dot never tunnels through solid room walls and slides cleanly along corridors/doorways.
 */
export function resolveWallCollision(
  fromX: number,
  fromY: number,
  dx: number,
  dy: number,
  walls: WallSegment[] = FLOOR_WALL_SEGMENTS,
  radius: number = USER_COLLISION_RADIUS
): { x: number; y: number; hitWall: boolean } {
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-5) {
    return { x: fromX, y: fromY, hitWall: false };
  }

  // Sub-step into <= 0.14m increments so even large steps cannot tunnel across thin walls
  const steps = Math.max(1, Math.ceil(dist / 0.14));
  const stepDx = dx / steps;
  const stepDy = dy / steps;

  let curX = fromX;
  let curY = fromY;
  let hitWall = false;

  for (let i = 0; i < steps; i++) {
    const nextX = Math.max(1.4, Math.min(30.6, curX + stepDx));
    const nextY = Math.max(1.4, Math.min(23.7, curY + stepDy));

    if (isMoveClear(curX, curY, nextX, nextY, walls, radius)) {
      curX = nextX;
      curY = nextY;
    } else {
      hitWall = true;
      // Slide along X axis only
      if (Math.abs(stepDx) > 1e-4 && isMoveClear(curX, curY, nextX, curY, walls, radius)) {
        curX = nextX;
      } else if (Math.abs(stepDy) > 1e-4 && isMoveClear(curX, curY, curX, nextY, walls, radius)) {
        // Slide along Y axis only
        curY = nextY;
      } else {
        break;
      }
    }
  }

  return {
    x: Number(curX.toFixed(2)),
    y: Number(curY.toFixed(2)),
    hitWall,
  };
}

/**
 * Shortest-angle circular low-pass smoothing for compass heading (degrees 0..360).
 */
export function smoothHeadingDegrees(
  prevHeading: number | null,
  rawHeading: number,
  alpha: number = 0.45
): number {
  const normalized = ((rawHeading % 360) + 360) % 360;
  if (prevHeading === null) return normalized;
  let delta = normalized - prevHeading;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return (((prevHeading + alpha * delta) % 360) + 360) % 360;
}

export interface MotionSampleInput {
  ax: number;
  ay: number;
  az: number;
  /** Linear acceleration excluding gravity when supported by the device */
  linAx?: number | null;
  linAy?: number | null;
  linAz?: number | null;
  /** Wrist/device rotation rate in deg/sec */
  rotAlpha?: number | null;
  rotBeta?: number | null;
  rotGamma?: number | null;
  timestampMs: number;
}

export interface StepDetectionResult {
  stepDetected: boolean;
  shakeRejected: boolean;
  stepLengthMeters: number;
}

/**
 * Anti-Shake Biphasic Gait Step Detector:
 * - Separates sitting wrist/hand-shakes from genuine walking strides using:
 *   1. Gyro rotational shake gate (>125 deg/s triggers shake lockout)
 *   2. Vertical-axis dominance check when hardware linear acceleration is available
 *   3. High-frequency jitter lockout (>3.2 Hz reversals or violent impacts >7.5 m/s^2)
 *   4. Biphasic heel-strike peak -> unweighting valley verification (Weinberg stride estimation)
 */
export class AntiShakeStepDetector {
  private gravityMag = 9.81;
  private smoothAcc = 0;
  private peakAcc = 0;
  private peakTimeMs = 0;
  private inPeakPhase = false;

  private lastStepTimeMs = 0;
  private lastPeakTimeMs = 0;
  private rapidPeakCount = 0;
  private shakeLockoutUntilMs = 0;

  private readonly minStepIntervalMs = 400; // Max ~2.5 steps/sec (human walking)
  private readonly maxGyroDegPerSec = 125;  // Sitting wrist-shakes exceed this easily
  private readonly peakThreshold = 1.35;    // m/s^2 above gravity
  private readonly valleyThreshold = -0.82; // m/s^2 below gravity
  private readonly minPeakToValley = 2.45;  // Total stride amplitude

  public reset(): void {
    this.gravityMag = 9.81;
    this.smoothAcc = 0;
    this.peakAcc = 0;
    this.peakTimeMs = 0;
    this.inPeakPhase = false;
    this.lastStepTimeMs = 0;
    this.lastPeakTimeMs = 0;
    this.rapidPeakCount = 0;
    this.shakeLockoutUntilMs = 0;
  }

  public processSample(sample: MotionSampleInput): StepDetectionResult {
    const now = sample.timestampMs;
    const rawMag = Math.hypot(sample.ax, sample.ay, sample.az);
    if (rawMag < 0.5) {
      return { stepDetected: false, shakeRejected: false, stepLengthMeters: 0 };
    }

    // 1. Gyroscope wrist-shake gate (sitting and waving/shaking phone generates high angular velocity)
    const rotMag = Math.hypot(
      sample.rotAlpha ?? 0,
      sample.rotBeta ?? 0,
      sample.rotGamma ?? 0
    );
    if (rotMag > this.maxGyroDegPerSec) {
      this.shakeLockoutUntilMs = Math.max(this.shakeLockoutUntilMs, now + 750);
      this.inPeakPhase = false;
      this.peakAcc = 0;
      return { stepDetected: false, shakeRejected: true, stepLengthMeters: 0 };
    }

    // 2. Dynamic acceleration signal (prefer gravity-aligned vertical component when hardware provides it)
    let dynAcc: number;
    if (
      sample.linAx !== undefined &&
      sample.linAx !== null &&
      sample.linAy !== undefined &&
      sample.linAy !== null &&
      sample.linAz !== undefined &&
      sample.linAz !== null
    ) {
      const gx = sample.ax - sample.linAx;
      const gy = sample.ay - sample.linAy;
      const gz = sample.az - sample.linAz;
      const gLen = Math.hypot(gx, gy, gz);
      const linMag = Math.hypot(sample.linAx, sample.linAy, sample.linAz);

      if (gLen > 4.0) {
        // Projection along gravity vector (negative = upward bounce)
        const verticalBounce = -(
          (sample.linAx * gx + sample.linAy * gy + sample.linAz * gz) /
          gLen
        );
        // Reject pure horizontal lateral shakes (e.g. waving phone left/right while seated)
        if (linMag > 2.2 && Math.abs(verticalBounce) < linMag * 0.42) {
          this.inPeakPhase = false;
          return { stepDetected: false, shakeRejected: true, stepLengthMeters: 0 };
        }
        dynAcc = verticalBounce;
      } else {
        this.gravityMag = 0.92 * this.gravityMag + 0.08 * rawMag;
        dynAcc = rawMag - this.gravityMag;
      }
    } else {
      // Adaptive gravity tracker
      const alpha = Math.abs(rawMag - this.gravityMag) < 1.2 ? 0.12 : 0.04;
      this.gravityMag = (1 - alpha) * this.gravityMag + alpha * rawMag;
      dynAcc = rawMag - this.gravityMag;
    }

    // Fast low-latency EMA smoothing (keeps step response <20ms while cutting electrical noise)
    this.smoothAcc = 0.68 * dynAcc + 0.32 * this.smoothAcc;

    // Violent impact / furious hand-shake lockout
    if (Math.abs(this.smoothAcc) > 7.8) {
      this.shakeLockoutUntilMs = Math.max(this.shakeLockoutUntilMs, now + 900);
      this.inPeakPhase = false;
      this.peakAcc = 0;
      return { stepDetected: false, shakeRejected: true, stepLengthMeters: 0 };
    }

    if (now < this.shakeLockoutUntilMs) {
      this.inPeakPhase = false;
      return { stepDetected: false, shakeRejected: true, stepLengthMeters: 0 };
    }

    // 3. Biphasic Heel-Strike Peak -> Unweighting Valley Gait State Machine
    if (this.smoothAcc > this.peakThreshold) {
      if (!this.inPeakPhase) {
        // Detect rapid hand-shake frequency (>3.2 Hz)
        if (now - this.lastPeakTimeMs < 300) {
          this.rapidPeakCount += 1;
          if (this.rapidPeakCount >= 2) {
            this.shakeLockoutUntilMs = now + 900;
            this.rapidPeakCount = 0;
            this.inPeakPhase = false;
            return { stepDetected: false, shakeRejected: true, stepLengthMeters: 0 };
          }
        } else {
          this.rapidPeakCount = 0;
        }
        this.lastPeakTimeMs = now;
        this.inPeakPhase = true;
        this.peakAcc = this.smoothAcc;
        this.peakTimeMs = now;
      } else if (this.smoothAcc > this.peakAcc) {
        this.peakAcc = this.smoothAcc;
        this.peakTimeMs = now;
      }
    } else if (this.inPeakPhase) {
      const elapsedSincePeak = now - this.peakTimeMs;

      // Peak expired without a valid stride valley
      if (elapsedSincePeak > 520) {
        this.inPeakPhase = false;
        this.peakAcc = 0;
        return { stepDetected: false, shakeRejected: false, stepLengthMeters: 0 };
      }

      // Valid downward swing valley reached
      if (this.smoothAcc < this.valleyThreshold && elapsedSincePeak >= 95) {
        const amplitude = this.peakAcc - this.smoothAcc;
        this.inPeakPhase = false;
        const savedPeak = this.peakAcc;
        this.peakAcc = 0;

        if (
          amplitude >= this.minPeakToValley &&
          now - this.lastStepTimeMs >= this.minStepIntervalMs
        ) {
          this.lastStepTimeMs = now;
          // Weinberg stride length model bounded to realistic [0.55m, 0.85m]
          const weinberg = 0.44 * Math.pow(Math.max(1.0, savedPeak - this.smoothAcc), 0.25);
          const stepLen = Number(Math.max(0.55, Math.min(0.85, weinberg)).toFixed(2));
          return {
            stepDetected: true,
            shakeRejected: false,
            stepLengthMeters: stepLen,
          };
        }
      }
    }

    return { stepDetected: false, shakeRejected: false, stepLengthMeters: 0 };
  }
}
