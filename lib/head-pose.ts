import type { HeadPoseAngles } from "@/types/telemetry";

interface LandmarkPoint {
  x: number;
  y: number;
}

type Point3D = readonly [number, number, number];
type PoseParameters = [number, number, number, number, number, number];

const MODEL_POINTS: readonly Point3D[] = [
  [0, 0, 0],
  [0, 63, -12],
  [-34, -28, -20],
  [34, -28, -20],
  [-25, 32, -15],
  [25, 32, -15],
];
const LANDMARK_INDICES = [1, 152, 33, 263, 61, 291] as const;

function rotationMatrix(rx: number, ry: number, rz: number) {
  const angle = Math.hypot(rx, ry, rz);
  if (angle < 1e-8) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }

  const x = rx / angle;
  const y = ry / angle;
  const z = rz / angle;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const complement = 1 - cosine;

  return [
    [cosine + x * x * complement, x * y * complement - z * sine, x * z * complement + y * sine],
    [y * x * complement + z * sine, cosine + y * y * complement, y * z * complement - x * sine],
    [z * x * complement - y * sine, z * y * complement + x * sine, cosine + z * z * complement],
  ];
}

function projectPoints(parameters: PoseParameters, focalLength: number, centerX: number, centerY: number) {
  const rotation = rotationMatrix(parameters[0], parameters[1], parameters[2]);

  return MODEL_POINTS.flatMap(([x, y, z]) => {
    const cameraX = rotation[0][0] * x + rotation[0][1] * y + rotation[0][2] * z + parameters[3];
    const cameraY = rotation[1][0] * x + rotation[1][1] * y + rotation[1][2] * z + parameters[4];
    const cameraZ = Math.max(
      1,
      rotation[2][0] * x + rotation[2][1] * y + rotation[2][2] * z + parameters[5]
    );

    return [focalLength * cameraX / cameraZ + centerX, focalLength * cameraY / cameraZ + centerY];
  });
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivotRow][column])) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][column]) < 1e-10) return null;
    [augmented[column], augmented[pivotRow]] = [augmented[pivotRow], augmented[column]];

    const pivot = augmented[column][column];
    for (let index = column; index <= size; index += 1) {
      augmented[column][index] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let index = column; index <= size; index += 1) {
        augmented[row][index] -= factor * augmented[column][index];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function calculateResiduals(
  parameters: PoseParameters,
  observations: readonly number[],
  focalLength: number,
  centerX: number,
  centerY: number
) {
  const projected = projectPoints(parameters, focalLength, centerX, centerY);
  return projected.map((value, index) => value - observations[index]);
}

export function estimateHeadPose(
  landmarks: readonly LandmarkPoint[],
  frameWidth: number,
  frameHeight: number
): HeadPoseAngles | null {
  if (landmarks.length <= Math.max(...LANDMARK_INDICES) || frameWidth <= 0 || frameHeight <= 0) {
    return null;
  }

  const observations = LANDMARK_INDICES.flatMap((index) => [
    landmarks[index].x * frameWidth,
    landmarks[index].y * frameHeight,
  ]);
  const focalLength = Math.max(frameWidth, frameHeight);
  const centerX = frameWidth / 2;
  const centerY = frameHeight / 2;
  const parameters: PoseParameters = [0, 0, 0, 0, 0, 600];
  const parameterSteps = [1e-4, 1e-4, 1e-4, 0.1, 0.1, 0.1];

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const residuals = calculateResiduals(parameters, observations, focalLength, centerX, centerY);
    const jacobian = parameterSteps.map((step, parameterIndex) => {
      const perturbed = [...parameters] as PoseParameters;
      perturbed[parameterIndex] += step;
      const projected = calculateResiduals(perturbed, observations, focalLength, centerX, centerY);
      return projected.map((value, index) => (value - residuals[index]) / step);
    });
    const normalMatrix = Array.from({ length: 6 }, () => Array<number>(6).fill(0));
    const gradient = Array<number>(6).fill(0);

    for (let row = 0; row < 6; row += 1) {
      for (let sample = 0; sample < residuals.length; sample += 1) {
        gradient[row] += jacobian[row][sample] * residuals[sample];
        for (let column = 0; column < 6; column += 1) {
          normalMatrix[row][column] += jacobian[row][sample] * jacobian[column][sample];
        }
      }
      normalMatrix[row][row] += Math.max(normalMatrix[row][row] * 1e-6, 1e-8);
    }

    const update = solveLinearSystem(normalMatrix, gradient.map((value) => -value));
    if (!update) return null;

    let updateMagnitude = 0;
    for (let index = 0; index < 6; index += 1) {
      parameters[index] += update[index];
      updateMagnitude += update[index] * update[index];
    }
    if (parameters[5] <= 100 || parameters[5] > 3000) return null;
    if (updateMagnitude < 1e-5) break;
  }

  const [rx, ry, rz] = parameters;
  const rotation = rotationMatrix(rx, ry, rz);
  const pitch = Math.atan2(rotation[2][1], rotation[2][2]);
  const yaw = Math.atan2(-rotation[2][0], Math.hypot(rotation[2][1], rotation[2][2]));
  const roll = Math.atan2(rotation[1][0], rotation[0][0]);
  const toDegrees = (radians: number) => radians * (180 / Math.PI);

  return {
    pitch: toDegrees(pitch),
    yaw: toDegrees(yaw),
    roll: toDegrees(roll),
  };
}
