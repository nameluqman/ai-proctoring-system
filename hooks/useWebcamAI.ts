"use client";

import { useCallback, useEffect, type RefObject } from "react";
import type { InferenceSession } from "onnxruntime-web";
import { estimateHeadPose } from "@/lib/head-pose";

interface UseWebcamAIProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  onEvent: (type: string, message: string, presenceState?: boolean, confidenceScore?: number) => void;
  enabled?: boolean;
  intervalMs?: number;
}

const YOLO_MODEL_URL = process.env.NEXT_PUBLIC_YOLO_MODEL_URL || "/models/yolo11n.onnx";
const YOLO_INPUT_SIZE = 640;
const YOLO_PHONE_CLASS_ID = 67;
const YOLO_PHONE_SCORE_THRESHOLD = 0.25;
const YOLO_MIN_PHONE_AREA = 0.00025;
const PHONE_CONFIRMATION_WINDOW = 5;
const PHONE_CONFIRMATION_COUNT = 3;
const FACE_DETECTOR_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite";
const FACE_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const GAZE_YAW_THRESHOLD_DEGREES = 25;
const GAZE_PITCH_THRESHOLD_DEGREES = 20;

function prepareYoloInput(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  input: Float32Array
) {
  const scale = Math.min(YOLO_INPUT_SIZE / video.videoWidth, YOLO_INPUT_SIZE / video.videoHeight);
  const drawnWidth = Math.round(video.videoWidth * scale);
  const drawnHeight = Math.round(video.videoHeight * scale);
  const left = Math.floor((YOLO_INPUT_SIZE - drawnWidth) / 2);
  const top = Math.floor((YOLO_INPUT_SIZE - drawnHeight) / 2);

  canvas.width = YOLO_INPUT_SIZE;
  canvas.height = YOLO_INPUT_SIZE;
  context.fillStyle = "rgb(114, 114, 114)";
  context.fillRect(0, 0, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE);
  context.drawImage(video, left, top, drawnWidth, drawnHeight);

  const pixels = context.getImageData(0, 0, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE).data;
  const planeSize = YOLO_INPUT_SIZE * YOLO_INPUT_SIZE;
  for (let pixel = 0; pixel < planeSize; pixel += 1) {
    const sourceIndex = pixel * 4;
    input[pixel] = pixels[sourceIndex] / 255;
    input[planeSize + pixel] = pixels[sourceIndex + 1] / 255;
    input[planeSize * 2 + pixel] = pixels[sourceIndex + 2] / 255;
  }

  return input;
}

function getPhoneConfidence(output: Float32Array, dimensions: readonly number[]) {
  if (dimensions.length !== 3 || dimensions[0] !== 1) {
    throw new Error(`Unsupported YOLO output shape: [${dimensions.join(", ")}].`);
  }

  const channelsFirst = dimensions[1] < dimensions[2];
  const attributeCount = dimensions[channelsFirst ? 1 : 2];
  const candidateCount = dimensions[channelsFirst ? 2 : 1];
  const hasObjectness = attributeCount === 85;
  const classOffset = hasObjectness ? 5 : 4;
  const classCount = attributeCount - classOffset;
  if (classCount < 1 || (classCount !== 1 && classCount <= YOLO_PHONE_CLASS_ID)) {
    throw new Error(`YOLO output does not contain the COCO phone class (output has ${classCount} classes).`);
  }

  const read = (candidate: number, attribute: number) =>
    channelsFirst
      ? output[attribute * candidateCount + candidate]
      : output[candidate * attributeCount + attribute];

  let highestConfidence: number | null = null;
  for (let candidate = 0; candidate < candidateCount; candidate += 1) {
    const phoneScore = read(candidate, classOffset + (classCount === 1 ? 0 : YOLO_PHONE_CLASS_ID));
    const objectness = hasObjectness ? read(candidate, 4) : 1;
    const score = phoneScore * objectness;
    const width = Math.max(0, read(candidate, 2));
    const height = Math.max(0, read(candidate, 3));
    const relativeArea = (width * height) / (YOLO_INPUT_SIZE * YOLO_INPUT_SIZE);

    if (
      Number.isFinite(score) &&
      score >= YOLO_PHONE_SCORE_THRESHOLD &&
      relativeArea >= YOLO_MIN_PHONE_AREA
    ) {
      highestConfidence = Math.max(highestConfidence ?? 0, score);
    }
  }

  return highestConfidence;
}

async function createYoloSession(): Promise<{
  runtime: typeof import("onnxruntime-web");
  session: InferenceSession;
}> {
  const ort = await import("onnxruntime-web");
  if ("gpu" in navigator) {
    try {
      return {
        runtime: ort,
        session: await ort.InferenceSession.create(YOLO_MODEL_URL, {
          executionProviders: ["webgpu"],
        }),
      };
    } catch (error) {
      console.warn("YOLO WebGPU initialization failed; falling back to WASM.", error);
    }
  }

  return {
    runtime: ort,
    session: await ort.InferenceSession.create(YOLO_MODEL_URL, {
      executionProviders: ["wasm"],
    }),
  };
}

export function useWebcamAI({
  videoRef,
  onEvent,
  enabled = true,
  intervalMs = 400,
}: UseWebcamAIProps) {
  const emitEvent = useCallback(
    (type: string, message: string, presenceState?: boolean, confidenceScore?: number) => {
      onEvent(type, message, presenceState, confidenceScore);
    },
    [onEvent]
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let cancelled = false;
    let frameTimer: number | null = null;
    let frameInFlight: Promise<void> | null = null;
    let ortRuntime: typeof import("onnxruntime-web") | null = null;
    let yoloSession: InferenceSession | null = null;
    let faceDetector: import("@mediapipe/tasks-vision").FaceDetector | null = null;
    let faceLandmarker: import("@mediapipe/tasks-vision").FaceLandmarker | null = null;
    let faceDetectionFailed = false;
    let phoneDetectionFailed = false;
    let gazeAlerted = false;
    let phoneAlerted = false;
    let multiFaceAlerted = false;
    let noFaceAlerted = false;
    const phoneFrames: (number | null)[] = [];
    const canvas = document.createElement("canvas");
    const canvasContext = canvas.getContext("2d", { willReadFrequently: true });
    const yoloInput = new Float32Array(3 * YOLO_INPUT_SIZE * YOLO_INPUT_SIZE);

    const dispose = () => {
      faceDetector?.close();
      faceLandmarker?.close();
      faceDetector = null;
      faceLandmarker = null;
      ortRuntime = null;
      if (yoloSession) {
        void yoloSession.release().catch((error: unknown) => {
          console.warn("YOLO session could not be released:", error);
        });
        yoloSession = null;
      }
    };

    const initializeVision = async () => {
      const { FilesetResolver, FaceDetector, FaceLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      const detector = await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_DETECTOR_MODEL_URL },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
        minSuppressionThreshold: 0.3,
      });

      try {
        const landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });

        if (cancelled) {
          detector.close();
          landmarker.close();
          return;
        }
        faceDetector = detector;
        faceLandmarker = landmarker;
      } catch (error) {
        detector.close();
        throw error;
      }
    };

    const initializeYolo = async () => {
      const { runtime, session } = await createYoloSession();
      if (cancelled) {
        await session.release();
        return;
      }
      ortRuntime = runtime;
      yoloSession = session;
    };

    void initializeVision().catch((error: unknown) => {
      if (!cancelled) {
        faceDetectionFailed = true;
        console.error("BlazeFace or face-landmark model initialization failed:", error);
      }
    });
    void initializeYolo().catch((error: unknown) => {
      if (!cancelled) {
        phoneDetectionFailed = true;
        console.error(
          `YOLO phone detection could not initialize. Provide a YOLOv8n/YOLO11n COCO ONNX model at ${YOLO_MODEL_URL}.`,
          error
        );
      }
    });

    const processFrame = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0 || !canvasContext) return;

      const timestamp = performance.now();
      if (yoloSession && ortRuntime) {
        try {
          const input = new ortRuntime.Tensor(
            "float32",
            prepareYoloInput(video, canvas, canvasContext, yoloInput),
            [1, 3, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE]
          );
          const outputs = await yoloSession.run({
            [yoloSession.inputNames[0]]: input,
          });
          if (cancelled) return;
          const result = outputs[yoloSession.outputNames[0]];
          if (!result || !(result.data instanceof Float32Array)) {
            throw new Error("YOLO returned a missing or non-float32 output tensor.");
          }

          phoneFrames.push(getPhoneConfidence(result.data, result.dims));
          if (phoneFrames.length > PHONE_CONFIRMATION_WINDOW) phoneFrames.shift();
          const confirmedPhone =
            phoneFrames.filter((confidence): confidence is number => confidence !== null).length >= PHONE_CONFIRMATION_COUNT;

          if (confirmedPhone && !phoneAlerted) {
            phoneAlerted = true;
            const confirmedConfidence = phoneFrames
              .filter((confidence): confidence is number => confidence !== null)
              .reduce((highest, confidence) => Math.max(highest, confidence), 0);
            emitEvent(
              "EXTERNAL_DEVICE_DETECTED",
              "YOLO confirmed a phone or extra device across multiple webcam frames.",
              false,
              confirmedConfidence
            );
          } else if (!confirmedPhone && phoneAlerted) {
            phoneAlerted = false;
            emitEvent("EXTERNAL_DEVICE_RESOLVED", "Candidate device check returned to normal.", true);
          }
        } catch (error) {
          if (!phoneDetectionFailed) {
            phoneDetectionFailed = true;
            console.error("YOLO phone inference failed; phone detection has stopped.", error);
          }
          const failedSession = yoloSession;
          yoloSession = null;
          ortRuntime = null;
          if (failedSession) {
            void failedSession.release().catch((releaseError: unknown) => {
              console.warn("YOLO session could not be released after inference failure:", releaseError);
            });
          }
        }
      }

      if (faceDetector && faceLandmarker) {
        try {
          const faceCount = faceDetector.detectForVideo(video, timestamp).detections.length;
          const landmarks =
            faceCount > 0 ? faceLandmarker.detectForVideo(video, timestamp).faceLandmarks[0] : undefined;

          if (faceCount > 1 && !multiFaceAlerted) {
            multiFaceAlerted = true;
            emitEvent("MULTIPLE_FACES_DETECTED", "Multiple faces detected in candidate video frame.", false);
          } else if (faceCount <= 1 && multiFaceAlerted) {
            multiFaceAlerted = false;
            emitEvent("MULTIPLE_FACES_RESOLVED", "Multiple face issue cleared.", true);
          }

          if (faceCount === 0) {
            if (!noFaceAlerted) {
              noFaceAlerted = true;
              emitEvent("NO_FACE_DETECTED", "Candidate is not visible in camera frame.", false);
            }
            gazeAlerted = false;
          } else {
            if (noFaceAlerted) {
              noFaceAlerted = false;
              emitEvent("NO_FACE_RESOLVED", "Candidate face detected again.", true);
            }

            if (landmarks) {
              const pose = estimateHeadPose(landmarks, video.videoWidth, video.videoHeight);
              if (pose) {
                const isLookingAway =
                  Math.abs(pose.yaw) > GAZE_YAW_THRESHOLD_DEGREES ||
                  Math.abs(pose.pitch) > GAZE_PITCH_THRESHOLD_DEGREES;

                if (isLookingAway && !gazeAlerted) {
                  gazeAlerted = true;
                  emitEvent(
                    "GAZE_DEVIATION",
                    `Candidate head pose indicates looking away (pitch ${pose.pitch.toFixed(0)}°, yaw ${pose.yaw.toFixed(0)}°).`,
                    false
                  );
                } else if (!isLookingAway && gazeAlerted) {
                  gazeAlerted = false;
                  emitEvent("GAZE_RECOVERED", "Candidate head pose returned to the screen center.", true);
                }
              }
            }
          }
        } catch (error) {
          if (!faceDetectionFailed) {
            faceDetectionFailed = true;
            console.error("BlazeFace or face-landmark inference failed; face detection has stopped.", error);
          }
          faceDetector.close();
          faceLandmarker.close();
          faceDetector = null;
          faceLandmarker = null;
        }
      }
    };

    const scheduleNextFrame = () => {
      if (cancelled) return;
      frameTimer = window.setTimeout(() => {
        frameInFlight = processFrame()
          .catch((error: unknown) => {
            console.error("Webcam detection frame failed:", error);
          })
          .finally(() => {
            frameInFlight = null;
            scheduleNextFrame();
          });
      }, intervalMs);
    };

    scheduleNextFrame();

    return () => {
      cancelled = true;
      if (frameTimer !== null) window.clearTimeout(frameTimer);
      if (frameInFlight) {
        void frameInFlight.finally(dispose);
      } else {
        dispose();
      }
    };
  }, [enabled, emitEvent, intervalMs, videoRef]);
}
