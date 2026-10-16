"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseAudioMonitorProps {
  onEvent: (type: string, message: string, presenceState?: boolean) => void;
  enabled?: boolean;
  systemAudioStream?: MediaStream | null;
}

const ANALYSIS_INTERVAL_MS = 100;
const SUSTAINED_ACTIVITY_MS = 3000;
const QUIET_RESET_MS = 1000;
const ACTIVITY_THRESHOLD_DBFS = -45;
const FREQUENCY_FLOOR_DBFS = -85;
const SYSTEM_AUDIO_THRESHOLD_DBFS = -55;
const SYSTEM_AUDIO_FREQUENCY_FLOOR_DBFS = -90;

export function useAudioMonitor({
  onEvent,
  enabled = true,
  systemAudioStream = null,
}: UseAudioMonitorProps) {
  const systemAudioContextRef = useRef<AudioContext | null>(null);

  const prepareSystemAudioCapture = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;

    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) {
      console.warn("System audio monitoring is unavailable: Web Audio is not supported.");
      return;
    }

    const currentContext = systemAudioContextRef.current;
    if (!currentContext || currentContext.state === "closed") {
      systemAudioContextRef.current = new AudioContextConstructor();
    }

    const context = systemAudioContextRef.current;
    if (context?.state === "suspended") {
      void context.resume().catch((error: unknown) => {
        console.warn("System audio context could not resume:", error);
      });
    }
  }, [enabled]);

  useEffect(() => {
    const hasLiveSharedAudio = systemAudioStream
      ?.getAudioTracks()
      .some((track) => track.readyState === "live");
    if (!enabled || typeof window === "undefined" || !hasLiveSharedAudio) return;

    let isCancelled = false;
    let microphoneStream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let analysisInterval: number | null = null;

    const startMonitoring = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Microphone capture is unavailable in this browser.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        microphoneStream = stream;

        const AudioContextConstructor =
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) {
          throw new Error("Web Audio is unavailable in this browser.");
        }

        const context = new AudioContextConstructor();
        audioContext = context;
        if (context.state === "suspended") {
          await context.resume();
        }
        if (isCancelled) return;

        const audioSource = context.createMediaStreamSource(stream);
        const audioAnalyser = context.createAnalyser();
        audioAnalyser.fftSize = 2048;
        audioAnalyser.smoothingTimeConstant = 0.2;
        audioSource.connect(audioAnalyser);
        source = audioSource;
        analyser = audioAnalyser;

        const timeDomainData = new Float32Array(audioAnalyser.fftSize);
        const frequencyData = new Float32Array(audioAnalyser.frequencyBinCount);
        const frequencyBinWidth = context.sampleRate / audioAnalyser.fftSize;
        const firstVoiceBin = Math.ceil(80 / frequencyBinWidth);
        const lastVoiceBin = Math.min(
          frequencyData.length,
          Math.floor(5000 / frequencyBinWidth)
        );
        let activityStartedAt: number | null = null;
        let quietStartedAt: number | null = null;
        let anomalyReported = false;

        analysisInterval = window.setInterval(() => {
          audioAnalyser.getFloatTimeDomainData(timeDomainData);
          audioAnalyser.getFloatFrequencyData(frequencyData);

          let squaredSum = 0;
          for (const sample of timeDomainData) {
            squaredSum += sample * sample;
          }
          const rms = Math.sqrt(squaredSum / timeDomainData.length);
          const volumeDbfs = rms > 0 ? 20 * Math.log10(rms) : Number.NEGATIVE_INFINITY;

          let audibleFrequencyBins = 0;
          for (let index = firstVoiceBin; index < lastVoiceBin; index += 1) {
            if (frequencyData[index] > FREQUENCY_FLOOR_DBFS) {
              audibleFrequencyBins += 1;
            }
          }

          const activityDetected =
            volumeDbfs >= ACTIVITY_THRESHOLD_DBFS && audibleFrequencyBins >= 3;
          const now = Date.now();

          if (activityDetected) {
            activityStartedAt ??= now;
            quietStartedAt = null;

            if (!anomalyReported && now - activityStartedAt >= SUSTAINED_ACTIVITY_MS) {
              anomalyReported = true;
              onEvent(
                "AUDIO_ANOMALY_DETECTED",
                "Candidate side whispering or loud background noise detected.",
                false
              );
            }
          } else {
            activityStartedAt = null;
            if (anomalyReported) {
              quietStartedAt ??= now;
              if (now - quietStartedAt >= QUIET_RESET_MS) {
                anomalyReported = false;
                quietStartedAt = null;
              }
            }
          }
        }, ANALYSIS_INTERVAL_MS);
      } catch (error) {
        if (!isCancelled) {
          console.warn("Audio monitoring could not start:", error);
        }
      }
    };

    void startMonitoring();

    return () => {
      isCancelled = true;
      if (analysisInterval !== null) {
        window.clearInterval(analysisInterval);
      }
      source?.disconnect();
      analyser?.disconnect();
      microphoneStream?.getTracks().forEach((track) => track.stop());
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close().catch((error: unknown) => {
          console.warn("Audio monitoring context could not close:", error);
        });
      }
    };
  }, [enabled, onEvent, systemAudioStream]);

  useEffect(() => {
    if (!enabled || !systemAudioStream) return;

    const audioTrack = systemAudioStream.getAudioTracks().find((track) => track.readyState === "live");
    const context = systemAudioContextRef.current;
    if (!audioTrack || !context || context.state === "closed") return;

    const audioOnlyStream = new MediaStream([audioTrack]);
    const source = context.createMediaStreamSource(audioOnlyStream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.2;
    source.connect(analyser);

    const timeDomainData = new Float32Array(analyser.fftSize);
    const frequencyData = new Float32Array(analyser.frequencyBinCount);
    const frequencyBinWidth = context.sampleRate / analyser.fftSize;
    const firstAudioBin = Math.ceil(80 / frequencyBinWidth);
    const lastAudioBin = Math.min(frequencyData.length, Math.floor(8000 / frequencyBinWidth));
    let activityStartedAt: number | null = null;
    let quietStartedAt: number | null = null;
    let anomalyReported = false;

    const interval = window.setInterval(() => {
      analyser.getFloatTimeDomainData(timeDomainData);
      analyser.getFloatFrequencyData(frequencyData);

      let squaredSum = 0;
      for (const sample of timeDomainData) {
        squaredSum += sample * sample;
      }
      const rms = Math.sqrt(squaredSum / timeDomainData.length);
      const volumeDbfs = rms > 0 ? 20 * Math.log10(rms) : Number.NEGATIVE_INFINITY;

      let audibleFrequencyBins = 0;
      for (let index = firstAudioBin; index < lastAudioBin; index += 1) {
        if (frequencyData[index] > SYSTEM_AUDIO_FREQUENCY_FLOOR_DBFS) {
          audibleFrequencyBins += 1;
        }
      }

      const activityDetected =
        volumeDbfs >= SYSTEM_AUDIO_THRESHOLD_DBFS && audibleFrequencyBins >= 3;
      const now = Date.now();

      if (activityDetected) {
        activityStartedAt ??= now;
        quietStartedAt = null;

        if (!anomalyReported && now - activityStartedAt >= SUSTAINED_ACTIVITY_MS) {
          anomalyReported = true;
          onEvent(
            "AI_AUDIO_DETECTED",
            "Sustained audio detected from the shared device output; its source cannot be identified by the browser.",
            false
          );
        }
      } else {
        activityStartedAt = null;
        if (anomalyReported) {
          quietStartedAt ??= now;
          if (now - quietStartedAt >= QUIET_RESET_MS) {
            anomalyReported = false;
            quietStartedAt = null;
          }
        }
      }
    }, ANALYSIS_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      source.disconnect();
      analyser.disconnect();
      audioOnlyStream.getTracks().forEach((track) => {
        if (track !== audioTrack) track.stop();
      });
    };
  }, [enabled, onEvent, systemAudioStream]);

  useEffect(
    () => () => {
      const context = systemAudioContextRef.current;
      systemAudioContextRef.current = null;
      if (context && context.state !== "closed") {
        void context.close().catch((error: unknown) => {
          console.warn("System audio context could not close:", error);
        });
      }
    },
    []
  );

  return { prepareSystemAudioCapture };
}