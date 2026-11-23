import { SimulatorBeacon, SimulatorNode, SimulatorEdge } from '../types/simulator';

/**
 * Log-Distance Path Loss Model:
 * Generates realistic noisy RSSI based on distance from beacon:
 * RSSI = TxPower - 10 * n * log10(d) + GaussianNoise
 */
export function simulateRawRssi(
  distanceMeters: number,
  txPower: number = -59,
  pathLossN: number = 2.2,
  noiseSigma: number = 2.5
): number {
  const d = Math.max(0.1, distanceMeters);
  const meanRssi = txPower - 10 * pathLossN * Math.log10(d);
  // Box-Muller transform for Gaussian noise
  const u1 = Math.random() || 0.0001;
  const u2 = Math.random() || 0.0001;
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return meanRssi + z0 * noiseSigma;
}

/**
 * Inverts Log-Distance Path Loss Model to compute distance from smoothed RSSI:
 * d = 10 ^ ((TxPower - RSSI) / (10 * n))
 */
export function rssiToDistance(
  rssi: number,
  txPower: number = -59,
  pathLossN: number = 2.2
): number {
  const exponent = (txPower - rssi) / (10 * pathLossN);
  return Math.pow(10, exponent);
}

/**
 * 1D Kalman Filter update step
 */
export function updateKalman1D(
  state: { q: number; r: number; p: number; x: number },
  measurement: number
): { q: number; r: number; p: number; x: number; k: number } {
  // 1. Prediction
  const pPred = state.p + state.q;
  // 2. Kalman Gain
  const k = pPred / (pPred + state.r);
  // 3. Update state
  const xUpd = state.x + k * (measurement - state.x);
  // 4. Update error covariance
  const pUpd = (1.0 - k) * pPred;

  return {
    q: state.q,
    r: state.r,
    p: pUpd,
    x: xUpd,
    k,
  };
}

/**
 * Solves 2D Trilateration for 3 beacons using linear least-squares:
 * 2(x2 - x1)x + 2(y2 - y1)y = (r1^2 - r2^2) + (x2^2 - x1^2) + (y2^2 - y1^2)
 * 2(x3 - x1)x + 2(y3 - y1)y = (r1^2 - r3^2) + (x3^2 - x1^2) + (y3^2 - y1^2)
 */
export function solveTrilateration(
  beacons: SimulatorBeacon[]
): { x: number; y: number } | null {
  if (beacons.length < 3) return null;

  const b1 = beacons[0];
  const b2 = beacons[1];
  const b3 = beacons[2];

  const x1 = b1.x, y1 = b1.y, r1 = b1.estimatedDistance;
  const x2 = b2.x, y2 = b2.y, r2 = b2.estimatedDistance;
  const x3 = b3.x, y3 = b3.y, r3 = b3.estimatedDistance;

  const a11 = 2 * (x2 - x1);
  const a12 = 2 * (y2 - y1);
  const c1 = (r1 * r1 - r2 * r2) + (x2 * x2 - x1 * x1) + (y2 * y2 - y1 * y1);

  const a21 = 2 * (x3 - x1);
  const a22 = 2 * (y3 - y1);
  const c2 = (r1 * r1 - r3 * r3) + (x3 * x3 - x1 * x1) + (y3 * y3 - y1 * y1);

  const det = a11 * a22 - a12 * a21;
  if (Math.abs(det) < 1e-5) {
    // Collinear fallback: weighted centroid
    let totalW = 0, wx = 0, wy = 0;
    for (const b of beacons.slice(0, 3)) {
      const w = 1 / Math.max(0.1, b.estimatedDistance * b.estimatedDistance);
      wx += b.x * w;
      wy += b.y * w;
      totalW += w;
    }
    return totalW > 0 ? { x: wx / totalW, y: wy / totalW } : null;
  }

  const solvedX = (c1 * a22 - c2 * a12) / det;
  const solvedY = (a11 * c2 - a21 * c1) / det;

  return { x: solvedX, y: solvedY };
}

/**
 * A* (A-Star) Shortest Path Search on Building Graph
 */
export function runAStar(
  nodes: SimulatorNode[],
  edges: SimulatorEdge[],
  startId: string,
  targetId: string
): { pathNodeIds: string[]; totalDistance: number; pathCoordinates: { x: number; y: number }[] } | null {
  const nodeMap = new Map<string, SimulatorNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const start = nodeMap.get(startId);
  const target = nodeMap.get(targetId);
  if (!start || !target) return null;

  const adj = new Map<string, { to: string; weight: number }[]>();
  nodes.forEach(n => adj.set(n.id, []));

  edges.forEach(e => {
    adj.get(e.fromId)?.push({ to: e.toId, weight: e.weight });
    adj.get(e.toId)?.push({ to: e.fromId, weight: e.weight });
  });

  const dist = (a: SimulatorNode, b: SimulatorNode) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const openSet = new Set<string>([startId]);
  const closedSet = new Set<string>();
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  nodes.forEach(n => {
    gScore.set(n.id, Infinity);
    fScore.set(n.id, Infinity);
  });

  gScore.set(startId, 0);
  fScore.set(startId, dist(start, target));

  while (openSet.size > 0) {
    let currentId = '';
    let lowestF = Infinity;

    openSet.forEach(id => {
      const score = fScore.get(id) ?? Infinity;
      if (score < lowestF) {
        lowestF = score;
        currentId = id;
      }
    });

    if (currentId === targetId) {
      // Reconstruct
      const pathNodeIds: string[] = [targetId];
      let curr = targetId;
      while (cameFrom.has(curr)) {
        curr = cameFrom.get(curr)!;
        pathNodeIds.unshift(curr);
      }
      return {
        pathNodeIds,
        totalDistance: gScore.get(targetId) || 0,
        pathCoordinates: pathNodeIds.map(id => {
          const n = nodeMap.get(id)!;
          return { x: n.x, y: n.y };
        }),
      };
    }

    openSet.delete(currentId);
    closedSet.add(currentId);

    const currentNode = nodeMap.get(currentId)!;
    const neighbors = adj.get(currentId) || [];

    for (const neighbor of neighbors) {
      if (closedSet.has(neighbor.to)) continue;

      const neighborNode = nodeMap.get(neighbor.to);
      if (!neighborNode) continue;

      const tentativeG = (gScore.get(currentId) ?? Infinity) + neighbor.weight;

      if (!openSet.has(neighbor.to)) {
        openSet.add(neighbor.to);
      } else if (tentativeG >= (gScore.get(neighbor.to) ?? Infinity)) {
        continue;
      }

      cameFrom.set(neighbor.to, currentId);
      gScore.set(neighbor.to, tentativeG);
      fScore.set(neighbor.to, tentativeG + dist(neighborNode, target));
    }
  }

  return null;
}

/**
 * Dynamic A* pathfinding between arbitrary continuous coordinates (start and target)
 */
export function runAStarBetweenCoordinates(
  nodes: SimulatorNode[],
  edges: SimulatorEdge[],
  startPoint: { x: number; y: number },
  targetPoint: { x: number; y: number }
): { pathCoordinates: { x: number; y: number }[]; totalDistance: number; pathNodeIds: string[] } | null {
  // Find nearest start node
  let startNode = nodes[0];
  let minStartDist = Infinity;
  for (const n of nodes) {
    const d = Math.hypot(n.x - startPoint.x, n.y - startPoint.y);
    if (d < minStartDist) {
      minStartDist = d;
      startNode = n;
    }
  }

  // Find nearest target node
  let targetNode = nodes[0];
  let minTargetDist = Infinity;
  for (const n of nodes) {
    const d = Math.hypot(n.x - targetPoint.x, n.y - targetPoint.y);
    if (d < minTargetDist) {
      minTargetDist = d;
      targetNode = n;
    }
  }

  const directDist = Math.hypot(startPoint.x - targetPoint.x, startPoint.y - targetPoint.y);
  if (startNode.id === targetNode.id && directDist < 3.0) {
    return {
      pathCoordinates: [startPoint, targetPoint],
      totalDistance: directDist,
      pathNodeIds: [startNode.id],
    };
  }

  const meshResult = runAStar(nodes, edges, startNode.id, targetNode.id);
  if (!meshResult) {
    return {
      pathCoordinates: [startPoint, targetPoint],
      totalDistance: directDist,
      pathNodeIds: [],
    };
  }

  const completeCoords = [
    startPoint,
    ...meshResult.pathCoordinates,
    targetPoint,
  ];

  const totalDist = minStartDist + meshResult.totalDistance + minTargetDist;

  return {
    pathCoordinates: completeCoords,
    totalDistance: totalDist,
    pathNodeIds: meshResult.pathNodeIds,
  };
}
