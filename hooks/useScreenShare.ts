import { useState, useRef, useCallback } from "react";

export const SCREEN_SHARE_REJECTION_MESSAGE =
  "Screen sharing is unavailable or permission was denied. Continue with webcam and microphone, or try a supported desktop browser.";

export function useScreenShare(onEndedCallback?: () => void) {
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startShare = useCallback(async () => {
    setShareError(null);

    if (!window.isSecureContext) {
      setShareError(SCREEN_SHARE_REJECTION_MESSAGE);
      return null;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setShareError(SCREEN_SHARE_REJECTION_MESSAGE);
      return null;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (!videoTrack) {
        mediaStream.getTracks().forEach((track) => track.stop());
        setShareError(SCREEN_SHARE_REJECTION_MESSAGE);
        return null;
      }

      videoTrack.onended = () => {
        setIsSharing(false);
        setStream(null);
        streamRef.current = null;
        if (onEndedCallback) onEndedCallback();
      };

      setStream(mediaStream);
      streamRef.current = mediaStream;
      setIsSharing(true);
      return mediaStream;
    } catch (err) {
      console.error("Screen share permission rejected or failed", err);
      setShareError(SCREEN_SHARE_REJECTION_MESSAGE);
      return null;
    }
  }, [onEndedCallback]);

  const stopShare = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      setStream(null);
      streamRef.current = null;
      setIsSharing(false);
    }
  }, []);

  return { isSharing, stream, streamRef, startShare, stopShare, shareError };
}