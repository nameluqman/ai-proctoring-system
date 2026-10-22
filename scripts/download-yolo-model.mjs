import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODEL_URL = "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.onnx";
const MODEL_SIZE_BYTES = 10_930_182;
const MODEL_SHA256 = "634279b40c07c6391472c51ad45b81ebc48706a9a1fe72dd3396322acd0c053b";
const AASIST_MODEL_URL =
  "https://huggingface.co/SpeechAntiSpoofingBenchmarks/AASIST-L/resolve/357e022c44a1aa926097e18c1457bde3873ed8bf/aasist-l.onnx";
const AASIST_MODEL_SIZE_BYTES = 766_114;
const AASIST_MODEL_SHA256 = "f43f0a638b52846f5d0e630c0a738d10e9306325945127c6f8662d559585f218";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelDirectory = path.join(projectRoot, "public", "models");
const models = [
  {
    name: "YOLO11n",
    url: MODEL_URL,
    path: path.join(modelDirectory, "yolo11n.onnx"),
    sizeBytes: MODEL_SIZE_BYTES,
    sha256: MODEL_SHA256,
  },
  {
    name: "AASIST-L",
    url: AASIST_MODEL_URL,
    path: path.join(modelDirectory, "aasist-l.onnx"),
    sizeBytes: AASIST_MODEL_SIZE_BYTES,
    sha256: AASIST_MODEL_SHA256,
  },
];

function hasExpectedDigest(data, model) {
  return data.byteLength === model.sizeBytes &&
    createHash("sha256").update(data).digest("hex") === model.sha256;
}

async function existingModelIsValid(model) {
  try {
    return hasExpectedDigest(await readFile(model.path), model);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function downloadModel(model) {
  if (process.env.NEXT_PUBLIC_YOLO_MODEL_URL) {
    if (model.name === "YOLO11n") {
      console.log("Skipping the bundled YOLO11n download because NEXT_PUBLIC_YOLO_MODEL_URL is set.");
      return;
    }
  }

  if (await existingModelIsValid(model)) {
    console.log(`Verified ${model.name} model already exists at public/models/${path.basename(model.path)}.`);
    return;
  }

  await mkdir(modelDirectory, { recursive: true });
  const temporaryPath = `${model.path}.${process.pid}.tmp`;
  console.log(`Downloading the ${model.name} ONNX model (first run only)...`);

  try {
    const response = await fetch(model.url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) {
      throw new Error(`Model download failed with HTTP ${response.status} ${response.statusText}.`);
    }

    const modelBytes = Buffer.from(await response.arrayBuffer());
    if (!hasExpectedDigest(modelBytes, model)) {
      throw new Error(
        `Downloaded model integrity check failed (received ${modelBytes.byteLength} bytes with SHA-256 ${createHash("sha256").update(modelBytes).digest("hex")}).`
      );
    }

    await writeFile(temporaryPath, modelBytes);
    await rename(temporaryPath, model.path);
    console.log(`${model.name} model downloaded and verified at public/models/${path.basename(model.path)}.`);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw new Error(
      `Could not prepare ${model.name}. Check your internet connection. ${error.message}`,
      { cause: error }
    );
  }
}

Promise.all(models.map((model) => downloadModel(model))).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
