"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseWebcamAIProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onEvent: (type: string, message: string, presenceState?: boolean) => void;
  enabled?: boolean;
  intervalMs?: number;
}

const PHONE_LABELS = ["cell phone", "mobile phone", "phone"];
const GAZE_YAW_THRESHOLD = 0.25;
const EYE_WIDTH_ASYMMETRY_THRESHOLD = 0.45;
const GAZE_VERTICAL_THRESHOLD = 0.06;

export function useWebcamAI({
  videoRef,
  onEvent,
  enabled = true,
  intervalMs = 400,
}: UseWebcamAIProps) {
  const detectorsRef = useRef<{ objectDetector: any; faceLandmarker: any } | null>(null);
  const intervalRef = useRef<number | null>(null);
  const gazeAlertedRef = useRef(false);
  const sidePanelAlertedRef = useRef(false);
  const phoneAlertedRef = useRef(false);
  const multiFaceAlertedRef = useRef(false);
  const noFaceAlertedRef = useRef(false);

  const emitEvent = useCallback(
    (type: string, message: string, presenceState?: boolean) => {
      onEvent(type, message, presenceState);
    },
    [onEvent]
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let objectDetector: any = null;
    let faceLandmarker: any = null;
    let isCancelled = false;

    const initDetectors = async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const { FilesetResolver, ObjectDetector, FaceLandmarker } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );

      objectDetector = await ObjectDetector.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
        },
        runningMode: "VIDEO",
        scoreThreshold: 0.5,
      });

      faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        },
        runningMode: "VIDEO",
        numFaces: 10,
        outputFaceBlendshapes: false,
      });

      if (!isCancelled) {
        detectorsRef.current = { objectDetector, faceLandmarker };
      }
    };

    initDetectors().catch((error) => {
      console.warn("Webcam AI setup failed:", error);
    });

    intervalRef.current = window.setInterval(() => {
      const video = videoRef.current;
      const detectors = detectorsRef.current;

      if (!video || !detectors || video.readyState < 2 || video.videoWidth === 0) {
        return;
      }

      const now = performance.now();
      const objectResult = detectors.objectDetector.detectForVideo(video, now);
      const faceResult = detectors.faceLandmarker.detectForVideo(video, now);
      const detections = objectResult?.detections ?? [];
      const faces = Array.isArray(faceResult?.faceLandmarks) ? faceResult.faceLandmarks : [];
      const frameArea = video.videoWidth * video.videoHeight;

      let phoneDetected = false;
      for (const detection of detections) {
        const category = detection?.categories?.[0];
        const label = String(category?.categoryName ?? "").trim().toLowerCase();
        const score = Number(category?.score ?? 0);
        const bbox = detection?.boundingBox ?? {};
        const width = Number(bbox.width ?? 0);
        const height = Number(bbox.height ?? 0);
        const area = width * height;
        const relativeArea = frameArea > 0 ? area / frameArea : 0;

        const isPhoneLabel = PHONE_LABELS.includes(label) || label.includes("phone");
        const isLikelyPhone = isPhoneLabel && score > 0.82 && relativeArea > 0.005;

        if (isLikelyPhone) {
          phoneDetected = true;
          break;
        }
      }

      if (phoneDetected && !phoneAlertedRef.current) {
        phoneAlertedRef.current = true;
        emitEvent("EXTERNAL_DEVICE_DETECTED", "Smartphone or extra device detected in candidate video feed.", false);
      } else if (!phoneDetected && phoneAlertedRef.current) {
        phoneAlertedRef.current = false;
        emitEvent("EXTERNAL_DEVICE_RESOLVED", "Candidate device check returned to normal.", true);
      }

      if (faces.length > 1 && !multiFaceAlertedRef.current) {
        multiFaceAlertedRef.current = true;
        emitEvent("MULTIPLE_FACES_DETECTED", "Multiple faces detected in candidate video frame.", false);
      } else if (faces.length <= 1 && multiFaceAlertedRef.current) {
        multiFaceAlertedRef.current = false;
        emitEvent("MULTIPLE_FACES_RESOLVED", "Multiple face issue cleared.", true);
      }

      if (faces.length === 0) {
        if (!noFaceAlertedRef.current) {
          noFaceAlertedRef.current = true;
          emitEvent("NO_FACE_DETECTED", "Candidate is not visible in camera frame.", false);
        }
      } else {
        if (noFaceAlertedRef.current) {
          noFaceAlertedRef.current = false;
          emitEvent("NO_FACE_RESOLVED", "Candidate face detected again.", true);
        }
      }

      if (faces.length > 0) {
        const face = faces[0];
        const leftEye = {
          x: (face[133].x + face[33].x + face[159].x + face[145].x) / 4,
          y: (face[133].y + face[33].y + face[159].y + face[145].y) / 4,
        };
        const rightEye = {
          x: (face[362].x + face[263].x + face[386].x + face[374].x) / 4,
          y: (face[362].y + face[263].y + face[386].y + face[374].y) / 4,
        };
        const noseTip = face[1];
        const mouthCenter = {
          x: (face[13].x + face[14].x + face[61].x + face[291].x) / 4,
          y: (face[13].y + face[14].y + face[61].y + face[291].y) / 4,
        };

        const eyeCenterX = (leftEye.x + rightEye.x) / 2;
        const eyeCenterY = (leftEye.y + rightEye.y) / 2;
        const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
        const yawDeviation = Math.abs(eyeCenterX - noseTip.x) / Math.max(eyeDistance, 0.0001);
        const leftEyeWidth = Math.abs(face[33].x - face[133].x);
        const rightEyeWidth = Math.abs(face[263].x - face[362].x);
        const eyeWidthAsymmetry =
          Math.min(leftEyeWidth, rightEyeWidth) / Math.max(leftEyeWidth, rightEyeWidth, 0.0001);
        const pitchDeviation = noseTip.y - mouthCenter.y;
        const sidePanelFocus = Math.abs(eyeCenterX - 0.5) > 0.28;
        const isLookingDown = noseTip.y > eyeCenterY + GAZE_VERTICAL_THRESHOLD || noseTip.y > mouthCenter.y + 0.04;
        const isLookingAway =
          yawDeviation > GAZE_YAW_THRESHOLD ||
          eyeWidthAsymmetry < EYE_WIDTH_ASYMMETRY_THRESHOLD ||
          pitchDeviation < -0.08;

        if (sidePanelFocus && !sidePanelAlertedRef.current) {
          sidePanelAlertedRef.current = true;
          emitEvent("AI_LISTENING_DETECTED", "Candidate looking towards side-panel AI chat window", false);
        } else if (!sidePanelFocus && sidePanelAlertedRef.current) {
          sidePanelAlertedRef.current = false;
        }

        if (isLookingDown || isLookingAway) {
          if (!gazeAlertedRef.current) {
            gazeAlertedRef.current = true;
            emitEvent("GAZE_DEVIATION", "Candidate is looking away from the screen or down toward the desk.", false);
          }
        } else {
          if (gazeAlertedRef.current) {
            gazeAlertedRef.current = false;
            emitEvent("GAZE_RECOVERED", "Candidate gaze returned to the screen center.", true);
          }
        }
      } else {
        gazeAlertedRef.current = false;
      }
    }, intervalMs);

    return () => {
      isCancelled = true;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
      if (objectDetector) {
        objectDetector.close();
      }
      if (faceLandmarker) {
        faceLandmarker.close();
      }
    };
  }, [enabled, emitEvent, intervalMs, videoRef]);
}
