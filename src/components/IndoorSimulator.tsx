import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Footprints,
  Compass,
  Radio,
  Share2,
  Navigation,
  Activity,
  Sliders,
  Maximize2,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Zap,
  Users,
  UserCheck,
  Target,
  X,
  Building
} from 'lucide-react';
import { SimulatorBeacon, SimulatorNode, SimulatorEdge, UserPose, TelemetryPacket, BuildingPeer } from '../types/simulator';
import {
  simulateRawRssi,
  rssiToDistance,
  updateKalman1D,
  solveTrilateration,
  runAStar,
  runAStarBetweenCoordinates
} from '../utils/simulatorEngine';

interface IndoorSimulatorProps {
  onTelemetryEmit?: (packet: TelemetryPacket) => void;
  onSelectCodeTab?: (tabName: string) => void;
}

export const IndoorSimulator: React.FC<IndoorSimulatorProps> = ({
  onTelemetryEmit,
  onSelectCodeTab
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kalmanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Scale: 1 meter = 20 canvas pixels
  const METERS_TO_PX = 20;

  // Simulator Nodes (Floor 1 rooms & corridor waypoints)
  const nodes: SimulatorNode[] = useMemo(() => [
    { id: 'room_101', label: 'Lab 101', x: 7, y: 6, floor: 1, type: 'room' },
    { id: 'room_102', label: 'Conf Room A', x: 25, y: 6, floor: 1, type: 'room' },
    { id: 'room_103', label: 'Cafeteria', x: 7, y: 20, floor: 1, type: 'room' },
    { id: 'room_104', label: 'Exec Suite', x: 25, y: 20, floor: 1, type: 'room' },
    { id: 'room_105', label: 'Server Hub', x: 16, y: 3, floor: 1, type: 'room' },
    { id: 'corr_center', label: 'Central Atrium', x: 16, y: 13, floor: 1, type: 'corridor' },
    { id: 'corr_north', label: 'North Junction', x: 16, y: 6, floor: 1, type: 'corridor' },
    { id: 'corr_south', label: 'South Junction', x: 16, y: 20, floor: 1, type: 'corridor' },
    { id: 'corr_west', label: 'West Corridor', x: 11, y: 13, floor: 1, type: 'corridor' },
    { id: 'corr_east', label: 'East Corridor', x: 21, y: 13, floor: 1, type: 'corridor' },
  ], []);

  // Building Edges
  const edges: SimulatorEdge[] = useMemo(() => [
    { fromId: 'corr_center', toId: 'corr_north', weight: 7 },
    { fromId: 'corr_center', toId: 'corr_south', weight: 7 },
    { fromId: 'corr_center', toId: 'corr_west', weight: 5 },
    { fromId: 'corr_center', toId: 'corr_east', weight: 5 },
    { fromId: 'corr_north', toId: 'room_101', weight: 9 },
    { fromId: 'corr_north', toId: 'room_102', weight: 9 },
    { fromId: 'corr_north', toId: 'room_105', weight: 3 },
    { fromId: 'corr_south', toId: 'room_103', weight: 9 },
    { fromId: 'corr_south', toId: 'room_104', weight: 9 },
    { fromId: 'corr_west', toId: 'room_101', weight: 8 },
    { fromId: 'corr_east', toId: 'room_102', weight: 8 },
  ], []);

  // Active Building Peers (Multi-User Directory)
  const [peers, setPeers] = useState<BuildingPeer[]>([
    {
      id: 'peer_hassaan',
      fullName: 'Hassaan Tariq',
      email: 'hassaan@enterprise.io',
      role: 'Lead Architect',
      department: 'Executive Suite',
      x: 25,
      y: 20,
      floor: 1,
      isOnline: true,
      avatarColor: '#F59E0B',
      lastUpdated: 'Just now',
    },
    {
      id: 'peer_sarah',
      fullName: 'Dr. Sarah Jenkins',
      email: 'sarah.j@enterprise.io',
      role: 'RF Engineer',
      department: 'Lab 101',
      x: 7,
      y: 6,
      floor: 1,
      isOnline: true,
      avatarColor: '#EC4899',
      lastUpdated: '1s ago',
    },
    {
      id: 'peer_marcus',
      fullName: 'Marcus Vance',
      email: 'm.vance@enterprise.io',
      role: 'Product Director',
      department: 'Conf Room A',
      x: 25,
      y: 6,
      floor: 1,
      isOnline: true,
      avatarColor: '#8B5CF6',
      lastUpdated: '2s ago',
    },
    {
      id: 'peer_elena',
      fullName: 'Elena Rostova',
      email: 'elena@enterprise.io',
      role: 'Operations Specialist',
      department: 'Cafeteria',
      x: 7,
      y: 20,
      floor: 1,
      isOnline: true,
      avatarColor: '#10B981',
      lastUpdated: 'Just now',
    },
  ]);

  // Locked target peer or room
  const [lockedTargetPeerId, setLockedTargetPeerId] = useState<string | null>('peer_hassaan');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isPeersDrawerOpen, setIsPeersDrawerOpen] = useState<boolean>(false);
  const [peersRoaming, setPeersRoaming] = useState<boolean>(true);

  // Fixed Reference BLE Beacons
  const [beacons, setBeacons] = useState<SimulatorBeacon[]>([
    {
      id: 'beacon_north',
      name: 'BLE-N01 (North)',
      x: 8,
      y: 3.5,
      floor: 1,
      txPower: -59,
      pathLossN: 2.2,
      currentRawRssi: -65,
      filteredRssi: -65,
      estimatedDistance: 2.0,
      kalmanState: { q: 0.012, r: 2.0, p: 1.0, x: -65 }
    },
    {
      id: 'beacon_east',
      name: 'BLE-E02 (East)',
      x: 26,
      y: 5.5,
      floor: 1,
      txPower: -59,
      pathLossN: 2.2,
      currentRawRssi: -72,
      filteredRssi: -72,
      estimatedDistance: 3.8,
      kalmanState: { q: 0.012, r: 2.0, p: 1.0, x: -72 }
    },
    {
      id: 'beacon_south',
      name: 'BLE-S03 (South)',
      x: 16,
      y: 23,
      floor: 1,
      txPower: -59,
      pathLossN: 2.2,
      currentRawRssi: -70,
      filteredRssi: -70,
      estimatedDistance: 3.2,
      kalmanState: { q: 0.012, r: 2.0, p: 1.0, x: -70 }
    },
    {
      id: 'beacon_west',
      name: 'BLE-W04 (West)',
      x: 5,
      y: 19,
      floor: 1,
      txPower: -59,
      pathLossN: 2.2,
      currentRawRssi: -78,
      filteredRssi: -78,
      estimatedDistance: 6.5,
      kalmanState: { q: 0.012, r: 2.0, p: 1.0, x: -78 }
    },
  ]);

  // Current logged in user pose
  const [userPose, setUserPose] = useState<UserPose>({
    x: 16,
    y: 13,
    floor: 1,
    heading: 90, // East
    stepCount: 0,
    totalDistanceMeters: 0,
    accuracy: 1.2,
  });

  const [rawTrilateration, setRawTrilateration] = useState<{ x: number; y: number } | null>(null);

  // Active navigation
  const [activePath, setActivePath] = useState<{
    pathCoordinates: { x: number; y: number }[];
    totalDistance: number;
    pathNodeIds: string[];
  } | null>(null);

  // Simulator controls
  const [isAutoWalking, setIsAutoWalking] = useState<boolean>(false);
  const [noiseLevel, setNoiseLevel] = useState<number>(2.5);
  const [pathLossN, setPathLossN] = useState<number>(2.2);
  const [showGraphMesh, setShowGraphMesh] = useState<boolean>(true);
  const [showBeaconRings, setShowBeaconRings] = useState<boolean>(true);
  const [pulseAnim, setPulseAnim] = useState<number>(0);

  // Live Chart histories
  const [kalmanHistory, setKalmanHistory] = useState<{ raw: number; filtered: number; trueRssi: number }[]>([]);
  const [pdrWaveform, setPdrWaveform] = useState<{ val: number; isStep: boolean }[]>([]);

  // Find target coordinates (either locked peer or selected room)
  const targetInfo = useMemo(() => {
    if (lockedTargetPeerId) {
      const peer = peers.find((p) => p.id === lockedTargetPeerId);
      if (peer) {
        return {
          type: 'peer' as const,
          name: peer.fullName,
          subtext: `${peer.department} • ${peer.role}`,
          coords: { x: peer.x, y: peer.y },
        };
      }
    }
    if (selectedRoomId) {
      const room = nodes.find((n) => n.id === selectedRoomId);
      if (room) {
        return {
          type: 'room' as const,
          name: room.label,
          subtext: 'Building Landmark',
          coords: { x: room.x, y: room.y },
        };
      }
    }
    return null;
  }, [lockedTargetPeerId, selectedRoomId, peers, nodes]);

  // Re-calculate dynamic A* path between continuous user coordinates & target coordinates
  useEffect(() => {
    if (targetInfo) {
      const pathRes = runAStarBetweenCoordinates(
        nodes,
        edges,
        { x: userPose.x, y: userPose.y },
        targetInfo.coords
      );
      setActivePath(pathRes);
    } else {
      setActivePath(null);
    }
  }, [userPose.x, userPose.y, targetInfo, nodes, edges]);

  // Animation pulse ticker
  useEffect(() => {
    let animFrame: number;
    const tick = () => {
      setPulseAnim((prev) => (prev + 0.02) % 1);
      animFrame = requestAnimationFrame(tick);
    };
    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, []);

  // Roam building peers slightly to demonstrate dynamic path recalculation in real-time
  useEffect(() => {
    if (!peersRoaming) return;
    const peerInterval = setInterval(() => {
      setPeers((prev) =>
        prev.map((peer, idx) => {
          // Subtle natural wandering around their base office (+-0.6m)
          const angle = Date.now() / 1200 + idx * 1.5;
          const offsetX = Math.sin(angle) * 0.4;
          const offsetY = Math.cos(angle) * 0.4;

          const basePositions = [
            { x: 25, y: 20 }, // Hassaan
            { x: 7, y: 6 },   // Sarah
            { x: 25, y: 6 },  // Marcus
            { x: 7, y: 20 },  // Elena
          ];
          const base = basePositions[idx] || { x: peer.x, y: peer.y };

          return {
            ...peer,
            x: Number((base.x + offsetX).toFixed(2)),
            y: Number((base.y + offsetY).toFixed(2)),
            lastUpdated: 'Live',
          };
        })
      );
    }, 800);

    return () => clearInterval(peerInterval);
  }, [peersRoaming]);

  // Main simulation step engine loop
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Calculate ground truth distance to each beacon
      const updatedBeacons = beacons.map((b) => {
        const dist = Math.hypot(b.x - userPose.x, b.y - userPose.y);
        const raw = simulateRawRssi(dist, b.txPower, pathLossN, noiseLevel);
        const kResult = updateKalman1D(b.kalmanState, raw);
        const estDist = rssiToDistance(kResult.x, b.txPower, pathLossN);

        return {
          ...b,
          currentRawRssi: raw,
          filteredRssi: kResult.x,
          estimatedDistance: estDist,
          kalmanState: {
            ...b.kalmanState,
            p: kResult.p,
            x: kResult.x,
          },
        };
      });

      setBeacons(updatedBeacons);

      // 2. Trilateration from top 3 closest beacons
      const sorted = [...updatedBeacons].sort((a, b) => a.estimatedDistance - b.estimatedDistance);
      const triPoint = solveTrilateration(sorted.slice(0, 3));
      setRawTrilateration(triPoint);

      // Record Kalman history for primary beacon (Beacon N-01)
      const b1 = updatedBeacons[0];
      const trueDist = Math.hypot(b1.x - userPose.x, b1.y - userPose.y);
      const trueRssi = b1.txPower - 10 * pathLossN * Math.log10(Math.max(0.1, trueDist));
      setKalmanHistory((prev) => {
        const next = [...prev, { raw: b1.currentRawRssi, filtered: b1.filteredRssi, trueRssi }];
        return next.slice(-40);
      });

      // Emit simulated Supabase telemetry event
      if (onTelemetryEmit) {
        onTelemetryEmit({
          id: `tel_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          userId: 'dev_user_lead_architect',
          x: Number(userPose.x.toFixed(2)),
          y: Number(userPose.y.toFixed(2)),
          floor: 1,
          heading: Number(userPose.heading.toFixed(1)),
          accuracy: Number(userPose.accuracy.toFixed(2)),
          timestamp: new Date().toLocaleTimeString(),
          source: 'BLE+PDR'
        });
      }
    }, 280);

    return () => clearInterval(interval);
  }, [userPose.x, userPose.y, userPose.heading, userPose.accuracy, pathLossN, noiseLevel, onTelemetryEmit]);

  // Auto-walking trajectory sequence
  useEffect(() => {
    if (!isAutoWalking) return;

    const waypoints = [
      { x: 16, y: 13, h: 0 },
      { x: 16, y: 6, h: 0 },
      { x: 7, y: 6, h: 270 }, // Lab 101
      { x: 16, y: 6, h: 90 },
      { x: 25, y: 6, h: 90 }, // Conf A
      { x: 16, y: 6, h: 180 },
      { x: 16, y: 13, h: 180 },
      { x: 16, y: 20, h: 180 },
      { x: 25, y: 20, h: 90 }, // Exec Suite
      { x: 16, y: 20, h: 270 },
      { x: 7, y: 20, h: 270 }, // Cafeteria
      { x: 16, y: 20, h: 0 },
      { x: 16, y: 13, h: 0 },
    ];

    let currentWpIdx = 0;
    const walkInterval = setInterval(() => {
      const target = waypoints[currentWpIdx];
      setUserPose((prev) => {
        const dx = target.x - prev.x;
        const dy = target.y - prev.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 0.6) {
          currentWpIdx = (currentWpIdx + 1) % waypoints.length;
          return {
            ...prev,
            heading: waypoints[currentWpIdx].h,
            stepCount: prev.stepCount + 1,
            totalDistanceMeters: prev.totalDistanceMeters + 0.65,
          };
        }

        const stepSize = 0.55;
        const angle = Math.atan2(dy, dx);
        const headingDeg = (angle * 180 / Math.PI + 90 + 360) % 360;

        setPdrWaveform((p) => [
          ...p.slice(-30),
          { val: 9.81 + Math.sin(prev.stepCount * 1.5) * 3.5, isStep: true },
        ]);

        return {
          ...prev,
          x: prev.x + (dx / dist) * stepSize,
          y: prev.y + (dy / dist) * stepSize,
          heading: headingDeg,
          stepCount: prev.stepCount + 1,
          totalDistanceMeters: prev.totalDistanceMeters + stepSize,
        };
      });
    }, 450);

    return () => clearInterval(walkInterval);
  }, [isAutoWalking]);

  // Keyboard navigation (WASD or Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let dx = 0;
      let dy = 0;
      let heading = userPose.heading;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        dy = -0.7;
        heading = 0;
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        dy = 0.7;
        heading = 180;
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        dx = -0.7;
        heading = 270;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        dx = 0.7;
        heading = 90;
      } else {
        return;
      }

      e.preventDefault();
      setUserPose((prev) => ({
        ...prev,
        x: Math.max(2, Math.min(30, prev.x + dx)),
        y: Math.max(2, Math.min(24, prev.y + dy)),
        heading,
        stepCount: prev.stepCount + 1,
        totalDistanceMeters: prev.totalDistanceMeters + 0.7,
      }));

      setPdrWaveform((p) => [
        ...p.slice(-30),
        { val: 12.8 + Math.random() * 2, isStep: true },
      ]);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [userPose.heading]);

  // Render main Floor Plan Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background architectural grid
    ctx.fillStyle = '#060A12';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#0E1726';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += METERS_TO_PX * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += METERS_TO_PX * 2) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw architectural rooms
    const roomRects = [
      { name: 'Lab 101', x: 2, y: 2, w: 10, h: 8, color: '#0B1528', border: '#1A3052' },
      { name: 'Conf Room A', x: 20, y: 2, w: 10, h: 8, color: '#0B1528', border: '#1A3052' },
      { name: 'Server Hub', x: 13, y: 1.5, w: 6, h: 4, color: '#0E1C33', border: '#254473' },
      { name: 'Cafeteria', x: 2, y: 16, w: 10, h: 9, color: '#0B1528', border: '#1A3052' },
      { name: 'Exec Suite', x: 20, y: 16, w: 10, h: 9, color: '#0B1528', border: '#1A3052' },
      { name: 'Central Atrium', x: 12, y: 9.5, w: 8, h: 7, color: '#081220', border: '#152B47' },
    ];

    roomRects.forEach((r) => {
      const rx = r.x * METERS_TO_PX;
      const ry = r.y * METERS_TO_PX;
      const rw = r.w * METERS_TO_PX;
      const rh = r.h * METERS_TO_PX;

      ctx.fillStyle = r.color;
      ctx.fillRect(rx, ry, rw, rh);

      ctx.strokeStyle = r.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);

      ctx.fillStyle = '#64748B';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(r.name, rx + 12, ry + 20);
    });

    // Draw Graph Mesh
    if (showGraphMesh) {
      ctx.strokeStyle = '#1E3A5F';
      ctx.lineWidth = 1.5;
      edges.forEach((edge) => {
        const from = nodes.find((n) => n.id === edge.fromId);
        const to = nodes.find((n) => n.id === edge.toId);
        if (from && to) {
          ctx.beginPath();
          ctx.moveTo(from.x * METERS_TO_PX, from.y * METERS_TO_PX);
          ctx.lineTo(to.x * METERS_TO_PX, to.y * METERS_TO_PX);
          ctx.stroke();
        }
      });

      nodes.forEach((n) => {
        const nx = n.x * METERS_TO_PX;
        const ny = n.y * METERS_TO_PX;
        ctx.fillStyle = n.type === 'room' ? '#38BDF8' : '#0284C7';
        ctx.beginPath();
        ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw Dynamic A* Route connecting User to Target
    if (activePath && activePath.pathCoordinates.length > 1) {
      const coords = activePath.pathCoordinates;

      // Glow outline
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.28)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(coords[0].x * METERS_TO_PX, coords[0].y * METERS_TO_PX);
      coords.forEach((c) => ctx.lineTo(c.x * METERS_TO_PX, c.y * METERS_TO_PX));
      ctx.stroke();

      // Main line with moving dash
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -pulseAnim * 28;
      ctx.beginPath();
      ctx.moveTo(coords[0].x * METERS_TO_PX, coords[0].y * METERS_TO_PX);
      coords.forEach((c) => ctx.lineTo(c.x * METERS_TO_PX, c.y * METERS_TO_PX));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Beacons & estimated distance circles
    beacons.forEach((b) => {
      const bx = b.x * METERS_TO_PX;
      const by = b.y * METERS_TO_PX;
      const radiusPx = b.estimatedDistance * METERS_TO_PX;

      if (showBeaconRings) {
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, radiusPx, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#60A5FA';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#93C5FD';
      ctx.font = '9px Fira Code, monospace';
      ctx.fillText(`${b.filteredRssi.toFixed(0)} dBm`, bx - 18, by - 10);
    });

    // Draw Active Building Peers
    peers.forEach((peer) => {
      const px = peer.x * METERS_TO_PX;
      const py = peer.y * METERS_TO_PX;
      const isTarget = lockedTargetPeerId === peer.id;

      if (isTarget) {
        // Pulsing yellow highlight for targeted user
        ctx.strokeStyle = `rgba(245, 158, 11, ${0.8 * (1 - pulseAnim)})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px, py, 10 + pulseAnim * 22, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Target badge
        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(`⭐ ${peer.fullName}`, px - 28, py - 14);
      } else {
        // Orange dots for other active peers
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#FED7AA';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(peer.fullName.split(' ')[0], px - 14, py - 10);
      }
    });

    // Draw Current User Marker (Blue Dot with Direction Cone)
    const ux = userPose.x * METERS_TO_PX;
    const uy = userPose.y * METERS_TO_PX;

    // Accuracy circle
    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.beginPath();
    ctx.arc(ux, uy, userPose.accuracy * METERS_TO_PX, 0, Math.PI * 2);
    ctx.fill();

    // Directional compass heading cone
    const headingRad = ((userPose.heading - 90) * Math.PI) / 180;
    const coneRadius = 38;
    ctx.fillStyle = 'rgba(6, 182, 212, 0.32)';
    ctx.beginPath();
    ctx.moveTo(ux, uy);
    ctx.arc(ux, uy, coneRadius, headingRad - 0.4, headingRad + 0.4);
    ctx.closePath();
    ctx.fill();

    // Blue current user dot
    ctx.fillStyle = '#06B6D4';
    ctx.beginPath();
    ctx.arc(ux, uy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#A5F3FC';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillText('You (Architect)', ux - 32, uy + 20);
  }, [userPose, beacons, activePath, peers, lockedTargetPeerId, showGraphMesh, showBeaconRings, pulseAnim, nodes, edges]);

  // Render Mini 1D Kalman Canvas Chart
  useEffect(() => {
    const canvas = kalmanCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#070C16';
    ctx.fillRect(0, 0, w, h);

    if (kalmanHistory.length < 2) return;

    const minRssi = -90;
    const maxRssi = -45;
    const toY = (rssi: number) => h - ((rssi - minRssi) / (maxRssi - minRssi)) * h;

    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    kalmanHistory.forEach((pt, i) => {
      const x = (i / (kalmanHistory.length - 1)) * w;
      const y = toY(pt.raw);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    kalmanHistory.forEach((pt, i) => {
      const x = (i / (kalmanHistory.length - 1)) * w;
      const y = toY(pt.filtered);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [kalmanHistory]);

  // Render Mini PDR Accelerometer Waveform
  useEffect(() => {
    const canvas = pdrCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#070C16';
    ctx.fillRect(0, 0, w, h);

    const baselineY = h * 0.55;
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(w, baselineY);
    ctx.stroke();

    if (pdrWaveform.length < 2) return;

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    pdrWaveform.forEach((pt, i) => {
      const x = (i / (pdrWaveform.length - 1)) * w;
      const y = baselineY - (pt.val - 9.8) * 8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [pdrWaveform]);

  // Handle Canvas Click to reposition user or pick a peer/room
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

    const meterX = clickX / METERS_TO_PX;
    const meterY = clickY / METERS_TO_PX;

    // Check if clicked near an active peer
    const clickedPeer = peers.find((p) => Math.hypot(p.x - meterX, p.y - meterY) < 1.8);
    if (clickedPeer) {
      setLockedTargetPeerId(clickedPeer.id);
      setSelectedRoomId(null);
      return;
    }

    // Check if clicked near a room
    const clickedNode = nodes.find((n) => Math.hypot(n.x - meterX, n.y - meterY) < 2.5);
    if (clickedNode && clickedNode.type === 'room') {
      setSelectedRoomId(clickedNode.id);
      setLockedTargetPeerId(null);
      return;
    }

    // Teleport user
    setUserPose((prev) => ({
      ...prev,
      x: Math.max(2, Math.min(30, meterX)),
      y: Math.max(2, Math.min(24, meterY)),
    }));
  };

  const stepManual = () => {
    const headingRad = ((userPose.heading - 90) * Math.PI) / 180;
    const stepLength = 0.7;
    const dx = Math.cos(headingRad) * stepLength;
    const dy = Math.sin(headingRad) * stepLength;

    setUserPose((prev) => ({
      ...prev,
      x: Math.max(2, Math.min(30, prev.x + dx)),
      y: Math.max(2, Math.min(24, prev.y + dy)),
      stepCount: prev.stepCount + 1,
      totalDistanceMeters: prev.totalDistanceMeters + stepLength,
    }));

    setPdrWaveform((p) => [
      ...p.slice(-30),
      { val: 13.5, isStep: true },
    ]);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 max-w-7xl mx-auto">
      {/* Left Column: Interactive 2D Floor Plan Canvas & Navigation HUD */}
      <div className="flex-1 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-sm">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Enterprise Multi-User Floor Plan
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono">
                {peers.length + 1} Active Online
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live Supabase Auth • Peer Telemetry Sync • Dynamic A* User-to-User Routing
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPeersDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition shadow-lg"
            >
              <Users className="w-3.5 h-3.5" />
              Building Directory ({peers.length})
            </button>

            <button
              onClick={() => setIsAutoWalking(!isAutoWalking)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isAutoWalking
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isAutoWalking ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-cyan-400" />}
              {isAutoWalking ? 'Pause Tour' : 'Auto Walk'}
            </button>

            <button
              onClick={stepManual}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Simulate 1 step forward"
            >
              <Footprints className="w-3.5 h-3.5 text-cyan-400" />
              +1 Step
            </button>

            <button
              onClick={() => {
                setUserPose({
                  x: 16,
                  y: 13,
                  floor: 1,
                  heading: 90,
                  stepCount: 0,
                  totalDistanceMeters: 0,
                  accuracy: 1.2,
                });
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700"
              title="Reset position to Central Atrium"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic User-to-User Guidance Banner */}
        {targetInfo && activePath && (
          <div className="my-3 px-4 py-3 rounded-xl bg-slate-950/90 border border-amber-500/40 flex items-center justify-between gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Navigation className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Navigating to meet:</span>
                  <span className="font-bold text-amber-300 text-sm">{targetInfo.name}</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-400 text-[10px] border border-amber-800 font-mono">
                    {targetInfo.subtext}
                  </span>
                </div>
                <div className="text-slate-400 mt-0.5">
                  Route dynamically recalculating in real-time as both users move across corridors.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-mono text-cyan-400 font-bold text-sm">
                  {activePath.totalDistance.toFixed(1)} m
                </div>
                <div className="text-[10px] text-slate-400">
                  {Math.round((activePath.totalDistance / 1.1))}s walk
                </div>
              </div>
              <button
                onClick={() => {
                  setLockedTargetPeerId(null);
                  setSelectedRoomId(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                title="Cancel navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 2D Canvas Container */}
        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#060A12] flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={640}
            height={520}
            onClick={handleCanvasClick}
            className="cursor-crosshair w-full max-w-full h-auto block"
          />

          {/* Canvas Floating Overlay Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
            <div className="bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-2">
              <span className="text-cyan-400 font-bold">You (Architect):</span>
              <span>X: {userPose.x.toFixed(1)}m</span>
              <span>Y: {userPose.y.toFixed(1)}m</span>
              <span>θ: {userPose.heading.toFixed(0)}°</span>
            </div>
            <div className="bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-2">
              <span className="text-amber-400 font-bold">Target Locked:</span>
              <span>{targetInfo ? targetInfo.name : 'None selected'}</span>
            </div>
          </div>

          {/* Quick instructions indicator */}
          <div className="absolute bottom-2 left-3 text-[10px] text-slate-500 pointer-events-none">
            Click any peer or room to navigate • Drag or click floor to teleport • WASD to walk
          </div>

          {/* Legend */}
          <div className="absolute bottom-2 right-3 flex items-center gap-3 bg-slate-950/85 px-2.5 py-1 rounded-md border border-slate-800 text-[10px] text-slate-400 pointer-events-none">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400" /> You (Blue)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Target Peer (Yellow)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Other Peers (Orange)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> BLE Beacon
            </span>
          </div>
        </div>

        {/* Interactive Controls & View Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-800 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showGraphMesh}
              onChange={(e) => setShowGraphMesh(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
            />
            <span>Building Graph Mesh</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={peersRoaming}
              onChange={(e) => setPeersRoaming(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
            />
            <span>Simulate Peer Movement</span>
          </label>

          <div className="flex items-center gap-2 col-span-2 justify-end">
            <span className="text-slate-400">Lock Target:</span>
            <select
              value={lockedTargetPeerId || selectedRoomId || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith('peer_')) {
                  setLockedTargetPeerId(val);
                  setSelectedRoomId(null);
                } else if (val.startsWith('room_')) {
                  setSelectedRoomId(val);
                  setLockedTargetPeerId(null);
                } else {
                  setLockedTargetPeerId(null);
                  setSelectedRoomId(null);
                }
              }}
              className="bg-slate-800 border border-slate-700 text-cyan-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none"
            >
              <optgroup label="Active Building Peers">
                {peers.map((p) => (
                  <option key={p.id} value={p.id}>
                    👤 {p.fullName} ({p.department})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Building Landmarks">
                {nodes
                  .filter((n) => n.type === 'room')
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      🚪 {r.label}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {/* Right Column: Multi-User Peer Directory & Sensor Telemetry */}
      <div className="w-full lg:w-96 flex flex-col gap-4">
        {/* Active Building Users Directory Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Building Peers ({peers.length})
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
              Floor 1 Active
            </span>
          </div>

          <div className="space-y-2">
            {peers.map((peer) => {
              const distance = Math.hypot(peer.x - userPose.x, peer.y - userPose.y);
              const isTarget = lockedTargetPeerId === peer.id;

              return (
                <div
                  key={peer.id}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isTarget
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
                        style={{
                          backgroundColor: `${peer.avatarColor}25`,
                          color: peer.avatarColor,
                          border: `1px solid ${peer.avatarColor}50`
                        }}
                      >
                        {peer.fullName[0]}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white leading-tight">
                          {peer.fullName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {peer.department} • {distance.toFixed(1)}m away
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setLockedTargetPeerId(peer.id);
                        setSelectedRoomId(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                        isTarget
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {isTarget ? 'Locked' : 'Navigate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 1D Kalman Filter Live Monitor */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                1D Kalman Filter (Beacon N-01)
              </h3>
            </div>
            <button
              onClick={() => onSelectCodeTab?.('lib/services/location_fusion_service.dart')}
              className="text-[11px] text-cyan-400 hover:underline flex items-center gap-0.5"
            >
              Dart Code <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            Red: Raw noisy RSSI • Green: Kalman-filtered smoothed signal
          </p>

          <div className="rounded-lg overflow-hidden border border-slate-800 bg-[#070C16]">
            <canvas ref={kalmanCanvasRef} width={340} height={85} className="w-full h-20 block" />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800 text-[11px] font-mono text-center">
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <div className="text-slate-400 text-[9px]">RAW RSSI</div>
              <div className="text-red-400 font-bold">{beacons[0]?.currentRawRssi.toFixed(1)} dBm</div>
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <div className="text-slate-400 text-[9px]">FILTERED</div>
              <div className="text-emerald-400 font-bold">{beacons[0]?.filteredRssi.toFixed(1)} dBm</div>
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <div className="text-slate-400 text-[9px]">EST. DIST</div>
              <div className="text-cyan-400 font-bold">{beacons[0]?.estimatedDistance.toFixed(2)} m</div>
            </div>
          </div>
        </div>

        {/* PDR Step Peak Detection Monitor */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Footprints className="w-4 h-4 text-pink-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                PDR Step Peak Detection
              </h3>
            </div>
            <button
              onClick={() => onSelectCodeTab?.('lib/services/step_detector.dart')}
              className="text-[11px] text-cyan-400 hover:underline flex items-center gap-0.5"
            >
              Dart Code <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="rounded-lg overflow-hidden border border-slate-800 bg-[#070C16]">
            <canvas ref={pdrCanvasRef} width={340} height={70} className="w-full h-18 block" />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800 text-[11px] font-mono text-center">
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <div className="text-slate-400 text-[9px]">STEP COUNT</div>
              <div className="text-pink-400 font-bold">{userPose.stepCount}</div>
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <div className="text-slate-400 text-[9px]">STEP MODEL</div>
              <div className="text-slate-300 font-bold">Weinberg K=0.45</div>
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <div className="text-slate-400 text-[9px]">BEARING</div>
              <div className="text-cyan-400 font-bold">{userPose.heading.toFixed(0)}°</div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over Full Building Directory Modal */}
      {isPeersDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Active Building Users Directory</h3>
                  <p className="text-xs text-slate-400">Live Supabase WebSocket presence channel</p>
                </div>
              </div>
              <button
                onClick={() => setIsPeersDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-3">
              {peers.map((peer) => {
                const distance = Math.hypot(peer.x - userPose.x, peer.y - userPose.y);
                const isTarget = lockedTargetPeerId === peer.id;

                return (
                  <div
                    key={peer.id}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                        style={{
                          backgroundColor: `${peer.avatarColor}20`,
                          color: peer.avatarColor,
                          border: `1px solid ${peer.avatarColor}50`
                        }}
                      >
                        {peer.fullName[0]}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{peer.fullName}</div>
                        <div className="text-xs text-slate-400">
                          {peer.role} • <span className="text-slate-300">{peer.department}</span>
                        </div>
                        <div className="text-[11px] text-cyan-400 font-mono mt-0.5">
                          {distance.toFixed(1)} meters away • Floor 1
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setLockedTargetPeerId(peer.id);
                        setSelectedRoomId(null);
                        setIsPeersDrawerOpen(false);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                        isTarget
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                      }`}
                    >
                      {isTarget ? 'Route Active' : 'Navigate'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
