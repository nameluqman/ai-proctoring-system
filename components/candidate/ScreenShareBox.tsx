import React, { useEffect, useRef } from "react";
import { Monitor, Video, VideoOff } from "lucide-react";

interface ScreenShareBoxProps {
  isSharing: boolean;
  stream: MediaStream | null;
  onStartShare: () => void;
  onStopShare: () => void;
}

export default function ScreenShareBox({ isSharing, stream, onStartShare, onStopShare }: ScreenShareBoxProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-md font-semibold text-white">Screen Verification</h2>
          <p className="text-xs text-slate-400">Share your full display to begin the proctored interview.</p>
        </div>
        {!isSharing ? (
          <button
            onClick={onStartShare}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md"
          >
            <Video className="w-4 h-4" /> Start Screen Share
          </button>
        ) : (
          <button
            onClick={onStopShare}
            className="bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md"
          >
            <VideoOff className="w-4 h-4" /> Stop Sharing
          </button>
        )}
      </div>

      <div className="relative bg-slate-950 border border-slate-800 rounded-lg aspect-video flex items-center justify-center overflow-hidden max-h-[350px]">
        {isSharing ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
        ) : (
          <div className="text-center p-6 space-y-2">
            <Monitor className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400">Screen feed is not active.</p>
          </div>
        )}
      </div>
    </div>
  );
}