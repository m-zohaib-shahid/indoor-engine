export interface SimulatorBeacon {
  id: string;
  name: string;
  x: number; // in meters
  y: number; // in meters
  floor: number;
  txPower: number; // RSSI at 1 meter, e.g. -59 dBm
  pathLossN: number; // path loss exponent, e.g. 2.2
  currentRawRssi: number;
  filteredRssi: number;
  estimatedDistance: number;
  kalmanState: {
    q: number;
    r: number;
    p: number;
    x: number;
  };
}

export interface SimulatorNode {
  id: string;
  label: string;
  x: number;
  y: number;
  floor: number;
  type: 'room' | 'corridor' | 'door' | 'entrance';
}

export interface SimulatorEdge {
  fromId: string;
  toId: string;
  weight: number;
}

export interface UserPose {
  x: number; // meters
  y: number; // meters
  floor: number;
  heading: number; // degrees 0-360
  stepCount: number;
  totalDistanceMeters: number;
  accuracy: number;
}

export interface BuildingPeer {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  x: number;
  y: number;
  floor: number;
  isOnline: boolean;
  avatarColor: string;
  lastUpdated: string;
}

export interface TelemetryPacket {
  id: string;
  userId: string;
  x: number;
  y: number;
  floor: number;
  heading: number;
  accuracy: number;
  timestamp: string;
  source: 'BLE+PDR' | 'PDR' | 'TRILAT';
}

export interface AccelerometerSample {
  time: number;
  raw: number;
  filtered: number;
  isPeak: boolean;
  threshold: number;
}
