declare module "@mediapipe/tasks-vision" {
  export interface NormalizedLandmark {
    x: number;
    y: number;
    z?: number;
  }

  export interface DetectionResult {
    detections: Array<{
      boundingBox?: { originX: number; originY: number; width: number; height: number };
      categories?: Array<{ categoryName: string; score: number }>;
    }>;
  }

  export interface FaceLandmarkerResult {
    faceLandmarks: NormalizedLandmark[][];
  }

  export class FilesetResolver {
    static forVisionTasks(url: string): Promise<FilesetResolver>;
  }

  export class FaceDetector {
    static createFromOptions(
      resolver: FilesetResolver,
      options: Record<string, unknown>
    ): Promise<FaceDetector>;
    detectForVideo(video: HTMLVideoElement, timestamp: number): DetectionResult;
    close(): void;
  }

  export class FaceLandmarker {
    static createFromOptions(
      resolver: FilesetResolver,
      options: Record<string, unknown>
    ): Promise<FaceLandmarker>;
    detectForVideo(video: HTMLVideoElement, timestamp: number): FaceLandmarkerResult;
    close(): void;
  }
}
