// hooks/usePeer.ts
import { useState, useEffect, useRef, useCallback } from "react";
import type { DataConnection, Peer } from "peerjs";

export function usePeer(customId: string, remotePeerId?: string) {
  const [peerId, setPeerId] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [peerReady, setPeerReady] = useState<boolean>(false);
  const peerRef = useRef<Peer | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);

  const connectToRemotePeer = useCallback(() => {
    if (!peerRef.current || !remotePeerId || typeof window === "undefined") return;

    if (dataConnRef.current && dataConnRef.current.open) return;

    const conn = peerRef.current.connect(remotePeerId);
    dataConnRef.current = conn;

    conn.on("open", () => {
      setIsConnected(true);
    });

    conn.on("close", () => {
      setIsConnected(false);
      dataConnRef.current = null;
    });

    conn.on("error", () => {
      setIsConnected(false);
      dataConnRef.current = null;
    });
  }, [remotePeerId]);

  useEffect(() => {
    if (typeof window === "undefined" || !customId) return;

    let peerInstance: Peer;

    const initPeer = async () => {
      const { default: Peer } = await import("peerjs");

      if (peerRef.current) {
        peerRef.current.destroy();
      }

      peerInstance = new Peer(customId, {
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
          ],
        },
        debug: 1,
      });

      peerInstance.on("open", (id: string) => {
        setPeerId(id);
        setPeerReady(true);
        connectToRemotePeer();
      });

      peerInstance.on("connection", (conn: DataConnection) => {
        dataConnRef.current = conn;
        setIsConnected(true);

        conn.on("close", () => setIsConnected(false));
      });

      peerInstance.on("error", (err: any) => {
        if (err.type === "unavailable-id") {
          console.warn(`Peer ID "${customId}" taken/reconnecting.`);
        } else {
          console.error("PeerJS error:", err);
        }
      });

      peerRef.current = peerInstance;
    };

    initPeer();

    return () => {
      setPeerReady(false);
      if (peerInstance) {
        peerInstance.destroy();
      }
    };
  }, [connectToRemotePeer, customId, remotePeerId]);

  useEffect(() => {
    if (!remotePeerId || !peerReady) return;

    const retryTimer = window.setInterval(() => {
      if (!dataConnRef.current || !dataConnRef.current.open) {
        connectToRemotePeer();
      }
    }, 2000);

    return () => window.clearInterval(retryTimer);
  }, [connectToRemotePeer, peerReady, remotePeerId]);

  return { peerId, isConnected, peerReady, peerRef, dataConnRef, connectToRemotePeer };
}