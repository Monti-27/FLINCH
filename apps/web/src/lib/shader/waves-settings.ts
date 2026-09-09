export const PIXEL_BUDGET = 2_000_000;
export const FRAME_INTERVAL = 1000 / 30;
export const TIME_SCALE = -0.727;
export const COLOR_COUNT = 4;

const palette = [[3, 28, 38], [27, 108, 168], [90, 210, 244], [234, 249, 255]];
export const COLORS = new Float32Array(Array.from({ length: 8 }, (_, index) => palette[Math.min(index, 3)]).flat().map(value => value / 255));
export const UNIFORMS = {
  u_shape: [2, 0.540, 0.470, 0.042],
  u_surface: [1.536, 1.158, 0, 1],
  u_finish: [0, 0.210, 0.002, 0.101],
  u_transform: [4012, 5.6549, 0.116, 0],
  u_space: [0.110, -0.190, 0, 0],
  u_cursor: [0, 2, 0.650, 0.460],
} as const;

export function drawingSize(width: number, height: number, dpr: number, maximum = 4096) {
  const finite = (value: number) => Number.isFinite(value) && value > 0 ? value : 1;
  const ratio = Math.min(finite(dpr), 2);
  const rawWidth = finite(width) * ratio;
  const rawHeight = finite(height) * ratio;
  const limit = finite(maximum);
  const scale = Math.min(1, limit / rawWidth, limit / rawHeight, Math.sqrt(PIXEL_BUDGET / (rawWidth * rawHeight)));
  return { width: Math.max(1, Math.floor(rawWidth * scale)), height: Math.max(1, Math.floor(rawHeight * scale)) };
}
