import Link from "next/link";
import { ShieldCheck, Eye, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-xl w-full text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Interview Proctor Portal</h1>
          <p className="text-slate-400 text-sm">
            Select your role to launch real-time screen verification and WebRTC assessment channels.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/candidate"
            className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-6 rounded-xl flex flex-col items-center text-center space-y-3 transition-all"
          >
            <ShieldCheck className="w-10 h-10 text-indigo-400 group-hover:scale-110 transition-transform" />
            <h2 className="font-bold text-white">Candidate Portal</h2>
            <p className="text-xs text-slate-400">Share display stream and complete your assessment.</p>
            <span className="text-xs text-indigo-400 font-medium flex items-center gap-1 pt-2">
              Enter Portal <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            href="/proctor"
            className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-6 rounded-xl flex flex-col items-center text-center space-y-3 transition-all"
          >
            <Eye className="w-10 h-10 text-emerald-400 group-hover:scale-110 transition-transform" />
            <h2 className="font-bold text-white">Interviewer Station</h2>
            <p className="text-xs text-slate-400">Monitor candidate screen presence and telemetry log.</p>
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 pt-2">
              Enter Station <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}





// "use client";
// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import { 
//   Monitor, 
//   Video, 
//   VideoOff, 
//   AlertTriangle, 
//   CheckCircle, 
//   XCircle, 
//   Play, 
//   Pause, 
//   Square, 
//   Download, 
//   Copy, 
//   Eye, 
//   Activity, 
//   ShieldAlert, 
//   Clock, 
//   UserCheck, 
//   Radio, 
//   RefreshCw,
//   Maximize2,
//   Minimize2,
//   FileText,
//   Volume2,
//   VolumeX,
//   Lock,
//   Layers
// } from 'lucide-react';

// interface EventLog {
//   id: string;
//   type: 'TAB_SWITCH' | 'WINDOW_BLUR' | 'WINDOW_FOCUS' | 'COPY_PASTE' | 'MOUSE_LEAVE' | 'STREAM_STOPPED' | 'RECORDING_START' | 'RECORDING_STOP';
//   severity: 'low' | 'medium' | 'high' | 'info';
//   message: string;
//   timestamp: string;
//   details?: string;
// }

// interface ProctoringStats {
//   tabSwitches: number;
//   windowBlurs: number;
//   copyPastes: number;
//   mouseLeaves: number;
//   timeAwaySeconds: number;
// }

// export default function ProctoringDashboard() {
//   // Tab/Role Selection: Candidate View vs Proctor View vs Split View
//   const [activeRole, setActiveRole] = useState<'candidate' | 'proctor' | 'dual'>('dual');

//   // Screen Capture & Media Stream State
//   const [stream, setStream] = useState<MediaStream | null>(null);
//   const [isSharing, setIsSharing] = useState<boolean>(false);
//   const [displaySurface, setDisplaySurface] = useState<string>('unknown');

//   // MediaRecorder & Recorded Blobs State
//   const [isRecording, setIsRecording] = useState<boolean>(false);
//   const [isPaused, setIsPaused] = useState<boolean>(false);
//   const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
//   const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
//   const [recordingDuration, setRecordingDuration] = useState<number>(0);
//   const mediaRecorderRef = useRef<MediaRecorder | null>(null);
//   const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

//   // Video Element References
//   const candidateVideoRef = useRef<HTMLVideoElement | null>(null);
//   const proctorVideoRef = useRef<HTMLVideoElement | null>(null);

//   // WebRTC Peer Connection State (Simulated)
//   const [peerState, setPeerState] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');

//   // Proctoring Violation Tracking State
//   const [logs, setLogs] = useState<EventLog[]>([]);
//   const [stats, setStats] = useState<ProctoringStats>({
//     tabSwitches: 0,
//     windowBlurs: 0,
//     copyPastes: 0,
//     mouseLeaves: 0,
//     timeAwaySeconds: 0,
//   });

//   const [activeWarning, setActiveWarning] = useState<string | null>(null);
//   const awayTimerRef = useRef<NodeJS.Timeout | null>(null);
//   const lastBlurTimeRef = useRef<number | null>(null);

//   const addLog = useCallback((
//     type: EventLog['type'], 
//     severity: EventLog['severity'], 
//     message: string, 
//     details?: string
//   ) => {
//     const newLog: EventLog = {
//       id: Math.random().toString(36).substring(2, 9),
//       type,
//       severity,
//       message,
//       timestamp: new Date().toLocaleTimeString(),
//       details,
//     };
//     setLogs((prev) => [newLog, ...prev]);

//     // Set floating warning flag for high/medium severity events
//     if (severity === 'high' || severity === 'medium') {
//       setActiveWarning(message);
//       setTimeout(() => {
//         setActiveWarning(null);
//       }, 4000);
//     }
//   }, []);

//   const startScreenShare = async () => {
//     try {
//       // Request full display monitor share as preferred setting
//       const mediaStream = await navigator.mediaDevices.getDisplayMedia({
//         video: {
//           displaySurface: 'monitor', // hint for full display
//         } as any,
//         audio: true, // Capture tab/system audio if available
//       });

//       // Extract display surface type if supported by browser
//       const videoTrack = mediaStream.getVideoTracks()[0];
//       const settings = videoTrack.getSettings() as any;
//       const surfaceType = settings.displaySurface || 'screen/window';
//       setDisplaySurface(surfaceType);

//       if (surfaceType !== 'monitor') {
//         addLog(
//           'STREAM_STOPPED', 
//           'medium', 
//           'Candidate shared a single tab/window instead of full monitor.',
//           `Shared surface: ${surfaceType}`
//         );
//       }

//       // Detect when candidate manually clicks browser "Stop sharing" bar
//       videoTrack.onended = () => {
//         handleStreamStopped('Candidate terminated screen capture.');
//       };

//       setStream(mediaStream);
//       setIsSharing(true);
//       setPeerState('connecting');

//       // Simulate WebRTC Peer Connection handshake
//       setTimeout(() => {
//         setPeerState('connected');
//         addLog('RECORDING_START', 'info', 'PeerConnection established with Proctor node.');
//       }, 1500);

//       addLog('RECORDING_START', 'info', 'Screen capture initialized successfully.', `Surface: ${surfaceType}`);
//     } catch (err: any) {
//       console.error('Error sharing screen:', err);
//       addLog('STREAM_STOPPED', 'high', 'Screen sharing request rejected or failed.', err.message);
//     }
//   };

//   const stopScreenShare = () => {
//     if (stream) {
//       stream.getTracks().forEach((track) => track.stop());
//       handleStreamStopped('Screen capture ended by user control.');
//     }
//   };

//   const handleStreamStopped = (reason: string) => {
//     setStream(null);
//     setIsSharing(false);
//     setPeerState('disconnected');
//     if (isRecording) {
//       stopRecording();
//     }
//     addLog('STREAM_STOPPED', 'high', `Screen share stopped: ${reason}`);
//   };

//   useEffect(() => {
//     if (candidateVideoRef.current && stream) {
//       candidateVideoRef.current.srcObject = stream;
//     }
//     if (proctorVideoRef.current && stream) {
//       proctorVideoRef.current.srcObject = stream;
//     }
//   }, [stream, activeRole]);

//   const startRecording = () => {
//     if (!stream) return;

//     try {
//       setRecordedChunks([]);
//       setRecordedUrl(null);

//       // Support fallback mime types
//       const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
//         ? { mimeType: 'video/webm;codecs=vp9,opus' }
//         : MediaRecorder.isTypeSupported('video/webm')
//         ? { mimeType: 'video/webm' }
//         : { mimeType: 'video/mp4' };

//       const mediaRecorder = new MediaRecorder(stream, options);

//       mediaRecorder.ondataavailable = (event) => {
//         if (event.data && event.data.size > 0) {
//           setRecordedChunks((prev) => [...prev, event.data]);
//         }
//       };

//       mediaRecorder.onstop = () => {
//         setIsRecording(false);
//         setIsPaused(false);
//         if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
//       };

//       mediaRecorder.start(1000); // Deliver slices of 1 second data
//       mediaRecorderRef.current = mediaRecorder;
//       setIsRecording(true);
//       setIsPaused(false);
//       setRecordingDuration(0);

//       // Start duration counter
//       recordingTimerRef.current = setInterval(() => {
//         setRecordingDuration((prev) => prev + 1);
//       }, 1000);

//       addLog('RECORDING_START', 'info', 'Screen recording session started.');
//     } catch (error: any) {
//       console.error('MediaRecorder error:', error);
//       addLog('STREAM_STOPPED', 'high', 'Failed to start MediaRecorder.', error.message);
//     }
//   };

//   const pauseRecording = () => {
//     if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
//       mediaRecorderRef.current.pause();
//       setIsPaused(true);
//       if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
//       addLog('RECORDING_STOP', 'info', 'Recording paused by user.');
//     }
//   };

//   const resumeRecording = () => {
//     if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
//       mediaRecorderRef.current.resume();
//       setIsPaused(false);
//       recordingTimerRef.current = setInterval(() => {
//         setRecordingDuration((prev) => prev + 1);
//       }, 1000);
//       addLog('RECORDING_START', 'info', 'Recording resumed.');
//     }
//   };

//   const stopRecording = () => {
//     if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
//       mediaRecorderRef.current.stop();
//       setIsRecording(false);
//       setIsPaused(false);
//       if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
//       addLog('RECORDING_STOP', 'info', 'Screen recording finalized.');
//     }
//   };

//   // Compile recorded chunks into downloadable Blob URL
//   useEffect(() => {
//     if (!isRecording && recordedChunks.length > 0) {
//       const blob = new Blob(recordedChunks, { type: 'video/webm' });
//       const url = URL.createObjectURL(blob);
//       setRecordedUrl(url);
//     }
//   }, [isRecording, recordedChunks]);

//   useEffect(() => {
//     // 1. Page Visibility API
//     const handleVisibilityChange = () => {
//       if (document.hidden) {
//         setStats((prev) => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }));
//         addLog('TAB_SWITCH', 'high', 'Candidate switched away from assessment tab.');
//       } else {
//         addLog('WINDOW_FOCUS', 'info', 'Candidate returned to assessment tab.');
//       }
//     };

//     // 2. Window Blur & Focus (Tracking window switch & secondary applications)
//     const handleBlur = () => {
//       lastBlurTimeRef.current = Date.now();
//       setStats((prev) => ({ ...prev, windowBlurs: prev.windowBlurs + 1 }));
//       addLog('WINDOW_BLUR', 'medium', 'Assessment window lost focus (app switch or second screen).');

//       // Track duration spent away from window
//       awayTimerRef.current = setInterval(() => {
//         setStats((prev) => ({ ...prev, timeAwaySeconds: prev.timeAwaySeconds + 1 }));
//       }, 1000);
//     };

//     const handleFocus = () => {
//       if (awayTimerRef.current) {
//         clearInterval(awayTimerRef.current);
//         awayTimerRef.current = null;
//       }
//       if (lastBlurTimeRef.current) {
//         const secondsAway = Math.round((Date.now() - lastBlurTimeRef.current) / 1000);
//         addLog('WINDOW_FOCUS', 'info', `Window focus restored after ${secondsAway} seconds away.`);
//         lastBlurTimeRef.current = null;
//       }
//     };

//     // 3. Copy / Paste Event Detection
//     const handleCopyPaste = (e: ClipboardEvent) => {
//       const actionType = e.type === 'copy' ? 'Copied text' : 'Pasted clipboard content';
//       setStats((prev) => ({ ...prev, copyPastes: prev.copyPastes + 1 }));
//       addLog('COPY_PASTE', 'medium', `Clipboard action detected: ${actionType}.`);
//     };

//     // 4. Mouse Leave Detection (Moving cursor off viewport)
//     const handleMouseLeave = (e: MouseEvent) => {
//       if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
//         setStats((prev) => ({ ...prev, mouseLeaves: prev.mouseLeaves + 1 }));
//         addLog('MOUSE_LEAVE', 'low', 'Mouse cursor moved outside candidate window viewport.');
//       }
//     };

//     // Attach native DOM event listeners
//     document.addEventListener('visibilitychange', handleVisibilityChange);
//     window.addEventListener('blur', handleBlur);
//     window.addEventListener('focus', handleFocus);
//     document.addEventListener('copy', handleCopyPaste);
//     document.addEventListener('paste', handleCopyPaste);
//     document.addEventListener('mouseleave', handleMouseLeave);

//     return () => {
//       document.removeEventListener('visibilitychange', handleVisibilityChange);
//       window.removeEventListener('blur', handleBlur);
//       window.removeEventListener('focus', handleFocus);
//       document.removeEventListener('copy', handleCopyPaste);
//       document.removeEventListener('paste', handleCopyPaste);
//       document.removeEventListener('mouseleave', handleMouseLeave);
//       if (awayTimerRef.current) clearInterval(awayTimerRef.current);
//     };
//   }, [addLog]);

//   // Helper function to format duration in seconds
//   const formatTime = (seconds: number) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
//   };

//   return (
//     <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col">
//       {/* HEADER BAR */}
//       <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
//         <div className="flex items-center space-x-3">
//           <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
//             <ShieldAlert className="w-6 h-6" />
//           </div>
//           <div>
//             <h1 className="text-lg font-bold tracking-wide text-white flex items-center gap-2">
//               ProctorGuard <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">v2.4-WebRTC</span>
//             </h1>
//             <p className="text-xs text-slate-400">Candidate Screen Monitoring & Event Auditing</p>
//           </div>
//         </div>

//         {/* Dynamic Warning Notification Banner */}
//         {activeWarning && (
//           <div className="hidden md:flex items-center bg-amber-500/10 border border-amber-500/40 text-amber-300 px-4 py-2 rounded-lg text-sm animate-bounce shadow-lg">
//             <AlertTriangle className="w-4 h-4 mr-2 text-amber-400 shrink-0" />
//             <span className="font-medium">{activeWarning}</span>
//           </div>
//         )}

//         {/* View Mode Controller */}
//         <div className="flex items-center space-x-2 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
//           <button
//             onClick={() => setActiveRole('dual')}
//             className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
//               activeRole === 'dual' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
//             }`}
//           >
//             Dual Control View
//           </button>
//           <button
//             onClick={() => setActiveRole('candidate')}
//             className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
//               activeRole === 'candidate' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
//             }`}
//           >
//             Candidate View
//           </button>
//           <button
//             onClick={() => setActiveRole('proctor')}
//             className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
//               activeRole === 'proctor' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
//             }`}
//           >
//             Proctor View
//           </button>
//         </div>
//       </header>

//       {/* MAIN CONTAINER */}
//       <main className="flex-1 p-4 md:p-6 grid grid-cols-1 gap-6 max-w-[1700px] w-full mx-auto">
        
//         {/* TOP STATUS BAR OVERVIEW */}
//         <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
//           <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center space-x-3">
//             <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
//               <Monitor className="w-5 h-5" />
//             </div>
//             <div>
//               <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Screen Share</p>
//               <p className="text-sm font-bold text-slate-100 flex items-center gap-1.5 mt-0.5">
//                 {isSharing ? (
//                   <span className="text-emerald-400 flex items-center gap-1">
//                     <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Active
//                   </span>
//                 ) : (
//                   <span className="text-slate-400">Inactive</span>
//                 )}
//               </p>
//             </div>
//           </div>

//           <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center space-x-3">
//             <div className="p-3 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20">
//               <Radio className="w-5 h-5" />
//             </div>
//             <div>
//               <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">WebRTC Peer</p>
//               <p className="text-sm font-bold capitalize mt-0.5 flex items-center gap-1">
//                 {peerState === 'connected' && <span className="text-emerald-400">Connected</span>}
//                 {peerState === 'connecting' && <span className="text-amber-400">Connecting...</span>}
//                 {peerState === 'disconnected' && <span className="text-slate-400">Disconnected</span>}
//               </p>
//             </div>
//           </div>

//           <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center space-x-3">
//             <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
//               <Layers className="w-5 h-5" />
//             </div>
//             <div>
//               <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Tab Switches</p>
//               <p className={`text-lg font-extrabold mt-0.5 ${stats.tabSwitches > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
//                 {stats.tabSwitches}
//               </p>
//             </div>
//           </div>

//           <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center space-x-3">
//             <div className="p-3 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
//               <Eye className="w-5 h-5" />
//             </div>
//             <div>
//               <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Window Blurs</p>
//               <p className={`text-lg font-extrabold mt-0.5 ${stats.windowBlurs > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
//                 {stats.windowBlurs}
//               </p>
//             </div>
//           </div>

//           <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center space-x-3">
//             <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
//               <Copy className="w-5 h-5" />
//             </div>
//             <div>
//               <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Copy / Pastes</p>
//               <p className="text-lg font-extrabold text-slate-200 mt-0.5">{stats.copyPastes}</p>
//             </div>
//           </div>

//           <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center space-x-3">
//             <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
//               <Clock className="w-5 h-5" />
//             </div>
//             <div>
//               <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Time Away</p>
//               <p className="text-lg font-extrabold text-slate-200 mt-0.5">{formatTime(stats.timeAwaySeconds)}</p>
//             </div>
//           </div>
//         </div>

//         {/* DASHBOARD SPLIT GRID */}
//         <div className={`grid gap-6 ${activeRole === 'dual' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          
//           {/* SECTION 1: CANDIDATE PANEL */}
//           {(activeRole === 'candidate' || activeRole === 'dual') && (
//             <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
//               <div>
//                 <div className="flex items-center justify-between pb-3 border-b border-slate-800">
//                   <div className="flex items-center space-x-2">
//                     <UserCheck className="w-5 h-5 text-indigo-400" />
//                     <h2 className="text-md font-bold text-white">Candidate Interface</h2>
//                   </div>
//                   <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono">
//                     Surface: {displaySurface}
//                   </span>
//                 </div>

//                 {/* Candidate Video Stream Preview Container */}
//                 <div className="mt-4 relative bg-slate-950 rounded-lg overflow-hidden border border-slate-800 aspect-video flex items-center justify-center">
//                   {isSharing ? (
//                     <video
//                       ref={candidateVideoRef}
//                       autoPlay
//                       playsInline
//                       muted
//                       className="w-full h-full object-contain"
//                     />
//                   ) : (
//                     <div className="text-center p-6 space-y-3">
//                       <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
//                         <Monitor className="w-8 h-8" />
//                       </div>
//                       <div>
//                         <p className="text-slate-300 font-medium text-sm">Screen Share Not Active</p>
//                         <p className="text-xs text-slate-500 max-w-sm mt-1">
//                           Click below to start screen sharing. Full desktop display is recommended for complete proctor verification.
//                         </p>
//                       </div>
//                     </div>
//                   )}

//                   {/* Active Recording Badge */}
//                   {isRecording && (
//                     <div className="absolute top-3 left-3 bg-red-600/90 text-white text-xs px-2.5 py-1 rounded-md font-medium flex items-center gap-2 shadow-lg backdrop-blur-sm">
//                       <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
//                       REC {formatTime(recordingDuration)}
//                     </div>
//                   )}
//                 </div>
//               </div>

//               {/* Candidate Action Buttons */}
//               <div className="space-y-3 pt-2">
//                 <div className="flex flex-wrap gap-2">
//                   {!isSharing ? (
//                     <button
//                       onClick={startScreenShare}
//                       className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md text-sm"
//                     >
//                       <Video className="w-4 h-4" /> Start Screen Share
//                     </button>
//                   ) : (
//                     <button
//                       onClick={stopScreenShare}
//                       className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md text-sm"
//                     >
//                       <VideoOff className="w-4 h-4" /> Stop Sharing
//                     </button>
//                   )}

//                   {/* MediaRecorder Controls */}
//                   {isSharing && (
//                     <>
//                       {!isRecording ? (
//                         <button
//                           onClick={startRecording}
//                           className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md text-sm"
//                         >
//                           <Play className="w-4 h-4" /> Record Session
//                         </button>
//                       ) : (
//                         <div className="flex items-center gap-2">
//                           {isPaused ? (
//                             <button
//                               onClick={resumeRecording}
//                               className="bg-amber-600 hover:bg-amber-500 text-white p-2.5 rounded-lg transition-all"
//                               title="Resume Recording"
//                             >
//                               <Play className="w-4 h-4" />
//                             </button>
//                           ) : (
//                             <button
//                               onClick={pauseRecording}
//                               className="bg-amber-600 hover:bg-amber-500 text-white p-2.5 rounded-lg transition-all"
//                               title="Pause Recording"
//                             >
//                               <Pause className="w-4 h-4" />
//                             </button>
//                           )}
//                           <button
//                             onClick={stopRecording}
//                             className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2.5 rounded-lg border border-slate-700 transition-all"
//                             title="Stop Recording"
//                           >
//                             <Square className="w-4 h-4 fill-current" />
//                           </button>
//                         </div>
//                       )}
//                     </>
//                   )}
//                 </div>

//                 {/* Candidate Interactive Test Pad (To simulate blur / copy / paste) */}
//                 <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
//                   <p className="text-xs font-semibold text-slate-400">Assessment Simulation Scratchpad:</p>
//                   <textarea
//                     rows={2}
//                     placeholder="Try selecting text here to copy/paste, or switch to another browser tab to trigger proctoring warning alerts..."
//                     className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
//                   />
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* SECTION 2: PROCTOR / INTERVIEWER DASHBOARD */}
//           {(activeRole === 'proctor' || activeRole === 'dual') && (
//             <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
//               <div>
//                 <div className="flex items-center justify-between pb-3 border-b border-slate-800">
//                   <div className="flex items-center space-x-2">
//                     <Activity className="w-5 h-5 text-emerald-400" />
//                     <h2 className="text-md font-bold text-white">Proctor Monitoring Station</h2>
//                   </div>
//                   <div className="flex items-center space-x-2">
//                     <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">
//                       Candidate: ID-8941
//                     </span>
//                   </div>
//                 </div>

//                 {/* Proctor Live Monitor View */}
//                 <div className="mt-4 relative bg-slate-950 rounded-lg overflow-hidden border border-slate-800 aspect-video flex items-center justify-center">
//                   {isSharing ? (
//                     <video
//                       ref={proctorVideoRef}
//                       autoPlay
//                       playsInline
//                       muted
//                       className="w-full h-full object-contain"
//                     />
//                   ) : (
//                     <div className="text-center p-6 space-y-2">
//                       <Radio className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
//                       <p className="text-slate-400 font-medium text-sm">Awaiting Candidate Feed...</p>
//                     </div>
//                   )}

//                   {/* Watermark overlay */}
//                   <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur border border-slate-800 px-2 py-1 rounded text-[10px] text-slate-400 font-mono">
//                     SECURE STREAM • WEBRTC LIVE
//                   </div>
//                 </div>
//               </div>

//               {/* Recorded Output Download Actions */}
//               {recordedUrl && (
//                 <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-lg p-3 flex items-center justify-between">
//                   <div className="flex items-center space-x-2">
//                     <FileText className="w-5 h-5 text-indigo-400" />
//                     <div>
//                       <p className="text-xs font-semibold text-indigo-200">Session Recording Ready</p>
//                       <p className="text-[10px] text-indigo-400/80">WebM video container available</p>
//                     </div>
//                   </div>
//                   <a
//                     href={recordedUrl}
//                     download={`proctor-session-${Date.now()}.webm`}
//                     className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all shadow"
//                   >
//                     <Download className="w-3.5 h-3.5" /> Download
//                   </a>
//                 </div>
//               )}

//               {/* Proctor Quick Actions */}
//               <div className="flex items-center space-x-2 pt-2">
//                 <button
//                   onClick={() => addLog('STREAM_STOPPED', 'high', 'Manual flag raised by Proctor.')}
//                   className="flex-1 bg-slate-800 hover:bg-slate-700 text-rose-400 border border-rose-500/30 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
//                 >
//                   <AlertTriangle className="w-3.5 h-3.5" /> Flag Incident
//                 </button>
//                 <button
//                   onClick={() => {
//                     setStats({ tabSwitches: 0, windowBlurs: 0, copyPastes: 0, mouseLeaves: 0, timeAwaySeconds: 0 });
//                     setLogs([]);
//                   }}
//                   className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
//                 >
//                   <RefreshCw className="w-3.5 h-3.5" /> Reset Audit
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>

//         {/* SECTION 3: REAL-TIME PROCTORING AUDIT LOG TIMELINE */}
//         <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
//           <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
//             <div className="flex items-center space-x-2">
//               <Clock className="w-5 h-5 text-indigo-400" />
//               <h3 className="text-md font-bold text-white">Proctoring Event Telemetry Log</h3>
//             </div>
//             <span className="text-xs text-slate-400">
//               Total Events Recorded: <strong className="text-slate-200">{logs.length}</strong>
//             </span>
//           </div>

//           {logs.length === 0 ? (
//             <div className="text-center py-8 text-slate-500 text-sm">
//               No incidents or user events logged yet. Start screen sharing or switch tabs to trigger detection.
//             </div>
//           ) : (
//             <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
//               {logs.map((log) => {
//                 let badgeStyle = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
//                 if (log.severity === 'high') badgeStyle = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
//                 if (log.severity === 'medium') badgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
//                 if (log.severity === 'info') badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

//                 return (
//                   <div
//                     key={log.id}
//                     className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 flex items-start justify-between text-xs transition-all hover:border-slate-700"
//                   >
//                     <div className="flex items-start space-x-3">
//                       <span className={`px-2 py-0.5 rounded border uppercase text-[10px] font-bold tracking-wide mt-0.5 ${badgeStyle}`}>
//                         {log.type}
//                       </span>
//                       <div>
//                         <p className="text-slate-200 font-medium">{log.message}</p>
//                         {log.details && <p className="text-slate-500 text-[11px] mt-0.5">{log.details}</p>}
//                       </div>
//                     </div>
//                     <span className="text-slate-500 font-mono text-[11px] shrink-0 ml-4">{log.timestamp}</span>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </div>
//       </main>
//     </div>
//   );
// }