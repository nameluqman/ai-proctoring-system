declare module "@mediapipe/tasks-vision" {
  export class FilesetResolver {
    static forVisionTasks(url: string): Promise<FilesetResolver>;
  }

  export class ObjectDetector {
    static createFromOptions(
      resolver: FilesetResolver,
      options: Record<string, unknown>
    ): Promise<ObjectDetector>;
    detectForVideo(video: HTMLVideoElement, timestamp: number): { detections?: any[] };
    close(): void;
  }

  export class FaceLandmarker {
    static createFromOptions(
      resolver: FilesetResolver,
      options: Record<string, unknown>
    ): Promise<FaceLandmarker>;
    detectForVideo(video: HTMLVideoElement, timestamp: number): { faceLandmarks?: any[] };
    close(): void;
  }
}
