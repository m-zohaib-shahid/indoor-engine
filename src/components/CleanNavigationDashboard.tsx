import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Compass,
  Users,
  LogOut,
  Navigation,
  X,
  CheckCircle2,
  Clock,
  Smartphone,
} from 'lucide-react';
import { BuildingPeer, SimulatorNode, SimulatorEdge, UserPose } from '../types/simulator';
import { runAStarBetweenCoordinates } from '../utils/simulatorEngine';
import {
  AntiShakeStepDetector,
  FLOOR_ROOMS,
  FLOOR_WALL_SEGMENTS,
  resolveWallCollision,
  smoothHeadingDegrees,
} from '../utils/floorPhysics';

interface CleanNavigationDashboardProps {
  currentUser: { name: string; role: string; email: string };
  onSignOut: () => void;
}

export const CleanNavigationDashboard: React.FC<CleanNavigationDashboardProps> = ({
  currentUser,
  onSignOut,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stepDetectorRef = useRef<AntiShakeStepDetector>(new AntiShakeStepDetector());
  const headingRef = useRef<number>(90);
  const rawHeadingRef = useRef<number | null>(null);
  const headingOffsetRef = useRef<number>(0);
  const lastHeadingSyncRef = useRef<number>(0);
  const wallHitUntilRef = useRef<number>(0);
  const sensorCleanupRef = useRef<(() => void) | null>(null);
  const shakeHintTimerRef = useRef<number | null>(null);

  // Scale: 1 meter = 24 canvas pixels for crisp, generous display
  const METERS_TO_PX = 24;

  // Active Building Peers (Multi-User Network)
  const [peers, setPeers] = useState<BuildingPeer[]>([
    {
      id: 'peer_hassaan',
      fullName: 'Hassaan Tariq',
      email: 'hassaan@enterprise.io',
      role: 'Lead Architect',
      department: 'Executive Suite',
      x: 25.0,
      y: 19.5,
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
      x: 7.0,
      y: 6.5,
      floor: 1,
      isOnline: true,
      avatarColor: '#EC4899',
      lastUpdated: '1s ago',
    },
    {
      id: 'peer_marcus',
      fullName: 'Marcus Vance',
      email: 'm.vance@enterprise.io',
      role: 'Director of Product',
      department: 'Conf Room A',
      x: 25.0,
      y: 6.5,
      floor: 1,
      isOnline: true,
      avatarColor: '#8B5CF6',
      lastUpdated: '2s ago',
    },
    {
      id: 'peer_elena',
      fullName: 'Elena Rostova',
      email: 'elena@enterprise.io',
      role: 'Operations Lead',
      department: 'Cafeteria',
      x: 7.0,
      y: 19.5,
      floor: 1,
      isOnline: true,
      avatarColor: '#10B981',
      lastUpdated: 'Just now',
    },
  ]);

  // Topological corridor nodes for building floor plan
  const nodes: SimulatorNode[] = useMemo(() => [
    { id: 'room_101', label: 'Lab 101', x: 7, y: 6.5, floor: 1, type: 'room' },
    { id: 'room_102', label: 'Conference Room A', x: 25, y: 6.5, floor: 1, type: 'room' },
    { id: 'room_103', label: 'Cafeteria', x: 7, y: 19.5, floor: 1, type: 'room' },
    { id: 'room_104', label: 'Executive Suite', x: 25, y: 19.5, floor: 1, type: 'room' },
    { id: 'room_105', label: 'Server Hub', x: 16, y: 3.5, floor: 1, type: 'room' },
    { id: 'corr_center', label: 'Central Atrium', x: 16, y: 13, floor: 1, type: 'corridor' },
    { id: 'corr_north', label: 'North Corridor', x: 16, y: 6.5, floor: 1, type: 'corridor' },
    { id: 'corr_south', label: 'South Corridor', x: 16, y: 19.5, floor: 1, type: 'corridor' },
    { id: 'corr_west', label: 'West Hallway', x: 10.5, y: 13, floor: 1, type: 'corridor' },
    { id: 'corr_east', label: 'East Hallway', x: 21.5, y: 13, floor: 1, type: 'corridor' },
  ], []);

  const edges: SimulatorEdge[] = useMemo(() => [
    { fromId: 'corr_center', toId: 'corr_north', weight: 6.5 },
    { fromId: 'corr_center', toId: 'corr_south', weight: 6.5 },
    { fromId: 'corr_center', toId: 'corr_west', weight: 5.5 },
    { fromId: 'corr_center', toId: 'corr_east', weight: 5.5 },
    { fromId: 'corr_north', toId: 'room_101', weight: 9 },
    { fromId: 'corr_north', toId: 'room_102', weight: 9 },
    { fromId: 'corr_north', toId: 'room_105', weight: 3 },
    { fromId: 'corr_south', toId: 'room_103', weight: 9 },
    { fromId: 'corr_south', toId: 'room_104', weight: 9 },
    { fromId: 'corr_west', toId: 'room_101', weight: 7.4 },
    { fromId: 'corr_west', toId: 'room_103', weight: 7.4 },
    { fromId: 'corr_east', toId: 'room_102', weight: 7.4 },
    { fromId: 'corr_east', toId: 'room_104', weight: 7.4 },
  ], []);

  // Current User Position & Motion State
  const [userPose, setUserPose] = useState<UserPose>({
    x: 16.0,
    y: 13.0,
    floor: 1,
    heading: 90,
    stepCount: 142,
    totalDistanceMeters: 92.4,
    accuracy: 1.0,
  });

  // Navigation Target (Peer User or Room)
  const [targetPeerId, setTargetPeerId] = useState<string | null>('peer_hassaan');
  const [targetRoomId, setTargetRoomId] = useState<string | null>(null);

  // Active Users Slide-Over Drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Motion sensors state (location updates strictly via PDR motion sensors)
  const [motionSensorsActive, setMotionSensorsActive] = useState(false);
  const [sensorStatusMessage, setSensorStatusMessage] = useState<string>('Enable Sensors');
  const [pulseAnim, setPulseAnim] = useState(0);

  // Step Forward immediately along the live headingRef direction (zero-lag PDR)
  const stepForward = useCallback((stepLength = 0.70) => {
    setUserPose((prev) => {
      const liveHeading = headingRef.current;
      const headingRad = ((liveHeading - 90) * Math.PI) / 180;
      const dx = Math.cos(headingRad) * stepLength;
      const dy = Math.sin(headingRad) * stepLength;

      const resolved = resolveWallCollision(prev.x, prev.y, dx, dy);
      const actualMoved = Math.hypot(resolved.x - prev.x, resolved.y - prev.y);

      if (resolved.hitWall) {
        wallHitUntilRef.current = Date.now() + 450;
      }

      if (actualMoved < 0.03) {
        return {
          ...prev,
          heading: Math.round(liveHeading),
        };
      }

      return {
        ...prev,
        x: resolved.x,
        y: resolved.y,
        heading: Math.round(liveHeading),
        stepCount: prev.stepCount + 1,
        totalDistanceMeters: Number((prev.totalDistanceMeters + actualMoved).toFixed(1)),
      };
    });
  }, []);

  // Active Target Information
  const activeTarget = useMemo(() => {
    if (targetPeerId) {
      const peer = peers.find((p) => p.id === targetPeerId);
      if (peer) {
        return {
          id: peer.id,
          name: peer.fullName,
          subtext: `${peer.department} • ${peer.role}`,
          coords: { x: peer.x, y: peer.y },
          isPeer: true,
        };
      }
    }
    if (targetRoomId) {
      const room = nodes.find((n) => n.id === targetRoomId);
      if (room) {
        return {
          id: room.id,
          name: room.label,
          subtext: 'Building Landmark',
          coords: { x: room.x, y: room.y },
          isPeer: false,
        };
      }
    }
    return null;
  }, [targetPeerId, targetRoomId, peers, nodes]);

  // Compute live continuous A* path connecting (userPose.x, userPose.y) directly to (target.x, target.y)
  const activeRoute = useMemo(() => {
    if (!activeTarget) return null;
    return runAStarBetweenCoordinates(
      nodes,
      edges,
      { x: userPose.x, y: userPose.y },
      activeTarget.coords
    );
  }, [userPose.x, userPose.y, activeTarget, nodes, edges]);

  // Live Metric Distance Calculation
  const liveDirectDistance = useMemo(() => {
    if (!activeTarget) return 0;
    return Math.hypot(activeTarget.coords.x - userPose.x, activeTarget.coords.y - userPose.y);
  }, [userPose.x, userPose.y, activeTarget]);

  const remainingDistanceMeters = useMemo(() => {
    if (!activeTarget) return 0;
    if (activeRoute && activeRoute.totalDistance > 0) {
      return activeRoute.totalDistance;
    }
    return liveDirectDistance;
  }, [activeRoute, liveDirectDistance, activeTarget]);

  // Arrival threshold: under 1.4 meters
  const hasArrived = Boolean(activeTarget && liveDirectDistance < 1.4);

  // Pulse animation frame
  useEffect(() => {
    let frame: number;
    const tick = () => {
      setPulseAnim((prev) => (prev + 0.02) % 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // WebSockets Peer Position Lock: Peer natural roaming updates target coords in real time
  useEffect(() => {
    const interval = setInterval(() => {
      setPeers((prev) =>
        prev.map((peer, idx) => {
          const angle = Date.now() / 1400 + idx * 1.5;
          const bases = [
            { x: 25.0, y: 19.5 }, // Hassaan
            { x: 7.0, y: 6.5 },   // Sarah
            { x: 25.0, y: 6.5 },  // Marcus
            { x: 7.0, y: 19.5 },  // Elena
          ];
          const b = bases[idx] || { x: peer.x, y: peer.y };
          return {
            ...peer,
            x: Number((b.x + Math.sin(angle) * 0.45).toFixed(2)),
            y: Number((b.y + Math.cos(angle) * 0.45).toFixed(2)),
            lastUpdated: 'Live',
          };
        })
      );
    }, 700);
    return () => clearInterval(interval);
  }, []);



  // Low-latency orientation extraction with screen-orientation & compass calibration offset
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    const compass = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
    const screenAngle =
      typeof window !== 'undefined' && window.screen?.orientation
        ? window.screen.orientation.angle || 0
        : 0;

    let rawHeading: number | null = null;
    if (compass !== undefined && compass !== null && !Number.isNaN(compass)) {
      rawHeading = (compass + screenAngle + 360) % 360;
    } else if (e.alpha !== null && !Number.isNaN(e.alpha)) {
      rawHeading = (360 - e.alpha + screenAngle + 360) % 360;
    }

    if (rawHeading === null) return;
    rawHeadingRef.current = rawHeading;

    const calibrated = (rawHeading - headingOffsetRef.current + 360) % 360;
    const smoothed = smoothHeadingDegrees(headingRef.current, calibrated, 0.48);
    headingRef.current = smoothed;

    // Throttle React UI updates (~25fps & >=2 deg change) so A* and Canvas stay 100% lag-free
    const now = Date.now();
    if (now - lastHeadingSyncRef.current >= 40) {
      lastHeadingSyncRef.current = now;
      const rounded = Math.round(smoothed);
      setUserPose((prev) =>
        Math.abs(prev.heading - rounded) >= 2 ? { ...prev, heading: rounded } : prev
      );
    }
  }, []);

  // Anti-Shake Gait Step Detector (ignores sitting hand-shakes, fires immediately on real strides)
  const handleMotion = useCallback(
    (e: DeviceMotionEvent) => {
      const accG = e.accelerationIncludingGravity;
      const accLin = e.acceleration;
      if (!accG && !accLin) return;

      const ax = accG?.x ?? accLin?.x ?? 0;
      const ay = accG?.y ?? accLin?.y ?? 0;
      const az = accG?.z ?? accLin?.z ?? 0;

      const result = stepDetectorRef.current.processSample({
        ax,
        ay,
        az,
        linAx: accLin?.x ?? null,
        linAy: accLin?.y ?? null,
        linAz: accLin?.z ?? null,
        rotAlpha: e.rotationRate?.alpha ?? null,
        rotBeta: e.rotationRate?.beta ?? null,
        rotGamma: e.rotationRate?.gamma ?? null,
        timestampMs: Date.now(),
      });

      if (result.stepDetected) {
        stepForward(result.stepLengthMeters);
      } else if (result.shakeRejected) {
        setSensorStatusMessage('Shake Ignored');
        if (shakeHintTimerRef.current) {
          window.clearTimeout(shakeHintTimerRef.current);
        }
        shakeHintTimerRef.current = window.setTimeout(() => {
          setSensorStatusMessage('PDR Active');
        }, 900);
      }
    },
    [stepForward]
  );

  // Align physical phone direction to Map North (0 deg) on tap
  const alignPhoneHeadingToMap = useCallback(() => {
    if (rawHeadingRef.current !== null) {
      headingOffsetRef.current = rawHeadingRef.current;
    }
    headingRef.current = 0;
    setUserPose((prev) => ({ ...prev, heading: 0 }));
    setSensorStatusMessage('Heading Aligned');
    window.setTimeout(() => {
      setSensorStatusMessage((cur) => (cur === 'Heading Aligned' ? 'PDR Active' : cur));
    }, 1100);
  }, []);

  const attachMotionListeners = useCallback(() => {
    if (sensorCleanupRef.current) {
      sensorCleanupRef.current();
      sensorCleanupRef.current = null;
    }

    stepDetectorRef.current.reset();

    let hasAbsoluteOrientation = false;
    const onAbsOrientation = (e: Event) => {
      hasAbsoluteOrientation = true;
      handleOrientation(e as DeviceOrientationEvent);
    };
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (
        !hasAbsoluteOrientation ||
        (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading !== undefined
      ) {
        handleOrientation(e);
      }
    };

    window.addEventListener('deviceorientationabsolute', onAbsOrientation);
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', handleMotion);

    sensorCleanupRef.current = () => {
      window.removeEventListener('deviceorientationabsolute', onAbsOrientation);
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', handleMotion);
    };

    setMotionSensorsActive(true);
    setSensorStatusMessage('PDR Active');
  }, [handleOrientation, handleMotion]);

  // Real Hardware Device Motion & Accelerometer Step Detector Handler
  const requestSensorAccess = async () => {
    try {
      // iOS 13+ requires explicit permission request
      if (
        typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
          .requestPermission === 'function'
      ) {
        const perm = await (
          DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }
        ).requestPermission();
        if (perm !== 'granted') {
          setSensorStatusMessage('Motion Permission Denied');
          return;
        }
      }
      if (
        typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> })
          .requestPermission === 'function'
      ) {
        await (
          DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }
        ).requestPermission();
      }

      attachMotionListeners();
    } catch {
      attachMotionListeners();
    }
  };

  // Auto-start motion sensors on Android/browsers that don't gate behind iOS requestPermission
  useEffect(() => {
    const needsExplicitPrompt =
      typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> })
        ?.requestPermission === 'function' ||
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        ?.requestPermission === 'function';

    if (!needsExplicitPrompt) {
      attachMotionListeners();
    }

    return () => {
      if (sensorCleanupRef.current) {
        sensorCleanupRef.current();
      }
      if (shakeHintTimerRef.current) {
        window.clearTimeout(shakeHintTimerRef.current);
      }
    };
  }, [attachMotionListeners]);

  // Clean Canvas Painter
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Dark Slate Viewport Background (#0F172A)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Subtle Architectural Grid
    ctx.strokeStyle = '#1E293B';
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

    // 2. Clean Room Layout with Solid Wall Segments & Visible Open Doorways
    FLOOR_ROOMS.forEach((r) => {
      const rx = r.x * METERS_TO_PX;
      const ry = r.y * METERS_TO_PX;
      const rw = r.w * METERS_TO_PX;
      const rh = r.h * METERS_TO_PX;

      ctx.fillStyle = '#1E293B70';
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 8);
      ctx.fill();

      // Draw subtle doorway thresholds so open entrances are clear
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.32)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      r.doors.forEach((d) => {
        ctx.beginPath();
        if (d.side === 'top') {
          ctx.moveTo((r.x + d.start) * METERS_TO_PX, ry);
          ctx.lineTo((r.x + d.end) * METERS_TO_PX, ry);
        } else if (d.side === 'bottom') {
          ctx.moveTo((r.x + d.start) * METERS_TO_PX, ry + rh);
          ctx.lineTo((r.x + d.end) * METERS_TO_PX, ry + rh);
        } else if (d.side === 'left') {
          ctx.moveTo(rx, (r.y + d.start) * METERS_TO_PX);
          ctx.lineTo(rx, (r.y + d.end) * METERS_TO_PX);
        } else {
          ctx.moveTo(rx + rw, (r.y + d.start) * METERS_TO_PX);
          ctx.lineTo(rx + rw, (r.y + d.end) * METERS_TO_PX);
        }
        ctx.stroke();
      });
      ctx.setLineDash([]);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 12px Inter, sans-serif';
      ctx.fillText(r.name, rx + 16, ry + 24);
    });

    // Solid impenetrable wall segments (skip outer frame edges that sit at map boundary)
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    FLOOR_WALL_SEGMENTS.forEach((w) => {
      ctx.beginPath();
      ctx.moveTo(w.x1 * METERS_TO_PX, w.y1 * METERS_TO_PX);
      ctx.lineTo(w.x2 * METERS_TO_PX, w.y2 * METERS_TO_PX);
      ctx.stroke();
    });

    // 3. Smooth Glowing Cyan Dashed Route Line connecting Start to Target
    if (activeRoute && activeRoute.pathCoordinates.length > 1) {
      const coords = activeRoute.pathCoordinates;

      ctx.strokeStyle = 'rgba(6, 182, 212, 0.28)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(coords[0].x * METERS_TO_PX, coords[0].y * METERS_TO_PX);
      coords.forEach((c) => ctx.lineTo(c.x * METERS_TO_PX, c.y * METERS_TO_PX));
      ctx.stroke();

      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -pulseAnim * 28;
      ctx.beginPath();
      ctx.moveTo(coords[0].x * METERS_TO_PX, coords[0].y * METERS_TO_PX);
      coords.forEach((c) => ctx.lineTo(c.x * METERS_TO_PX, c.y * METERS_TO_PX));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Building Peers
    peers.forEach((peer) => {
      const px = peer.x * METERS_TO_PX;
      const py = peer.y * METERS_TO_PX;
      const isTarget = targetPeerId === peer.id;

      if (isTarget) {
        // Glowing / Pulsing Yellow Target Dot
        ctx.strokeStyle = `rgba(245, 158, 11, ${0.85 * (1 - pulseAnim)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, 10 + pulseAnim * 22, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(`⭐ ${peer.fullName}`, px - 28, py - 14);
      } else {
        // Subtle Muted Dots for other users
        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(peer.fullName.split(' ')[0], px - 12, py - 10);
      }
    });

    // 5. User Dot: Pulsing Blue Dot with Heading Direction Cone
    const ux = userPose.x * METERS_TO_PX;
    const uy = userPose.y * METERS_TO_PX;

    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
    ctx.beginPath();
    ctx.arc(ux, uy, userPose.accuracy * METERS_TO_PX, 0, Math.PI * 2);
    ctx.fill();

    const headingRad = ((userPose.heading - 90) * Math.PI) / 180;
    const coneRadius = 42;
    ctx.fillStyle = 'rgba(59, 130, 246, 0.35)';
    ctx.beginPath();
    ctx.moveTo(ux, uy);
    ctx.arc(ux, uy, coneRadius, headingRad - 0.42, headingRad + 0.42);
    ctx.closePath();
    ctx.fill();

    const isWallBlocked = Date.now() < wallHitUntilRef.current;

    ctx.strokeStyle = isWallBlocked
      ? 'rgba(244, 63, 94, 0.9)'
      : `rgba(59, 130, 246, ${0.9 * (1 - pulseAnim)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ux, uy, 10 + pulseAnim * 20, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = isWallBlocked ? '#F43F5E' : '#3B82F6';
    ctx.beginPath();
    ctx.arc(ux, uy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }, [userPose, activeRoute, peers, targetPeerId, pulseAnim]);

  // Handle canvas click: select target peer or room only (no manual movement)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const meterX = clickX / METERS_TO_PX;
    const meterY = clickY / METERS_TO_PX;

    // Check if clicked a peer
    const clickedPeer = peers.find((p) => Math.hypot(p.x - meterX, p.y - meterY) < 1.8);
    if (clickedPeer) {
      setTargetPeerId(clickedPeer.id);
      setTargetRoomId(null);
      return;
    }

    // Check if clicked a room
    const clickedRoom = nodes.find((n) => Math.hypot(n.x - meterX, n.y - meterY) < 2.5 && n.type === 'room');
    if (clickedRoom) {
      setTargetRoomId(clickedRoom.id);
      setTargetPeerId(null);
    }
  };

  return (
    <div className="h-screen w-full bg-[#0B0F19] text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* 1. Minimalist Top Navigation Bar */}
      <header className="h-16 px-6 bg-[#0F172A]/90 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-md shadow-cyan-500/20">
            <div className="w-full h-full bg-[#0F172A] rounded-[10px] flex items-center justify-center">
              <Compass className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-none">
              Indoor Nav Engine
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-slate-400 font-medium">Connected to Floor 1</span>
            </div>
          </div>
        </div>

        {/* Center: Current User Profile Chip & Sensor Status */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-xs">
            <div className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center text-[11px]">
              {(currentUser.name.trim()[0] || 'U').toUpperCase()}
            </div>
            <span className="font-semibold text-white">
              Good morning, {currentUser.name.trim().split(/\s+/)[0] || 'there'}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-cyan-400 font-medium">{currentUser.role}</span>
          </div>

          {/* Sensor Access & Heading Alignment */}
          <button
            onClick={requestSensorAccess}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              motionSensorsActive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Enable anti-shake walking step detection & compass heading"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{sensorStatusMessage}</span>
          </button>

          {motionSensorsActive && (
            <button
              onClick={alignPhoneHeadingToMap}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition"
              title="Point your phone toward the top of the map and tap Align"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Align</span>
            </button>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition shadow-sm"
          >
            <Users className="w-4 h-4" />
            <span>Active Users</span>
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-bold">
              {peers.length}
            </span>
          </button>

          <button
            onClick={onSignOut}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
            title="Sign Out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Clean 2D Floor Plan Canvas (Main Viewport) */}
      <main className="flex-1 relative p-4 flex items-center justify-center bg-[#070B14] overflow-hidden">
        <div className="relative w-full h-full max-w-5xl rounded-3xl overflow-hidden border border-slate-800 bg-[#0F172A] shadow-2xl flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={768}
            height={580}
            onClick={handleCanvasClick}
            className="cursor-pointer block max-w-full max-h-full object-contain"
          />

          {/* 3. Floating Navigation Guidance Banner with Live Distance Countdown */}
          {activeTarget && (
            <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-auto sm:w-[500px] z-20 animate-fade-in">
              <div
                className={`border rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 transition-all ${
                  hasArrived
                    ? 'bg-emerald-950/95 border-emerald-500/60 shadow-emerald-500/20'
                    : 'bg-[#0B101E]/95 border-cyan-500/40 shadow-black/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      hasArrived
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    }`}
                  >
                    {hasArrived ? (
                      <CheckCircle2 className="w-6 h-6 animate-bounce" />
                    ) : (
                      <Navigation className="w-5 h-5 animate-pulse" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span>{hasArrived ? 'Destination Reached' : 'Navigating to'}</span>
                      <span className="text-cyan-400 font-bold truncate">{activeTarget.name}</span>
                    </div>

                    <div className="text-sm font-bold text-white truncate">
                      {hasArrived
                        ? 'You Have Arrived! 🎉'
                        : `Proceed ${remainingDistanceMeters.toFixed(1)}m to destination`}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>
                        {hasArrived
                          ? 'Target is at your location'
                          : `~${Math.max(1, Math.round(remainingDistanceMeters / 1.1))}s walk • Step count: ${userPose.stepCount}`}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setTargetPeerId(null);
                    setTargetRoomId(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0"
                >
                  {hasArrived ? 'Done' : 'Cancel'}
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* 5. Clean Active Users Drawer (Slide-Over Panel) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm h-full bg-[#0F172A] border-l border-slate-800 p-6 flex flex-col shadow-2xl animate-slide-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">Active Building Users</h3>
                  <p className="text-xs text-slate-400">{peers.length} online peers on Floor 1</p>
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {peers.map((peer) => {
                const distance = Math.hypot(peer.x - userPose.x, peer.y - userPose.y);
                const isTarget = targetPeerId === peer.id;

                return (
                  <div
                    key={peer.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isTarget
                        ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5'
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                          style={{
                            backgroundColor: `${peer.avatarColor}20`,
                            color: peer.avatarColor,
                            border: `1px solid ${peer.avatarColor}40`,
                          }}
                        >
                          {peer.fullName[0]}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">{peer.fullName}</div>
                          <div className="text-xs text-slate-400">{peer.role}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-cyan-400">
                          {distance.toFixed(1)} m
                        </span>
                        <div className="text-[10px] text-slate-500">Distance</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                      <span className="text-xs text-slate-400">{peer.department}</span>

                      <button
                        onClick={() => {
                          setTargetPeerId(peer.id);
                          setTargetRoomId(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                          isTarget
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                        }`}
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>{isTarget ? 'Route Active' : 'Navigate to User'}</span>
                      </button>
                    </div>
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
