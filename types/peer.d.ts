import type { DataConnection, MediaConnection } from "peerjs";

export interface PeerSession {
  peerId: string;
  isConnected: boolean;
  dataConnection: DataConnection | null;
  mediaConnection: MediaConnection | null;
}