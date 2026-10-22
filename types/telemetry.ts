export interface EventLog {
  id: string;
  type: string;
  message: string;
  presence?: boolean;
  timestamp: string;
}

export interface HeadPoseAngles {
  pitch: number;
  yaw: number;
  roll: number;
}

export interface MetricsStats {
  tabSwitches: number;
  windowBlurs: number;
  copyPastes: number;
}

export interface EvidenceSnapshot {
  id: string;
  eventId: string;
  type: string;
  message: string;
  timestamp: string;
  imageUrl: string;
}