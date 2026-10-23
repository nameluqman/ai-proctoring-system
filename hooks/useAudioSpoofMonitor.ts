"use client";

import { useEffect, useState } from "react";
import type { InferenceSession } from "onnxruntime-web";

export type AudioSpoofMonitorStatus = "inactive" | "loading" | "ready" | "error";

const MODEL_URL = "/models/aasist-l.onnx";
const MODEL_SAMPLE_RATE = 16_000;
const MODEL_WINDOW_SAMPLES = 64_600;
const WINDOW_SECONDS = MODEL_WINDOW_SAMPLES / MODEL_SAMPLE_RATE;
const PROCESSOR_BUFFER_SIZE = 4_096;
const MIN_WINDOW_RMS = 0.008;
const SPOOF_PROBABILITY_THRESHOLD = 0.9;
const REQUIRED_SUSPICIOUS_WINDOWS = 2;
const REQUIRED_CLEAR_WINDOWS = 2;

function resampleToModelRate(input: Float32Array, targetSamples: number) {
  const output = new Float32Array(targetSamples);
  const scale = input.length / targetSamples;

  for (let index = 0; index < targetSamples; index += 1) {
    const sourceIndex = index * scale;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, input.length - 1);
    const fraction = sourceIndex - leftIndex;
    output[index] = input[leftIndex] * (1 - fraction) + input[rightIndex] * fraction;
  }

  return output;
}

function getSpoofProbability(logits: Float32Array | Int32Array, dimensions: readonly number[]) {
  if (dimensions.length !== 2 || dimensions[0] !== 1 || dimensions[1] !== 2 || logits.length !== 2) {
    throw new Error(`Unsupported AASIST-L output shape [${dimensions.join(", ")}]. Expected [1, 2].`);
  }

  const maxLogit = Math.max(logits[0], logits[1]);
  const spoofScore = Math.exp(logits[0] - maxLogit);
  const bonaFideScore = Math.exp(logits[1] - maxLogit);
  return spoofScore / (spoofScore + bonaFideScore);
}

export function useAudioSpoofMonitor(
  microphoneStream: MediaStream | null,
  onSuspectedSyntheticAudio: (message: string, confidenceScore?: number) => void
) {
  const [status, setStatus] = useState<AudioSpoofMonitorStatus>("inactive");

  useEffect(() => {
    if (!microphoneStream || !microphoneStream.active) {
      return;
    }

    let cancelled = false;
    let audioContext: AudioContext | null = null;
    let classifier: InferenceSession | null = null;
    let processor: ScriptProcessorNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let silentOutput: GainNode | null = null;
    let inferencePending = false;
    let samplesCollected = 0;
    let suspiciousWindows = 0;
    let clearWindows = 0;
    let alertReported = false;
    let inputBuffer = new Float32Array(Math.round(48_000 * WINDOW_SECONDS));

    const cleanupAudioGraph = () => {
      if (processor) {
        processor.onaudioprocess = null;
        processor.disconnect();
        processor = null;
      }
      source?.disconnect();
      source = null;
      silentOutput?.disconnect();
      silentOutput = null;
    };

    const releaseClassifier = () => {
      const session = classifier;
      classifier = null;
      if (session) {
        void session.release().catch((error: unknown) => {
          console.warn("AASIST-L session could not be released:", error);
        });
      }
    };

    const initialize = async () => {
      setStatus("loading");
      const audioTrack = microphoneStream.getAudioTracks().find((track) => track.readyState === "live");
      if (!audioTrack) {
        setStatus("inactive");
        return;
      }

      const AudioContextConstructor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) {
        throw new Error("Web Audio is not supported in this browser.");
      }

      audioContext = new AudioContextConstructor();
      await audioContext.resume();
      if (cancelled) return;

      const { InferenceSession } = await import("onnxruntime-web");
      classifier = await InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
      if (cancelled) return;

      const inputName = classifier.inputNames[0];
      const outputName = classifier.outputNames[0];
      if (!inputName || !outputName) {
        throw new Error("AASIST-L model has no input or output tensor.");
      }

      source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
      processor = audioContext.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
      silentOutput = audioContext.createGain();
      silentOutput.gain.value = 0;
      source.connect(processor);
      processor.connect(silentOutput);
      silentOutput.connect(audioContext.destination);

      inputBuffer = new Float32Array(Math.round(audioContext.sampleRate * WINDOW_SECONDS));

      processor.onaudioprocess = (event) => {
        if (!classifier || cancelled || inferencePending) return;
        const input = event.inputBuffer.getChannelData(0);
        let inputOffset = 0;

        while (inputOffset < input.length) {
          const availableSamples = inputBuffer.length - samplesCollected;
          const samplesToCopy = Math.min(availableSamples, input.length - inputOffset);
          inputBuffer.set(input.subarray(inputOffset, inputOffset + samplesToCopy), samplesCollected);
          samplesCollected += samplesToCopy;
          inputOffset += samplesToCopy;

          if (samplesCollected === inputBuffer.length) {
            const capturedWindow = inputBuffer;
            inputBuffer = new Float32Array(Math.round(audioContext!.sampleRate * WINDOW_SECONDS));
            samplesCollected = 0;
            inferencePending = true;

            const modelInput = resampleToModelRate(capturedWindow, MODEL_WINDOW_SAMPLES);
            let squaredSum = 0;
            for (const sample of modelInput) squaredSum += sample * sample;
            const rms = Math.sqrt(squaredSum / modelInput.length);

            if (rms < MIN_WINDOW_RMS) {
              suspiciousWindows = 0;
              clearWindows += 1;
              if (clearWindows >= REQUIRED_CLEAR_WINDOWS) alertReported = false;
              inferencePending = false;
              break;
            }

            void (async () => {
              try {
                const runtime = await import("onnxruntime-web");
                const currentClassifier = classifier;
                if (!currentClassifier || cancelled) return;

                const tensor = new runtime.Tensor("float32", modelInput, [1, MODEL_WINDOW_SAMPLES]);
                const results = await currentClassifier.run({ [inputName]: tensor });
                if (cancelled) return;
                const logits = results[outputName];
                if (!logits || !(logits.data instanceof Float32Array)) {
                  throw new Error("AASIST-L returned a missing or non-float32 output tensor.");
                }

                const spoofProbability = getSpoofProbability(logits.data, logits.dims);
                if (spoofProbability >= SPOOF_PROBABILITY_THRESHOLD) {
                  suspiciousWindows += 1;
                  clearWindows = 0;
                  if (!alertReported && suspiciousWindows >= REQUIRED_SUSPICIOUS_WINDOWS) {
                    alertReported = true;
                    onSuspectedSyntheticAudio(
                      `AASIST-L flagged repeated audio windows as possibly synthetic (${Math.round(spoofProbability * 100)}% model score). This experimental signal can be wrong and is not proof of AI use.`,
                      spoofProbability
                    );
                  }
                } else {
                  suspiciousWindows = 0;
                  clearWindows += 1;
                  if (clearWindows >= REQUIRED_CLEAR_WINDOWS) alertReported = false;
                }
              } catch (error) {
                if (!cancelled) {
                  console.error("AASIST-L audio analysis failed; synthetic-audio monitoring has stopped.", error);
                  setStatus("error");
                  cancelled = true;
                  cleanupAudioGraph();
                  releaseClassifier();
                }
              } finally {
                inferencePending = false;
              }
            })();
            break;
          }
        }
      };

      if (!cancelled) setStatus("ready");
    };

    void initialize().catch((error: unknown) => {
      if (!cancelled) {
        console.error("AASIST-L audio monitor could not initialize:", error);
        setStatus("error");
        cancelled = true;
        cleanupAudioGraph();
        releaseClassifier();
      }
    });

    return () => {
      cancelled = true;
      cleanupAudioGraph();
      releaseClassifier();
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close().catch((error: unknown) => {
          console.warn("AASIST-L audio context could not be closed:", error);
        });
      }
    };
  }, [microphoneStream, onSuspectedSyntheticAudio]);

  return microphoneStream?.active ? status : "inactive";
}
